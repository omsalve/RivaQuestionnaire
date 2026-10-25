import type { MediaExt, MediaMime } from "@/lib/paths";

/**
 * MediaRecorder format negotiation.
 * Chrome, Firefox and Android record Opus in WebM; iOS Safari records AAC in MP4.
 * Newer Safari versions also accept WebM, which is fine: whichever the browser
 * picks, the stored extension follows the container it actually produced.
 */
const CANDIDATES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/aac"];

export interface RecorderFormat {
  /** Value passed to the MediaRecorder constructor, or undefined for the browser default. */
  requested: string | undefined;
}

export function pickRecorderFormat(): RecorderFormat | null {
  if (typeof window === "undefined" || typeof window.MediaRecorder === "undefined") return null;
  const supported = CANDIDATES.find((t) => {
    try {
      return MediaRecorder.isTypeSupported(t);
    } catch {
      return false;
    }
  });
  return { requested: supported };
}

/** Maps what the recorder actually produced to a stored format, or null if we can't store it. */
export function storedFormatFor(actualMime: string): { mime: MediaMime; ext: MediaExt } | null {
  const base = actualMime.split(";")[0].trim().toLowerCase();
  if (base === "audio/webm" || base === "video/webm") return { mime: "audio/webm", ext: "webm" };
  if (base === "audio/mp4" || base === "video/mp4" || base === "audio/x-m4a" || base === "audio/aac") {
    return { mime: "audio/mp4", ext: "m4a" };
  }
  return null;
}

export type RecorderProblem = "unsupported" | "insecure" | "denied" | "no-device" | "busy" | "unknown";

export function describeRecorderProblem(problem: RecorderProblem): string {
  switch (problem) {
    case "insecure":
      return "Recording needs a secure (https) connection. Open the questionnaire from its https link.";
    case "unsupported":
      return "This browser can't record audio. Try Safari on iPhone or Chrome on Android or desktop.";
    case "denied":
      return "Microphone access is blocked. Allow the microphone for this site in your browser settings, then try again.";
    case "no-device":
      return "No microphone was found. Connect one and try again.";
    case "busy":
      return "Your microphone is in use by another app. Close it and try again.";
    default:
      return "Recording couldn't start. Please try again.";
  }
}

export function classifyGetUserMediaError(error: unknown): RecorderProblem {
  const name = error instanceof DOMException ? error.name : error instanceof Error ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "denied";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "no-device";
  if (name === "NotReadableError" || name === "AbortError") return "busy";
  return "unknown";
}
