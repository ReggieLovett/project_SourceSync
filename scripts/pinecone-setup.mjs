// One-time setup: create the Pinecone index Source Sync uses (npm run pinecone:setup).
// Reads PINECONE_API_KEY and PINECONE_INDEX (default "source-sync") from .env.local.
// The field and model must match lib/pinecone.ts (PINECONE_TEXT_FIELD, PINECONE_EMBED_MODEL).
import nextEnv from "@next/env";
import { Pinecone } from "@pinecone-database/pinecone";

const TEXT_FIELD = "text";
const EMBED_MODEL = "llama-text-embed-v2";

nextEnv.loadEnvConfig(process.cwd());
const apiKey = process.env.PINECONE_API_KEY?.trim();
const name = process.env.PINECONE_INDEX?.trim() || "source-sync";

if (!apiKey) {
  console.error("Set PINECONE_API_KEY in .env.local first (Pinecone console → API Keys), then run this again.");
  process.exit(1);
}

const pinecone = new Pinecone({ apiKey });

try {
  console.log(`Creating Pinecone index "${name}" (or reusing it if it exists)…`);
  // The Starter (free) plan only allows serverless indexes on AWS us-east-1.
  await pinecone.indexes.create({
    name,
    deployment: { deploymentType: "managed", cloud: "aws", region: "us-east-1" },
    schema: {
      fields: {
        // Pinecone embeds this field with a hosted model on write and at search time.
        [TEXT_FIELD]: { type: "string", storeText: true, embed: { model: EMBED_MODEL, metric: "cosine" } },
      },
    },
    waitUntilReady: true,
    suppressConflicts: true,
  });

  const index = await pinecone.indexes.describe(name);
  const field = index?.schema?.fields?.[TEXT_FIELD];
  const model = field?.embed?.model ?? field?.model;
  console.log(`Ready: ${index.name}`);
  if (index.host) console.log(`  host:   ${index.host}`);
  if (index.status?.state) console.log(`  status: ${index.status.state}`);
  if (field && model && model !== EMBED_MODEL) {
    console.warn(`  Warning: field "${TEXT_FIELD}" is embedded with ${model}, not ${EMBED_MODEL}. Search still works, but results differ from the tested setup.`);
  } else if (index.schema && !field) {
    console.error(`  This index has no "${TEXT_FIELD}" field. It was probably created another way.`);
    console.error(`  Delete it in the Pinecone console (or set PINECONE_INDEX to a new name) and run this again.`);
    process.exit(1);
  }
  console.log(`\nDone. Keep PINECONE_API_KEY${process.env.PINECONE_INDEX ? " and PINECONE_INDEX" : ""} in .env.local, and add the same values in Vercel.`);
} catch (error) {
  const kind = error?.name ?? "Error";
  if (kind === "PineconeAuthorizationError") {
    console.error("Pinecone rejected the API key. Copy it again from the Pinecone console (API Keys).");
  } else if (kind === "PineconePaymentRequiredError" || /quota|limit/i.test(String(error?.message))) {
    console.error("Pinecone refused to create the index because of a plan limit (the free plan allows 5 indexes).");
  } else {
    console.error(`Could not create the index (${kind}): ${error?.message ?? error}`);
  }
  process.exit(1);
}
