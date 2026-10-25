import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "outline" | "quiet" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-ink text-paper hover:bg-clay-deep active:bg-clay-deep disabled:bg-ink/30 disabled:text-paper/90 px-6",
  outline:
    "border border-ink/20 text-ink hover:border-clay hover:text-clay-deep disabled:text-ink-3 disabled:border-rule px-5",
  quiet: "text-ink-2 hover:text-clay-deep disabled:text-ink-3/60 px-2 -mx-2",
  danger: "border border-danger/40 text-danger hover:bg-danger hover:text-paper px-5",
};

export function buttonClass(variant: Variant = "primary", extra = ""): string {
  return [
    "inline-flex min-h-12 items-center justify-center gap-2 rounded-[2px] text-[0.9375rem] font-bold tracking-[0.01em]",
    "transition-[background-color,color,border-color,opacity] duration-200 ease-out",
    "disabled:cursor-not-allowed select-none touch-manipulation",
    VARIANTS[variant],
    extra,
  ].join(" ");
}

export function Button({
  variant = "primary",
  className = "",
  children,
  type = "button",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; children: ReactNode }) {
  return (
    <button type={type} className={buttonClass(variant, className)} {...rest}>
      {children}
    </button>
  );
}

/** A thin determinate bar in the accent colour. */
export function ProgressLine({ value, label }: { value: number; label: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pct)}
      className="h-px w-full bg-rule"
    >
      <div
        className="h-px origin-left bg-clay transition-transform duration-[900ms] ease-out-expo"
        style={{ transform: `scaleX(${pct / 100})` }}
      />
    </div>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-sans text-[0.6875rem] font-bold uppercase tracking-[0.32em] text-clay ${className}`}>
      Riva Chavan Studio
    </span>
  );
}
