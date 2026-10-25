import { DISPLAY_TIME_ZONE, PERSON_SLOTS } from "@/config/questions";
import { isPerPersonAnswer, type Manifest, type ManifestAnswer, type SlotAnswer } from "@/lib/manifest";
import { formatDuration } from "@/lib/format";
import type { SlotKey } from "@/lib/paths";

export { formatDuration };

/*
 * How an export maps to the questionnaire:
 *
 *   manifest.json        the exact stored record (structured, versioned)
 *   answers.md           every question in order: "## Q{n} [{type}] {prompt}" followed by the
 *                        written answer and the filenames of any recording or photos
 *   NN-voice.webm        media renamed by question number, so files sort in question order.
 *   NN-image-1.jpg       Photos are numbered; per-founder answers add the slot and name,
 *   NN-voice-p1-riya.m4a e.g. 17-image-p2-ana-3.jpg
 */

export interface ExportEntry {
  questionNumber: number;
  questionId: string;
  slot: SlotKey;
  kind: "voice" | "image";
  /** 1-based photo position within the slot; undefined for voice. */
  position?: number;
  pathname: string;
  fileName: string;
}

export function formatDateTime(iso: string | Date): string {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: DISPLAY_TIME_ZONE,
  }).format(typeof iso === "string" ? new Date(iso) : iso);
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/[\s_-]+/g, "-")
    .slice(0, 32);
}

/** An answer's slots as [slot, parts, personName?] tuples, in slot order. */
export function answerSlots(answer: ManifestAnswer): [SlotKey, SlotAnswer, string | undefined][] {
  if (isPerPersonAnswer(answer)) {
    return PERSON_SLOTS.flatMap((slot) => {
      const v = answer.people[slot];
      return v ? [[slot, v, v.person] as [SlotKey, SlotAnswer, string]] : [];
    });
  }
  return [["main", answer, undefined]];
}

function exportBase(questionNumber: number, kind: "voice" | "image", slot: SlotKey, person?: string): string {
  const n = String(questionNumber).padStart(2, "0");
  const who = slot === "main" ? "" : `-${slot}${person && slug(person) ? `-${slug(person)}` : ""}`;
  return `${n}-${kind}${who}`;
}

export function mediaEntries(manifest: Manifest): ExportEntry[] {
  const entries: ExportEntry[] = [];
  manifest.questions.forEach((q, index) => {
    const answer = manifest.answers[q.id];
    if (!answer) return;
    const questionNumber = index + 1;
    for (const [slot, parts, person] of answerSlots(answer)) {
      if (parts.voice) {
        const ext = parts.voice.mimeType === "audio/mp4" ? "m4a" : "webm";
        entries.push({
          questionNumber,
          questionId: q.id,
          slot,
          kind: "voice",
          pathname: parts.voice.pathname,
          fileName: `${exportBase(questionNumber, "voice", slot, person)}.${ext}`,
        });
      }
      parts.images?.forEach((img, i) => {
        entries.push({
          questionNumber,
          questionId: q.id,
          slot,
          kind: "image",
          position: i + 1,
          pathname: img.pathname,
          fileName: `${exportBase(questionNumber, "image", slot, person)}-${i + 1}.jpg`,
        });
      });
    }
  });
  return entries;
}

function describeSlot(parts: SlotAnswer, files: Map<string, string>): string {
  const out: string[] = [];
  if (parts.text) out.push(parts.text);
  if (parts.voice) {
    out.push(
      `Voice recording: \`${files.get(parts.voice.pathname)}\` (${formatDuration(parts.voice.durationSec)}, ${parts.voice.mimeType})`,
    );
  }
  if (parts.images?.length) {
    const list = parts.images.map((img) => `\`${files.get(img.pathname)}\` (${img.width}×${img.height})`).join(", ");
    out.push(`${parts.images.length === 1 ? "Photo" : "Photos"}: ${list}`);
  }
  return out.length ? out.join("\n\n") : "_No answer._";
}

export function answersMarkdown(manifest: Manifest): string {
  const files = new Map(mediaEntries(manifest).map((e) => [e.pathname, e.fileName]));
  const { respondent } = manifest;
  const people = respondent.people ?? {};
  const answered = manifest.questions.filter((q) => manifest.answers[q.id]).length;

  const lines: string[] = [
    "# Riva Chavan Studio — Founder Questionnaire",
    "",
    `- Submission: ${manifest.submissionId}`,
    `- Submitted: ${formatDateTime(manifest.submittedAt)} (${DISPLAY_TIME_ZONE}) — ${manifest.submittedAt}`,
  ];
  if (respondent.name || respondent.email) {
    lines.push(
      `- Respondent: ${[respondent.name, respondent.email && `<${respondent.email}>`].filter(Boolean).join(" ")}`,
    );
  }
  if (manifest.questions.some((q) => q.perPerson)) {
    lines.push(`- Separate answer slots: ${PERSON_SLOTS.map((s) => `${people[s] ?? s} (${s})`).join(", ")}`);
  }
  lines.push(
    `- Answered: ${answered} of ${manifest.questions.length} questions`,
    "",
    "Questions marked “answered separately by each founder” have one answer per founder.",
    "Any answer may combine writing, a voice recording and photos. Recordings and photos are attached",
    "as files named by question number; listen to recordings for the full answer.",
  );

  let section: string | undefined;
  manifest.questions.forEach((q, index) => {
    if (q.section && q.section !== section) {
      section = q.section;
      lines.push("", "---", "", `# ${section}`);
      if (q.sectionDescription) lines.push("", q.sectionDescription);
    }
    lines.push("", `## Q${index + 1} [${q.type}] ${q.prompt}`);
    if (q.helperText) lines.push("", q.helperText);
    if (q.perPerson) lines.push("", "_Answered separately by each founder._");

    const answer = manifest.answers[q.id];
    const prompt = answer?.questionPrompt;
    if (prompt && prompt !== q.prompt) lines.push("", `_Prompt as answered: ${prompt}_`);

    if (q.perPerson) {
      const bySlot = new Map(answer ? answerSlots(answer).map(([slot, v]) => [slot, v]) : []);
      for (const slot of PERSON_SLOTS) {
        const v = bySlot.get(slot);
        lines.push("", `**${people[slot] ?? slot}:**`, "", v ? describeSlot(v, files) : "_No answer._");
      }
    } else if (answer) {
      const [[, parts]] = answerSlots(answer);
      lines.push("", describeSlot(parts, files));
    } else {
      lines.push("", "_No answer._");
    }
  });

  return `${lines.join("\n")}\n`;
}
