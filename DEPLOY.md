# Deploying Source Sync to Vercel

Source Sync runs on your laptop with a local Chroma server and History saved as files. On Vercel, three pieces move to hosted services. The app picks them up from environment variables, so no code changes are needed:

| Piece | On your laptop | On Vercel |
| --- | --- | --- |
| Vector database and embeddings | Local Chroma (`npm run chroma:start`) and a local embedding model | **Pinecone** (`PINECONE_API_KEY`), which also computes the embeddings |
| History | JSON files in `.data/history/` | **Vercel Blob** (a private store connected to the project) |
| Access | Open (only your computer can reach it) | **Password** (`SITE_PASSWORD`), required |
| AI | Groq (`GROQ_API_KEY`) | Groq (`GROQ_API_KEY`) |

The sidebar shows which vector database is in use: **ChromaDB** or **Pinecone**.

## What it costs

A demo fits in the free tiers:

- **Pinecone Starter:** free. It allows 5 indexes (Source Sync uses 1), 2 GB of storage, and 5 million embedding tokens a month per model (10 million until December 31, 2026). Starter indexes run on AWS us-east-1 only; the setup script picks that region for you. A 4 MB PDF is a few hundred thousand tokens at most, so a demo uses a small fraction of the allowance.
- **Vercel Hobby:** free, for personal, non-commercial projects. Each request may run up to 300 seconds, and request bodies are capped at 4.5 MB on every plan.
- **Vercel Blob:** free on Hobby within its usage limits. If you exceed them you aren't charged; Blob is paused for 30 days instead.
- **Groq:** your existing free key (8,000 tokens per minute and 1,000 requests per day on the current key).

## Step 1: Get a Pinecone API key

1. Sign up at [app.pinecone.io](https://app.pinecone.io/). You start on the free Starter plan.
2. Open **API Keys** in the left menu. Copy the default key, or create one and copy it. Keep it somewhere safe; it is shown in full only once.

## Step 2: Create the index from your laptop

Source Sync needs one Pinecone index whose `text` field Pinecone embeds with its hosted `llama-text-embed-v2` model. A script creates it with the right settings.

1. Add the key to `.env.local` in the project folder:
   ```
   PINECONE_API_KEY=your-key
   ```
2. Run the setup script once:
   ```bash
   npm run pinecone:setup
   ```
   It prints `Ready: source-sync` and `Done.` when the index exists. Running it again is safe: it reuses the index.

The index is named `source-sync`. To use another name, set `PINECONE_INDEX` in `.env.local` before running the script, and add the same `PINECONE_INDEX` in Vercel in Step 4.

## Step 3 (recommended): Try Pinecone from your laptop

This catches typos before anything is public.

1. Restart `npm run dev`. You no longer need `npm run chroma:start`: with `PINECONE_API_KEY` set, the app uses Pinecone. The sidebar now says **Pinecone**.
2. Upload `demo-study.docx` in Chat and ask a question. If it answers with excerpts, Pinecone works. The upload takes a few seconds longer than with local Chroma, because the app waits until Pinecone can search the new document.

To go back to local Chroma, delete or comment out `PINECONE_API_KEY` and restart. Documents uploaded in one mode aren't visible in the other.

## Step 4: Put the code on GitHub

Vercel publishes the `main` branch of `ReggieLovett/project_SourceSync`. Commit your work on `main`, then push it:

```bash
git push origin main
```

`.env.local` is gitignored, so your keys stay on your laptop.

## Step 5: Create the Vercel project

1. Sign in to [vercel.com](https://vercel.com/) with GitHub.
2. Click **Add New → Project** and import **ReggieLovett/project_SourceSync**. Vercel detects Next.js; keep the default build settings.
3. Open **Environment Variables** and add:

   | Name | Value |
   | --- | --- |
   | `GROQ_API_KEY` | your Groq key |
   | `PINECONE_API_KEY` | from Step 1 |
   | `SITE_PASSWORD` | a password you'll share with your team and panel |

   Add `PINECONE_INDEX` only if you changed the index name in Step 2. Optional: `GROQ_CHAT_MODEL`, `GROQ_CHECKER_MODEL`, `GROQ_REASONING_EFFORT` (see `.env.example`).
4. Click **Deploy**. The first build takes a few minutes.

## Step 6: Add Vercel Blob for History

1. In the project, open the **Storage** tab and create a **Blob** store. If Vercel asks about access, choose **Private**.
2. Connect it to the project for all environments. Vercel adds `BLOB_READ_WRITE_TOKEN` automatically.
3. Redeploy so the new variable takes effect: **Deployments**, open the latest one's **⋯** menu, then **Redeploy**.

## Step 7: Test the live site

1. Open your `….vercel.app` URL. The browser asks you to sign in: type any username and your `SITE_PASSWORD`.
2. Check that the sidebar says **Pinecone**.
3. In Chat, upload `demo-study.docx` and ask a question.
4. Send the answer to the checker and run it.
5. In Batch check, run `demo-batch.json` with **Concurrency 1**.
6. Open History; the chat and checks should be listed.

If something fails, open the project in Vercel, then **Logs**, and see the table below.

## Limits on Vercel

- **Uploads:** up to 4 MB per file (20 MB locally). The app tells you before uploading if a file is too big.
- **Long requests:** each request stops at 300 seconds. With the current Groq key, keep batches to about 10 items or fewer.
- **First request after idle:** can take a few extra seconds while Vercel starts the function.
- **Data doesn't carry over:** documents in your local Chroma and History in `.data/history/` stay on your laptop. Documents you upload while testing in Step 3 are already in Pinecone, so the live site can use them too.

## If something goes wrong

| What you see | Fix |
| --- | --- |
| "This deployment has no SITE_PASSWORD" | Add `SITE_PASSWORD` in Environment Variables, then redeploy. |
| "This deployment has no vector database" (`VECTOR_STORE_NOT_CONFIGURED`) | Add `PINECONE_API_KEY`, then redeploy. |
| "Pinecone rejected the API key" (`VECTOR_ACCESS_DENIED`) | Copy the key again from the Pinecone console, update it in Vercel, and redeploy. |
| "Pinecone has no index named …" (`VECTOR_INDEX_NOT_FOUND`) | Run `npm run pinecone:setup` (Step 2), or set `PINECONE_INDEX` to your index's name. |
| "Pinecone rejected the request" (`VECTOR_REQUEST_REJECTED`) | The index wasn't created by the setup script. Delete it in the Pinecone console and run `npm run pinecone:setup` again. |
| "Pinecone's usage limit was reached" (`VECTOR_QUOTA_EXCEEDED`) | The free plan's monthly allowance is used up. Check **Usage** in the Pinecone console; it resets monthly. |
| "…isn't searchable yet" (`VECTOR_STORE_NOT_READY`) | Pinecone was slow to index the upload. Wait a few seconds, then ask your question. |
| "Cannot reach Pinecone" (`VECTOR_STORE_UNAVAILABLE`, `VECTOR_STORE_TIMEOUT`) | Retry in a moment. |
| "History needs a Vercel Blob store" (`HISTORY_NOT_CONFIGURED`) | Do Step 6, then redeploy. |
| "Vercel has paused this Blob store" (`HISTORY_STORE_SUSPENDED`) | The free Blob limit was reached; it resets after 30 days. |
| "GROQ_API_KEY is not set" | Add `GROQ_API_KEY`, then redeploy. |
| A batch stops with a timeout | Run fewer items per batch, and use Concurrency 1. |
| `FUNCTION_PAYLOAD_TOO_LARGE` | The request was over Vercel's 4.5 MB limit. Use a smaller file or batch. |

## How the deployment is built

For anyone maintaining this:

- `lib/config.ts`: `vectorStoreSettings()` picks Pinecone when `PINECONE_API_KEY` is set, otherwise local Chroma; `historySettings()` uses Vercel Blob when `BLOB_READ_WRITE_TOKEN` (or `BLOB_STORE_ID`) is set. On Vercel, both refuse to fall back to local mode, with a message saying what to configure.
- `lib/vector-store.ts`: one interface (upsert, query, delete, wait until searchable) over `lib/chroma.ts` and `lib/pinecone.ts`. A Chroma collection maps to a Pinecone namespace with the same name (`uploaded_documents`, `hf_test_contexts`) in one index.
- `lib/pinecone.ts`: uses the Pinecone SDK's documents API (`@pinecone-database/pinecone` 9.1.0, pinned). Pinecone embeds the `text` field with `llama-text-embed-v2` on write and at search time; scores (cosine similarity) are reported as cosine distance. Upserts go in batches of 96. Because Pinecone is eventually consistent, an upload waits until one of its chunks is searchable. Errors are mapped by the SDK's `error.name`, which survives minification.
- `scripts/pinecone-setup.mjs`: creates the index (serverless, AWS us-east-1, cosine) and checks its `text` field.
- `lib/history.ts`: `blobHistoryStore` keeps one private blob per item and reads with `useCache: false`, so conversations updated in place are never served stale.
- `proxy.ts` and `lib/site-auth.ts`: HTTP Basic auth on every page and API route when `SITE_PASSWORD` is set. On Vercel it is required.
- `next.config.mjs`: leaves the local ONNX embedding stack (about 350 MB, over Vercel's 250 MB function limit) out of deployments. Routes package to about 91 MB.
- `app/api/batch-check/route.ts`: `maxDuration` is 300 seconds, the Hobby maximum.

Verified before release: unit tests for the Pinecone backend (batching, search options, filters, score conversion, the readiness wait, error mapping) against a fake client; the setup script reaching Pinecone with a test key; and a standalone production build (which packages only traced files, as Vercel does) that served the password prompt, labelled the sidebar Pinecone, reached Pinecone with the packaged SDK, and returned each configuration error above. A real Pinecone index, a real Vercel deployment, and a real Blob store have not been tested yet.
