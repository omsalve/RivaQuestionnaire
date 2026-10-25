"use client";

import { useEffect, useRef, type CSSProperties } from "react";
import { answerModes, DEFAULT_MAX_DURATION_SEC, type PersonSlot, type Question } from "@/config/questions";
import { ImageAnswer } from "@/components/answers/ImageAnswer";
import { TextAnswer } from "@/components/answers/TextAnswer";
import { VoiceAnswer } from "@/components/answers/VoiceAnswer";
import { ArrowLeft, ArrowRight, StarMark } from "@/components/Icons";
import { RevealText } from "@/components/questionnaire/RevealText";
import { Button } from "@/components/ui";
import type { DraftSlot } from "@/lib/draft";
import type { SlotKey } from "@/lib/paths";

export function QuestionScreen({
  question,
  number,
  submissionId,
  people,
  answers,
  previews,
  autoFocus,
  nextLabel,
  error,
  canGoBack,
  onSlotChange,
  onPreview,
  onBusy,
  onNext,
  onBack,
}: {
  question: Question;
  number: number;
  submissionId: string;
  people: Record<PersonSlot, string>;
  answers: Partial<Record<SlotKey, DraftSlot>>;
  /** Local object URLs keyed by blob pathname. */
  previews: Record<string, string>;
  autoFocus: boolean;
  nextLabel: string;
  error: string | null;
  canGoBack: boolean;
  onSlotChange: (slot: SlotKey, update: (prev: DraftSlot) => DraftSlot) => void;
  onPreview: (pathname: string, url: string | undefined) => void;
  onBusy: (key: string, busy: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const slots: SlotKey[] = question.perPerson ? ["p1", "p2"] : ["main"];
  const modes = answerModes(question);
  const wordCount = question.prompt.split(/\s+/).length;
  // The answer area arrives as the last words of the prompt settle.
  const answerDelay = Math.min(wordCount, 36) * 26 + 260;

  useEffect(() => {
    if (!autoFocus || !modes.text) headingRef.current?.focus({ preventScroll: true });
  }, [autoFocus, modes.text]);

  return (
    <article className="mx-auto w-full max-w-[42rem] px-6 pb-24 pt-[clamp(2.5rem,9vh,6rem)] sm:px-8">
      <h1
        ref={headingRef}
        tabIndex={-1}
        className="font-serif text-[clamp(1.5rem,1.05rem+1.9vw,2.125rem)] leading-[1.24] tracking-[-0.008em] text-pretty text-ink outline-none"
      >
        <span className="reveal mr-[0.3em] inline-block tabular-nums text-clay">{number}.</span>
        <RevealText text={question.prompt} delayMs={80} />
      </h1>

      {question.sectionDescription && (
        <p className="reveal mt-5 whitespace-pre-line text-[0.9375rem] leading-[1.7] text-ink-2">
          {question.sectionDescription}
        </p>
      )}

      {(question.perPerson || question.helperText) && (
        <div className="reveal mt-5 space-y-2" style={{ "--delay": `${answerDelay - 120}ms` } as CSSProperties}>
          {question.perPerson && (
            <p className="flex items-center gap-2 text-[0.9375rem] italic text-clay-deep">
              <StarMark size={13} className="shrink-0 text-clay" />
              Each person answers separately{question.required ? "." : ", if you'd like."}
            </p>
          )}
          {question.helperText && (
            <p className="max-w-prose whitespace-pre-line text-[0.9375rem] text-ink-2">{question.helperText}</p>
          )}
        </div>
      )}

      <div
        className={`reveal mt-10 ${question.perPerson ? "space-y-12" : ""}`}
        style={{ "--delay": `${answerDelay}ms` } as CSSProperties}
      >
        {slots.map((slot, index) => {
          const person = slot === "main" ? undefined : people[slot];
          const label = person ? `${person}: ${question.prompt}` : question.prompt;
          const who = person ? `${person}'s answer` : "this question";
          const value = answers[slot] ?? {};
          const voice = modes.voice && (
            <VoiceAnswer
              submissionId={submissionId}
              questionId={question.id}
              slot={slot}
              label={who}
              variant={question.type === "voice" ? "primary" : "note"}
              maxDurationSec={question.maxDurationSec ?? DEFAULT_MAX_DURATION_SEC}
              value={value.voice}
              previewUrl={value.voice ? previews[value.voice.pathname] : undefined}
              onSaved={(v, url) => {
                onPreview(v.pathname, url);
                onSlotChange(slot, (prev) => ({ ...prev, voice: v }));
              }}
              onRemove={() => onSlotChange(slot, (prev) => ({ ...prev, voice: undefined }))}
              onBusyChange={(busy) => onBusy(`${slot}:voice`, busy)}
            />
          );
          const photos = modes.images > 0 && (
            <ImageAnswer
              submissionId={submissionId}
              questionId={question.id}
              slot={slot}
              label={who}
              max={modes.images}
              variant={question.type === "image" ? "primary" : "note"}
              images={value.images ?? []}
              previews={previews}
              onAdd={(img, url) => {
                onPreview(img.pathname, url);
                onSlotChange(slot, (prev) => ({
                  ...prev,
                  images: [...(prev.images ?? []).filter((i) => i.pathname !== img.pathname), img],
                }));
              }}
              onRemove={(pathname) => {
                onPreview(pathname, undefined);
                onSlotChange(slot, (prev) => ({
                  ...prev,
                  images: (prev.images ?? []).filter((i) => i.pathname !== pathname),
                }));
              }}
              onBusyChange={(busy) => onBusy(`${slot}:images`, busy)}
            />
          );
          return (
            <section key={slot} aria-label={person}>
              {person && (
                <h2 className="mb-3 flex items-baseline gap-3 text-[0.8125rem] font-bold uppercase tracking-[0.14em] text-clay">
                  {person}
                </h2>
              )}
              {modes.text ? (
                <>
                  <TextAnswer
                    id={`answer-${question.id}-${slot}`}
                    label={label}
                    multiline={question.multiline ?? true}
                    value={value.text ?? ""}
                    autoFocus={autoFocus && index === 0}
                    placeholder={
                      person
                        ? `${person}'s answer…`
                        : modes.voice
                          ? "Answer as yourself, not as a brochure."
                          : undefined
                    }
                    onChange={(text) => onSlotChange(slot, (prev) => ({ ...prev, text }))}
                    onSubmitShortcut={onNext}
                  />
                  {(voice || photos) && (
                    <div className="mt-5 flex flex-wrap items-start gap-x-3 gap-y-6">
                      {voice}
                      {photos}
                    </div>
                  )}
                </>
              ) : (
                <div className="flex flex-wrap items-start gap-x-3 gap-y-8">
                  {voice}
                  {photos}
                </div>
              )}
            </section>
          );
        })}

        <nav className="mt-14 flex items-center justify-between gap-4" aria-label="Question navigation">
          <Button variant="quiet" onClick={onBack} disabled={!canGoBack}>
            <ArrowLeft size={16} /> Back
          </Button>
          <div className="flex items-center gap-5">
            <span className="hidden text-xs tracking-wide text-ink-3 pointer-fine:inline" aria-hidden="true">
              Ctrl / ⌘ + Enter
            </span>
            <Button variant="primary" onClick={onNext}>
              {nextLabel} <ArrowRight size={16} />
            </Button>
          </div>
        </nav>
        {error && (
          <p role="alert" className="mt-5 text-right text-[0.9375rem] text-danger">
            {error}
          </p>
        )}
      </div>
    </article>
  );
}
