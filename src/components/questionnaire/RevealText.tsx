import type { CSSProperties } from "react";

/**
 * Splits text into words that focus in one after another, like a title card.
 * Words stay real text (spaces between spans), so it reads naturally to
 * screen readers and wraps with text-wrap: balance.
 */
export function RevealText({ text, delayMs = 0 }: { text: string; delayMs?: number }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <>
      {words.map((word, i) => (
        <span key={i}>
          <span className="reveal-word" style={{ "--i": i, "--delay": `${delayMs}ms` } as CSSProperties}>
            {word}
          </span>
          {i < words.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}
