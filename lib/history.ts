// Saved conversations and checks: one JSON document per entry, stored as files in
// HISTORY_DIR (default .data/history) or, on Vercel, as private blobs in Vercel Blob.
// Server-only; the dashboard reaches it through /api/history.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { historySettings, LIMITS } from "./config";
import { AppError } from "./errors";
import type {
  ChatResponse,
  CheckResult,
  HistoryEntry,
  HistorySummary,
  SavedCheck,
  SavedConversation,
  UploadedDocument,
} from "./types";

/** IDs are client-generated UUIDs; the pattern also keeps them safe to use as file names. */
export const HISTORY_ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;

const TITLE_LENGTH = 80;

// ---------- Validation of what the dashboard saves ----------

const verdictSchema = z.enum(["Supported", "Contradicted", "Unsupported"]);

const uploadedDocumentSchema = z.object({
  documentId: z.string().min(1).max(200),
  fileName: z.string().min(1).max(500),
  fileType: z.enum(["pdf", "docx"]),
  pages: z.number().int().nonnegative().nullable(),
  characters: z.number().int().nonnegative(),
  chunks: z.number().int().nonnegative(),
  collection: z.string().max(200),
  preview: z.string().max(10_000),
}) satisfies z.ZodType<UploadedDocument>;

const chatResponseSchema = z.object({
  question: z.string().max(LIMITS.questionCharacters),
  answer: z.string().max(50_000),
  documentId: z.string().max(200).nullable(),
  fileName: z.string().max(500).nullable(),
  context: z.array(z.object({
    id: z.string().max(500),
    chunkIndex: z.number().int().nonnegative(),
    text: z.string().max(20_000),
    distance: z.number().nullable(),
  })).max(LIMITS.chatTopK.max),
  contextText: z.string().max(LIMITS.chatTopK.max * 20_000),
  model: z.string().max(200),
  durationMs: z.number().nonnegative(),
}) satisfies z.ZodType<ChatResponse>;

const chatEntrySchema = z.discriminatedUnion("role", [
  z.object({ role: z.literal("user"), content: z.string().min(1).max(LIMITS.questionCharacters) }),
  z.object({ role: z.literal("assistant"), content: z.string().max(50_000), response: chatResponseSchema }),
]);

const checkResultSchema = z.object({
  question: z.string().max(LIMITS.questionCharacters),
  answer: z.string().max(LIMITS.answerCharacters),
  contextCharacters: z.number().int().nonnegative(),
  strictnessMode: z.boolean(),
  supportThreshold: z.number().nullable(),
  claims: z.array(z.object({
    id: z.string().max(200),
    claim: z.string().max(LIMITS.answerCharacters),
    verdict: verdictSchema,
    modelVerdict: verdictSchema,
    evidence: z.string().max(LIMITS.contextCharacters),
    evidenceFound: z.boolean(),
    literalMatch: z.boolean().nullable(),
    confidence: z.number(),
    reasoning: z.string().max(10_000),
    adjustments: z.array(z.string().max(2_000)).max(20),
  })).max(LIMITS.maxClaims),
  counts: z.object({
    total: z.number().int().nonnegative(),
    supported: z.number().int().nonnegative(),
    contradicted: z.number().int().nonnegative(),
    unsupported: z.number().int().nonnegative(),
  }),
  metrics: z.object({
    faithfulness: z.number().nullable(),
    answerRelevance: z.number(),
    contextRelevance: z.number(),
    answerRelevanceReason: z.string().max(5_000),
    contextRelevanceReason: z.string().max(5_000),
  }),
  model: z.string().max(200),
  durationMs: z.number().nonnegative(),
}) satisfies z.ZodType<CheckResult>;

/** Body of PUT /api/history/[id]. */
export const historySaveSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("conversation"),
    document: uploadedDocumentSchema.nullable(),
    messages: z.array(chatEntrySchema)
      .min(1, "A conversation needs at least one message.")
      .max(LIMITS.historyMessages)
      .refine((messages) => messages.some((message) => message.role === "user"), "A conversation needs a question."),
  }),
  z.object({
    kind: z.literal("check"),
    input: z.object({
      question: z.string().trim().min(1, "Question is required.").max(LIMITS.questionCharacters),
      context: z.string().min(1, "Context is required.").max(LIMITS.contextCharacters),
      answer: z.string().trim().min(1, "Answer is required.").max(LIMITS.answerCharacters),
      strictnessMode: z.boolean(),
    }),
    result: checkResultSchema,
  }),
]);

// ---------- Storage ----------

export function assertHistoryId(id: string): void {
  if (!HISTORY_ID_PATTERN.test(id)) {
    throw new AppError(400, "INVALID_HISTORY_ID", "History IDs are 8 to 64 letters, digits, hyphens, or underscores.");
  }
}

function notFound(): AppError {
  return new AppError(404, "HISTORY_NOT_FOUND", "That saved item no longer exists. It may have been deleted.");
}

/** First line of the first question, collapsed and shortened for list rows. */
export function historyTitle(text: string): string {
  const line = text.replace(/\s+/g, " ").trim();
  if (!line) return "Untitled";
  return line.length > TITLE_LENGTH ? `${line.slice(0, TITLE_LENGTH - 1).trimEnd()}…` : line;
}

/** Where saved items live: JSON files on this computer, or private blobs in Vercel Blob. */
export interface HistoryStore {
  read(id: string): Promise<HistoryEntry | null>;
  write(entry: HistoryEntry): Promise<void>;
  /** False when there was nothing to delete. */
  remove(id: string): Promise<boolean>;
  /** Every readable entry; unreadable ones are skipped with a warning, not fatal. */
  readAll(): Promise<HistoryEntry[]>;
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
}

function skipUnreadable(name: string, error: unknown): void {
  console.warn(`[history] skipping unreadable ${name}:`, error instanceof Error ? error.message : error);
}

/** One `<id>.json` file per entry in `dir`; writes go beside the target and are renamed into place. */
export function fileHistoryStore(dir: string): HistoryStore {
  const fileFor = (id: string) => path.join(dir, `${id}.json`);
  async function readFileEntry(file: string): Promise<HistoryEntry | null> {
    try {
      return JSON.parse(await readFile(file, "utf8")) as HistoryEntry;
    } catch (error) {
      if (isMissing(error)) return null;
      throw error;
    }
  }
  return {
    read: (id) => readFileEntry(fileFor(id)),
    async write(entry) {
      await mkdir(dir, { recursive: true });
      // A crash mid-write leaves only the temporary file, never a half-written entry.
      const temporary = `${fileFor(entry.id)}.${randomUUID()}.tmp`;
      await writeFile(temporary, JSON.stringify(entry), "utf8");
      await rename(temporary, fileFor(entry.id));
    },
    async remove(id) {
      try {
        await rm(fileFor(id));
        return true;
      } catch (error) {
        if (isMissing(error)) return false;
        throw error;
      }
    },
    async readAll() {
      let names: string[];
      try {
        names = await readdir(dir);
      } catch (error) {
        if (isMissing(error)) return [];
        throw error;
      }
      const entries: HistoryEntry[] = [];
      for (const name of names) {
        if (!name.endsWith(".json") || !HISTORY_ID_PATTERN.test(name.slice(0, -5))) continue;
        try {
          const entry = await readFileEntry(path.join(dir, name));
          if (entry) entries.push(entry);
        } catch (error) {
          skipUnreadable(name, error);
        }
      }
      return entries;
    },
  };
}

/** The part of @vercel/blob this store uses; tests pass an in-memory stand-in. */
export type BlobApi = Pick<
  typeof import("@vercel/blob"),
  | "put" | "get" | "list" | "del"
  | "BlobStoreSuspendedError" | "BlobStoreNotFoundError" | "BlobAccessError"
  | "BlobServiceRateLimited" | "BlobServiceNotAvailable"
>;

const BLOB_READ_CONCURRENCY = 6;

/**
 * Turn Vercel Blob failures into messages that say what to do in the Vercel dashboard.
 * Blob errors don't set error.name and production bundles minify class names, so
 * they are matched with instanceof against the library's own classes.
 */
function blobError(error: unknown, api: BlobApi | undefined): AppError {
  if (error instanceof AppError) return error;
  if (api && error instanceof api.BlobStoreSuspendedError) {
    return new AppError(503, "HISTORY_STORE_SUSPENDED", "Vercel has paused this Blob store, usually because the free plan's monthly limit was reached. History will work again when the limit resets.");
  }
  if (api && (error instanceof api.BlobStoreNotFoundError || error instanceof api.BlobAccessError)) {
    return new AppError(503, "HISTORY_STORE_UNAVAILABLE", "Vercel could not open the Blob store for History. Check that a private Blob store is connected to this project, then redeploy.");
  }
  if (api && (error instanceof api.BlobServiceRateLimited || error instanceof api.BlobServiceNotAvailable)) {
    return new AppError(503, "HISTORY_STORE_BUSY", "Vercel Blob is busy. Retry in a moment.");
  }
  console.error("[history] Vercel Blob error", error);
  return new AppError(503, "HISTORY_STORE_ERROR", "Saving or loading History in Vercel Blob failed. Check the Vercel function logs.");
}

/**
 * One private blob per entry at `<prefix><id>.json`. Reads skip the CDN cache
 * (`useCache: false`) because conversations are overwritten in place as they grow.
 */
export function blobHistoryStore(prefix: string, loadApi: () => Promise<BlobApi> = () => import("@vercel/blob")): HistoryStore {
  const pathFor = (id: string) => `${prefix}${id}.json`;
  async function guarded<T>(task: (api: BlobApi) => Promise<T>): Promise<T> {
    let api: BlobApi | undefined;
    try {
      api = await loadApi();
      return await task(api);
    } catch (error) {
      throw blobError(error, api);
    }
  }
  async function readBlob(api: BlobApi, pathname: string): Promise<HistoryEntry | null> {
    const result = await api.get(pathname, { access: "private", useCache: false });
    if (!result || result.statusCode !== 200 || !result.stream) return null;
    return JSON.parse(await new Response(result.stream).text()) as HistoryEntry;
  }
  async function pathnames(api: BlobApi): Promise<string[]> {
    const found: string[] = [];
    let cursor: string | undefined;
    do {
      const page = await api.list({ prefix, cursor, limit: 1000 });
      found.push(...page.blobs.map((blob) => blob.pathname));
      cursor = page.hasMore ? page.cursor : undefined;
    } while (cursor);
    return found.filter((pathname) => {
      const name = pathname.slice(prefix.length);
      return name.endsWith(".json") && HISTORY_ID_PATTERN.test(name.slice(0, -5));
    });
  }
  return {
    read: (id) => guarded((api) => readBlob(api, pathFor(id))),
    write: (entry) => guarded(async (api) => {
      await api.put(pathFor(entry.id), JSON.stringify(entry), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/json",
      });
    }),
    remove: (id) => guarded(async (api) => {
      const target = pathFor(id);
      if (!(await pathnames(api)).includes(target)) return false;
      await api.del(target);
      return true;
    }),
    readAll: () => guarded(async (api) => {
      const queue = await pathnames(api);
      const entries: HistoryEntry[] = [];
      const worker = async () => {
        for (let next = queue.shift(); next !== undefined; next = queue.shift()) {
          try {
            const entry = await readBlob(api, next);
            if (entry) entries.push(entry);
          } catch (error) {
            skipUnreadable(next, error);
          }
        }
      };
      await Promise.all(Array.from({ length: BLOB_READ_CONCURRENCY }, worker));
      return entries;
    }),
  };
}

/** The store this deployment is configured for (see historySettings). */
export function historyStore(): HistoryStore {
  const settings = historySettings();
  return settings.backend === "blob" ? blobHistoryStore(settings.prefix) : fileHistoryStore(path.resolve(settings.dir));
}

// ---------- Operations ----------

/** Create or replace a saved item. Keeps the original createdAt when the item already exists. */
export async function saveHistoryEntry(id: string, body: unknown, store: HistoryStore = historyStore()): Promise<HistoryEntry> {
  assertHistoryId(id);
  const input = historySaveSchema.parse(body);
  const existing = await store.read(id);
  if (existing && existing.kind !== input.kind) {
    throw new AppError(409, "HISTORY_KIND_MISMATCH", `That ID already holds a saved ${existing.kind}.`);
  }
  const now = new Date().toISOString();
  const createdAt = existing?.createdAt ?? now;

  let entry: HistoryEntry;
  if (input.kind === "conversation") {
    const firstQuestion = input.messages.find((message) => message.role === "user")?.content ?? "";
    entry = {
      kind: "conversation", id, title: historyTitle(firstQuestion), createdAt, updatedAt: now,
      document: input.document, messages: input.messages,
    } satisfies SavedConversation;
  } else {
    entry = {
      kind: "check", id, title: historyTitle(input.input.question), createdAt, updatedAt: now,
      input: input.input, result: input.result,
    } satisfies SavedCheck;
  }
  await store.write(entry);
  return entry;
}

export async function getHistoryEntry(id: string, store: HistoryStore = historyStore()): Promise<HistoryEntry> {
  assertHistoryId(id);
  const entry = await store.read(id);
  if (!entry) throw notFound();
  return entry;
}

export async function deleteHistoryEntry(id: string, store: HistoryStore = historyStore()): Promise<void> {
  assertHistoryId(id);
  if (!(await store.remove(id))) throw notFound();
}

export function summarizeHistoryEntry(entry: HistoryEntry): HistorySummary {
  const base = { id: entry.id, title: entry.title, createdAt: entry.createdAt, updatedAt: entry.updatedAt };
  return entry.kind === "conversation"
    ? { ...base, kind: "conversation", messageCount: entry.messages.length, fileName: entry.document?.fileName ?? null }
    : {
        ...base,
        kind: "check",
        counts: entry.result.counts,
        faithfulness: entry.result.metrics.faithfulness,
        strictnessMode: entry.input.strictnessMode,
      };
}

/** Every saved item, most recently updated first. */
export async function listHistory(store: HistoryStore = historyStore()): Promise<HistorySummary[]> {
  const entries = await store.readAll();
  return entries.map(summarizeHistoryEntry).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
