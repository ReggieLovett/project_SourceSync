---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["app/globals.css","app/layout.tsx","app/components"]
---

# Source Sync dashboard

Scope: the single-page dashboard (`app/page.tsx`, `app/components/*`, `app/globals.css`, `app/layout.tsx`, `app/icon.svg`). Visitor mode: Operate. Build path: code-led (Operate surface; no image generation).

Audience and job: a capstone team demoing on a projector to instructors and classmates. The task is the demo flow: chat over a document, send an answer to the checker, read the claims table; then import, batch, export CSV.

Constraints: stylesheet targets elements and `data-*` hooks only; four modes stay mounted; verdicts readable without colour; projector legibility.

## Direction contract

THESIS: Source Sync proves each answer claim by claim. The screen is a clean working dashboard, and the world arrives as a seal on every verdict. It refuses the costume version of a samurai game menu (brush-stroke buttons, paper grain, ink banners on every control).

OWN-WORLD: Sumi-ink rail (#111) beside a cool washi-grey ground (blue at or above red); white-paper work surfaces; crimson for the brand seal, the current mode, focus, and Contradicted; primary actions are ink, not crimson, because crimson already means Contradicted (PRODUCT.md principle 4: the three verdicts stay distinct); gold only on ink (status, speaker label, focus ring). Zen Kaku Gothic New for the UI voice, uppercase tracked labels; Shippori Mincho for source text and evidence. Square corners, hairline rules, crisp standard controls. Brush texture lives only in seals: the logo and the verdict stamps.

STORY: The audience sees a calm, legible tool, understands at a glance which claims the source supports, contradicts, or never mentions, and believes it because each seal sits beside its verbatim quote.

FIRST VIEWPORT: Ink rail left (Source Sync seal + wordmark top, four modes below, active mode a washi block with a crimson seal dot; a crimson edge stripe is refused by the craft floor's ban on side stripes over 1px on list items). Main: mode title large, one-line purpose, then the work area: chat log with the ink composer pinned to the bottom; in the checker, inputs then scores card and claims table, verdict seals in their own column.

FORM: Pinned by the user ("modern rendition of the Ghost of Tsushima style"); the roll ran for the record and the pin governs (a user-pinned decision beats the roll). seed:f80cf23346e9250c. Signature move: verdict seals that stamp in, row by row, the first time a result lands.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
