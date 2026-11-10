---
name: Source Sync
description: AI answers checked claim by claim against their source, every verdict a stamped seal.
colors:
  ink: "#111110"
  ink-3: "#2c2a27"
  on-ink: "#eceeed"
  on-ink-soft: "rgba(236, 238, 237, 0.64)"
  ground: "#e3e6e7"
  washi: "#eef0f0"
  paper: "#fafbfb"
  rule: "rgba(17, 17, 16, 0.12)"
  rule-strong: "rgba(17, 17, 16, 0.28)"
  text: "#141413"
  text-soft: "#4f5458"
  crimson: "#b0281e"
  crimson-deep: "#8a1d15"
  crimson-wash: "rgba(176, 40, 30, 0.07)"
  gold: "#cfa95c"
  supported: "#2f6a45"
  supported-wash: "rgba(47, 106, 69, 0.11)"
  contradicted: "#b0281e"
  contradicted-wash: "rgba(176, 40, 30, 0.1)"
  unsupported: "#7a5814"
  unsupported-wash: "rgba(122, 88, 20, 0.12)"
typography:
  display:
    fontFamily: "Zen Kaku Gothic New, Hiragino Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.1em"
  display-compact:
    fontFamily: "Zen Kaku Gothic New, Hiragino Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.625rem"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "0.1em"
  headline:
    fontFamily: "Zen Kaku Gothic New, Hiragino Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "0.08em"
  title:
    fontFamily: "Zen Kaku Gothic New, Hiragino Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "0.16em"
  body:
    fontFamily: "Zen Kaku Gothic New, Hiragino Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 400
    lineHeight: 1.65
    fontFeature: "lnum"
  body-sm:
    fontFamily: "Zen Kaku Gothic New, Hiragino Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.6
    fontFeature: "lnum"
  caption:
    fontFamily: "Zen Kaku Gothic New, Hiragino Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "lnum"
  label:
    fontFamily: "Zen Kaku Gothic New, Hiragino Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.11em"
  seal:
    fontFamily: "Zen Kaku Gothic New, Hiragino Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "0.12em"
  source:
    fontFamily: "Shippori Mincho, Hiragino Mincho ProN, Georgia, serif"
    fontSize: "1rem"
    fontWeight: 500
    lineHeight: 1.7
rounded:
  none: "0px"
spacing:
  xs: "0.4rem"
  sm: "0.75rem"
  md: "1.25rem"
  lg: "1.75rem"
  xl: "2.5rem"
components:
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.text}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.5rem 1.15rem"
    height: "2.625rem"
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.5rem 1.15rem"
    height: "2.625rem"
  button-primary-hover:
    backgroundColor: "{colors.ink-3}"
    textColor: "{colors.on-ink}"
  input-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.none}"
    padding: "0.75rem 0.9rem"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.on-ink-soft}"
    typography: "{typography.label}"
    rounded: "{rounded.none}"
    padding: "0.6rem 0.9rem 0.6rem 1.4rem"
    height: "2.875rem"
  nav-item-active:
    backgroundColor: "{colors.washi}"
    textColor: "{colors.ink}"
  work-surface:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.text}"
    rounded: "{rounded.none}"
    padding: "1.25rem 1.5rem"
  seal-supported:
    backgroundColor: "{colors.supported}"
    textColor: "{colors.paper}"
    typography: "{typography.seal}"
    padding: "0.42rem 0.8rem 0.38rem"
  seal-contradicted:
    backgroundColor: "{colors.contradicted}"
    textColor: "{colors.paper}"
    typography: "{typography.seal}"
    padding: "0.42rem 0.8rem 0.38rem"
  seal-unsupported:
    backgroundColor: "{colors.unsupported-wash}"
    textColor: "{colors.unsupported}"
    typography: "{typography.seal}"
    padding: "0.42rem 0.8rem 0.38rem"
  composer:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.none}"
    padding: "0.5rem"
  message-user:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    padding: "0.75rem 1.2rem 0.85rem"
  alert:
    backgroundColor: "{colors.crimson-wash}"
    textColor: "{colors.crimson-deep}"
    padding: "0.75rem 1rem"
---

# Design System: Source Sync

## Overview

**Creative North Star: "The Stamped Ledger"**

Source Sync is a clean working dashboard that borrows a samurai-era menu language without wearing it as a costume. A sumi-ink rail runs down the left; the work happens on a cool washi-grey ground, on white paper surfaces with hairline rules. Controls are standard, crisp, and square. The world arrives in one place: every verdict is a hand-stamped seal, uneven at the edges, tilted a degree or so, pressed beside the verbatim quote that justifies it.

The system is built for a projector. Hierarchy comes from scale, weight, and wide uppercase tracking rather than ornament, and the three verdicts stay distinct by fill, word, and colour, each carrying the meaning on its own. Brush texture is rationed to the seals (the logo and the verdict stamps); everything else is plain ink on paper.

Motion is equally rationed: one authored moment, the seals stamping down row by row the first time a check result lands, and otherwise only small state transitions.

**Key Characteristics:**
- Ink rail, washi-grey ground, white paper work surfaces.
- Square corners throughout; 1px hairline rules for structure.
- Zen Kaku Gothic New for the interface, uppercase and tracked for labels; Shippori Mincho for source text.
- Crimson is meaningful and rare; primary actions are ink.
- Verdict seals are the signature: masked stamp edges, slight tilt, one-time stamp-in.

## Colors

A near-monochrome ink-and-paper palette with one meaningful red and three verdict hues.

### Primary
- **Sumi Ink** (`ink`): the rail, primary buttons, the user's chat messages, the composer strip, table header rule, and focused input borders. Hover deepens toward **Warm Charcoal** (`ink-3`).
- **Seal Crimson** (`crimson`): the brand seal, the current-mode dot, the focus outline, selection, links, checkbox accent, the status dot, the composer's focus edge, and the Contradicted verdict. **Deep Crimson** (`crimson-deep`) is link hover and alert text; **Crimson Wash** (`crimson-wash`) is the alert ground.

### Secondary
- **Lacquer Gold** (`gold`): appears only on ink. The focus outline inside the rail and composer, the composer caret, and the "You" speaker label on the user's messages.

### Tertiary (verdicts)
- **Pine Green** (`supported`) with `supported-wash`: the Supported seal and quote highlight.
- **Seal Crimson** (`contradicted`, same value as `crimson`) with `contradicted-wash`: the Contradicted seal and quote highlight.
- **Ochre Earth** (`unsupported`) with `unsupported-wash`: the hollow Unsupported seal and its highlight.

### Neutral
- **Washi Grey** (`ground`): the page ground behind everything; cool, blue at or above red.
- **Pale Washi** (`washi`): the active mode block in the rail and the send button on the composer.
- **White Paper** (`paper`): work surfaces (score cards, tables, assistant answers), inputs, secondary buttons, and text on solid seals.
- **Ink Text** (`text`) and **Slate Text** (`text-soft`): body copy and secondary copy (labels, notes, metadata, placeholders).
- **Hairline** (`rule`) and **Strong Hairline** (`rule-strong`): table row dividers and surface borders; control borders, header rules, and the h3 run-off line.
- **Rice Paper on Ink** (`on-ink`, `on-ink-soft`): text on the rail and composer; inactive modes and the stack list use the soft value.

### Named Rules
**The Crimson Means Something Rule.** Crimson is reserved for the brand seal, the current mode, focus, errors, and Contradicted. Primary actions are ink, never crimson, because crimson already says Contradicted.

**The Gold-On-Ink Rule.** Gold appears only on ink surfaces. It never touches paper or the washi ground.

**The Three Verdicts Rule.** Supported, Contradicted, and Unsupported each get their own hue, and the verdict word is always printed in the seal. No verdict depends on colour alone.

## Typography

**Display Font:** Zen Kaku Gothic New (with Hiragino Sans, ui-sans-serif, system-ui)
**Body Font:** Zen Kaku Gothic New, weights 400 / 500 / 700
**Source Font:** Shippori Mincho 500 (with Hiragino Mincho ProN, Georgia)
**Mono:** ui-monospace, SF Mono, Menlo, for inline code only

**Character:** A quiet Japanese gothic carries the interface like menu text: uppercase, widely tracked, confident at a distance. A Mincho serif sets anything quoted from the source, so evidence reads as printed document rather than UI.

### Hierarchy
- **Display** (700, 2.5rem, 1.1, 0.1em, uppercase): the mode title at the top of each mode, balanced wrap. **Display Compact** (1.625rem) replaces it under 48rem.
- **Headline** (700, 1.25rem, 1.25, 0.08em, uppercase): section headings within a mode.
- **Title** (700, 0.8125rem, 1.3, 0.16em, uppercase): menu-label sub-headings with a strong hairline running off to the right.
- **Body** (400, 1.125rem, 1.65, lining numerals): running text, max 72ch; header blurbs max 66ch; the composer's input.
- **Body Small** (400, 0.9375rem, 1.6): secondary copy: notes, alerts, status lines, checkbox labels, summaries, attachments, the file input, table cells, and header blurbs under 48rem.
- **Caption** (400, 0.875rem, 1.5): `small` meta text, the composer hint, and the verdict legend.
- **Label** (500, 0.8125rem, 0.1 to 0.11em, uppercase): buttons, field labels, legends (700), definition terms, table headers, speaker labels, rail items, stack list.
- **Seal** (700, 0.8125rem, 0.12em, uppercase; 0.9375rem at 0.08em inside the claims table): verdict seals.
- **Source** (Shippori Mincho 500, inherits size, 1.7 in blockquotes): quotes, blockquotes, the checker's context field.

### Named Rules
**The Menu Label Rule.** Interface labels are uppercase and tracked between 0.08em and 0.2em. Sentences stay in sentence case: body copy, checkbox labels, inputs, and source text are never uppercased.

**The Printed Source Rule.** Anything quoted from the source document is set in Shippori Mincho. Interface copy never is.

**The Tabular Numbers Rule.** Score cards and tables use lining, tabular numerals so figures align in columns.

## Layout

A two-column app shell: an 18rem ink rail on the left and a scrolling main column (`minmax(0, 1fr)`) filling the viewport height (100dvh). Main is padded 2.5rem on the sides and top, 3rem at the bottom; each mode's content is centred at a max width of 60rem, and the chat mode narrows to 50rem with the composer pinned to the bottom of its column.

Each mode opens with a header block (display title, one-line purpose in `text-soft`) closed by a strong hairline, then the work area. Vertical rhythm runs on a loose rem scale: 0.4rem inside label pairs, 0.75rem between controls, 1.25rem to 1.75rem between groups and fieldsets, 2.5rem before menu-label sub-headings. Action rows are wrapping flex rows with a 0.6rem by 0.75rem gap.

Below 48rem the rail becomes an ink tab bar across the top: the brand logo shrinks to 1.8rem tall, the mode list scrolls horizontally, and the stack list is hidden. Main padding drops to 1.25rem by 1rem. Definition lists collapse to one column, wide tables scroll sideways, and the claims table restacks each claim as a grid block (number and claim, then seal and confidence, then evidence, then reasoning) with column names printed as labels.

## Elevation & Depth

Mostly flat, with tonal layering doing the work: ink rail against washi ground against white paper. A single soft lift marks paper work surfaces so they sit just above the ground; controls stay flat at rest and respond with border and fill changes, not shadows.

### Shadow Vocabulary
- **Paper lift** (`box-shadow: 0 1px 2px rgba(17, 17, 16, 0.05), 0 12px 28px -18px rgba(17, 17, 16, 0.3)`): score cards, tables, and assistant answer bodies.
- **Composer drop** (`box-shadow: 0 18px 34px -22px rgba(17, 17, 16, 0.7)`): under the ink composer strip only.
- **Seal ring** (`box-shadow: inset 0 0 0 3px <verdict>, inset 0 0 0 4px rgba(250, 251, 251, 0.5)`): the carved inner border on solid seals; hollow seals use a single 2.5px inset ring.
- **Key cap** (`box-shadow: inset 0 -1px 0 rgba(17, 17, 16, 0.28)`): keyboard hints.

### Named Rules
**The Paper Lift Rule.** Only paper work surfaces take the lift. Buttons, inputs, and nav items are flat.

## Shapes

Square everywhere in the interface (0 radius on buttons, inputs, file buttons, surfaces, messages, and seals). Structure comes from 1px hairlines: table row dividers, surface borders, header rules, and the run-off line after sub-headings. Small markers are squares and diamonds: a 0.375rem crimson square for the current mode and attachments, a 0.5rem square status dot, and a rotated diamond on disclosure summaries that fills crimson when open.

The only irregular edges belong to seals. Verdict seals are clipped by an SVG stamp mask (displaced edges with tiny gaps where the ink did not take) and tilted -1.5deg, alternating to 1deg on even table rows. The logo is a crimson seal with a carved frame, one chipped corner, and two carved brush strokes set like an equals sign; its faint silhouette is the chat empty-state watermark.

### Named Rules
**The Seal Is The Only Brush Rule.** Brush and ink texture live only in the logo and the verdict seals. Buttons, banners, surfaces, and the ground stay clean.

## Components

### Buttons
Crisp, standard, typographic.
- **Shape:** square (0px), 1px border, min height 2.625rem.
- **Primary:** ink fill with rice-paper label, used for submit and the main action of a mode (Run check, Import from Hugging Face, Run batch).
- **Secondary:** white paper fill with strong hairline border and ink text.
- **Hover / Focus:** secondary borders darken to ink; primary deepens to warm charcoal. Focus is a 2px crimson outline at 2px offset (gold on ink surfaces). Press scales to 0.97 over 160ms; disabled drops to 0.42 opacity.
- **Small in-context actions** (in the chat log, attachment chip, composer hint): min height 2.25rem, tighter padding.
- **File picker:** the native selector button is restyled as a secondary button at 0.75rem.
- **Danger (confirm delete):** secondary shape with a crimson border and deep crimson label; hover fills crimson. Only appears after a first Delete click, beside **Keep**.

### Cards / Containers
- **Corner Style:** square.
- **Background:** white paper on the washi ground.
- **Shadow Strategy:** paper lift (see Elevation & Depth).
- **Border:** 1px hairline.
- **Internal Padding:** 1.25rem by 1.5rem for score cards, which are two-column definition lists (uppercase label, value) with tabular numerals.

### Inputs / Fields
- **Style:** white paper, 1px strong hairline, square, 0.75rem by 0.9rem padding, 1rem text, crimson caret.
- **Hover / Focus:** border darkens on hover and becomes ink on focus, plus the crimson focus outline.
- **Labels:** uppercase tracked labels above or inline; checkbox labels stay sentence case with a crimson-accented checkbox.
- **Error:** alerts are a crimson-wash panel with a faint crimson border and deep crimson text.

### Navigation
- **Rail:** ink column with the brand (the seal-and-wordmark logo image exported from Canva, 2.55rem tall, on the rail's own #111110 ink), five mode buttons with authored 24px-grid line icons (1.6 stroke, square caps, mitred joins), and a stack list at the foot behind an on-ink hairline.
- **States:** inactive modes are soft rice-paper text on transparent; hover adds a faint light wash; the current mode is a pale washi block with ink bold text and a crimson square dot that scales in over 220ms. Focus inside the rail is a gold outline inset by 2px.
- **Mobile:** a horizontal, scrolling ink tab bar at the top; the current tab scrolls into view whenever the mode changes.

### Chat
- **Messages:** user messages are ink blocks aligned right (max 80%) with a gold speaker label; assistant answers are paper surfaces with the paper lift, preceded by an uppercase speaker label. New messages ease in 5px over 220ms.
- **Composer:** an ink strip pinned to the bottom, like an in-game hint bar, with a transparent auto-growing textarea, a ghost attach button and a washi send button (2.75rem square). A 2px crimson edge appears along its top while focused.
- **Attachment chip:** paper, strong hairline, crimson square marker, small Remove action.
- **Empty state:** the faint seal watermark (5.5rem) above an uppercase first step.
- **Dropzone:** a 90% ink overlay with a dashed inset outline and uppercase prompt.

### History rows
- **List:** one paper surface per section (Conversations, Checks) with the paper lift; rows divided by 1px hairlines, 1rem by 1.25rem padding.
- **Row:** title (first question) in Body at 500 weight, a Caption meta line (date, message count and document, or faithfulness and mode), and for checks the seal-and-count row. **Open** and **Delete** sit on the right as small secondary buttons; under 48rem they move below the text.
- **Empty state:** a soft sentence per section saying when items appear.

### Verdict Seals (signature)
The proof made visible. Each claim's verdict is a stamped seal set beside its verbatim quote.
- **Supported:** solid pine-green seal, paper text, carved inner ring.
- **Contradicted:** solid crimson seal, paper text, carved inner ring.
- **Unsupported:** hollow seal, ochre ring and text on an ochre wash, because "the source never says" is not "the source says otherwise".
- **In the claims table:** a size up (0.9375rem), tilts alternating by row; the row's quote is highlighted with its verdict wash in Shippori Mincho.
- **Count markers:** in the score card each seal sits beside its count; in batch tables a 0.62rem square (hollow for Unsupported) replaces the emoji marker.
- **Motion:** when a result first renders, seals stamp down (scale 1.5 to 0.93 to 1, blur clearing, 360ms) with a 110ms stagger per row after a 200ms delay. Gated by a two-second fresh flag so revisiting a mode does not replay it; skipped entirely under reduced motion.

### Status
- **Working status:** soft text led by a 0.5rem crimson square that breathes (1.2s) unless reduced motion is set.
- **Disclosures:** summaries with a crimson diamond that fills when open.

## Do's and Don'ts

### Do:
- **Do** keep every interface corner square (0px) and build structure from 1px hairlines.
- **Do** make primary actions ink (`ink`) and reserve crimson for the brand seal, current mode, focus, errors, and Contradicted.
- **Do** print the verdict word inside every seal and keep Unsupported hollow, so all three verdicts read without colour.
- **Do** set quotes, evidence, and source context in Shippori Mincho, and interface labels in uppercase tracked Zen Kaku Gothic New.
- **Do** put work on white paper surfaces with the paper lift over the washi-grey ground.
- **Do** gate the stamp animation to the first render of a result and honour `prefers-reduced-motion`.
- **Do** use the authored 24px line-icon set (1.6 stroke, square caps) for new icons.

### Don't:
- **Don't** use brush strokes, paper grain, or ink banners on buttons, surfaces, or backgrounds; texture belongs only to the seals.
- **Don't** make a primary button crimson.
- **Don't** put gold on paper or the washi ground.
- **Don't** mark list items or the active mode with a side stripe wider than 1px; the current mode is a washi block with a crimson dot.
- **Don't** replay the stamp-in on every visit or add other decorative entrance animation.
- **Don't** use game assets, names, characters, or logos; the samurai menu language is inspiration only.
