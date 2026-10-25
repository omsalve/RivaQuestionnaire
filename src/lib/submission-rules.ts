import { answerModes, getQuestion, type Question } from "@/config/questions";
import {
  MEDIA_RULES,
  mediaTypeForExt,
  mimeForExt,
  parseMediaPathname,
  submissionIdDate,
  type SlotKey,
} from "@/lib/paths";

/** Drafts live in localStorage, so allow a generous window to finish. */
const MAX_SUBMISSION_AGE_MS = 30 * 24 * 60 * 60 * 1000;
const MAX_CLOCK_SKEW_MS = 24 * 60 * 60 * 1000;
/** No human answers anything in under this. */
export const MIN_FILL_TIME_MS = 8 * 1000;

export class RuleError extends Error {}

export function assertFreshSubmissionId(submissionId: string, now = Date.now()): Date {
  const startedAt = submissionIdDate(submissionId);
  if (!startedAt) throw new RuleError("Invalid submission id.");
  const age = now - startedAt.getTime();
  if (age < -MAX_CLOCK_SKEW_MS || age > MAX_SUBMISSION_AGE_MS) {
    throw new RuleError("This questionnaire session has expired. Please start again.");
  }
  return startedAt;
}

export function slotsFor(question: Question): SlotKey[] {
  return question.perPerson ? ["p1", "p2"] : ["main"];
}

/** Validates a client-upload pathname against the questionnaire. Returns what the token may accept. */
export function resolveUploadTarget(pathname: string) {
  const parsed = parseMediaPathname(pathname);
  if (!parsed) throw new RuleError("Upload path is not allowed.");
  assertFreshSubmissionId(parsed.submissionId);

  const question = getQuestion(parsed.questionId);
  if (!question) throw new RuleError("Unknown question.");
  const mediaType = mediaTypeForExt(parsed.ext);
  const modes = answerModes(question);
  const accepted = mediaType === "voice" ? modes.voice : (parsed.index ?? 0) <= modes.images;
  if (!accepted) throw new RuleError("This question doesn't accept that kind of file.");
  if (!slotsFor(question).includes(parsed.slot)) throw new RuleError("Invalid answer slot.");

  return {
    ...parsed,
    question,
    contentType: mimeForExt(parsed.ext),
    maxBytes: MEDIA_RULES[mediaType].maxBytes,
  };
}
