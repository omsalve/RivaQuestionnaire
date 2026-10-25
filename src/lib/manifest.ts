import { z } from "zod";
import { MAX_IMAGES_LIMIT, PERSON_SLOTS, QUESTION_TYPES } from "@/config/questions";
import { SUBMISSION_ID_RE } from "@/lib/paths";

/* ------------------------------------------------------------------------ */
/* Answer parts                                                              */
/*                                                                           */
/* Every answer slot (one per question, or one per person on ★ questions)   */
/* can hold any of: text, one voice recording, and photos.                  */
/* ------------------------------------------------------------------------ */

const Pathname = z.string().min(1).max(200);
export const TEXT_MAX = 20_000;

export const VoiceFileSchema = z.object({
  pathname: Pathname,
  mimeType: z.enum(["audio/webm", "audio/mp4"]),
  sizeBytes: z.number().int().nonnegative(),
  durationSec: z.number().nonnegative().max(3600),
});
export type VoiceFile = z.infer<typeof VoiceFileSchema>;

export const ImageFileSchema = z.object({
  pathname: Pathname,
  mimeType: z.literal("image/jpeg"),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().max(16_384),
  height: z.number().int().positive().max(16_384),
});
export type ImageFile = z.infer<typeof ImageFileSchema>;

export const SlotAnswerSchema = z.object({
  text: z.string().max(TEXT_MAX).optional(),
  voice: VoiceFileSchema.optional(),
  images: z.array(ImageFileSchema).max(MAX_IMAGES_LIMIT).optional(),
});
export type SlotAnswer = z.infer<typeof SlotAnswerSchema>;

/* ------------------------------------------------------------------------ */
/* Manifest v1                                                               */
/* ------------------------------------------------------------------------ */

const SingleAnswerSchema = SlotAnswerSchema.extend({
  /** The question's main answer type. */
  type: z.enum(QUESTION_TYPES),
  questionPrompt: z.string(),
});

const PersonAnswerSchema = SlotAnswerSchema.extend({ person: z.string() });

const PerPersonAnswerSchema = z.object({
  type: z.enum(QUESTION_TYPES),
  questionPrompt: z.string(),
  perPerson: z.literal(true),
  people: z.partialRecord(z.enum(PERSON_SLOTS), PersonAnswerSchema),
});

export const ManifestAnswerSchema = z.union([PerPersonAnswerSchema, SingleAnswerSchema]);
export type ManifestAnswer = z.infer<typeof ManifestAnswerSchema>;
export type PerPersonAnswer = z.infer<typeof PerPersonAnswerSchema>;
export type PersonAnswer = z.infer<typeof PersonAnswerSchema>;

export function isPerPersonAnswer(answer: ManifestAnswer): answer is PerPersonAnswer {
  return "perPerson" in answer && answer.perPerson === true;
}

export const QuestionSnapshotSchema = z.object({
  id: z.string(),
  type: z.enum(QUESTION_TYPES),
  prompt: z.string(),
  helperText: z.string().optional(),
  sectionDescription: z.string().optional(),
  section: z.string().optional(),
  perPerson: z.boolean(),
  required: z.boolean(),
  /** What each answer slot accepted at submit time. */
  accepts: z.object({ text: z.boolean(), voice: z.boolean(), images: z.number().int().nonnegative() }),
});
export type QuestionSnapshot = z.infer<typeof QuestionSnapshotSchema>;

export const RespondentSchema = z.object({
  name: z.string().optional(),
  email: z.string().optional(),
  people: z.partialRecord(z.enum(PERSON_SLOTS), z.string()).optional(),
});
export type Respondent = z.infer<typeof RespondentSchema>;

export const ManifestSchema = z.object({
  version: z.literal(1),
  submissionId: z.string().regex(SUBMISSION_ID_RE),
  submittedAt: z.iso.datetime(),
  respondent: RespondentSchema,
  userAgent: z.string(),
  /** Every question as it read at submit time, in order — including unanswered ones. */
  questions: z.array(QuestionSnapshotSchema),
  answers: z.record(z.string(), ManifestAnswerSchema),
});
export type Manifest = z.infer<typeof ManifestSchema>;

/* ------------------------------------------------------------------------ */
/* Submit payload (browser → /api/submit)                                    */
/* ------------------------------------------------------------------------ */

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

/** Sizes are re-read from storage on the server, never trusted from the browser. */
export const ClientSlotSchema = z.object({
  text: z.string().max(TEXT_MAX).optional(),
  voice: VoiceFileSchema.omit({ sizeBytes: true }).optional(),
  images: z
    .array(ImageFileSchema.omit({ sizeBytes: true }))
    .max(MAX_IMAGES_LIMIT)
    .optional(),
});
export type ClientSlot = z.infer<typeof ClientSlotSchema>;

export const SubmitBodySchema = z.object({
  submissionId: z.string().regex(SUBMISSION_ID_RE),
  respondent: z.object({
    name: optionalText(200),
    email: optionalText(320).pipe(z.email("That email address doesn't look right.").optional()),
    people: z.partialRecord(z.enum(PERSON_SLOTS), optionalText(120)).optional(),
  }),
  /** Honeypot. Humans never see this field. */
  website: z.string().max(500).optional(),
  answers: z.record(z.string().max(80), z.partialRecord(z.enum(["main", ...PERSON_SLOTS]), ClientSlotSchema)),
});
export type SubmitBody = z.infer<typeof SubmitBodySchema>;

/* ------------------------------------------------------------------------ */
/* Client-upload token request (browser → /api/upload)                      */
/* ------------------------------------------------------------------------ */

export const UploadTokenEventSchema = z.object({
  type: z.literal("blob.generate-client-token"),
  payload: z.object({
    pathname: z.string().min(1).max(200),
    // The SDK omits these from the JSON when unset.
    multipart: z
      .boolean()
      .optional()
      .transform((v) => v ?? false),
    clientPayload: z
      .string()
      .max(1000)
      .nullish()
      .transform((v) => v ?? null),
  }),
});
