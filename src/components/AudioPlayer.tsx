"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "@/components/Icons";
import { formatDuration } from "@/lib/format";

/**
 * A quiet player around <audio>. Chrome's MediaRecorder WebM files report an
 * Infinity duration until fully scanned, so we seek far ahead once to force
 * the browser to compute it, and fall back to the duration we measured.
 */
export function AudioPlayer({ src, knownDuration, label }: { src: string; knownDuration?: number; label: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(knownDuration ?? 0);
  const fixingRef = useRef(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onMeta = () => {
      if (audio.duration === Infinity || Number.isNaN(audio.duration)) {
        fixingRef.current = true;
        audio.currentTime = 1e101;
      } else {
        setDuration(audio.duration);
      }
    };
    const onTime = () => {
      if (fixingRef.current) {
        fixingRef.current = false;
        if (Number.isFinite(audio.duration)) setDuration(audio.duration);
        audio.currentTime = 0;
        return;
      }
      setCurrent(audio.currentTime);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => {
      setPlaying(false);
      setCurrent(0);
    };

    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  const total = duration || knownDuration || 0;
  const progress = total > 0 ? Math.min(100, (current / total) * 100) : 0;

  return (
    <div className="flex items-center gap-4">
      <audio ref={audioRef} src={src} preload="metadata" />
      <button
        type="button"
        onClick={() => {
          const audio = audioRef.current;
          if (!audio) return;
          if (audio.paused) void audio.play().catch(() => setPlaying(false));
          else audio.pause();
        }}
        aria-label={playing ? `Pause ${label}` : `Play ${label}`}
        className="grid size-11 shrink-0 place-items-center rounded-full border border-ink/15 text-ink transition-colors hover:border-clay hover:text-clay-deep"
      >
        {playing ? <Pause size={16} /> : <Play size={16} className="translate-x-px" />}
      </button>
      <input
        type="range"
        className="scrub min-w-0 flex-1"
        min={0}
        max={total || 1}
        step={0.1}
        value={Math.min(current, total || 1)}
        aria-label={`Seek ${label}`}
        aria-valuetext={`${formatDuration(current)} of ${formatDuration(total)}`}
        style={{ ["--progress" as string]: `${progress}%` }}
        onChange={(e) => {
          const audio = audioRef.current;
          if (!audio) return;
          audio.currentTime = Number(e.target.value);
          setCurrent(audio.currentTime);
        }}
      />
      <span className="w-[5.5rem] shrink-0 text-right text-sm tabular-nums text-ink-2">
        {formatDuration(current)} / {formatDuration(total)}
      </span>
    </div>
  );
}
