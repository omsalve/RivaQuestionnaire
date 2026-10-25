"use client";

import { useState, type CSSProperties, type FormEvent } from "react";
import { ArrowRight } from "@/components/Icons";
import { Button, Wordmark } from "@/components/ui";
import type { Draft } from "@/lib/draft";

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

export function IntroScreen({
  draft,
  resumeStep,
  onWebsiteChange,
  onBegin,
  onStartOver,
}: {
  draft: Draft;
  resumeStep: number | null;
  onWebsiteChange: (website: string) => void;
  onBegin: () => void;
  onStartOver: () => void;
}) {
  const [confirmReset, setConfirmReset] = useState(false);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    onBegin();
  };

  return (
    <main className="mx-auto w-full max-w-[42rem] px-6 pb-24 pt-[clamp(3rem,14vh,8rem)] sm:px-8">
      <Wordmark className="wordmark-in block" />
      <h1
        className="reveal-focus mt-5 font-serif text-[clamp(2.5rem,1.6rem+4.2vw,4.25rem)] leading-[1.02] tracking-[-0.022em] text-ink"
        style={delay(350)}
      >
        Riva Chavan Studio — Founder Questionnaire
      </h1>
      <span aria-hidden="true" className="rule-draw mt-10 block h-px w-full bg-clay" style={delay(800)} />

      <div className="reveal mt-10 max-w-[60ch] space-y-5 text-[1.0625rem] leading-[1.7]" style={delay(1050)}>
        <h2 className="font-serif text-[1.5rem] text-ink">How to use this</h2>
        <p>
          Your answers shape the brand philosophy, the rebrand and the brand story for the next 12 months. Every
          question here is one only you can answer.
        </p>
        <ul className="list-disc space-y-3 pl-6 text-ink-2">
          <li>Answer as yourself, not as a brochure. Opinions and strong dislikes help us more than polished lines.</li>
          <li>Voice notes are welcome. If a question is easier to talk through, record it and we will transcribe.</li>
          <li>&ldquo;Don&rsquo;t know yet&rdquo; is a valid answer. It shows us where to help you decide.</li>
          <li>Images beat adjectives. Where a question asks about taste, attach references.</li>
        </ul>
        <p className="text-ink-2">Time needed: about 90 minutes.</p>
      </div>

      <form onSubmit={submit} className="reveal mt-14 space-y-8" style={delay(1250)} noValidate>
        <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
          <label htmlFor="website">Website</label>
          <input
            id="website"
            name="website"
            tabIndex={-1}
            autoComplete="off"
            value={draft.website}
            onChange={(e) => onWebsiteChange(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-x-6 gap-y-4 pt-2">
          <Button type="submit" variant="primary">
            {resumeStep ? `Continue from question ${resumeStep}` : "Begin"} <ArrowRight size={16} />
          </Button>
          {resumeStep &&
            (confirmReset ? (
              <span className="flex items-center gap-4 text-[0.9375rem]">
                <span className="text-ink-2">Clear every answer?</span>
                <Button variant="quiet" className="text-danger" onClick={onStartOver}>
                  Yes, start over
                </Button>
                <Button variant="quiet" onClick={() => setConfirmReset(false)}>
                  Keep them
                </Button>
              </span>
            ) : (
              <Button variant="quiet" onClick={() => setConfirmReset(true)}>
                Start over
              </Button>
            ))}
        </div>
      </form>
    </main>
  );
}
