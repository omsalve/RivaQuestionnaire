import type { CSSProperties } from "react";
import { Wordmark } from "@/components/ui";

const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as CSSProperties;

export function DoneScreen({ submissionId }: { submissionId: string }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[42rem] flex-col justify-center px-6 py-20 sm:px-8">
      <Wordmark className="wordmark-in block" />
      <h1
        className="reveal-focus mt-6 font-serif text-[clamp(3rem,2rem+5vw,5rem)] leading-none tracking-[-0.025em]"
        style={delay(300)}
        tabIndex={-1}
      >
        Thank you.
      </h1>
      <span aria-hidden="true" className="rule-draw mt-10 block h-px w-full bg-clay" style={delay(700)} />
      <p className="reveal mt-8 max-w-[46ch] text-[1.125rem] leading-[1.7] text-ink" style={delay(1000)} role="status">
        Your answers shape the brand philosophy, the rebrand and the brand story for the next 12 months.
      </p>
      <p className="reveal mt-6 text-sm tabular-nums text-ink-3" style={delay(1250)}>
        Reference {submissionId}
      </p>
    </main>
  );
}
