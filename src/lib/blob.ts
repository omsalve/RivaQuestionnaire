import "server-only";
import { BlobNotFoundError, del, get, head, list, put, type HeadBlobResult } from "@vercel/blob";
import { ManifestSchema, type Manifest } from "@/lib/manifest";
import { isSubmissionId, manifestPathname, submissionPrefix } from "@/lib/paths";

/** Every object in this app lives in one private store. */
const ACCESS = "private" as const;

export async function headOrNull(pathname: string): Promise<HeadBlobResult | null> {
  try {
    return await head(pathname);
  } catch (error) {
    if (error instanceof BlobNotFoundError) return null;
    throw error;
  }
}

export async function manifestExists(submissionId: string): Promise<boolean> {
  return (await headOrNull(manifestPathname(submissionId))) !== null;
}

/** Writes the manifest once. Throws if one already exists, so a submission can't be overwritten. */
export async function writeManifest(manifest: Manifest): Promise<void> {
  await put(manifestPathname(manifest.submissionId), JSON.stringify(manifest, null, 2), {
    access: ACCESS,
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: false,
  });
}

export type ManifestResult =
  { status: "ok"; manifest: Manifest } | { status: "missing" } | { status: "invalid"; error: string };

export async function readManifest(submissionId: string): Promise<ManifestResult> {
  const result = await get(manifestPathname(submissionId), { access: ACCESS, useCache: false });
  if (!result || result.statusCode !== 200) return { status: "missing" };
  const json: unknown = await new Response(result.stream).json().catch(() => null);
  const parsed = ManifestSchema.safeParse(json);
  return parsed.success ? { status: "ok", manifest: parsed.data } : { status: "invalid", error: parsed.error.message };
}

/** Submission ids, newest first. */
export async function listSubmissionIds(): Promise<string[]> {
  const ids: string[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: "submissions/", mode: "folded", cursor, limit: 1000 });
    for (const folder of page.folders) {
      const id = folder.replace(/^submissions\//, "").replace(/\/$/, "");
      if (isSubmissionId(id)) ids.push(id);
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return ids.sort().reverse();
}

export async function listSubmissionBlobs(submissionId: string) {
  const blobs: { pathname: string; size: number; uploadedAt: Date }[] = [];
  let cursor: string | undefined;
  do {
    const page = await list({ prefix: submissionPrefix(submissionId), cursor, limit: 1000 });
    blobs.push(...page.blobs.map(({ pathname, size, uploadedAt }) => ({ pathname, size, uploadedAt })));
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);
  return blobs;
}

export async function deletePathnames(pathnames: string[]): Promise<void> {
  // del() accepts batches; keep them modest.
  for (let i = 0; i < pathnames.length; i += 100) {
    await del(pathnames.slice(i, i + 100));
  }
}

export async function deleteSubmission(submissionId: string): Promise<void> {
  const blobs = await listSubmissionBlobs(submissionId);
  await deletePathnames(blobs.map((b) => b.pathname));
}

/**
 * Reads a private blob. Uploads to the same pathname can be overwritten
 * (re-recording), so bypass the CDN cache to never serve a stale take.
 */
export async function readBlob(pathname: string, headers?: HeadersInit) {
  const result = await get(pathname, { access: ACCESS, useCache: false, headers });
  return result && result.statusCode === 200 ? result : null;
}
