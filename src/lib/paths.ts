import { MAX_IMAGES_LIMIT, type PersonSlot, type QuestionType } from "@/config/questions";

/**
 * Storage layout, shared by the browser and the server:
 *
 *   submissions/{submissionId}/manifest.json
 *   submissions/{submissionId}/{questionId}[.{p1|p2}].{webm|m4a}   the slot's voice recording
 *   submissions/{submissionId}/{questionId}[.{p1|p2}].img{n}.jpg   the slot's n-th photo
 *
 * The .p1/.p2 segment appears only on per-founder (★) questions.
 */

export type SlotKey = "main" | PersonSlot;

/** e.g. 2026-10-25T14-03-11_x7k2p9 — sorts chronologically as a string. */
export const SUBMISSION_ID_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})_([a-z0-9]{6})$/;

const ID_ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";

export function createSubmissionId(now: Date = new Date()): string {
  const stamp = now.toISOString().slice(0, 19).replace(/:/g, "-");
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const suffix = Array.from(bytes, (b) => ID_ALPHABET[b % ID_ALPHABET.length]).join("");
  return `${stamp}_${suffix}`;
}

export function isSubmissionId(value: string): boolean {
  return SUBMISSION_ID_RE.test(value);
}

/** The UTC moment encoded in a submission id, or null when the id is malformed. */
export function submissionIdDate(id: string): Date | null {
  const m = SUBMISSION_ID_RE.exec(id);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const date = new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +s));
  return Number.isNaN(date.getTime()) ? null : date;
}

export type MediaType = Exclude<QuestionType, "text">;
export type MediaExt = "webm" | "m4a" | "jpg";
export type MediaMime = "audio/webm" | "audio/mp4" | "image/jpeg";

export const MEDIA_RULES: Record<MediaType, { maxBytes: number; formats: { mime: MediaMime; ext: MediaExt }[] }> = {
  voice: {
    maxBytes: 15 * 1024 * 1024,
    formats: [
      { mime: "audio/webm", ext: "webm" },
      { mime: "audio/mp4", ext: "m4a" },
    ],
  },
  image: {
    maxBytes: 8 * 1024 * 1024,
    formats: [{ mime: "image/jpeg", ext: "jpg" }],
  },
};

export function extForMime(mime: MediaMime): MediaExt {
  return mime === "audio/webm" ? "webm" : mime === "audio/mp4" ? "m4a" : "jpg";
}

export function mimeForExt(ext: MediaExt): MediaMime {
  return ext === "webm" ? "audio/webm" : ext === "m4a" ? "audio/mp4" : "image/jpeg";
}

export function mediaTypeForExt(ext: MediaExt): MediaType {
  return ext === "jpg" ? "image" : "voice";
}

export function submissionPrefix(submissionId: string): string {
  return `submissions/${submissionId}/`;
}

export function manifestPathname(submissionId: string): string {
  return `${submissionPrefix(submissionId)}manifest.json`;
}

/** What a media file holds: the slot's voice recording, or its n-th photo (1-based). */
export type MediaPart = { kind: "voice"; ext: "webm" | "m4a" } | { kind: "image"; index: number };

export function mediaFileName(questionId: string, slot: SlotKey, part: MediaPart): string {
  const base = slot === "main" ? questionId : `${questionId}.${slot}`;
  return part.kind === "voice" ? `${base}.${part.ext}` : `${base}.img${part.index}.jpg`;
}

export function mediaPathname(submissionId: string, questionId: string, slot: SlotKey, part: MediaPart): string {
  return `${submissionPrefix(submissionId)}${mediaFileName(questionId, slot, part)}`;
}

const MEDIA_FILE_RE = /^([a-z0-9]+(?:-[a-z0-9]+)*)(?:\.(p1|p2))?(?:\.img([1-9]\d*))?\.(webm|m4a|jpg)$/;

export interface ParsedMediaFile {
  questionId: string;
  slot: SlotKey;
  ext: MediaExt;
  /** Photo number for images; undefined for voice. */
  index?: number;
}

export function parseMediaFileName(fileName: string): ParsedMediaFile | null {
  const m = MEDIA_FILE_RE.exec(fileName);
  if (!m) return null;
  const ext = m[4] as MediaExt;
  const index = m[3] ? Number(m[3]) : undefined;
  // Photos are always numbered; recordings never are.
  if ((ext === "jpg") !== (index !== undefined)) return null;
  if (index !== undefined && (!Number.isSafeInteger(index) || index > MAX_IMAGES_LIMIT)) return null;
  return { questionId: m[1], slot: (m[2] as PersonSlot | undefined) ?? "main", ext, index };
}

export function parseMediaPathname(pathname: string): (ParsedMediaFile & { submissionId: string }) | null {
  const parts = pathname.split("/");
  if (parts.length !== 3 || parts[0] !== "submissions" || !isSubmissionId(parts[1])) return null;
  const file = parseMediaFileName(parts[2]);
  return file ? { ...file, submissionId: parts[1] } : null;
}
