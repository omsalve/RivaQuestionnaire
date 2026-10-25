"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Close, ImageIcon, Plus } from "@/components/Icons";
import { buttonClass } from "@/components/ui";
import type { DraftImage } from "@/lib/draft";
import { compressImage, ImageDecodeError } from "@/lib/image";
import { mediaPathname, parseMediaFileName, type SlotKey } from "@/lib/paths";
import { uploadMedia } from "@/lib/upload";

interface Pending {
  key: string;
  index: number;
  url?: string;
  percent: number;
}

const SHADOW = "shadow-[0_1px_2px_rgb(36_32_30/0.08),0_8px_24px_-12px_rgb(36_32_30/0.25)]";

function photoIndex(pathname: string): number {
  return parseMediaFileName(pathname.split("/").pop() ?? "")?.index ?? 0;
}

/**
 * Up to `max` photos for one answer slot. Each photo is resized, stripped of
 * EXIF/GPS, and uploaded the moment it's chosen, to its own numbered file.
 */
export function ImageAnswer({
  submissionId,
  questionId,
  slot,
  max,
  images,
  previews,
  label,
  variant = "primary",
  onAdd,
  onRemove,
  onBusyChange,
}: {
  submissionId: string;
  questionId: string;
  slot: SlotKey;
  max: number;
  images: DraftImage[];
  /** Local object URLs keyed by blob pathname (this session only). */
  previews: Record<string, string>;
  label: string;
  /** "primary": photos are the answer. "note": a compact add-on next to a text answer. */
  variant?: "primary" | "note";
  onAdd: (image: DraftImage, previewUrl: string) => void;
  onRemove: (pathname: string) => void;
  onBusyChange: (busy: boolean) => void;
}) {
  const [pending, setPending] = useState<Pending[]>([]);
  const [problem, setProblem] = useState<string | null>(null);
  const controllers = useRef(new Set<AbortController>());
  // Indices claimed by uploads in flight, so parallel picks never collide.
  const claimed = useRef(new Set<number>());

  const busy = pending.length > 0;
  useEffect(() => onBusyChange(busy), [busy, onBusyChange]);
  useEffect(() => {
    const all = controllers.current;
    return () => all.forEach((c) => c.abort());
  }, []);

  const freeIndex = (): number | null => {
    const used = new Set([...images.map((i) => photoIndex(i.pathname)), ...claimed.current]);
    for (let i = 1; i <= max; i++) if (!used.has(i)) return i;
    return null;
  };

  const update = (key: string, patch: Partial<Pending>) =>
    setPending((list) => list.map((p) => (p.key === key ? { ...p, ...patch } : p)));

  const addOne = async (file: File) => {
    const index = freeIndex();
    if (index === null) return false;
    claimed.current.add(index);
    const key = `${index}-${file.name}-${file.size}`;
    setPending((list) => [...list, { key, index, percent: 0 }]);
    const controller = new AbortController();
    controllers.current.add(controller);
    let url: string | undefined;
    try {
      if (file.type && !file.type.startsWith("image/")) {
        throw new ImageDecodeError(`“${file.name}” isn't an image. Please choose JPEG or PNG photos.`);
      }
      const compressed = await compressImage(file);
      url = URL.createObjectURL(compressed.blob);
      update(key, { url });
      const pathname = mediaPathname(submissionId, questionId, slot, { kind: "image", index });
      await uploadMedia(
        pathname,
        compressed.blob,
        "image/jpeg",
        (percent) => update(key, { percent }),
        controller.signal,
      );
      onAdd(
        {
          pathname,
          mimeType: "image/jpeg",
          sizeBytes: compressed.blob.size,
          width: compressed.width,
          height: compressed.height,
          thumb: compressed.thumb,
        },
        url,
      );
      url = undefined; // ownership passes to the parent's preview map
    } catch (error) {
      if (!controller.signal.aborted) {
        setProblem(error instanceof Error ? error.message : "That photo couldn't be uploaded. Please try again.");
      }
    } finally {
      if (url) URL.revokeObjectURL(url);
      controllers.current.delete(controller);
      claimed.current.delete(index);
      setPending((list) => list.filter((p) => p.key !== key));
    }
    return true;
  };

  const handleFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    setProblem(null);
    const files = Array.from(list);
    const room = max - images.length - claimed.current.size;
    if (files.length > room) {
      setProblem(
        room <= 0
          ? `You've added the maximum of ${max} photos. Remove one to add another.`
          : `Only ${room} more ${room === 1 ? "photo fits" : "photos fit"} here, so the first ${room} were added.`,
      );
    }
    // One at a time keeps memory low on phones decoding large camera images.
    for (const file of files.slice(0, Math.max(0, room))) await addOne(file);
  };

  const full = images.length + pending.length >= max;
  const compactIdle = variant === "note" && images.length === 0 && pending.length === 0 && !problem;

  const picker = (kind: "camera" | "library", style: "primary" | "outline") => (
    <label className={buttonClass(style, `cursor-pointer ${busy ? "pointer-events-none opacity-60" : ""}`)}>
      {kind === "camera" ? (
        <Camera size={18} />
      ) : (
        <ImageIcon size={18} className={style === "outline" ? "text-clay" : ""} />
      )}
      {kind === "camera"
        ? "Take a photo"
        : images.length
          ? "Add more"
          : variant === "note"
            ? "Add photos"
            : "Choose photos"}
      <input
        type="file"
        accept="image/*"
        {...(kind === "camera" ? { capture: "environment" as const } : { multiple: true })}
        className="sr-only"
        disabled={busy}
        aria-label={`${kind === "camera" ? "Take a photo" : "Choose photos"} for ${label}`}
        onChange={(e) => {
          void handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </label>
  );

  const pickers = !full && (
    <div className="flex flex-wrap items-center gap-3">
      {/* The camera shortcut only makes sense on touch devices; desktops get the file picker. */}
      <span className="contents pointer-fine:hidden">
        {picker("camera", variant === "primary" && images.length === 0 ? "primary" : "outline")}
      </span>
      {picker("library", "outline")}
    </div>
  );

  if (compactIdle) return pickers || null;

  return (
    <div className="w-full space-y-4">
      {variant === "note" && (
        <p className="flex items-center gap-2 text-[0.75rem] font-bold uppercase tracking-[0.14em] text-ink-2">
          <ImageIcon size={14} className="text-clay" /> Photos
        </p>
      )}

      {(images.length > 0 || pending.length > 0) && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3" aria-label={`Photos for ${label}`}>
          {images.map((img, i) => {
            const src = previews[img.pathname] ?? img.thumb;
            return (
              <li
                key={img.pathname}
                className={`group relative aspect-[4/5] overflow-hidden rounded-[2px] bg-paper-2 ${SHADOW}`}
              >
                {src ? (
                  // eslint-disable-next-line @next/next/no-img-element -- local object/data URLs
                  <img src={src} alt={`Photo ${i + 1} for ${label}`} className="size-full object-cover" />
                ) : (
                  <span className="grid size-full place-items-center text-sm text-ink-2">Photo {i + 1}</span>
                )}
                <button
                  type="button"
                  onClick={() => onRemove(img.pathname)}
                  disabled={busy}
                  aria-label={`Remove photo ${i + 1}`}
                  className="absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-full bg-paper/90 text-ink shadow-sm transition-colors hover:bg-paper hover:text-danger disabled:opacity-50"
                >
                  <Close size={16} />
                </button>
              </li>
            );
          })}
          {pending.map((p) => (
            <li
              key={p.key}
              className={`relative aspect-[4/5] overflow-hidden rounded-[2px] bg-paper-2 ${SHADOW}`}
              role="status"
              aria-label={`Uploading photo, ${Math.round(p.percent)}%`}
            >
              {p.url && (
                // eslint-disable-next-line @next/next/no-img-element -- local object URL
                <img src={p.url} alt="" className="size-full object-cover opacity-60 blur-[1px]" />
              )}
              {!p.url && (
                <span className="absolute inset-0 grid place-items-center text-sm text-ink-2">Preparing…</span>
              )}
              <span className="absolute inset-x-0 bottom-0 h-[3px] bg-paper/70">
                <span
                  className="block h-full origin-left bg-clay transition-transform duration-300 ease-out"
                  style={{ transform: `scaleX(${Math.max(0.03, p.percent / 100)})` }}
                />
              </span>
            </li>
          ))}
          {!full && images.length > 0 && (
            <li className="hidden sm:block">
              <label
                className={`grid aspect-[4/5] cursor-pointer place-items-center rounded-[2px] border border-dashed border-ink/20 text-ink-2 transition-colors hover:border-clay hover:text-clay-deep ${busy ? "pointer-events-none opacity-60" : ""}`}
              >
                <span className="flex flex-col items-center gap-2 text-sm">
                  <Plus size={20} /> Add more
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  className="sr-only"
                  disabled={busy}
                  aria-label={`Add more photos for ${label}`}
                  onChange={(e) => {
                    void handleFiles(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </li>
          )}
        </ul>
      )}

      {images.length === 0 ? pickers : <div className="sm:hidden">{pickers}</div>}

      <p className="text-sm tabular-nums text-ink-2">
        {images.length > 0 ? `${images.length} of ${max} photos · ` : `Up to ${max} photos · `}
        resized, location data removed
      </p>

      {problem && (
        <p role="alert" className="max-w-prose text-[0.9375rem] text-danger">
          {problem}
        </p>
      )}
    </div>
  );
}
