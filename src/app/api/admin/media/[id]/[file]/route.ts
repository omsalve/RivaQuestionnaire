import { requireAdminRoute } from "@/lib/admin-session";
import { readBlob } from "@/lib/blob";
import { isSubmissionId, mimeForExt, parseMediaFileName, submissionPrefix } from "@/lib/paths";

const BASE_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Cache-Control": "private, no-store",
  "Accept-Ranges": "bytes",
};

/**
 * Streams a private media blob to an authenticated admin.
 * Supports single byte ranges, which Safari requires before it will play <audio>.
 */
export async function GET(request: Request, ctx: RouteContext<"/api/admin/media/[id]/[file]">): Promise<Response> {
  const denied = await requireAdminRoute();
  if (denied) return denied;

  const { id, file } = await ctx.params;
  const parsed = parseMediaFileName(file);
  if (!isSubmissionId(id) || !parsed) return new Response("Not found", { status: 404 });

  const blob = await readBlob(`${submissionPrefix(id)}${file}`);
  if (!blob) return new Response("Not found", { status: 404 });

  const contentType = mimeForExt(parsed.ext);
  const range = request.headers.get("range");
  if (!range) {
    return new Response(blob.stream, {
      headers: { ...BASE_HEADERS, "Content-Type": contentType, "Content-Length": String(blob.blob.size) },
    });
  }

  // Media is capped at 15 MB, so buffering to serve a slice is fine.
  const bytes = new Uint8Array(await new Response(blob.stream).arrayBuffer());
  const total = bytes.byteLength;
  const match = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  let start = match?.[1] ? Number(match[1]) : NaN;
  let end = match?.[2] ? Number(match[2]) : total - 1;
  if (match && !match[1] && match[2]) {
    start = Math.max(0, total - Number(match[2])); // suffix range: last N bytes
    end = total - 1;
  }
  if (!match || Number.isNaN(start) || start >= total || end < start) {
    return new Response(null, { status: 416, headers: { ...BASE_HEADERS, "Content-Range": `bytes */${total}` } });
  }
  end = Math.min(end, total - 1);

  return new Response(bytes.slice(start, end + 1), {
    status: 206,
    headers: {
      ...BASE_HEADERS,
      "Content-Type": contentType,
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${total}`,
    },
  });
}
