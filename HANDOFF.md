# Handoff

Updated 2026-11-01. The project was rebuilt into the "AI Chatbot & RAG Hallucination Checker" platform. See `README.md` for setup, architecture, the API, and configuration.

## What changed

- Replaced the old SQuAD-knowledge-base chat (`lib/rag/*`, `/api/rag`, `/api/verify`, `/api/batch`, the styled UI and its components, the CLI scripts, and the 127 old tests) with the new modules: document chatbot, verification engine, Hugging Face importer, batch checking, and CSV export.
- A pre-rebuild snapshot, including the old uncommitted work, is at `../backups/RAG-halu-pre-rebuild-2026-11-01.tar.gz`. It excludes `node_modules`, `.chroma`, and caches. Earlier states are also in git history.
- New dependencies: `groq-sdk` (the official package; `@groq/groq-sdk` does not exist on npm), `pdf-parse` 2.x, `mammoth`, `@chroma-core/default-embed`, and `jszip` (a dev dependency for test fixtures).
- The UI started as raw HTML with no CSS, as the original spec required. At the user's later request, it now has one stylesheet, `app/globals.css`. On 2026-11-09 the app was renamed **Source Sync**, given a logo (the Sync seal + SOURCE SYNC wordmark, edited in Canva as "Source Sync logo" and exported to `app/assets/source-sync-logo.png`; the seal alone is the favicon, `app/icon.svg`), and restyled as a modern rendition of Ghost of Tsushima's UI: crisp controls, Zen Kaku Gothic New / Shippori Mincho via `next/font` in `app/layout.tsx` (`preload: false`; the old CSS `@import` of Google Fonts was being dropped by the bundler), and verdict seals that stamp in once per result (`data-fresh` in `CheckResultView.tsx`). Product facts live in `PRODUCT.md`, design rules in `DESIGN.md`. It targets only elements and `data-*` hooks (no classes or inline styles), so a full UI design can replace it. Without it, verdicts still read through 🟢/🔴/🟡 markers.
- tsconfig target went from `es5` to `ES2022`. The broken `next lint` script was removed, because Next 16 has no lint command.

## Verified on 2026-11-01

- `npm run typecheck`, `npm test` (42 passing), and `npm run build` all pass.
- Live with local Chroma and Groq `openai/gpt-oss-120b`:
  - PDF and DOCX upload returned 201. The first upload took 18 s while it downloaded the embedding model; later uploads take about 0.2 s.
  - `.txt`, a fake `.pdf`, a missing file, and a JSON body were rejected with 415/422/400/415.
  - Chat gave grounded answers in about 1–2 s and refused an out-of-document question. Bad and unknown document IDs returned 400/404.
  - The checker scored the chat answer 100%. The readmissions example (32% claimed vs. 23% in the context) came out Contradicted with the exact evidence quote.
  - Batch runs: `examples/batch-input.json` (3 items, all three verdicts, 50% overall faithfulness) and imported HaluEval rows. The hallucinated "First for Women" answer was flagged.
  - Hugging Face import auto-detected SQuAD (`plain_text`/`validation`) and HaluEval `qa_samples`, and embedded the contexts into `hf_test_contexts`.
  - With Chroma stopped, upload and chat returned a 503 telling the user to start Chroma, and the HF import still returned its items with `embedding.status: "failed"`.
  - In the browser: upload → chat → Send to Checker → Run check, then HF import → batch → CSV download (correct content, UTF-8 BOM). No console errors.

## Follow-up, same day: literal-match gate and design

- Healthcare Mode now asks the verifier for `literalMatch` (placed before `confidence` in the strict schema). Supported needs `literalMatch: true` and confidence ≥ 0.95. Each failed criterion is noted in `adjustments`, and `ClaimCheck.literalMatch` is null in standard mode.
- Live result: "10 mg/kg roughly three times daily" and "about 40 mg/kg" (against "every 8 hours" and "40 mg per kilogram") were flagged non-literal and downgraded, where the threshold alone had let them through. The literal claim "412 adults at hospitals in Ohio" stayed Supported (0.97), so there was no over-blocking in this test.
- Added the Claude-inspired stylesheet, checked at desktop and 375 px phone width (no horizontal overflow, no console errors). `npm run typecheck`, `npm test` (43 passing), and `npm run build` pass.

## Follow-up: app layout

- The single scrolling page is now a sidebar app with four modes: Chat, Hallucination checker, Hugging Face import, and Batch check. Modes stay mounted, so switching keeps their state.
- Chat works without a file; `documentId` is optional on `/api/chat`. Files attach with the + button or by dropping them on the chat, and the composer stays pinned at the bottom.
- The checker has an "Upload file for context" button at the top, backed by the new `POST /api/extract`, which extracts text without storing it.
- Verified in the browser: plain chat, drag-and-drop attach, document chat, Send to checker (switches mode), upload for context, and the HF → Batch hand-off, at desktop and phone width. Typecheck, 43 tests, and the build pass.

## Follow-up, 2026-11-10: History

- New **History** mode. Chat saves the whole conversation after every answer (one entry per conversation, updated in place; **New chat** starts a new one). The checker saves each completed check, pasted or sent from chat, as its own entry. History lists both, newest first, and can reopen or delete them.
- Storage is one JSON file per item in `HISTORY_DIR` (default `.data/history/`, gitignored), written atomically. `lib/history.ts` validates every save with zod; routes are `app/api/history/route.ts` and `app/api/history/[id]/route.ts`.
- Saves from one chat tab are queued, because in testing two quick answers raced (the first save waited on dev-mode route compilation) and an older copy could have landed last.
- Verified with 11 new tests (54 total), typecheck, build, and in the browser at 1280x800 and 375px with stubbed chat/check responses: autosave, reopen into Chat and the checker, delete with confirmation, and the forced save race.

## Follow-up, 2026-11-11: Vercel deployment support

- The app now runs on Vercel without code changes, configured by environment variables. `DEPLOY.md` has the step-by-step guide, costs, and troubleshooting.
- `CHROMA_API_KEY` (+ `CHROMA_TENANT`, `CHROMA_DATABASE`) switches to Chroma Cloud with its hosted Qwen embeddings (`@chroma-core/chroma-cloud-qwen` 0.1.12). History uses a private Vercel Blob store when `BLOB_READ_WRITE_TOKEN` is set (`@vercel/blob` 2.8.2, pinned). `proxy.ts` adds a site password (`SITE_PASSWORD`, required on Vercel). Batch `maxDuration` is now 300 s (Hobby maximum). Hosted uploads are capped at 4 MB, checked in the browser.
- `next.config.mjs` excludes the ~350 MB ONNX embedding stack from deployments and explicitly includes `chromadb` and the Qwen package (both loaded via `webpackIgnore`). Chroma routes trace to about 93 MB (limit 250 MB).
- Verified: 63 tests (9 new), typecheck, build, and a temporary standalone build run with fake credentials: password prompt, packaged `chromadb` and Qwen loading, Chroma Cloud reached and its rejection mapped, and each missing-configuration message. Local dev mode is unchanged. Not yet verified: a real Vercel deployment with real Chroma Cloud and Blob credentials.

## Follow-up, 2026-11-11: Pinecone instead of Chroma Cloud

- Deployments now use Pinecone, replacing the Chroma Cloud mode described above (`CHROMA_API_KEY`, `CHROMA_TENANT`, `CHROMA_DATABASE` and `@chroma-core/chroma-cloud-qwen` are gone). Local development still uses local Chroma by default.
- `lib/vector-store.ts` is the one interface the app calls; it picks `lib/pinecone.ts` when `PINECONE_API_KEY` is set (required on Vercel) and `lib/chroma.ts` otherwise. Collections become namespaces in one index (`PINECONE_INDEX`, default `source-sync`), and Pinecone embeds the `text` field with `llama-text-embed-v2`. `@pinecone-database/pinecone` 9.1.0, pinned.
- `npm run pinecone:setup` (`scripts/pinecone-setup.mjs`) creates the index once. Uploads wait until Pinecone can search the new chunks, since it is eventually consistent.
- The sidebar and Hugging Face import name the vector database in use; `app/page.tsx` is now a server component that passes it to `app/components/Dashboard.tsx`.
- Pinecone and Blob errors are mapped by `error.name` and `instanceof`, not constructor names, which production bundles minify (found by testing the production build).
- Verified: 68 tests, typecheck, build, the setup script reaching Pinecone with a test key, and a standalone production build (password prompt, sidebar label, Pinecone's rejection mapped to `VECTOR_ACCESS_DENIED`, missing-configuration messages). Local mode unchanged. Not yet verified: a real Pinecone index, Vercel deployment, or Blob store.

## Known limitations

- **Healthcare Mode** still relies on LLM judgments. The literal-match flag made the gate effective in testing, but the flag and verdicts can still be wrong, so treat results as an audit aid, not clinical validation.
- **Groq limits on this key:** 8,000 tokens per minute and 1,000 requests per day. One check uses about 3 requests, so big batches are slow. A back-to-back burst during testing hit a 429; after that, the client was changed to wait out 429s (up to `GROQ_RATE_LIMIT_WAIT_MS`). That backoff is covered by mock-server tests but has not yet been exercised against live Groq.
- The old Chroma collection `rag_hf_minilm_v1` (2,334 records) is still in `.chroma/` but unused.

## Continue

1. `npm run chroma:start`, then `npm run dev`. Check `curl http://localhost:8000/api/v2/heartbeat` first so you don't start a second Chroma.
2. After changes, run `npm run typecheck && npm test && npm run build`.
