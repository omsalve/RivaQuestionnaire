import "server-only";
import { Readable } from "node:stream";
import { ZipArchive } from "archiver";
import { readBlob, readManifest } from "@/lib/blob";
import { answersMarkdown, mediaEntries } from "@/lib/export";

type Archive = InstanceType<typeof ZipArchive>;

/** Appends one entry and resolves once archiver has fully written it, so blob reads run one at a time. */
function appendAndWait(archive: Archive, source: Readable | string, name: string, store = false): Promise<void> {
  return new Promise((resolve, reject) => {
    const onEntry = (entry: { name: string }) => {
      if (entry.name !== name) return;
      cleanup();
      resolve();
    };
    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };
    const cleanup = () => {
      archive.off("entry", onEntry);
      archive.off("error", onError);
    };
    archive.on("entry", onEntry);
    archive.on("error", onError);
    archive.append(source, { name, store });
  });
}

/** Adds manifest.json, answers.md and ordered media for one submission under `folder`. */
async function appendSubmission(archive: Archive, submissionId: string, folder = ""): Promise<void> {
  const result = await readManifest(submissionId);
  if (result.status !== "ok") {
    await appendAndWait(
      archive,
      `This submission has no readable manifest (${result.status}). It was probably started but never submitted.\n`,
      `${folder}MISSING-MANIFEST.txt`,
    );
    return;
  }
  const { manifest } = result;
  await appendAndWait(archive, JSON.stringify(manifest, null, 2), `${folder}manifest.json`);
  await appendAndWait(archive, answersMarkdown(manifest), `${folder}answers.md`);

  for (const entry of mediaEntries(manifest)) {
    const blob = await readBlob(entry.pathname);
    if (!blob) {
      await appendAndWait(
        archive,
        `Missing from storage: ${entry.pathname}\n`,
        `${folder}${entry.fileName}.MISSING.txt`,
      );
      continue;
    }
    // Audio and JPEG are already compressed; store them as-is.
    await appendAndWait(
      archive,
      Readable.fromWeb(blob.stream as import("node:stream/web").ReadableStream),
      `${folder}${entry.fileName}`,
      true,
    );
  }
}

/** Streams a ZIP of the given submissions. With more than one, each goes in its own folder. */
export function zipResponse(submissionIds: string[], fileName: string): Response {
  const archive = new ZipArchive({ zlib: { level: 6 } });
  const nested = submissionIds.length > 1;

  void (async () => {
    try {
      for (const id of submissionIds) await appendSubmission(archive, id, nested ? `${id}/` : "");
      await archive.finalize();
    } catch (error) {
      console.error("[export] zip failed", error);
      archive.destroy(error instanceof Error ? error : new Error(String(error)));
    }
  })();

  return new Response(Readable.toWeb(archive) as ReadableStream, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
