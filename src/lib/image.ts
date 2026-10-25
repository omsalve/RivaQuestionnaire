/**
 * Client-side image pipeline: decode (honouring EXIF orientation), scale to a
 * 2048px long edge, and re-encode as JPEG. Re-encoding through a canvas drops
 * all EXIF metadata, including GPS location.
 */

const MAX_EDGE = 2048;
const QUALITY = 0.85;
const THUMB_EDGE = 320;

export class ImageDecodeError extends Error {}

export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
  /** Small JPEG data URL kept in the local draft for the review screen. */
  thumb: string;
}

type Source = { draw: CanvasImageSource; width: number; height: number; release: () => void };

async function decode(file: File): Promise<Source> {
  // createImageBitmap applies EXIF orientation with imageOrientation: "from-image".
  if (typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
      return { draw: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close() };
    } catch {
      /* fall through to <img>, which can decode formats like HEIC on Safari */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    // Browsers apply EXIF orientation to <img> by default (image-orientation: from-image).
    return { draw: img, width: img.naturalWidth, height: img.naturalHeight, release: () => URL.revokeObjectURL(url) };
  } catch {
    URL.revokeObjectURL(url);
    const heic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
    throw new ImageDecodeError(
      heic
        ? "This browser can't read HEIC photos. Please choose a JPEG or PNG instead (on iPhone, Settings → Camera → Formats → Most Compatible)."
        : "That file couldn't be opened as an image. Please choose a JPEG or PNG.",
    );
  }
}

function render(
  source: Source,
  maxEdge: number,
  quality: number,
): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new ImageDecodeError("Your browser couldn't process this image.");
  ctx.fillStyle = "#ffffff"; // transparent PNGs flatten onto white, not black
  ctx.fillRect(0, 0, width, height);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source.draw, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob ? resolve({ blob, width, height }) : reject(new ImageDecodeError("Couldn't compress this image.")),
      "image/jpeg",
      quality,
    );
  });
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

export async function compressImage(file: File): Promise<CompressedImage> {
  const source = await decode(file);
  try {
    const full = await render(source, MAX_EDGE, QUALITY);
    const small = await render(source, THUMB_EDGE, 0.72);
    return { ...full, thumb: await toDataUrl(small.blob) };
  } finally {
    source.release();
  }
}
