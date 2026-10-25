"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PersonSlot, Question } from "@/config/questions";
import { ChapterCard } from "@/components/questionnaire/ChapterCard";
import { DoneScreen } from "@/components/questionnaire/DoneScreen";
import { IntroScreen } from "@/components/questionnaire/IntroScreen";
import { QuestionScreen } from "@/components/questionnaire/QuestionScreen";
import { ReviewScreen } from "@/components/questionnaire/ReviewScreen";
import { ProgressLine, Wordmark } from "@/components/ui";
import { clearDraft, isAnswered, loadDraft, newDraft, saveDraft, type Draft, type DraftSlot } from "@/lib/draft";
import type { ClientSlot, SubmitBody } from "@/lib/manifest";
import type { SlotKey } from "@/lib/paths";
import { buildSections, type SectionInfo } from "@/lib/sections";

function slotsOf(q: Question): SlotKey[] {
  return q.perPerson ? ["p1", "p2"] : ["main"];
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function hasFinePointer(): boolean {
  return typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
}

export function Questionnaire({
  questions,
  defaultPeople,
}: {
  questions: Question[];
  defaultPeople: Record<PersonSlot, string>;
}) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [doneId, setDoneId] = useState<string | null>(null);
  const [previews, setPreviews] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<Record<string, boolean>>({});
  const [navError, setNavError] = useState<string | null>(null);
  const [chapter, setChapter] = useState<SectionInfo | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [resumeStep, setResumeStep] = useState<number | null>(null);
  const previewsRef = useRef(previews);
  useEffect(() => {
    previewsRef.current = previews;
  }, [previews]);

  const total = questions.length;
  const reviewStep = total + 1;
  const sections = useMemo(() => buildSections(questions), [questions]);
  const sectionById = useMemo(() => {
    const map = new Map<string, SectionInfo>();
    for (const s of sections) for (const id of s.questionIds) map.set(id, s);
    return map;
  }, [sections]);
  const questionNumberById = useMemo(
    () => new Map(sections.flatMap((section) => section.questionIds.map((id, index) => [id, index + 1] as const))),
    [sections],
  );

  // Restore (or start) the draft on the client only.
  useEffect(() => {
    const restored = loadDraft();
    const d = restored ?? newDraft();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage is only readable after mount
    setDraft({ ...d, step: 0 });
    if (restored && restored.step > 0) setResumeStep(Math.min(restored.step, total));
  }, [total]);

  // Autosave, lightly debounced.
  useEffect(() => {
    if (!draft) return;
    const t = window.setTimeout(() => saveDraft(draft), 250);
    return () => window.clearTimeout(t);
  }, [draft]);

  // Free audio/image object URLs when leaving the page.
  useEffect(() => () => Object.values(previewsRef.current).forEach((u) => URL.revokeObjectURL(u)), []);

  const people = useMemo(() => {
    const named = draft?.respondent.people;
    return {
      p1: named?.p1.trim() || defaultPeople.p1,
      p2: named?.p2.trim() || defaultPeople.p2,
    };
  }, [draft?.respondent.people, defaultPeople]);

  const missing = useMemo(() => {
    const set = new Set<string>();
    if (!draft) return set;
    for (const q of questions) {
      if (q.required && !slotsOf(q).every((s) => isAnswered(draft.answers[q.id]?.[s]))) set.add(q.id);
    }
    return set;
  }, [draft, questions]);

  const step = draft?.step ?? 0;
  const question = step >= 1 && step <= total ? questions[step - 1] : null;
  const anyBusy = Object.values(busy).some(Boolean);

  const goTo = useCallback(
    (target: number) => {
      const to = Math.max(0, Math.min(reviewStep, target));
      // Entering a new chapter going forward plays its title card.
      if (to > step && to >= 1 && to <= total && !prefersReducedMotion()) {
        const incoming = sectionById.get(questions[to - 1].id);
        const previous = step >= 1 && step <= total ? sectionById.get(questions[step - 1].id) : undefined;
        const opensChapter = incoming?.questionIds[0] === questions[to - 1].id || step === 0;
        if (incoming?.title && incoming !== previous && opensChapter) setChapter(incoming);
      }
      setDraft((d) => (d ? { ...d, step: to } : d));
      setNavError(null);
      setSubmitError(null);
      setBusy({});
      window.scrollTo({ top: 0 });
    },
    [questions, reviewStep, sectionById, step, total],
  );

  const next = useCallback(() => {
    if (!draft) return;
    if (question) {
      if (anyBusy) {
        setNavError("Finish saving your recording or photos before moving on.");
        return;
      }
      const answers = draft.answers[question.id] ?? {};
      if (question.required && !slotsOf(question).every((s) => isAnswered(answers[s]))) {
        setNavError(
          question.perPerson
            ? "Each answer space needs a response before moving on."
            : "This question needs an answer before moving on.",
        );
        return;
      }
    }
    goTo(step + 1);
  }, [anyBusy, draft, goTo, question, step]);

  const back = useCallback(() => {
    if (anyBusy) {
      setNavError("Finish saving your recording or photos before going back.");
      return;
    }
    goTo(step - 1);
  }, [anyBusy, goTo, step]);

  // Ctrl/⌘ + Enter moves forward from anywhere on a question.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || chapter || !question) return;
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        next();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [chapter, next, question]);

  const updateSlot = useCallback((questionId: string, slot: SlotKey, update: (prev: DraftSlot) => DraftSlot) => {
    setNavError(null);
    setDraft((d) => {
      if (!d) return d;
      const slots = { ...(d.answers[questionId] ?? {}) };
      slots[slot] = update(slots[slot] ?? {});
      return { ...d, answers: { ...d.answers, [questionId]: slots } };
    });
  }, []);

  /** Session-only previews of uploaded media, keyed by blob pathname. */
  const setPreview = useCallback((pathname: string, url: string | undefined) => {
    setPreviews((p) => {
      if (p[pathname] && p[pathname] !== url) URL.revokeObjectURL(p[pathname]);
      const copy = { ...p };
      if (url) copy[pathname] = url;
      else delete copy[pathname];
      return copy;
    });
  }, []);

  const setPartBusy = useCallback((key: string, value: boolean) => {
    setBusy((b) => (!!b[key] === value ? b : { ...b, [key]: value }));
  }, []);

  const submit = async () => {
    if (!draft || submitting) return;
    setSubmitting(true);
    setSubmitError(null);

    const answers: SubmitBody["answers"] = {};
    for (const q of questions) {
      for (const slot of slotsOf(q)) {
        const v = draft.answers[q.id]?.[slot];
        if (!v || !isAnswered(v)) continue;
        // Drop client-only fields (thumbnails, local sizes) — the server re-reads sizes from storage.
        const clean: ClientSlot = {};
        if (v.text?.trim()) clean.text = v.text;
        if (v.voice) {
          const { pathname, mimeType, durationSec } = v.voice;
          clean.voice = { pathname, mimeType, durationSec };
        }
        if (v.images?.length) {
          clean.images = v.images.map(({ pathname, mimeType, width, height }) => ({
            pathname,
            mimeType,
            width,
            height,
          }));
        }
        (answers[q.id] ??= {})[slot] = clean;
      }
    }
    const named = [draft.respondent.people.p1.trim(), draft.respondent.people.p2.trim()].filter(Boolean);
    const body = {
      submissionId: draft.submissionId,
      respondent: {
        name: named.join(" & ") || undefined,
        email: draft.respondent.email.trim() || undefined,
        people: {
          p1: draft.respondent.people.p1.trim() || undefined,
          p2: draft.respondent.people.p2.trim() || undefined,
        },
      },
      website: draft.website || undefined,
      answers,
    };

    try {
      const res = await fetch("/api/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        setSubmitError(json.error ?? "We couldn't send your answers. Please try again.");
        setSubmitting(false);
        return;
      }
      clearDraft();
      setDoneId(draft.submissionId);
      window.scrollTo({ top: 0 });
    } catch {
      setSubmitError("You seem to be offline. Your answers are safe on this device. Reconnect and try again.");
      setSubmitting(false);
    }
  };

  if (doneId) return <DoneScreen submissionId={doneId} />;

  if (!draft) return <div className="min-h-dvh" aria-busy="true" />;

  const currentSection = question ? sectionById.get(question.id) : undefined;

  return (
    <div className="flex min-h-dvh flex-col">
      {step > 0 && (
        <header className="sticky top-0 z-40 bg-paper">
          <div className="mx-auto flex h-14 w-full max-w-[60rem] items-center justify-between gap-6 px-6 sm:px-8">
            <button
              type="button"
              onClick={() => {
                if (anyBusy) return setNavError("Finish saving your recording or photos first.");
                setResumeStep(Math.min(step, total));
                goTo(0);
              }}
              className="rounded-[2px]"
              aria-label="Riva Chavan Studio — back to the start"
            >
              <Wordmark />
            </button>
            {currentSection?.title && (
              <p className="hidden min-w-0 truncate text-sm text-ink-2 md:block">
                <span className="mr-2 tabular-nums text-clay">{currentSection.number}.</span>
                {currentSection.title}
              </p>
            )}
            <p className="shrink-0 text-sm tabular-nums text-ink-2" aria-live="polite">
              {question ? (
                <>
                  <span className="sr-only">Question </span>
                  {questionNumberById.get(question.id)}{" "}
                  <span className="text-ink-3">/ {currentSection?.questionIds.length ?? total}</span>
                </>
              ) : (
                "Review"
              )}
            </p>
          </div>
          <ProgressLine value={question ? ((step - 1) / total) * 100 : 100} label="Questionnaire progress" />
        </header>
      )}

      {step === 0 ? (
        <IntroScreen
          draft={draft}
          resumeStep={resumeStep}
          onWebsiteChange={(website) => setDraft((d) => (d ? { ...d, website } : d))}
          onBegin={() => goTo(resumeStep ?? 1)}
          onStartOver={() => {
            clearDraft();
            Object.values(previews).forEach((u) => URL.revokeObjectURL(u));
            setPreviews({});
            setResumeStep(null);
            setDraft({ ...newDraft(), respondent: draft.respondent });
          }}
        />
      ) : question ? (
        chapter ? null : (
          <QuestionScreen
            key={question.id}
            question={question}
            number={questionNumberById.get(question.id) ?? step}
            submissionId={draft.submissionId}
            people={people}
            answers={draft.answers[question.id] ?? {}}
            previews={previews}
            autoFocus={hasFinePointer()}
            nextLabel={
              step === total
                ? "Review answers"
                : !question.required && !slotsOf(question).some((s) => isAnswered(draft.answers[question.id]?.[s]))
                  ? "Skip"
                  : "Next"
            }
            error={navError}
            canGoBack={step > 1}
            onSlotChange={(slot, update) => updateSlot(question.id, slot, update)}
            onPreview={setPreview}
            onBusy={setPartBusy}
            onNext={next}
            onBack={back}
          />
        )
      ) : (
        <ReviewScreen
          questions={questions}
          sections={sections}
          answers={draft.answers}
          previews={previews}
          people={people}
          missing={missing}
          submitting={submitting}
          error={submitError}
          onEdit={(index) => goTo(index + 1)}
          onSubmit={submit}
        />
      )}

      {chapter && <ChapterCard section={chapter} onDone={() => setChapter(null)} />}
    </div>
  );
}
