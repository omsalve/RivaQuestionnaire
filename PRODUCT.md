# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js 16 (App Router, Cache Components) + TypeScript + Tailwind v4 on Vercel Pro. The user asked for Next 15 and then chose to keep the existing Next 16 scaffold. Storage is a private Vercel Blob store only: no database and no paid services (hard zero-cost constraint).

## Users

- **Respondent:** Riva Chavan, founder of Riva Chavan Studio. She answers the founder questionnaire before a rebrand and brand-story engagement. She may answer on a phone or a laptop, possibly in more than one sitting.
- **Admin:** the agency team running the engagement. They review submissions, then export each one as a ZIP to upload to Claude for synthesis.

## Product Purpose

A web version of the Riva Chavan Studio Founder Questionnaire (originally a 5-page PDF). Each question is answered as text, voice or an image, and every answer stays linked to its question. Success: the founder completes it without friction, and the agency gets a clean, LLM-readable export.

## Operating Context

- 92 questions in 14 sections, copied from the PDF.
- Questions are edited in `src/config/questions.ts`. There is no CMS.
- Exports (`manifest.json`, `answers.md` and ordered media files) are uploaded to Claude.

## Capabilities and Constraints

- Private Blob store; media is uploaded directly from the client and never passes through a function body.
- Drafts persist in localStorage. No respondent auth. The admin area is protected by a single password.
- Must work on iOS Safari and Android Chrome (voice recording and the camera).

## Brand Commitments

- The visual language of the original PDF: an old-style serif for headings, a humanist sans (Lato) for body text, one muted clay-brown accent on white, numbered sections and dotted answer lines.
- The user asked for a minimal design with "a cinematic animation touch".

## Evidence on Hand

- Riva Chavan Studio — Founder Questionnaire v2.pdf (question copy and visual reference). No logo file, photography or testimonials have been supplied.

## Product Principles

1. Feel like the same document Riva already saw, just alive.
2. Never lose an answer: autosave, upload on confirm, verify before submit.
3. Riva's voice stays distinct and personal.
4. Exports are written for an LLM reader first.
