# Riva Chavan Studio: Founder Questionnaire

A one-question-per-screen web version of the Riva Chavan Studio Founder Questionnaire. Riva can type an answer, record a voice note on any question, and add reference photos where pictures help. Admins review submissions and export each one as a ZIP to upload to Claude.

Stack: Next.js 16 (App Router, Cache Components), TypeScript, Tailwind v4 and zod, deployed on Vercel. The only storage is a **private Vercel Blob store**: no database and no paid services.

## Setup

```bash
npm install
cp .env.example .env.local   # then fill in the three values
npm run dev
```

| Variable | What it is |
| --- | --- |
| `BLOB_READ_WRITE_TOKEN` | Read-write token of the private Blob store (see below). |
| `ADMIN_PASSWORD` | Password for `/admin`. |
| `ADMIN_SECRET` | 32+ random characters that sign the admin cookie. `node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"` |

No secret ever reaches the browser. Uploads use short-lived, path-scoped client tokens issued by `/api/upload`.

### Connecting a Blob store (Vercel dashboard)

1. Open the project in Vercel, go to **Storage**, choose **Create Database**, then **Blob**.
2. Set access to **Private**. This matters: media is only ever served through the authenticated admin proxy.
3. Connect the store to the project for all environments (Production, Preview and Development).
4. Check that **Settings → Environment Variables** now has `BLOB_READ_WRITE_TOKEN`. If it doesn't, copy it from the store's **.env.local** tab and add it. Client-upload tokens are signed with this token, so OIDC alone isn't enough.
5. Add `ADMIN_PASSWORD` and `ADMIN_SECRET`, then redeploy.
6. Locally: `vercel env pull .env.local`, or paste the values in by hand.

Blob on Vercel Pro stays within the plan's included usage at this volume. Client uploads incur no data-transfer charge.

### Testing on a phone

Recording and the camera need **https**. Use a Vercel preview deployment, or run `next dev --experimental-https` and open the LAN address. On plain `http://192.168…` the microphone is blocked, and the app says so.

## Editing questions

Edit the `QUESTION_SECTIONS` array in `src/config/questions.ts`:

```ts
const QUESTION_SECTIONS = [
  {
    title: "Riva, the person",
    questions: [
      { prompt: "Describe yourself in three words. Then give the three words your closest friend would use." },
      { prompt: "Share reference images.", maxImages: 5 },
    ],
  },
];
```

- The array is validated with zod when the module loads. A malformed entry or a **duplicate id fails `npm run build`** with a readable error.
- Questions are numbered within each section, in the order shown in the array.
- A section can include a `description`, which is shown with the section and included in exports. A question can include `helperText` or `maxImages`.
- Question IDs are assigned from their order. Append new questions after the existing questions; inserting or reordering questions changes their IDs.
- Every manifest stores a snapshot of all questions and each answered prompt. Editing a question later never breaks older submissions.

**What each answer slot accepts.** Every answer slot can combine:

| `type` | Shows | Also |
| --- | --- | --- |
| `text` | text box + **Record a voice note** button | photos if `maxImages` is set |
| `voice` | large record button | photos if `maxImages` is set |
| `image` | **Take a photo** (phones) / **Choose photos** | — |

The questionnaire has 92 questions across 14 sections. Every question accepts a written answer and a voice note; questions that ask for visual references also accept photos. Questions are optional, in keeping with the PDF's guidance that "Don't know yet" is a valid answer.

## How it works

```
Browser ──(1) ask for upload token──▶ /api/upload   validates path, question, type, size; issues a 10-min token
   │
   └──(2) PUT media directly──▶ Vercel Blob (private)   submissions/{id}/{questionId}[.p1|.p2].{webm|m4a}
   │                                                    submissions/{id}/{questionId}[.p1|.p2].img{n}.jpg
   │
   └──(3) submit answers──▶ /api/submit   validates, HEADs every referenced blob, writes manifest.json once,
                                          and deletes media that was replaced or removed
```

- **Submission id** (`2026-10-25T14-03-11_x7k2p9`): created in the browser at the start of the session and sorts by time. It's stored in localStorage together with all drafts, so a refresh or a locked phone loses nothing. The draft is cleared after a successful submit.
- **Media** uploads when the respondent confirms it ("Save recording", or picking photos), with progress per file. Uploads give up after 3 minutes with a clear message instead of spinning. Photos are resized to a 2048px long edge and re-encoded as JPEG at 0.85, which also strips EXIF and GPS data. Several photos can be picked at once; each gets its own numbered file.
- **Voice** records with `audio/webm;codecs=opus` (Chrome, Firefox, Android) and falls back to `audio/mp4` (iOS Safari). The file extension follows the container the browser actually produced.
- **Spam:** a honeypot field, a minimum fill time, a submission-id age window, and strict path, type and size allowlists. A manifest can't be overwritten, and uploads stop once a submission is final.

### Manifest (`submissions/{id}/manifest.json`, schema in `src/lib/manifest.ts`)

```jsonc
{
  "version": 1,
  "submissionId": "2026-10-25T14-03-11_x7k2p9",
  "submittedAt": "2026-10-25T14:41:02.118Z",
  "respondent": { "name": "Riva Chavan" },
  "userAgent": "…",
  "questions": [{ "id": "riva-q01", "type": "text", "prompt": "…", "section": "Riva, the person",
                  "perPerson": false, "required": false, "accepts": { "text": true, "voice": true, "images": 0 } }],
  "answers": {
    // Every answer slot is { text?, voice?, images? } — any combination.
    "riva-q01": {
      "type": "text", "questionPrompt": "…", "text": "…",
      "voice": { "pathname": "submissions/…/riva-q01.webm", "mimeType": "audio/webm",
                 "sizeBytes": 812345, "durationSec": 42.3 }
    }
  }
}
```

## Admin

- `/admin`: password sign-in sets an httpOnly, HMAC-signed cookie that lasts 7 days. `src/proxy.ts` gates `/admin/*` and `/api/admin/*`, and every page and route checks again next to the read.
- The list shows submissions newest first (Blob `list` in folded mode) with date, respondent and answer count. Sessions that uploaded media but never submitted appear under **Started, never sent** and can be deleted.
- A submission's detail page shows every question in order with its answer. Audio and images stream through `/api/admin/media/{id}/{file}`, which supports Range requests for Safari.
- Each submission has **Download ZIP**, and the header has **Export all**. Both are streamed with `archiver`.
- **Delete** asks for an inline confirmation, then removes the manifest and all media.

### How exports map to questions

```
house-of-design-{id}.zip
├── manifest.json      the stored record, as above
├── answers.md                "## Q{n} [{type}] {prompt}", then the written answer and the
│                             filenames of any recording or photos for that answer
├── 01-voice.webm             media renamed by question number n (the position in the questionnaire)
├── 07-image-1.jpg            photos are numbered in the order they were added
├── 07-image-2.jpg
├── 02-voice-p1-riya.m4a      per-founder answers add the slot and name
└── 17-image-p2-ana-1.jpg
```

`Q{n}` in answers.md and the `NN-` prefix on files refer to the same question, so a file always sorts next to its question. Text answers live inline in answers.md (and in manifest.json), not as separate files. **Export all** puts each submission in its own `{submissionId}/` folder.

## Scripts

```bash
npm run dev        # local dev
npm run build      # production build (also validates questions)
npm run typecheck  # tsc --noEmit
npm run lint
```
