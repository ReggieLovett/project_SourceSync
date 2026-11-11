import { AppError } from "./errors";

// Llama 3.x 70B models have been retired on Groq; gpt-oss-120b is the strongest
// generally available text model. Override with GROQ_CHAT_MODEL / GROQ_CHECKER_MODEL.
export const DEFAULT_GROQ_MODEL = "openai/gpt-oss-120b";

function text(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function integer(name: string, fallback: number, min: number, max: number): number {
  const raw = text(name);
  const value = raw === undefined ? fallback : Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new AppError(500, "INVALID_CONFIGURATION", `${name} must be an integer from ${min} to ${max}.`);
  }
  return value;
}

export function groqSettings() {
  const shared = text("GROQ_MODEL");
  return {
    apiKey: text("GROQ_API_KEY"),
    chatModel: text("GROQ_CHAT_MODEL") ?? shared ?? DEFAULT_GROQ_MODEL,
    checkerModel: text("GROQ_CHECKER_MODEL") ?? shared ?? DEFAULT_GROQ_MODEL,
    timeoutMs: integer("GROQ_TIMEOUT_MS", 60_000, 1_000, 600_000),
    /** Retries for timeouts, network errors, and 5xx responses. */
    maxRetries: integer("GROQ_MAX_RETRIES", 2, 0, 6),
    /** Total time one request may spend waiting out 429 rate limits. */
    rateLimitWaitMs: integer("GROQ_RATE_LIMIT_WAIT_MS", 90_000, 0, 600_000),
  };
}

const COLLECTION_NAME = /^[a-zA-Z0-9][a-zA-Z0-9._-]{1,61}[a-zA-Z0-9]$/;

function collectionName(name: string, fallback: string): string {
  const value = text(name) ?? fallback;
  if (!COLLECTION_NAME.test(value)) {
    throw new AppError(500, "INVALID_CONFIGURATION", `${name} must be 3-63 letters, digits, dots, underscores, or hyphens.`);
  }
  return value;
}

/**
 * True on Vercel. NEXT_PUBLIC_VERCEL_ENV is set by Vercel for Next.js builds and is
 * inlined into the browser bundle; VERCEL covers the server at runtime.
 */
export function isHosted(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL);
}

export type ChromaSettings =
  | { mode: "local"; host: string; port: number; documentsCollection: string; hfCollection: string }
  | { mode: "cloud"; apiKey: string; tenant: string; database: string; documentsCollection: string; hfCollection: string };

/**
 * Local Chroma (npm run chroma:start) unless CHROMA_API_KEY is set, which switches to
 * Chroma Cloud. Cloud mode also embeds with Chroma Cloud's hosted Qwen model, so the
 * deployment never loads the local ONNX embedding stack.
 */
export function chromaSettings(): ChromaSettings {
  const collections = {
    documentsCollection: collectionName("CHROMA_DOCUMENTS_COLLECTION", "uploaded_documents"),
    hfCollection: collectionName("CHROMA_HF_COLLECTION", "hf_test_contexts"),
  };
  const apiKey = text("CHROMA_API_KEY");
  if (apiKey) {
    const tenant = text("CHROMA_TENANT");
    const database = text("CHROMA_DATABASE");
    if (!tenant || !database) {
      throw new AppError(500, "INVALID_CONFIGURATION", "Chroma Cloud needs CHROMA_TENANT and CHROMA_DATABASE as well as CHROMA_API_KEY. All three are shown in the Chroma Cloud dashboard.");
    }
    return { mode: "cloud", apiKey, tenant, database, ...collections };
  }
  if (isHosted()) {
    throw new AppError(503, "CHROMA_NOT_CONFIGURED", "This deployment has no Chroma database. Set CHROMA_API_KEY, CHROMA_TENANT, and CHROMA_DATABASE in the Vercel project's environment variables, then redeploy.");
  }
  return { mode: "local", host: text("CHROMA_HOST") ?? "localhost", port: integer("CHROMA_PORT", 8000, 1, 65_535), ...collections };
}

/**
 * Saved conversations and checks: Vercel Blob when a store is connected to the
 * deployment (it sets BLOB_READ_WRITE_TOKEN), otherwise JSON files in HISTORY_DIR.
 * Vercel's own disk is read-only and temporary, so hosted History needs Blob.
 */
export function historySettings():
  | { backend: "files"; dir: string }
  | { backend: "blob"; prefix: string } {
  if (text("BLOB_READ_WRITE_TOKEN") || text("BLOB_STORE_ID")) return { backend: "blob", prefix: "history/" };
  if (isHosted()) {
    throw new AppError(503, "HISTORY_NOT_CONFIGURED", "History needs a Vercel Blob store on this deployment. In Vercel, open Storage, create a private Blob store, connect it to this project, and redeploy.");
  }
  return { backend: "files", dir: text("HISTORY_DIR") ?? ".data/history" };
}

export const LIMITS = {
  /** Vercel rejects request bodies over 4.5 MB on every plan, so hosted uploads stop at 4 MB. */
  uploadBytes: (isHosted() ? 4 : 20) * 1024 * 1024,
  documentCharacters: 2_000_000,
  questionCharacters: 4_000,
  answerCharacters: 20_000,
  contextCharacters: 60_000,
  chatMessages: 50,
  chatTopK: { min: 1, max: 10, default: 5 },
  batchItems: 50,
  batchConcurrency: { min: 1, max: 5, default: 2 },
  hfRows: { max: 50, default: 10 },
  maxClaims: 40,
  /** One saved conversation or check, as JSON (a full 60,000-character context fits easily). */
  historyEntryBytes: 2 * 1024 * 1024,
  /** Messages kept in one saved conversation (the chat API accepts up to `chatMessages` of history). */
  historyMessages: 120,
} as const;

/** Confidence a claim needs in Healthcare (strict) mode to stay "Supported". */
export const STRICT_SUPPORT_THRESHOLD = 0.95;
