import { handleUpload } from "@vercel/blob/client";
import { manifestExists } from "@/lib/blob";
import { UploadTokenEventSchema } from "@/lib/manifest";
import { resolveUploadTarget, RuleError } from "@/lib/submission-rules";

/**
 * Issues short-lived client-upload tokens. The browser then uploads straight to
 * Blob, so media never passes through a function body.
 *
 * Only token requests are accepted: no upload-completed callback is configured,
 * because the manifest (written at submit) is the source of truth.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = UploadTokenEventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid upload request." }, { status: 400 });
  }

  try {
    // Validate before handleUpload so bad requests are rejected without touching storage credentials.
    if (parsed.data.payload.multipart) throw new RuleError("Multipart uploads are not needed for these files.");
    const target = resolveUploadTarget(parsed.data.payload.pathname);
    if (await manifestExists(target.submissionId)) {
      throw new RuleError("This questionnaire has already been submitted.");
    }

    const result = await handleUpload({
      request,
      body: parsed.data,
      onBeforeGenerateToken: async (pathname) => {
        if (pathname !== parsed.data.payload.pathname) throw new RuleError("Upload path mismatch.");
        return {
          allowedContentTypes: [target.contentType],
          maximumSizeInBytes: target.maxBytes,
          addRandomSuffix: false,
          // Re-recording or replacing an image writes to the same pathname.
          allowOverwrite: true,
          validUntil: Date.now() + 10 * 60 * 1000,
        };
      },
    });
    return Response.json(result);
  } catch (error) {
    if (error instanceof RuleError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    console.error("[upload] token generation failed", error);
    return Response.json({ error: "Upload is unavailable right now. Please try again." }, { status: 500 });
  }
}
