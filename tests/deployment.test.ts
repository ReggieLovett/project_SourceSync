import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { chromaSettings, historySettings } from "../lib/config";
import { AppError } from "../lib/errors";
import {
  blobHistoryStore,
  deleteHistoryEntry,
  getHistoryEntry,
  listHistory,
  saveHistoryEntry,
  type BlobApi,
} from "../lib/history";
import { passwordMatches, siteAccess } from "../lib/site-auth";
import type { HistorySaveRequest } from "../lib/types";
import { checkResult } from "./fixtures";

// ---------- Environment helpers ----------

const ENV_KEYS = [
  "CHROMA_API_KEY", "CHROMA_TENANT", "CHROMA_DATABASE", "CHROMA_HOST", "CHROMA_PORT",
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
  it("uses local Chroma by default and Chroma Cloud when an API key is set", () => {
    env({});
    assert.equal(chromaSettings().mode, "local");
    env({ CHROMA_API_KEY: "ck-test", CHROMA_TENANT: "tenant-1", CHROMA_DATABASE: "source-sync" });
    const settings = chromaSettings();
    assert.equal(settings.mode, "cloud");
    if (settings.mode === "cloud") assert.deepEqual([settings.tenant, settings.database], ["tenant-1", "source-sync"]);
  });

  it("explains what is missing for Chroma Cloud, and on Vercel without it", async () => {
    env({ CHROMA_API_KEY: "ck-test" });
    await rejectsWith(() => chromaSettings(), 500, "INVALID_CONFIGURATION");
    env({ VERCEL: "1" });
    await rejectsWith(() => chromaSettings(), 503, "CHROMA_NOT_CONFIGURED");
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
    class BlobStoreSuspendedError extends Error {}
    class BlobAccessError extends Error {}
    const failing = (error: Error) => blobHistoryStore("history/", async () => ({
      ...fakeBlob().api,
      get: async () => { throw error; },
    }) as BlobApi);
    await rejectsWith(getHistoryEntry(ID_A, failing(new BlobStoreSuspendedError())), 503, "HISTORY_STORE_SUSPENDED");
    await rejectsWith(getHistoryEntry(ID_A, failing(new BlobAccessError())), 503, "HISTORY_STORE_UNAVAILABLE");
  });
});
