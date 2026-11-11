// One interface over the two vector databases: local Chroma (the default, `npm run
// chroma:start`) and Pinecone (when PINECONE_API_KEY is set; required on Vercel).
// A "collection" is a Chroma collection or a Pinecone namespace.
import * as chroma from "./chroma";
import { vectorStoreSettings } from "./config";
import {
  pineconeDelete,
  pineconeNamespaces,
  pineconeQuery,
  pineconeUpsert,
  pineconeWaitUntilSearchable,
} from "./pinecone";

export type VectorMetadata = Record<string, string | number | boolean>;
export type VectorRecord = { id: string; document: string; metadata: VectorMetadata };
export type VectorMatch = { id: string; document: string; metadata: VectorMetadata; distance: number | null };
/** Equality on every key, e.g. `{ documentId: "doc_…" }`. */
export type VectorWhere = Record<string, string | number | boolean>;

/** Store records; stable IDs make re-imports idempotent. */
export async function upsertRecords(collection: string, records: VectorRecord[], signal?: AbortSignal): Promise<number> {
  const settings = vectorStoreSettings();
  if (settings.backend === "pinecone") {
    return pineconeUpsert(pineconeNamespaces(settings.apiKey, settings.index), settings.index, collection, records, signal);
  }
  return chroma.upsertRecords(collection, records, signal);
}

/** The `nResults` records closest in meaning to `text`, most similar first. */
export async function queryCollection(
  collection: string,
  text: string,
  options: { nResults: number; where?: VectorWhere },
  signal?: AbortSignal,
): Promise<VectorMatch[]> {
  const settings = vectorStoreSettings();
  if (settings.backend === "pinecone") {
    return pineconeQuery(pineconeNamespaces(settings.apiKey, settings.index), settings.index, collection, text, options, signal);
  }
  return (await chroma.queryCollection(collection, text, options, signal)) as VectorMatch[];
}

export async function deleteRecords(collection: string, where: VectorWhere, signal?: AbortSignal): Promise<void> {
  const settings = vectorStoreSettings();
  if (settings.backend === "pinecone") {
    return pineconeDelete(pineconeNamespaces(settings.apiKey, settings.index), settings.index, collection, where, signal);
  }
  return chroma.deleteRecords(collection, where, signal);
}

/**
 * Wait until just-written records matching `where` are searchable. Chroma is
 * immediately consistent; Pinecone takes a moment, so this polls with `probe`
 * (the text of one written record).
 */
export async function waitUntilSearchable(collection: string, where: VectorWhere, probe: string, signal?: AbortSignal): Promise<void> {
  const settings = vectorStoreSettings();
  if (settings.backend !== "pinecone") return;
  await pineconeWaitUntilSearchable(pineconeNamespaces(settings.apiKey, settings.index), settings.index, collection, where, probe, { signal });
}
