"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AudioPlayer } from "@/components/AudioPlayer";
import { Check, Mic, Redo, StopSquare, Trash } from "@/components/Icons";
import { Button } from "@/components/ui";
import { formatDuration } from "@/lib/format";
import type { VoiceFile } from "@/lib/manifest";
import { MEDIA_RULES, mediaPathname, type SlotKey } from "@/lib/paths";
import {
  classifyGetUserMediaError,
  describeRecorderProblem,
  pickRecorderFormat,
  storedFormatFor,
  type RecorderProblem,
} from "@/lib/recorder";
import { uploadMedia } from "@/lib/upload";

type Phase =
  | { name: "idle" }
  | { name: "requesting" }
  | { name: "recording" }
  | { name: "review"; blob: Blob; url: string; mime: VoiceFile["mimeType"]; ext: "webm" | "m4a"; durationSec: number }
  | { name: "uploading"; percent: number };

const BARS = 28;

interface Session {
  stream: MediaStream;
  recorder: MediaRecorder;
  chunks: Blob[];
  ctx: AudioContext | null;
  startedAt: number;
  raf: number;
  timer: number;
}

export function VoiceAnswer({
  submissionId,
  questionId,
  slot,
  maxDurationSec,
  value,
  previewUrl,
  label,
  variant = "primary",
  onSaved,
  onRemove,
  onBusyChange,
}: {
  submissionId: string;
  questionId: string;
  slot: SlotKey;
  maxDurationSec: number;
  value?: VoiceFile;
  previewUrl?: string;
  label: string;
  /** "primary": the recorder is the answer. "note": a compact add-on next to a text answer. */
  variant?: "primary" | "note";
  onSaved: (value: VoiceFile, previewUrl: string) => void;
  onRemove: () => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ name: "idle" });
  const [elapsed, setElapsed] = useState(0);
  const [problem, setProblem] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const sessionRef = useRef<Session | null>(null);
  const barsRef = useRef<(HTMLSpanElement | null)[]>([]);
  const levelsRef = useRef<number[]>(Array(BARS).fill(0));
  const reviewUrlRef = useRef<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const busy = phase.name !== "idle";
  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);

  const teardown = useCallback(() => {
    const s = sessionRef.current;
    if (!s) return;
    cancelAnimationFrame(s.raf);
    window.clearInterval(s.timer);
    s.stream.getTracks().forEach((t) => t.stop());
    void s.ctx?.close().catch(() => undefined);
    sessionRef.current = null;
  }, []);

  const stop = useCallback(() => {
    const s = sessionRef.current;
    if (!s || s.recorder.state === "inactive") return;
    s.recorder.stop();
  }, []);

  // Release the microphone and any unsaved take if the question unmounts.
  useEffect(
    () => () => {
      const s = sessionRef.current;
      if (s && s.recorder.state !== "inactive") {
        s.recorder.onstop = null;
        s.recorder.stop();
      }
      teardown();
      abortRef.current?.abort();
      if (reviewUrlRef.current) URL.revokeObjectURL(reviewUrlRef.current);
    },
    [teardown],
  );

  // A locked phone or a switched tab ends the take rather than corrupting it.
  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", onHide);
    return () => document.removeEventListener("visibilitychange", onHide);
  }, [stop]);

  const fail = (p: RecorderProblem) => {
    teardown();
    setPhase({ name: "idle" });
    const message = describeRecorderProblem(p);
    setProblem(message);
    setAnnouncement(message);
  };

  const start = async () => {
    setProblem(null);
    if (!window.isSecureContext) return fail("insecure");
    if (!navigator.mediaDevices?.getUserMedia) return fail("unsupported");
    const format = pickRecorderFormat();
    if (!format) return fail("unsupported");

    // iOS only lets an AudioContext run if it's created and resumed inside the tap.
    const Ctx: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    let ctx: AudioContext | null = null;
    try {
      ctx = Ctx ? new Ctx() : null;
      void ctx?.resume().catch(() => undefined);
    } catch {
      ctx = null;
    }

    setPhase({ name: "requesting" });
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch (error) {
      void ctx?.close().catch(() => undefined);
      return fail(classifyGetUserMediaError(error));
    }

    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, {
        ...(format.requested ? { mimeType: format.requested } : {}),
        audioBitsPerSecond: 96_000,
      });
    } catch {
      try {
        recorder = new MediaRecorder(stream);
      } catch {
        stream.getTracks().forEach((t) => t.stop());
        void ctx?.close().catch(() => undefined);
        return fail("unsupported");
      }
    }

    const session: Session = { stream, recorder, chunks: [], ctx, startedAt: 0, raf: 0, timer: 0 };
    sessionRef.current = session;

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) session.chunks.push(e.data);
    };
    recorder.onerror = () => fail("unknown");
    recorder.onstop = () => {
      const durationSec = Math.round(((performance.now() - session.startedAt) / 1000) * 10) / 10;
      const actual = recorder.mimeType || session.chunks[0]?.type || format.requested || "";
      teardown();
      const stored = storedFormatFor(actual);
      if (!stored || stored.mime === "image/jpeg") return fail("unsupported");
      const blob = new Blob(session.chunks, { type: stored.mime });
      if (blob.size === 0) return fail("unknown");
      if (blob.size > MEDIA_RULES.voice.maxBytes) {
        setPhase({ name: "idle" });
        setProblem("That recording is too large to upload. Please record a shorter answer.");
        return;
      }
      if (reviewUrlRef.current) URL.revokeObjectURL(reviewUrlRef.current);
      const url = URL.createObjectURL(blob);
      reviewUrlRef.current = url;
      setPhase({
        name: "review",
        blob,
        url,
        mime: stored.mime as VoiceFile["mimeType"],
        ext: stored.ext as "webm" | "m4a",
        durationSec,
      });
      setAnnouncement(
        `Recording stopped at ${formatDuration(durationSec)}. Listen back, then save it or record again.`,
      );
    };

    // Level meter: RMS of the waveform, scrolling right to left.
    if (ctx) {
      try {
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 1024;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.fftSize);
        let last = 0;
        const tick = (t: number) => {
          session.raf = requestAnimationFrame(tick);
          if (t - last < 70) return;
          last = t;
          analyser.getByteTimeDomainData(data);
          let sum = 0;
          for (const v of data) sum += ((v - 128) / 128) ** 2;
          const level = Math.min(1, Math.sqrt(sum / data.length) * 3.2);
          const levels = levelsRef.current;
          levels.shift();
          levels.push(level);
          levels.forEach((l, i) => {
            const bar = barsRef.current[i];
            if (bar) bar.style.transform = `scaleY(${Math.max(0.08, l)})`;
          });
        };
        session.raf = requestAnimationFrame(tick);
      } catch {
        /* meter is decorative; recording continues */
      }
    }

    levelsRef.current = Array(BARS).fill(0);
    recorder.start();
    session.startedAt = performance.now();
    setElapsed(0);
    setPhase({ name: "recording" });
    setAnnouncement(`Recording. Up to ${formatDuration(maxDurationSec)}.`);
    session.timer = window.setInterval(() => {
      const secs = (performance.now() - session.startedAt) / 1000;
      setElapsed(secs);
      if (secs >= maxDurationSec) stop();
    }, 200);
  };

  const discardReview = () => {
    if (reviewUrlRef.current) URL.revokeObjectURL(reviewUrlRef.current);
    reviewUrlRef.current = null;
    setPhase({ name: "idle" });
  };

  const save = async () => {
    if (phase.name !== "review") return;
    const take = phase;
    const pathname = mediaPathname(submissionId, questionId, slot, { kind: "voice", ext: take.ext });
    const controller = new AbortController();
    abortRef.current = controller;
    setProblem(null);
    setPhase({ name: "uploading", percent: 0 });
    try {
      await uploadMedia(
        pathname,
        take.blob,
        take.mime,
        (percent) => setPhase({ name: "uploading", percent }),
        controller.signal,
      );
      reviewUrlRef.current = null; // ownership passes to the parent's preview map
      onSaved({ pathname, mimeType: take.mime, sizeBytes: take.blob.size, durationSec: take.durationSec }, take.url);
      setPhase({ name: "idle" });
      setAnnouncement("Recording saved.");
    } catch (error) {
      if (controller.signal.aborted) return;
      setPhase(take);
      setProblem(error instanceof Error ? error.message : "Upload failed.");
    }
  };

  const remaining = Math.max(0, maxDurationSec - elapsed);
  const compactIdle = variant === "note" && phase.name === "idle" && !value && !problem;

  return (
    <div className={compactIdle ? "" : "w-full space-y-5"}>
      <p className="sr-only" aria-live="assertive">
        {announcement}
      </p>
      {variant === "note" && !compactIdle && (
        <p className="flex items-center gap-2 text-[0.75rem] font-bold uppercase tracking-[0.14em] text-ink-2">
          <Mic size={14} className="text-clay" /> Voice note
        </p>
      )}

      {phase.name === "recording" || phase.name === "requesting" ? (
        <div className="space-y-6">
          <div className="flex h-16 items-center gap-[3px]" aria-hidden="true">
            {Array.from({ length: BARS }, (_, i) => (
              <span
                key={i}
                ref={(el) => {
                  barsRef.current[i] = el;
                }}
                className="meter-bar h-full w-[3px] rounded-full bg-clay"
                style={{ transform: "scaleY(0.08)", opacity: 0.35 + (i / BARS) * 0.65 }}
              />
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <Button
              variant="primary"
              onClick={stop}
              disabled={phase.name === "requesting"}
              aria-label={`Stop recording ${label}`}
            >
              <StopSquare size={16} />
              {phase.name === "requesting" ? "Waiting for microphone…" : "Stop"}
            </Button>
            <p className="font-serif text-2xl tabular-nums text-ink">
              {formatDuration(elapsed)}
              <span className="ml-2 font-sans text-sm text-ink-2">
                {remaining <= 15 && phase.name === "recording"
                  ? `${Math.ceil(remaining)}s left`
                  : `of ${formatDuration(maxDurationSec)}`}
              </span>
            </p>
          </div>
        </div>
      ) : phase.name === "review" || phase.name === "uploading" ? (
        <div className="space-y-5">
          {phase.name === "review" ? (
            <AudioPlayer src={phase.url} knownDuration={phase.durationSec} label={`your new recording for ${label}`} />
          ) : (
            <UploadProgress percent={phase.percent} />
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button variant="primary" onClick={save} disabled={phase.name === "uploading"}>
              <Check size={16} />
              {phase.name === "uploading" ? "Saving…" : "Save recording"}
            </Button>
            <Button variant="quiet" onClick={discardReview} disabled={phase.name === "uploading"}>
              <Redo size={16} /> Discard and record again
            </Button>
          </div>
        </div>
      ) : value ? (
        <div className="space-y-5">
          {previewUrl ? (
            <AudioPlayer src={previewUrl} knownDuration={value.durationSec} label={`your recording for ${label}`} />
          ) : (
            <p className="flex items-center gap-2 text-ink-2">
              <Check size={16} className="text-clay" /> Recording saved · {formatDuration(value.durationSec)}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <Button variant="outline" onClick={start}>
              <Redo size={16} /> Record again
            </Button>
            <Button variant="quiet" onClick={onRemove}>
              <Trash size={16} /> Remove
            </Button>
          </div>
        </div>
      ) : variant === "note" ? (
        <Button variant="outline" onClick={start} aria-label={`Record a voice note for ${label}`}>
          <Mic size={18} className="text-clay" /> Record a voice note
        </Button>
      ) : (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
          <button
            type="button"
            onClick={start}
            className="group inline-flex items-center gap-4 rounded-full py-1 pr-3 text-left"
            aria-label={`Start recording ${label}`}
          >
            <span className="grid size-16 place-items-center rounded-full bg-clay text-paper transition-[background-color,transform] duration-300 ease-out-expo group-hover:bg-clay-deep group-active:scale-95">
              <Mic size={24} />
            </span>
            <span>
              <span className="block font-bold text-ink">Record your answer</span>
              <span className="block text-sm text-ink-2">Up to {formatDuration(maxDurationSec)} · speak freely</span>
            </span>
          </button>
        </div>
      )}

      {problem && (
        <p role="alert" className="max-w-prose text-[0.9375rem] text-danger">
          {problem}
        </p>
      )}
    </div>
  );
}

export function UploadProgress({ percent }: { percent: number }) {
  return (
    <div className="space-y-2" role="status" aria-live="polite">
      <div className="h-[2px] w-full bg-rule">
        <div
          className="h-[2px] origin-left bg-clay transition-transform duration-300 ease-out"
          style={{ transform: `scaleX(${Math.max(0.02, percent / 100)})` }}
        />
      </div>
      <p className="text-sm tabular-nums text-ink-2">Uploading… {Math.round(percent)}%</p>
    </div>
  );
}
