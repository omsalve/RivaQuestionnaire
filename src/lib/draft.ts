import { PEOPLE, type PersonSlot } from "@/config/questions";
import type { ImageFile, VoiceFile } from "@/lib/manifest";
import { createSubmissionId, isSubmissionId, type SlotKey } from "@/lib/paths";

/**
 * The in-progress questionnaire, mirrored to localStorage so a refresh (or a
 * phone locking mid-answer) never loses work. Recordings and photos are stored
 * as references to blobs that were already uploaded, plus a tiny thumbnail per
 * photo for the review screen.
 */

export type DraftImage = ImageFile & { thumb?: string };

/** One answer slot: any mix of writing, one recording and photos. */
export interface DraftSlot {
  text?: string;
  voice?: VoiceFile;
  images?: DraftImage[];
}

export type DraftAnswers = Record<string, Partial<Record<SlotKey, DraftSlot>>>;

export interface Draft {
  version: 2;
  submissionId: string;
  step: number;
  respondent: { name: string; email: string; people: Record<PersonSlot, string> };
  /** Honeypot mirror. */
  website: string;
  answers: DraftAnswers;
}

const KEY = "riva-chavan-founder-questionnaire:draft:v1";

export function newDraft(): Draft {
  return {
    version: 2,
    submissionId: createSubmissionId(),
    step: 0,
    respondent: { name: "", email: "", people: { ...PEOPLE } },
    website: "",
    answers: {},
  };
}

export function loadDraft(): Draft | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const draft = JSON.parse(raw) as Draft;
    if (draft?.version !== 2 || !isSubmissionId(draft.submissionId) || typeof draft.answers !== "object") return null;
    return draft;
  } catch {
    return null;
  }
}

export function saveDraft(draft: Draft): boolean {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(draft));
    return true;
  } catch {
    // Quota exceeded: drop thumbnails, keep the answers.
    try {
      const lean: Draft = {
        ...draft,
        answers: Object.fromEntries(
          Object.entries(draft.answers).map(([id, slots]) => [
            id,
            Object.fromEntries(
              Object.entries(slots).map(([slot, v]) => [
                slot,
                v?.images ? { ...v, images: v.images.map((img) => ({ ...img, thumb: undefined })) } : v,
              ]),
            ),
          ]),
        ),
      };
      window.localStorage.setItem(KEY, JSON.stringify(lean));
      return true;
    } catch {
      return false;
    }
  }
}

export function clearDraft(): void {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* storage unavailable */
  }
}

export function isAnswered(slot: DraftSlot | undefined): boolean {
  if (!slot) return false;
  return !!slot.text?.trim() || !!slot.voice || (slot.images?.length ?? 0) > 0;
}
