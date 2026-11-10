// Saved conversations and checks: one JSON file per entry in HISTORY_DIR
// (default .data/history). Server-only; the dashboard reaches it through /api/history.
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

function historyDir(): string {
  return path.resolve(historySettings().dir);
}

function entryFile(id: string): string {
  assertHistoryId(id);
  return path.join(historyDir(), `${id}.json`);
}

function isMissing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException | null)?.code === "ENOENT";
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

async function readEntry(file: string): Promise<HistoryEntry | null> {
  try {
    return JSON.parse(await readFile(file, "utf8")) as HistoryEntry;
  } catch (error) {
    if (isMissing(error)) return null;
    throw error;
  }
}

/** Create or replace a saved item. Keeps the original createdAt when the item already exists. */
export async function saveHistoryEntry(id: string, body: unknown): Promise<HistoryEntry> {
  const file = entryFile(id);
  const input = historySaveSchema.parse(body);
  const existing = await readEntry(file);
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

  // Write beside the target and rename, so a crash never leaves a half-written entry.
  await mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.${randomUUID()}.tmp`;
  await writeFile(temporary, JSON.stringify(entry), "utf8");
  await rename(temporary, file);
  return entry;
}

export async function getHistoryEntry(id: string): Promise<HistoryEntry> {
  const entry = await readEntry(entryFile(id));
  if (!entry) throw notFound();
  return entry;
}

export async function deleteHistoryEntry(id: string): Promise<void> {
  try {
    await rm(entryFile(id));
  } catch (error) {
    if (isMissing(error)) throw notFound();
    throw error;
  }
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

/** Every saved item, most recently updated first. Unreadable files are skipped, not fatal. */
export async function listHistory(): Promise<HistorySummary[]> {
  let names: string[];
  try {
    names = await readdir(historyDir());
  } catch (error) {
    if (isMissing(error)) return [];
    throw error;
  }
  const summaries: HistorySummary[] = [];
  for (const name of names) {
    if (!name.endsWith(".json") || !HISTORY_ID_PATTERN.test(name.slice(0, -5))) continue;
    try {
      const entry = await readEntry(path.join(historyDir(), name));
      if (entry) summaries.push(summarizeHistoryEntry(entry));
    } catch (error) {
      console.warn(`[history] skipping unreadable ${name}:`, error instanceof Error ? error.message : error);
    }
  }
  return summaries.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}
