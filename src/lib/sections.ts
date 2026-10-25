import type { Question } from "@/config/questions";

export interface SectionInfo {
  number: number;
  title: string;
  description?: string;
  questionIds: string[];
}

/** Groups consecutive questions by their `section` into numbered chapters. */
export function buildSections(questions: Question[]): SectionInfo[] {
  const sections: SectionInfo[] = [];
  for (const q of questions) {
    const title = q.section ?? "";
    let current = sections.at(-1);
    if (!current || current.title !== title) {
      current = {
        number: sections.length + 1,
        title,
        ...(q.sectionDescription ? { description: q.sectionDescription } : {}),
        questionIds: [],
      };
      sections.push(current);
    }
    current.questionIds.push(q.id);
  }
  return sections;
}

export function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

const WORDS = [
  "zero",
  "one",
  "two",
  "three",
  "four",
  "five",
  "six",
  "seven",
  "eight",
  "nine",
  "ten",
  "eleven",
  "twelve",
];

export function countWord(n: number): string {
  return WORDS[n] ?? String(n);
}
