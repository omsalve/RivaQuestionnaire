import type { MediaMime } from "@/lib/paths";

/** The SDK retries flaky requests with backoff; past this, tell the respondent instead of spinning. */
const UPLOAD_TIMEOUT_MS = 3 * 60 * 1000;

/**
 * Uploads one media answer straight from the browser to the private Blob store.
 * /api/upload only issues a scoped token; the bytes never touch a function.
 */
export async function uploadMedia(
  pathname: string,
  body: Blob,
  contentType: MediaMime,
  onProgress: (percentage: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  const { upload } = await import("@vercel/blob/client");
  const timeout = new AbortController();
  const timer = window.setTimeout(() => timeout.abort(), UPLOAD_TIMEOUT_MS);
  const onAbort = () => timeout.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    await upload(pathname, body, {
      access: "private",
      handleUploadUrl: "/api/upload",
      contentType,
      multipart: false,
      abortSignal: timeout.signal,
      onUploadProgress: ({ percentage }) => onProgress(percentage),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    console.error("[upload]", error);
    throw new Error(
      typeof navigator !== "undefined" && !navigator.onLine
        ? "You're offline. Reconnect and try again — your answer is still here."
        : timeout.signal.aborted
          ? "The upload is taking too long. Check your connection and try again."
          : "The upload didn't go through. Check your connection and try again.",
    );
  } finally {
    window.clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}
