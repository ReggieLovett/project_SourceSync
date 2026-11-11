import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { historySettings, vectorStoreSettings } from "../lib/config";
import { AppError } from "../lib/errors";
import {
  blobHistoryStore,
  deleteHistoryEntry,
  getHistoryEntry,
  listHistory,
  saveHistoryEntry,
  type BlobApi,
} from "../lib/history";
import {
  pineconeDelete,
  pineconeFilter,
  pineconeQuery,
  pineconeUpsert,
  pineconeWaitUntilSearchable,
  type OpenNamespace,
  type PineconeDocuments,
} from "../lib/pinecone";
import { passwordMatches, siteAccess } from "../lib/site-auth";
import type { HistorySaveRequest } from "../lib/types";
import { checkResult } from "./fixtures";

// ---------- Environment helpers ----------

const ENV_KEYS = [
  "PINECONE_API_KEY", "PINECONE_INDEX", "CHROMA_HOST", "CHROMA_PORT",
  "BLOB_READ_WRITE_TOKEN", "BLOB_STORE_ID", "HISTORY_DIR", "VERCEL", "NEXT_PUBLIC_VERCEL_ENV",
] as const;
const saved = Object.fromEntries(ENV_KEYS.map((key) => [key, process.env[key]]));

function env(values: Partial<Record<(typeof ENV_KEYS)[number], string>>) {
  for (const key of ENV_KEYS) delete process.env[key];
  Object.assign(process.env, values);
}

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (saved[key] === undefined) delete process.env[key];
    else process.env[key] = saved[key];
  }
});

function basic(user: string, password: string): string {
  return `Basic ${Buffer.from(`${user}:${password}`).toString("base64")}`;
}

async function rejectsWith(promise: Promise<unknown> | (() => unknown), status: number, code: string) {
  const run = typeof promise === "function" ? async () => promise() : () => promise;
  await assert.rejects(run, (error: unknown) => {
    assert.ok(error instanceof AppError, `expected AppError, got ${String(error)}`);
    assert.equal(error.status, status);
    assert.equal(error.code, code);
    return true;
  });
}

// ---------- Site password ----------

describe("site password", () => {
  it("leaves the site open locally without a password, and refuses to run unprotected on Vercel", () => {
    assert.equal(siteAccess(null, undefined, false), "open");
    assert.equal(siteAccess(null, undefined, true), "unconfigured");
  });

  it("asks for the password until the right one is given, with any username", () => {
    assert.equal(siteAccess(null, "demo-pass", true), "challenge");
    assert.equal(siteAccess(basic("anyone", "wrong"), "demo-pass", true), "challenge");
    assert.equal(siteAccess(basic("anyone", "demo-pass"), "demo-pass", true), "allowed");
    assert.equal(siteAccess(basic("", "demo-pass"), "demo-pass", false), "allowed");
  });

  it("checks only the part after the first colon, and rejects malformed headers", () => {
    assert.ok(passwordMatches(basic("team", "pa:ss"), "pa:ss"));
    assert.ok(!passwordMatches("Bearer abc", "x"));
    assert.ok(!passwordMatches(`Basic ${Buffer.from("no-colon").toString("base64")}`, "no-colon"));
    assert.ok(!passwordMatches("Basic !!!not-base64!!!", "x"));
    assert.ok(!passwordMatches("", "x"));
  });
});

// ---------- Configuration modes ----------

describe("deployment configuration", () => {
  it("uses local Chroma by default and Pinecone when an API key is set", () => {
    env({});
    assert.equal(vectorStoreSettings().backend, "chroma");
    env({ PINECONE_API_KEY: "pc-test" });
    assert.deepEqual(vectorStoreSettings(), { backend: "pinecone", apiKey: "pc-test", index: "source-sync" });
    env({ PINECONE_API_KEY: "pc-test", PINECONE_INDEX: "my-index-2" });
    assert.deepEqual(vectorStoreSettings(), { backend: "pinecone", apiKey: "pc-test", index: "my-index-2" });
  });

  it("rejects a malformed index name, and requires Pinecone on Vercel", async () => {
    env({ PINECONE_API_KEY: "pc-test", PINECONE_INDEX: "Bad_Name" });
    await rejectsWith(() => vectorStoreSettings(), 500, "INVALID_CONFIGURATION");
    env({ VERCEL: "1" });
    await rejectsWith(() => vectorStoreSettings(), 503, "VECTOR_STORE_NOT_CONFIGURED");
  });

  it("stores History in files locally, in Blob when a store is connected, and refuses files on Vercel", async () => {
    env({});
    assert.equal(historySettings().backend, "files");
    env({ BLOB_READ_WRITE_TOKEN: "vercel_blob_rw_test" });
    assert.equal(historySettings().backend, "blob");
    env({ VERCEL: "1" });
    await rejectsWith(() => historySettings(), 503, "HISTORY_NOT_CONFIGURED");
  });
});

// ---------- History in Vercel Blob ----------

// Stand-ins for @vercel/blob's error classes; like the real ones they don't set error.name.
class BlobStoreSuspendedError extends Error {}
class BlobStoreNotFoundError extends Error {}
class BlobAccessError extends Error {}
class BlobServiceRateLimited extends Error {}
class BlobServiceNotAvailable extends Error {}

/** An in-memory stand-in for the parts of @vercel/blob the store uses (2 results per list page). */
function fakeBlob() {
  const files = new Map<string, string>();
  const getOptions: Record<string, unknown>[] = [];
  const api = {
    async put(pathname: string, body: string, options: Record<string, unknown>) {
      assert.equal(options.access, "private");
      assert.equal(options.addRandomSuffix, false);
      assert.equal(options.allowOverwrite, true);
      files.set(pathname, body);
      return { pathname };
    },
    async get(pathname: string, options: Record<string, unknown>) {
      getOptions.push(options);
      const body = files.get(pathname);
      if (body === undefined) return null;
      return { statusCode: 200, stream: new Blob([body]).stream(), headers: new Headers(), blob: {} };
    },
    async list(options: { prefix?: string; cursor?: string }) {
      const all = [...files.keys()].filter((pathname) => pathname.startsWith(options.prefix ?? "")).sort();
      const start = Number(options.cursor ?? 0);
      return {
        blobs: all.slice(start, start + 2).map((pathname) => ({ pathname })),
        hasMore: start + 2 < all.length,
        cursor: String(start + 2),
      };
    },
    async del(pathname: string) {
      files.delete(pathname);
    },
    BlobStoreSuspendedError, BlobStoreNotFoundError, BlobAccessError, BlobServiceRateLimited, BlobServiceNotAvailable,
  };
  return { files, getOptions, api: api as unknown as BlobApi };
}

const ID_A = "11111111-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const ID_B = "22222222-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const ID_C = "33333333-cccc-4ccc-8ccc-cccccccccccc";

const check: HistorySaveRequest = {
  kind: "check",
  input: { question: "What did the study find?", context: "Readmissions fell 23%.", answer: "They fell 32%.", strictnessMode: false },
  result: checkResult({
    claims: [{
      id: "c1", claim: "Readmissions fell 32%.", verdict: "Contradicted", modelVerdict: "Contradicted",
      evidence: "Readmissions fell 23%.", evidenceFound: true, literalMatch: null, confidence: 0.9,
      reasoning: "23%, not 32%.", adjustments: [],
    }],
  }),
};

describe("History in Vercel Blob", () => {
  it("saves private blobs, reads past the CDN cache, lists across pages, and deletes", async () => {
    const { files, getOptions, api } = fakeBlob();
    const store = blobHistoryStore("history/", async () => api);

    const first = await saveHistoryEntry(ID_A, check, store);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const again = await saveHistoryEntry(ID_A, check, store);
    assert.equal(again.createdAt, first.createdAt);
    assert.ok(files.has(`history/${ID_A}.json`));
    assert.ok(getOptions.every((options) => options.access === "private" && options.useCache === false));

    await saveHistoryEntry(ID_B, check, store);
    await saveHistoryEntry(ID_C, check, store);
    files.set("history/notes.txt", "not an entry");
    assert.deepEqual((await listHistory(store)).map((entry) => entry.id).sort(), [ID_A, ID_B, ID_C]);

    assert.deepEqual((await getHistoryEntry(ID_B, store)).id, ID_B);
    await deleteHistoryEntry(ID_B, store);
    assert.ok(!files.has(`history/${ID_B}.json`));
    await rejectsWith(deleteHistoryEntry(ID_B, store), 404, "HISTORY_NOT_FOUND");
    await rejectsWith(getHistoryEntry(ID_B, store), 404, "HISTORY_NOT_FOUND");
  });

  it("skips a damaged blob instead of failing the whole list", async () => {
    const { files, api } = fakeBlob();
    const store = blobHistoryStore("history/", async () => api);
    await saveHistoryEntry(ID_A, check, store);
    files.set(`history/${ID_B}.json`, "{ not json");
    assert.deepEqual((await listHistory(store)).map((entry) => entry.id), [ID_A]);
  });

  it("turns Vercel Blob failures into instructions", async () => {
    const failing = (error: Error) => blobHistoryStore("history/", async () => ({
      ...fakeBlob().api,
      get: async () => { throw error; },
    }) as BlobApi);
    await rejectsWith(getHistoryEntry(ID_A, failing(new BlobStoreSuspendedError())), 503, "HISTORY_STORE_SUSPENDED");
    await rejectsWith(getHistoryEntry(ID_A, failing(new BlobAccessError())), 503, "HISTORY_STORE_UNAVAILABLE");
  });
});

// ---------- Pinecone vector store ----------

/** An in-memory stand-in for `index.documents`: exact-match filters, fake similarity scores. */
function fakePinecone({ visibleAfterSearches = 0 } = {}) {
  const namespaces = new Map<string, Map<string, Record<string, unknown>>>();
  const calls = { upsertSizes: [] as number[], searches: [] as Array<Record<string, unknown>>, deletes: [] as object[] };
  let searchesSoFar = 0;
  const matchesFilter = (doc: Record<string, unknown>, filter?: object) =>
    !filter || Object.entries(filter).every(([key, condition]) => doc[key] === (condition as { $eq: unknown }).$eq);
  const open: OpenNamespace = async (namespace) => {
    const store = namespaces.get(namespace) ?? new Map();
    namespaces.set(namespace, store);
    const documents: PineconeDocuments = {
      async upsert({ documents: batch }) {
        calls.upsertSizes.push(batch.length);
        for (const doc of batch) store.set(doc._id, { ...doc });
        return {};
      },
      async search(options) {
        calls.searches.push(options);
        searchesSoFar++;
        if (searchesSoFar <= visibleAfterSearches) return { matches: [] };
        const hits = [...store.values()].filter((doc) => matchesFilter(doc, options.filter)).slice(0, options.topK);
        return { matches: hits.map((doc, rank) => ({ ...doc, _id: String(doc._id), _score: 0.9 - rank * 0.1 })) };
      },
      async delete({ filter }) {
        calls.deletes.push(filter);
        for (const [id, doc] of store) if (matchesFilter(doc, filter)) store.delete(id);
        return {};
      },
    };
    return documents;
  };
  return { namespaces, calls, open };
}

describe("Pinecone vector store", () => {
  const records = Array.from({ length: 100 }, (_, index) => ({
    id: `doc_aaaaaaaaaaaaaaaa:${index}`,
    document: `Chunk ${index} text.`,
    metadata: { documentId: "doc_aaaaaaaaaaaaaaaa", fileName: "study.docx", chunkIndex: index },
  }));

  it("writes documents in batches of 96 with the text in the embedded field", async () => {
    const { namespaces, calls, open } = fakePinecone();
    assert.equal(await pineconeUpsert(open, "source-sync", "uploaded_documents", records), 100);
    assert.deepEqual(calls.upsertSizes, [96, 4]);
    assert.deepEqual(namespaces.get("uploaded_documents")?.get("doc_aaaaaaaaaaaaaaaa:3"), {
      documentId: "doc_aaaaaaaaaaaaaaaa", fileName: "study.docx", chunkIndex: 3,
      _id: "doc_aaaaaaaaaaaaaaaa:3", text: "Chunk 3 text.",
    });
  });

  it("searches by meaning within one document and reports cosine distance", async () => {
    const { calls, open } = fakePinecone();
    await pineconeUpsert(open, "source-sync", "uploaded_documents", records.slice(0, 3));
    const matches = await pineconeQuery(open, "source-sync", "uploaded_documents", "What did the study find?",
      { nResults: 2, where: { documentId: "doc_aaaaaaaaaaaaaaaa" } });
    assert.deepEqual(calls.searches[0], {
      scoreBy: [{ type: "embed", field: "text", query: "What did the study find?" }],
      topK: 2,
      filter: { documentId: { $eq: "doc_aaaaaaaaaaaaaaaa" } },
      includeFields: ["*"],
    });
    assert.equal(matches.length, 2);
    assert.equal(matches[0].document, "Chunk 0 text.");
    assert.deepEqual(matches[0].metadata, { documentId: "doc_aaaaaaaaaaaaaaaa", fileName: "study.docx", chunkIndex: 0 });
    assert.ok(Math.abs((matches[0].distance ?? 0) - 0.1) < 1e-9, "distance is 1 - similarity");
  });

  it("deletes a document's chunks by filter and leaves other documents", async () => {
    const { namespaces, open } = fakePinecone();
    await pineconeUpsert(open, "source-sync", "uploaded_documents", [
      ...records.slice(0, 2),
      { id: "doc_bbbbbbbbbbbbbbbb:0", document: "Other.", metadata: { documentId: "doc_bbbbbbbbbbbbbbbb", fileName: "b.pdf", chunkIndex: 0 } },
    ]);
    await pineconeDelete(open, "source-sync", "uploaded_documents", { documentId: "doc_aaaaaaaaaaaaaaaa" });
    assert.deepEqual([...namespaces.get("uploaded_documents")!.keys()], ["doc_bbbbbbbbbbbbbbbb:0"]);
    assert.deepEqual(pineconeFilter({ documentId: "x", chunkIndex: 1 }), { documentId: { $eq: "x" }, chunkIndex: { $eq: 1 } });
  });

  it("waits until new chunks are searchable, and gives up with a clear message", async () => {
    const slow = fakePinecone({ visibleAfterSearches: 2 });
    await pineconeUpsert(slow.open, "source-sync", "uploaded_documents", records.slice(0, 1));
    await pineconeWaitUntilSearchable(slow.open, "source-sync", "uploaded_documents",
      { documentId: "doc_aaaaaaaaaaaaaaaa" }, "Chunk 0 text.", { attempts: 5, delayMs: 1 });
    assert.equal(slow.calls.searches.length, 3);

    const never = fakePinecone({ visibleAfterSearches: 99 });
    await rejectsWith(pineconeWaitUntilSearchable(never.open, "source-sync", "uploaded_documents",
      { documentId: "doc_aaaaaaaaaaaaaaaa" }, "probe", { attempts: 3, delayMs: 1 }), 504, "VECTOR_STORE_NOT_READY");
  });

  it("turns Pinecone failures into instructions", async () => {
    // Like the SDK: the class is anonymous after bundling, but error.name is set.
    const named = (name: string) => Object.assign(new Error("failed"), { name });
    const failing = (error: Error): OpenNamespace => async () => ({
      upsert: async () => { throw error; },
      search: async () => { throw error; },
      delete: async () => { throw error; },
    });
    const query = (error: Error) => pineconeQuery(failing(error), "source-sync", "uploaded_documents", "q", { nResults: 1 });
    await rejectsWith(query(named("PineconeAuthorizationError")), 503, "VECTOR_ACCESS_DENIED");
    await rejectsWith(query(named("PineconeNotFoundError")), 503, "VECTOR_INDEX_NOT_FOUND");
    await rejectsWith(query(named("PineconePaymentRequiredError")), 503, "VECTOR_QUOTA_EXCEEDED");
    await rejectsWith(query(named("PineconeConnectionError")), 503, "VECTOR_STORE_UNAVAILABLE");
  });
});
