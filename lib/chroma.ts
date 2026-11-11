import path from "node:path";
import type { FeatureExtractionPipeline } from "@huggingface/transformers";
import type { Collection, EmbeddingFunction, Metadata, Where } from "chromadb";
import { chromaSettings, type ChromaSettings } from "./config";
import { AppError, cancelledError } from "./errors";

const EMBED_BATCH_SIZE = 32;
const CHROMA_TIMEOUT_MS = 30_000;

export type ChromaRecord = { id: string; document: string; metadata: Metadata };
export type ChromaMatch = { id: string; document: string; metadata: Metadata; distance: number | null };

type ChromaModule = typeof import("chromadb");
let chromaModule: Promise<ChromaModule> | undefined;

/**
 * Load chromadb at runtime instead of bundling it: it imports
 * `@chroma-core/${name}` packages dynamically, which Turbopack can neither
 * bundle nor trace (it tries to compile every file in those packages).
 */
function loadChroma(): Promise<ChromaModule> {
  chromaModule ??= import(/* webpackIgnore: true */ "chromadb");
  return chromaModule;
}

let localEmbedding: Promise<EmbeddingFunction> | undefined;
let cloudEmbedding: { apiKey: string; ef: Promise<EmbeddingFunction> } | undefined;

/** Local default embeddings, or Chroma Cloud's hosted Qwen model when CHROMA_API_KEY is set. */
export function embeddingFunction(settings: ChromaSettings = chromaSettings()): Promise<EmbeddingFunction> {
  return settings.mode === "cloud" ? cloudEmbeddingFunction(settings.apiKey) : defaultEmbeddingFunction();
}

// Qwen embeddings take a task instruction for queries; documents are embedded as-is.
// Wording follows the retrieval prompts in Qwen3-Embedding's evaluation set.
const QWEN_TASK = "document_qa";
const QWEN_QUERY_INSTRUCTION = "Given a question, retrieve passages from a document that answer the question";

/** Chroma Cloud's hosted Qwen3-Embedding-0.6B: embeddings are computed on Chroma's servers. */
function cloudEmbeddingFunction(apiKey: string): Promise<EmbeddingFunction> {
  if (cloudEmbedding?.apiKey !== apiKey) {
    cloudEmbedding = {
      apiKey,
      ef: (async () => {
        // webpackIgnore for the same reason as chromadb above; next.config.mjs lists the
        // package in outputFileTracingIncludes so deployments still ship it.
        const { ChromaCloudQwenEmbeddingFunction, ChromaCloudQwenEmbeddingModel, ChromaCloudQwenEmbeddingTarget } =
          await import(/* webpackIgnore: true */ "@chroma-core/chroma-cloud-qwen") as typeof import("@chroma-core/chroma-cloud-qwen");
        return new ChromaCloudQwenEmbeddingFunction({
          model: ChromaCloudQwenEmbeddingModel.QWEN3_EMBEDDING_0p6B,
          task: QWEN_TASK,
          instructions: {
            [QWEN_TASK]: {
              [ChromaCloudQwenEmbeddingTarget.DOCUMENTS]: "",
              [ChromaCloudQwenEmbeddingTarget.QUERY]: QWEN_QUERY_INSTRUCTION,
            },
          },
          apiKeyEnvVar: "CHROMA_API_KEY",
        });
      })(),
    };
  }
  return cloudEmbedding.ef;
}

/**
 * Chroma's DefaultEmbeddingFunction (Xenova/all-MiniLM-L6-v2, fp32, mean
 * pooling, normalized), run locally through Transformers.js. The subclass only
 * keeps one ONNX session alive instead of reloading the model on every
 * generate() call; its name and config are unchanged, so collections record
 * Chroma's "default" embedding function.
 */
export function defaultEmbeddingFunction(): Promise<EmbeddingFunction> {
  localEmbedding ??= (async () => {
    // Imported lazily so routes that never embed don't load onnxruntime.
    const [{ DefaultEmbeddingFunction }, transformers] = await Promise.all([
      import("@chroma-core/default-embed"),
      import("@huggingface/transformers"),
    ]);
    transformers.env.cacheDir = path.join(process.cwd(), ".cache", "transformers");
    // pipeline()'s overloads are too large for TypeScript to infer here.
    const createExtractor = transformers.pipeline as unknown as (
      task: "feature-extraction",
      model: string | undefined,
      options: { revision?: string; dtype?: unknown },
    ) => Promise<FeatureExtractionPipeline>;

    class ReusableDefaultEmbeddingFunction extends DefaultEmbeddingFunction {
      private extractor?: Promise<FeatureExtractionPipeline>;

      async generate(texts: string[]): Promise<number[][]> {
        const { model_name, revision, dtype } = this.getConfig();
        this.extractor ??= createExtractor("feature-extraction", model_name, { revision, dtype });
        let extractor: FeatureExtractionPipeline;
        try {
          extractor = await this.extractor;
        } catch {
          this.extractor = undefined;
          throw new AppError(503, "EMBEDDING_MODEL_UNAVAILABLE", "Could not load Chroma's default embedding model (all-MiniLM-L6-v2). The first run downloads about 90 MB into .cache/transformers; check your internet connection and retry.");
        }
        const output = await extractor(texts, { pooling: "mean", normalize: true });
        return output.tolist() as number[][];
      }
    }
    return new ReusableDefaultEmbeddingFunction();
  })();
  return localEmbedding;
}

/**
 * Embed texts in batches. `purpose: "query"` uses the embedding function's query mode
 * where it has one (Chroma Cloud's Qwen adds its retrieval instruction).
 */
export async function embedTexts(
  texts: string[],
  signal?: AbortSignal,
  purpose: "documents" | "query" = "documents",
): Promise<number[][]> {
  const settings = chromaSettings();
  const ef = await embeddingFunction(settings);
  const vectors: number[][] = [];
  for (let start = 0; start < texts.length; start += EMBED_BATCH_SIZE) {
    if (signal?.aborted) throw cancelledError();
    const batch = texts.slice(start, start + EMBED_BATCH_SIZE);
    try {
      vectors.push(...await (purpose === "query" && ef.generateForQueries ? ef.generateForQueries(batch) : ef.generate(batch)));
    } catch (error) {
      if (error instanceof AppError || settings.mode === "local") throw error;
      // Chroma's embedding API errors can echo request text, so they are not passed through.
      throw new AppError(503, "CHROMA_EMBEDDING_FAILED", "Chroma Cloud could not create embeddings. Check CHROMA_API_KEY and that your Chroma Cloud account still has credits.");
    }
  }
  return vectors;
}

function chromaError(chroma: ChromaModule, error: unknown, settings: ChromaSettings, timedOut: boolean): AppError {
  if (error instanceof AppError) return error;
  const cloud = settings.mode === "cloud";
  const where = cloud ? "Chroma Cloud" : `ChromaDB at http://${settings.host}:${settings.port}`;
  // The SDK reports aborted fetches as connection errors, so check our timer first.
  if (timedOut) {
    return new AppError(504, "CHROMA_TIMEOUT", `${where} did not respond within ${CHROMA_TIMEOUT_MS / 1000} s. ${cloud ? "Retry in a moment." : "Check the Chroma terminal and retry."}`);
  }
  if (error instanceof chroma.ChromaConnectionError) {
    return new AppError(503, "CHROMA_UNAVAILABLE", cloud
      ? "Cannot reach Chroma Cloud. Check the internet connection and retry."
      : `Cannot reach ${where}. Start it with "npm run chroma:start" and keep that terminal open.`);
  }
  if (error instanceof chroma.ChromaUnauthorizedError || error instanceof chroma.ChromaForbiddenError) {
    return new AppError(503, "CHROMA_ACCESS_DENIED", cloud
      ? "Chroma Cloud rejected the credentials. Check CHROMA_API_KEY, CHROMA_TENANT, and CHROMA_DATABASE."
      : `${where} denied access. Check the server's authentication settings.`);
  }
  if (error instanceof chroma.ChromaQuotaExceededError) {
    return new AppError(503, "CHROMA_QUOTA_EXCEEDED", "Chroma Cloud's usage limit was reached. Check the account's plan and credits.");
  }
  if (error instanceof chroma.ChromaNotFoundError || error instanceof chroma.InvalidCollectionError) {
    return new AppError(409, "CHROMA_COLLECTION_ERROR", cloud
      ? "The Chroma Cloud database or collection was not found. Check CHROMA_DATABASE and the CHROMA_*_COLLECTION settings."
      : "The Chroma collection is missing or invalid. Check the CHROMA_*_COLLECTION settings.");
  }
  if (error instanceof chroma.ChromaClientError || error instanceof chroma.ChromaValueError || error instanceof chroma.InvalidArgumentError) {
    // SDK messages can echo document text, so they are not passed through.
    return new AppError(502, "CHROMA_REQUEST_REJECTED", "ChromaDB rejected the request (invalid IDs, metadata, or embedding dimensions).");
  }
  if (error instanceof chroma.ChromaServerError) {
    return new AppError(502, "CHROMA_SERVER_ERROR", cloud
      ? "Chroma Cloud reported a server error. Retry in a moment."
      : "ChromaDB reported a server error. Check the Chroma terminal and free disk space.");
  }
  if (error instanceof chroma.ChromaRateLimitError) {
    return new AppError(503, "CHROMA_BUSY", `${where} is busy. Retry in a moment.`);
  }
  return new AppError(500, "CHROMA_ERROR", cloud
    ? "The Chroma Cloud operation failed. Check the Vercel function logs."
    : "The ChromaDB operation failed. Check the Chroma terminal output.");
}

/**
 * Run one operation against a collection that records its embedding function: the local
 * default model, or Chroma Cloud's Qwen. Cloud collections use the SPANN index, local
 * ones HNSW; both measure cosine distance.
 */
export async function withCollection<T>(
  name: string,
  operation: (collection: Collection) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) throw cancelledError();
  const settings = chromaSettings();
  const [chroma, ef] = await Promise.all([loadChroma(), embeddingFunction(settings)]);
  const timeout = AbortSignal.timeout(CHROMA_TIMEOUT_MS);
  const fetchOptions: RequestInit = { signal: signal ? AbortSignal.any([signal, timeout]) : timeout };
  const client = settings.mode === "cloud"
    ? new chroma.CloudClient({ apiKey: settings.apiKey, tenant: settings.tenant, database: settings.database, fetchOptions })
    : new chroma.ChromaClient({ host: settings.host, port: settings.port, ssl: false, fetchOptions });
  try {
    const collection = await client.getOrCreateCollection({
      name,
      embeddingFunction: ef,
      configuration: settings.mode === "cloud" ? { spann: { space: "cosine" } } : { hnsw: { space: "cosine" } },
    });
    return await operation(collection);
  } catch (error) {
    if (signal?.aborted) throw cancelledError();
    throw chromaError(chroma, error, settings, timeout.aborted);
  }
}

/** Embed (batched), then upsert; stable IDs make re-imports idempotent. */
export async function upsertRecords(collection: string, records: ChromaRecord[], signal?: AbortSignal): Promise<number> {
  for (let start = 0; start < records.length; start += EMBED_BATCH_SIZE) {
    const batch = records.slice(start, start + EMBED_BATCH_SIZE);
    const embeddings = await embedTexts(batch.map((record) => record.document), signal);
    await withCollection(collection, (handle) => handle.upsert({
      ids: batch.map((record) => record.id),
      documents: batch.map((record) => record.document),
      metadatas: batch.map((record) => record.metadata),
      embeddings,
    }), signal);
  }
  return records.length;
}

export async function queryCollection(
  collection: string,
  text: string,
  options: { nResults: number; where?: Where },
  signal?: AbortSignal,
): Promise<ChromaMatch[]> {
  const [embedding] = await embedTexts([text], signal, "query");
  return withCollection(collection, async (handle) => {
    const result = await handle.query({
      queryEmbeddings: [embedding],
      nResults: options.nResults,
      where: options.where,
      include: ["documents", "metadatas", "distances"],
    });
    return (result.ids[0] ?? []).map((id, index) => ({
      id,
      document: result.documents[0]?.[index] ?? "",
      metadata: result.metadatas[0]?.[index] ?? {},
      distance: result.distances[0]?.[index] ?? null,
    }));
  }, signal);
}

export async function deleteRecords(collection: string, where: Where, signal?: AbortSignal): Promise<void> {
  await withCollection(collection, (handle) => handle.delete({ where }), signal);
}
