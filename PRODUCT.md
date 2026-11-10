# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

A class / capstone team project. The primary audience is the instructors, panelists, and classmates watching it demonstrated; the team members are the operators during the demo.

## Product Purpose

Source Sync keeps AI answers in sync with their sources. It is a RAG chatbot paired with a hallucination checker: answers are generated from an uploaded document, then every answer is checked claim by claim against that source, with the exact supporting (or contradicting) quote shown as proof. Success is an audience that can see, at a glance, which claims the source backs and which it does not.

## Positioning

Claim-level verification with evidence: not a single trust score, but each atomic claim labelled Supported, Contradicted, or Unsupported next to the verbatim quote from the context. Healthcare Strictness Mode additionally requires a literal match and confidence ≥ 0.95 before a claim counts as Supported.

## Operating Context

- Shown live on a projector to an audience; first impressions and legibility at distance matter.
- The demo flow: upload a PDF/DOCX → chat → Send to checker → Run check → read the claims table; then Hugging Face import → Batch check → Download CSV Audit Report.
- Runs locally: Next.js dev server, a local ChromaDB server, and the Groq API (key in `.env.local`).

## Capabilities and Constraints

- Five modes in one dashboard: Chat, Hallucination checker, Hugging Face import, Batch check, History. Modes stay mounted, so switching keeps state.
- History saves every conversation (after each answer) and every completed check, including pasted ones, as JSON files on the machine running the app (`.data/history/`). Saved items can be reopened or deleted. Batch reports are not saved.
- Chat works without a file (plain Groq chat) or grounded in one attached PDF/DOCX (up to 20 MB).
- Checker outputs Faithfulness, Answer Relevance, and Context Relevance, plus a claims table (verdict, confidence, evidence, reasoning, adjustments).
- Batch check handles up to 50 items and exports a CSV audit report.
- Groq limits on the current key: 8,000 tokens per minute and 1,000 requests per day; one check is about 3 requests.
- The stylesheet targets elements and `data-*` hooks only (no classes, no inline styles).
- Verdicts must stay readable without color (the markup carries 🟢/🔴/🟡 markers and verdict words).

## Brand Commitments

- Name: **Source Sync** (two words), confirmed by the user on 2026-11-09. Replaces the working titles "RAG Hallucination Checker" / "AI Chatbot & RAG Hallucination Checker".
- The user asked for a modern rendition of the Ghost of Tsushima UI style and a logo for Source Sync. The style is inspiration only: no game assets, names, characters, or logos.

## Evidence on Hand

- Example batch input: `examples/batch-input.json`.
- Built-in checker example (readmissions study) that produces all three verdicts.
- No testimonials, users, benchmarks, or accuracy claims exist; do not invent them.

## Product Principles

1. Proof over scores: every verdict is shown with the quote that justifies it.
2. Legible at a distance: the demo is read off a projector, so hierarchy and contrast win over ornament.
3. One flow, end to end: chat → check → batch → report should read as one continuous story.
4. Honest uncertainty: Unsupported is not Contradicted; the UI keeps the three verdicts distinct.
