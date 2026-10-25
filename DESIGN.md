# Design

The discovery questionnaire PDF, made alive. Minimal, document-like, with one cinematic gesture.

## Tokens (`src/app/globals.css`, `@theme`)

| Role | Token | Value |
| --- | --- | --- |
| Paper | `paper` / `paper-2` | `#ffffff` / `#f8f6f4` (hover rows, image wells) |
| Ink | `ink` / `ink-2` / `ink-3` | `#24201e` / `#5b5450` / `#6f6762` (all ≥ 4.5:1 on white) |
| Rules | `rule` / `dot` | `#e4dfda` hairlines / `#c9c1ba` dotted answer lines |
| Accent (only one) | `clay` / `clay-deep` / `clay-wash` | `#8f553f` / `#6f3f2d` hover / `#f6eeea` selection |
| Error | `danger` | `#a33a2a` |

## Type

- **Source Serif 4** (400/500) for prompts, titles, chapter numbers and the review question text. Set in a single weight; hierarchy comes from size.
- **Lato** (400/700) for everything you read or type. Inputs are ≥ 17px, so iOS never zooms on focus.
- Labels: Lato 700, uppercase, tracking 0.12–0.14em, clay for founder names and ink-2 for field labels.
- Wordmark: "HOUSE OF DESIGN", 11px, 700, tracking 0.32em, clay (as in the PDF header).
- Question numbers: clay serif at the prompt's own size (`12.`), as in the PDF.

## Components

- **Answer lines:** textareas with no box, written on dotted rules (`.answer-lines`, 2rem line height, background-attachment local). A clay hairline draws under the field on focus.
- **Buttons:** square corners (2px), 48px min height. Primary is ink and turns clay-deep on hover; outline uses an ink/20 border; quiet is text only.
- **★:** a drawn SVG star (`StarMark`) marks per-founder questions, as in the PDF.
- **Progress:** a 1px rule with a clay fill under the sticky header.
- **Recorder:** a round clay mic button (the only round control), a 28-bar clay level meter, and a serif timer.
- **Voice note / photos:** under each text box, an outline "Record a voice note" (clay mic) and "Add photos" button; once used they expand into a labelled block (player, or a 4:5 thumbnail grid with round remove buttons and a dashed "Add more" tile). Photos get a soft two-layer shadow; audio uses a custom player with a clay scrub line.
- **Confirmations** are inline two-step, never modals.

## Motion

One grammar: things *focus in* (blur 8px → 0, rise 0.45em, 1000ms, expo ease-out).

- Prompts reveal word by word (26ms stagger), and the answer area arrives as the last word settles.
- **Signature:** chapter title cards between sections. A big clay numeral and the section name focus in, a clay rule draws, then the card wipes upward (clip-path). Any key or tap skips it.
- Intro: the wordmark tracks in from wide letter-spacing, the title focuses in, and the clay rule draws.
- `prefers-reduced-motion`: everything becomes an instant fade and chapter cards are skipped.
