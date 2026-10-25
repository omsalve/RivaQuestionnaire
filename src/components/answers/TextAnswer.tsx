"use client";

import { useLayoutEffect, useRef } from "react";

const MAX_LENGTH = 20_000;

/**
 * Writing on the questionnaire's dotted lines. The textarea grows with its
 * content (min four lines), so long answers never hide behind a scrollbar.
 */
export function TextAnswer({
  id,
  value,
  onChange,
  multiline = true,
  label,
  placeholder = "Answer as yourself, not as a brochure.",
  autoFocus,
  onSubmitShortcut,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  label: string;
  placeholder?: string;
  autoFocus?: boolean;
  onSubmitShortcut?: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);

  const near = value.length > MAX_LENGTH * 0.9;

  return (
    <div className="group">
      <label htmlFor={id} className="sr-only">
        {label}
      </label>
      {multiline ? (
        <textarea
          ref={ref}
          id={id}
          value={value}
          autoFocus={autoFocus}
          maxLength={MAX_LENGTH}
          rows={4}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              onSubmitShortcut?.();
            }
          }}
          className="answer-lines block min-h-[calc(var(--answer-line)*4+2px)] w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[1.0625rem] text-ink outline-none focus-visible:outline-none"
        />
      ) : (
        <input
          id={id}
          value={value}
          autoFocus={autoFocus}
          maxLength={MAX_LENGTH}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              onSubmitShortcut?.();
            }
          }}
          className="answer-lines block h-[var(--answer-line)] w-full border-0 bg-transparent p-0 text-[1.0625rem] text-ink outline-none"
        />
      )}
      <span aria-hidden="true" className="mt-1 block h-px bg-rule">
        <span className="block h-px origin-left scale-x-0 bg-clay transition-transform duration-700 ease-out-expo group-focus-within:scale-x-100" />
      </span>
      {near && (
        <p className="mt-2 text-sm tabular-nums text-ink-2" aria-live="polite">
          {(MAX_LENGTH - value.length).toLocaleString()} characters left
        </p>
      )}
    </div>
  );
}
