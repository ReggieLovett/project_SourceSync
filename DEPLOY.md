# Deploying Source Sync to Vercel

Source Sync runs on your laptop with a local Chroma server and History saved as files. On Vercel, three pieces move to hosted services. The app picks them up from environment variables, so no code changes are needed:

| Piece | On your laptop | On Vercel |
| --- | --- | --- |
| Vector database and embeddings | Local Chroma (`npm run chroma:start`) and a local embedding model | **Chroma Cloud** (`CHROMA_API_KEY`), which also computes the embeddings |
| History | JSON files in `.data/history/` | **Vercel Blob** (a private store connected to the project) |
| Access | Open (only your computer can reach it) | **Password** (`SITE_PASSWORD`), required |
| AI | Groq (`GROQ_API_KEY`) | Groq (`GROQ_API_KEY`) |

## What it costs

A demo fits in the free tiers:

- **Vercel Hobby:** free, for personal, non-commercial projects. Each request may run up to 300 seconds, and request bodies are capped at 4.5 MB on every plan.
- **Chroma Cloud Starter:** free, with $5 of credits for new accounts. A demo's documents and searches use cents; check usage in the Chroma dashboard after the first day, because Chroma's pages don't list the price of hosted embeddings.
- **Vercel Blob:** free on Hobby within its usage limits. If you exceed them you aren't charged; Blob is paused for 30 days instead.
- **Groq:** your existing free key (8,000 tokens per minute and 1,000 requests per day on the current key).

## Step 1: Set up Chroma Cloud

1. Sign up at [trychroma.com](https://www.trychroma.com/).
2. Create a database, for example `source-sync`.
3. Create an API key.
4. Copy three values somewhere safe: the **API key**, your **tenant ID**, and the **database name**. The dashboard's connection snippet shows all three.

## Step 2 (recommended): Try Chroma Cloud from your laptop first

This catches typos before anything is public.

1. Add the three values to `.env.local`:
   ```
   CHROMA_API_KEY=your-key
   CHROMA_TENANT=your-tenant-id
   CHROMA_DATABASE=source-sync
   ```
2. Restart `npm run dev`. You no longer need `npm run chroma:start`: with `CHROMA_API_KEY` set, the app uses Chroma Cloud and its hosted embeddings.
3. Upload `demo-study.docx` in Chat and ask a question. If it answers with excerpts, Chroma Cloud works.

To go back to local Chroma, delete or comment out `CHROMA_API_KEY` and restart. Documents uploaded in one mode aren't visible in the other: the two use different databases and different embedding models.

## Step 3: Put the code on `main`

Vercel publishes the `main` branch as the live site. From the project folder:

```bash
git switch main
```

```bash
git merge source-sync-redesign
```

```bash
git push origin main
```

## Step 4: Create the Vercel project

1. Sign in to [vercel.com](https://vercel.com/) with GitHub.
2. Click **Add New → Project** and import **ReggieLovett/project_SourceSync**. Vercel detects Next.js; keep the default build settings.
3. Open **Environment Variables** and add:

   | Name | Value |
   | --- | --- |
   | `GROQ_API_KEY` | your Groq key |
   | `CHROMA_API_KEY` | from Step 1 |
   | `CHROMA_TENANT` | from Step 1 |
   | `CHROMA_DATABASE` | from Step 1 |
   | `SITE_PASSWORD` | a password you'll share with your team and panel |

   Optional: `GROQ_CHAT_MODEL`, `GROQ_CHECKER_MODEL`, `GROQ_REASONING_EFFORT` (see `.env.example`).
4. Click **Deploy**. The first build takes a few minutes.

## Step 5: Add Vercel Blob for History

1. In the project, open the **Storage** tab and create a **Blob** store. If Vercel asks about access, choose **Private**.
2. Connect it to the project for all environments. Vercel adds `BLOB_READ_WRITE_TOKEN` automatically.
3. Redeploy so the new variable takes effect: **Deployments**, open the latest one's **⋯** menu, then **Redeploy**.

## Step 6: Test the live site

1. Open your `….vercel.app` URL. The browser asks you to sign in: type any username and your `SITE_PASSWORD`.
2. In Chat, upload `demo-study.docx` and ask a question.
3. Send the answer to the checker and run it.
4. In Batch check, run `demo-batch.json` with **Concurrency 1**.
5. Open History; the chat and checks should be listed.

If something fails, open the project in Vercel, then **Logs**, and see the table below.

## Limits on Vercel

- **Uploads:** up to 4 MB per file (20 MB locally). The app tells you before uploading if a file is too big.
- **Long requests:** each request stops at 300 seconds. With the current Groq key, keep batches to about 10 items or fewer.
- **First request after idle:** can take a few extra seconds while Vercel starts the function.
- **Data doesn't carry over:** documents in your local Chroma and History in `.data/history/` stay on your laptop.

## If something goes wrong

| What you see | Fix |
| --- | --- |
| "This deployment has no SITE_PASSWORD" | Add `SITE_PASSWORD` in Environment Variables, then redeploy. |
| "This deployment has no Chroma database" (`CHROMA_NOT_CONFIGURED`) | Add `CHROMA_API_KEY`, `CHROMA_TENANT`, and `CHROMA_DATABASE`, then redeploy. |
| "Chroma Cloud rejected the credentials" (`CHROMA_ACCESS_DENIED`) | One of the three Chroma values is wrong. Copy them again from the Chroma dashboard. |
| "Chroma Cloud could not create embeddings" (`CHROMA_EMBEDDING_FAILED`) | Check `CHROMA_API_KEY`, and that the Chroma account still has credits. |
| "History needs a Vercel Blob store" (`HISTORY_NOT_CONFIGURED`) | Do Step 5, then redeploy. |
| "Vercel has paused this Blob store" (`HISTORY_STORE_SUSPENDED`) | The free Blob limit was reached; it resets after 30 days. |
| "GROQ_API_KEY is not set" | Add `GROQ_API_KEY`, then redeploy. |
| A batch stops with a timeout | Run fewer items per batch, and use Concurrency 1. |
| `FUNCTION_PAYLOAD_TOO_LARGE` | The request was over Vercel's 4.5 MB limit. Use a smaller file or batch. |

## How the deployment is built

For anyone maintaining this:

- `lib/config.ts`: `chromaSettings()` switches to Chroma Cloud when `CHROMA_API_KEY` is set; `historySettings()` uses Vercel Blob when `BLOB_READ_WRITE_TOKEN` (or `BLOB_STORE_ID`) is set. On Vercel, both refuse to fall back to local mode, with a message saying what to configure.
- `lib/chroma.ts`: Chroma Cloud uses `CloudClient` and Chroma's hosted `Qwen3-Embedding-0.6B` (`@chroma-core/chroma-cloud-qwen`), with a retrieval instruction for questions. Cloud collections use the SPANN index; local ones use HNSW. Both use cosine distance.
- `lib/history.ts`: `blobHistoryStore` keeps one private blob per item and reads with `useCache: false`, so conversations updated in place are never served stale.
- `proxy.ts` and `lib/site-auth.ts`: HTTP Basic auth on every page and API route when `SITE_PASSWORD` is set. On Vercel it is required.
- `next.config.mjs`: leaves the local ONNX embedding stack (about 350 MB, over Vercel's 250 MB function limit) out of deployments, and explicitly includes `chromadb` and the Qwen package, which are loaded with `webpackIgnore` imports. The Chroma routes package to about 93 MB.
- `app/api/batch-check/route.ts`: `maxDuration` is 300 seconds, the Hobby maximum.

Verified before release: a standalone production build (which packages only traced files, as Vercel does) served the password prompt, reached Chroma Cloud with the packaged `chromadb`, loaded the Qwen package, and returned each configuration error above. A real deployment with real Chroma Cloud and Blob credentials has not been run yet.
