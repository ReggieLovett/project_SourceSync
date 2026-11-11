// Pinecone backend for the vector store (used when PINECONE_API_KEY is set; required
// on Vercel). The index is a document index whose `text` field Pinecone embeds with a
// hosted model on write and at search time, so this app never computes embeddings.
// Create it once with `npm run pinecone:setup`.
import type { Pinecone } from "@pinecone-database/pinecone";
import { AppError, cancelledError } from "./errors";
import type { VectorMatch, VectorRecord, VectorWhere } from "./vector-store";

/** The embedded field and model; scripts/pinecone-setup.mjs creates the index with the same values. */
export const PINECONE_TEXT_FIELD = "text";
export const PINECONE_EMBED_MODEL = "llama-text-embed-v2";

/** Pinecone embeds at most 96 documents per upsert request. */
const UPSERT_BATCH_SIZE = 96;
const PINECONE_TIMEOUT_MS = 30_000;

type SearchMatch = { _id: string; _score: number | null; [field: string]: unknown };

/** The part of `index.documents` this backend uses; tests pass a fake. */
export type PineconeDocuments = {
  upsert(options: { documents: Array<{ _id: string; [field: string]: unknown }> }): Promise<unknown>;
  search(options: {
    scoreBy: Array<{ type: string; field?: string; query?: string }>;
    topK: number;
    filter?: object;
    includeFields?: string[];
  }): Promise<{ matches: SearchMatch[] }>;
  delete(options: { filter: object }): Promise<unknown>;
};

/** Opens one namespace of the configured index. */
export type OpenNamespace = (namespace: string) => Promise<PineconeDocuments>;

let client: { apiKey: string; pinecone: Promise<Pinecone> } | undefined;

export function pineconeNamespaces(apiKey: string, indexName: string): OpenNamespace {
  if (client?.apiKey !== apiKey) {
    client = {
      apiKey,
      pinecone: import("@pinecone-database/pinecone").then(({ Pinecone }) => new Pinecone({ apiKey })),
    };
  }
  const pinecone = client.pinecone;
  return async (namespace) => (await pinecone).index({ name: indexName, namespace }).documents as unknown as PineconeDocuments;
}

/** `{ documentId: "x" }` → `{ documentId: { $eq: "x" } }`, Pinecone's filter syntax. */
export function pineconeFilter(where: VectorWhere): object {
  return Object.fromEntries(Object.entries(where).map(([key, value]) => [key, { $eq: value }]));
}

function describeIndexError(error: unknown, indexName: string): AppError {
  if (error instanceof AppError) return error;
  // The SDK sets error.name (e.g. "PineconeAuthorizationError"). Constructor names
  // can't be used: production bundles minify them.
  switch ((error as Error | null)?.name) {
    case "PineconeAuthorizationError":
      return new AppError(503, "VECTOR_ACCESS_DENIED", "Pinecone rejected the API key. Check PINECONE_API_KEY.");
    case "PineconeNotFoundError":
    case "PineconeUnableToResolveHostError":
      return new AppError(503, "VECTOR_INDEX_NOT_FOUND", `Pinecone has no index named "${indexName}". Run "npm run pinecone:setup" once, or set PINECONE_INDEX to your index's name.`);
    case "PineconePaymentRequiredError":
      return new AppError(503, "VECTOR_QUOTA_EXCEEDED", "Pinecone's usage limit was reached (the free plan's monthly allowance). Check usage in the Pinecone console.");
    case "PineconeBadRequestError":
    case "PineconeUnprocessableEntityError":
    case "PineconePayloadTooLargeError":
    case "PineconeArgumentError":
      // Pinecone messages can echo document text, so they are not passed through.
      return new AppError(502, "VECTOR_REQUEST_REJECTED", `Pinecone rejected the request. Check that "${indexName}" was created by "npm run pinecone:setup" (a document index with an embedded "${PINECONE_TEXT_FIELD}" field).`);
    case "PineconeConnectionError":
    case "PineconeRequestError":
    case "PineconeUnavailableError":
    case "PineconeInternalServerError":
    case "PineconeMaxRetriesExceededError":
    case "PineconeTimeoutError":
      return new AppError(503, "VECTOR_STORE_UNAVAILABLE", "Cannot reach Pinecone right now. Retry in a moment.");
    default:
      console.error("[pinecone] unexpected error", error);
      return new AppError(500, "VECTOR_STORE_ERROR", "The Pinecone operation failed. Check the server logs.");
  }
}

/** Run one Pinecone call with a timeout, the caller's cancellation, and readable errors. */
async function call<T>(indexName: string, task: () => Promise<T>, signal?: AbortSignal): Promise<T> {
  if (signal?.aborted) throw cancelledError();
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new AppError(504, "VECTOR_STORE_TIMEOUT", `Pinecone did not respond within ${PINECONE_TIMEOUT_MS / 1000} s. Retry in a moment.`)), PINECONE_TIMEOUT_MS);
  });
  const cancelled = new Promise<never>((_, reject) => signal?.addEventListener("abort", () => reject(cancelledError()), { once: true }));
  try {
    return await Promise.race([task(), timeout, cancelled]);
  } catch (error) {
    throw describeIndexError(error, indexName);
  } finally {
    clearTimeout(timer);
  }
}

export async function pineconeUpsert(
  open: OpenNamespace, indexName: string, namespace: string, records: VectorRecord[], signal?: AbortSignal,
): Promise<number> {
  const documents = await call(indexName, () => open(namespace), signal);
  for (let start = 0; start < records.length; start += UPSERT_BATCH_SIZE) {
    const batch = records.slice(start, start + UPSERT_BATCH_SIZE);
    await call(indexName, () => documents.upsert({
      documents: batch.map((record) => ({ ...record.metadata, _id: record.id, [PINECONE_TEXT_FIELD]: record.document })),
    }), signal);
  }
  return records.length;
}

export async function pineconeQuery(
  open: OpenNamespace, indexName: string, namespace: string, text: string,
  options: { nResults: number; where?: VectorWhere }, signal?: AbortSignal,
): Promise<VectorMatch[]> {
  const documents = await call(indexName, () => open(namespace), signal);
  const result = await call(indexName, () => documents.search({
    scoreBy: [{ type: "embed", field: PINECONE_TEXT_FIELD, query: text }],
    topK: options.nResults,
    filter: options.where ? pineconeFilter(options.where) : undefined,
    includeFields: ["*"],
  }), signal);
  return result.matches.map(({ _id, _score, [PINECONE_TEXT_FIELD]: chunk, ...metadata }) => ({
    id: _id,
    document: typeof chunk === "string" ? chunk : "",
    metadata: metadata as VectorRecord["metadata"],
    // Pinecone scores cosine similarity (higher is closer); the app reports cosine distance.
    distance: _score === null ? null : 1 - _score,
  }));
}

export async function pineconeDelete(
  open: OpenNamespace, indexName: string, namespace: string, where: VectorWhere, signal?: AbortSignal,
): Promise<void> {
  const documents = await call(indexName, () => open(namespace), signal);
  await call(indexName, () => documents.delete({ filter: pineconeFilter(where) }), signal);
}

/**
 * Pinecone is eventually consistent: new records take a moment to become searchable.
 * Poll a search for one just-written chunk so a question asked right after an upload
 * doesn't report the document as missing.
 */
export async function pineconeWaitUntilSearchable(
  open: OpenNamespace, indexName: string, namespace: string, where: VectorWhere, probe: string,
  { attempts = 15, delayMs = 1_000, signal }: { attempts?: number; delayMs?: number; signal?: AbortSignal } = {},
): Promise<void> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    const matches = await pineconeQuery(open, indexName, namespace, probe, { nResults: 1, where }, signal);
    if (matches.length > 0) return;
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, delayMs));
  }
  throw new AppError(504, "VECTOR_STORE_NOT_READY", "The document was saved to Pinecone but isn't searchable yet. Wait a few seconds, then ask your question.");
}
