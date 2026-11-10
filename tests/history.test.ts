import assert from "node:assert/strict";
import { mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, beforeEach, describe, it } from "node:test";
import { DELETE, GET, PUT } from "../app/api/history/[id]/route";
import { GET as LIST } from "../app/api/history/route";
import { AppError } from "../lib/errors";
import {
  deleteHistoryEntry,
  getHistoryEntry,
  historyTitle,
  listHistory,
  saveHistoryEntry,
} from "../lib/history";
import type { ChatEntry, ChatResponse, HistoryEntry, HistoryListResponse, HistorySaveRequest } from "../lib/types";
import { checkResult } from "./fixtures";

let dir: string;
const previousDir = process.env.HISTORY_DIR;

before(async () => {
  dir = await mkdtemp(path.join(tmpdir(), "source-sync-history-"));
  process.env.HISTORY_DIR = dir;
});

beforeEach(async () => {
  for (const name of await readdir(dir)) await rm(path.join(dir, name), { force: true });
});

after(async () => {
  await rm(dir, { recursive: true, force: true });
  if (previousDir === undefined) delete process.env.HISTORY_DIR;
  else process.env.HISTORY_DIR = previousDir;
});

const response: ChatResponse = {
  question: "What did the study find?",
  answer: "Readmissions fell 23%.",
  documentId: "doc_1",
  fileName: "study.pdf",
  context: [{ id: "doc_1:0", chunkIndex: 0, text: "Readmissions fell 23%.", distance: 0.2 }],
  contextText: "Readmissions fell 23%.",
  model: "test-model",
  durationMs: 12,
};

function conversation(...questions: string[]): HistorySaveRequest {
  const messages: ChatEntry[] = questions.flatMap((question): ChatEntry[] => [
    { role: "user", content: question },
    { role: "assistant", content: response.answer, response: { ...response, question } },
  ]);
  return {
    kind: "conversation",
    document: {
      documentId: "doc_1", fileName: "study.pdf", fileType: "pdf", pages: 4,
      characters: 900, chunks: 2, collection: "uploaded_documents", preview: "Readmissions…",
    },
    messages,
  };
}

const check: HistorySaveRequest = {
  kind: "check",
  input: { question: "What did the study find?", context: "Readmissions fell 23%.", answer: "They fell 32%.", strictnessMode: true },
  result: checkResult({
    strictnessMode: true,
    supportThreshold: 0.95,
    claims: [{
      id: "c1", claim: "Readmissions fell 32%.", verdict: "Contradicted", modelVerdict: "Contradicted",
      evidence: "Readmissions fell 23%.", evidenceFound: true, literalMatch: false, confidence: 0.9,
      reasoning: "23%, not 32%.", adjustments: [],
    }],
  }),
};

const ID_A = "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_B = "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb";

async function rejects(promise: Promise<unknown>, status: number, code: string) {
  await assert.rejects(promise, (error: unknown) => {
    assert.ok(error instanceof AppError, `expected AppError, got ${String(error)}`);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

describe("history store", () => {
  it("saves a conversation with a title from its first question, then lists it", async () => {
    const saved = await saveHistoryEntry(ID_A, conversation("What did the study find?", "Who funded it?"));
    assert.equal(saved.kind, "conversation");
    assert.equal(saved.title, "What did the study find?");
    assert.equal(saved.createdAt, saved.updatedAt);

    const [summary, ...rest] = await listHistory();
    assert.equal(rest.length, 0);
    assert.deepEqual(summary, {
      id: ID_A, title: "What did the study find?", createdAt: saved.createdAt, updatedAt: saved.updatedAt,
      kind: "conversation", messageCount: 4, fileName: "study.pdf",
    });
    assert.deepEqual(await getHistoryEntry(ID_A), saved);
  });

  it("keeps createdAt when a conversation is saved again, and replaces its messages", async () => {
    const first = await saveHistoryEntry(ID_A, conversation("First question"));
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await saveHistoryEntry(ID_A, conversation("First question", "Follow-up"));
    assert.equal(second.createdAt, first.createdAt);
    assert.ok(second.updatedAt > first.updatedAt);
    assert.equal((second as Extract<HistoryEntry, { kind: "conversation" }>).messages.length, 4);
    assert.equal((await listHistory()).length, 1);
  });

  it("saves a check and summarizes its verdicts, newest first", async () => {
    await saveHistoryEntry(ID_A, conversation("Older conversation"));
    await new Promise((resolve) => setTimeout(resolve, 5));
    await saveHistoryEntry(ID_B, check);

    const [newest, older] = await listHistory();
    assert.equal(newest.id, ID_B);
    assert.equal(older.id, ID_A);
    assert.equal(newest.kind, "check");
    if (newest.kind !== "check") return;
    assert.deepEqual(newest.counts, { total: 1, supported: 0, contradicted: 1, unsupported: 0 });
    assert.equal(newest.faithfulness, 0);
    assert.equal(newest.strictnessMode, true);
  });

  it("refuses IDs that are not safe file names", async () => {
    for (const id of ["../escape", "short", "a/b/c/d/e/f", "x".repeat(65), "has space 123"]) {
      await rejects(saveHistoryEntry(id, check), 400, "INVALID_HISTORY_ID");
      await rejects(getHistoryEntry(id), 400, "INVALID_HISTORY_ID");
    }
  });

  it("validates what is saved", async () => {
    await assert.rejects(saveHistoryEntry(ID_A, { kind: "conversation", document: null, messages: [] }));
    await assert.rejects(saveHistoryEntry(ID_A, {
      kind: "conversation", document: null,
      messages: [{ role: "assistant", content: "x", response }],
    }));
    await assert.rejects(saveHistoryEntry(ID_A, { kind: "check", input: check.kind === "check" ? check.input : null }));
    await assert.rejects(saveHistoryEntry(ID_A, { kind: "batch" }));
    assert.deepEqual(await listHistory(), []);
  });

  it("will not turn a saved conversation into a check", async () => {
    await saveHistoryEntry(ID_A, conversation("Question"));
    await rejects(saveHistoryEntry(ID_A, check), 409, "HISTORY_KIND_MISMATCH");
  });

  it("reports missing items as 404 and deletes saved ones", async () => {
    await rejects(getHistoryEntry(ID_A), 404, "HISTORY_NOT_FOUND");
    await rejects(deleteHistoryEntry(ID_A), 404, "HISTORY_NOT_FOUND");
    await saveHistoryEntry(ID_A, check);
    await deleteHistoryEntry(ID_A);
    await rejects(getHistoryEntry(ID_A), 404, "HISTORY_NOT_FOUND");
  });

  it("lists nothing before the folder exists, and skips files it cannot read", async () => {
    process.env.HISTORY_DIR = path.join(dir, "not-created-yet");
    assert.deepEqual(await listHistory(), []);
    process.env.HISTORY_DIR = dir;

    await saveHistoryEntry(ID_A, check);
    await writeFile(path.join(dir, `${ID_B}.json`), "{ not json");
    await writeFile(path.join(dir, "notes.txt"), "ignored");
    const entries = await listHistory();
    assert.deepEqual(entries.map((entry) => entry.id), [ID_A]);
  });

  it("shortens long titles and collapses whitespace", () => {
    assert.equal(historyTitle("  What   did\n the study find?  "), "What did the study find?");
    const long = historyTitle("word ".repeat(40));
    assert.ok(long.length <= 80);
    assert.ok(long.endsWith("…"));
    assert.equal(historyTitle("   "), "Untitled");
  });
});

describe("history API routes", () => {
  const context = (id: string) => ({ params: Promise.resolve({ id }) });
  const put = (id: string, body: unknown, type = "application/json") =>
    PUT(new Request(`http://localhost/api/history/${id}`, {
      method: "PUT",
      headers: { "content-type": type },
      body: JSON.stringify(body),
    }), context(id));

  it("saves, reads, lists, and deletes through the handlers", async () => {
    const saved = await put(ID_A, check);
    assert.equal(saved.status, 200);
    const entry = (await saved.json()) as HistoryEntry;
    assert.equal(entry.title, "What did the study find?");

    const read = await GET(new Request(`http://localhost/api/history/${ID_A}`), context(ID_A));
    assert.deepEqual(await read.json(), entry);

    const list = (await (await LIST()).json()) as HistoryListResponse;
    assert.deepEqual(list.entries.map((item) => item.id), [ID_A]);

    const deleted = await DELETE(new Request(`http://localhost/api/history/${ID_A}`, { method: "DELETE" }), context(ID_A));
    assert.deepEqual(await deleted.json(), { deleted: true, id: ID_A });
    assert.equal((await GET(new Request("http://localhost"), context(ID_A))).status, 404);
  });

  it("returns 400 for a bad ID or body, and 415 for a non-JSON body", async () => {
    const badId = await put("../../etc", check);
    assert.equal(badId.status, 400);
    assert.equal((await badId.json()).code, "INVALID_HISTORY_ID");

    const badBody = await put(ID_A, { kind: "check" });
    assert.equal(badBody.status, 400);
    assert.equal((await badBody.json()).code, "INVALID_REQUEST");

    assert.equal((await put(ID_A, check, "text/plain")).status, 415);
  });
});
