import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { DeleteSubmission } from "@/components/admin/DeleteSubmission";
import { ArrowRight } from "@/components/Icons";
import { requireAdminPage } from "@/lib/admin-session";
import { listSubmissionIds, readManifest, type ManifestResult } from "@/lib/blob";
import { formatDateTime, mediaEntries } from "@/lib/export";
import { submissionIdDate } from "@/lib/paths";

export const metadata: Metadata = { title: "Submissions · Riva Chavan Studio" };

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (cursor < items.length) {
      const i = cursor++;
      results[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return results;
}

async function SubmissionList() {
  await requireAdminPage();

  let ids: string[];
  try {
    ids = await listSubmissionIds();
  } catch (error) {
    console.error("[admin] list failed", error);
    return (
      <p role="alert" className="mt-10 max-w-prose text-danger">
        Couldn&rsquo;t reach Blob storage. Check that a private Blob store is connected to this project and that
        BLOB_READ_WRITE_TOKEN is set.
      </p>
    );
  }

  const rows = await mapLimit(ids, 8, async (id) => ({
    id,
    result: await readManifest(id).catch((): ManifestResult => ({ status: "invalid", error: "Read failed" })),
  }));
  const submitted = rows.filter((r) => r.result.status === "ok");
  const unfinished = rows.filter((r) => r.result.status !== "ok");

  return (
    <>
      <p className="mt-3 text-ink-2">
        {submitted.length === 0
          ? "Nothing yet. When Riva sends her answers, they’ll appear here."
          : `${submitted.length} ${submitted.length === 1 ? "submission" : "submissions"}, newest first.`}
      </p>

      {submitted.length > 0 && (
        <ul className="mt-10 border-b border-rule">
          {submitted.map(({ id, result }) => {
            if (result.status !== "ok") return null;
            const m = result.manifest;
            const answered = m.questions.filter((q) => m.answers[q.id]).length;
            const media = mediaEntries(m);
            const voices = media.filter((e) => e.kind === "voice").length;
            const photos = media.length - voices;
            return (
              <li key={id} className="border-t border-rule">
                <Link
                  href={`/admin/${id}`}
                  className="group grid gap-x-8 gap-y-1 py-6 transition-colors hover:bg-paper-2 sm:grid-cols-[11rem_1fr_auto] sm:items-baseline sm:px-3"
                >
                  <span className="text-sm tabular-nums text-ink-2">{formatDateTime(m.submittedAt)}</span>
                  <span className="min-w-0">
                    <span className="block truncate font-serif text-[1.25rem] text-ink">
                      {m.respondent.name || "Unnamed"}
                    </span>
                    {m.respondent.email && (
                      <span className="block truncate text-sm text-ink-2">{m.respondent.email}</span>
                    )}
                  </span>
                  <span className="flex items-center gap-4 text-sm tabular-nums text-ink-2">
                    {answered} / {m.questions.length} answered
                    {voices > 0 && ` · ${voices} voice`}
                    {photos > 0 && ` · ${photos} ${photos === 1 ? "photo" : "photos"}`}
                    <ArrowRight
                      size={16}
                      className="text-clay transition-transform duration-300 group-hover:translate-x-1"
                    />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {unfinished.length > 0 && (
        <section className="mt-16" aria-labelledby="unfinished">
          <h2 id="unfinished" className="font-serif text-[1.375rem]">
            Started, never sent
          </h2>
          <p className="mt-2 max-w-prose text-sm text-ink-2">
            Media was uploaded for these sessions but no manifest was written. They&rsquo;re usually abandoned drafts or
            tests and can be deleted.
          </p>
          <ul className="mt-6 border-b border-rule">
            {unfinished.map(({ id, result }) => {
              const started = submissionIdDate(id);
              return (
                <li key={id} className="flex flex-wrap items-center justify-between gap-4 border-t border-rule py-4">
                  <span className="text-sm tabular-nums text-ink-2">
                    {started ? `Started ${formatDateTime(started)}` : id}
                    {result.status === "invalid" && <span className="ml-3 text-danger">manifest unreadable</span>}
                  </span>
                  <DeleteSubmission submissionId={id} compact />
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </>
  );
}

export default function AdminHome() {
  return (
    <main className="mx-auto w-full max-w-[64rem] px-6 pb-24 pt-12 sm:px-8">
      <h1 className="font-serif text-[clamp(2rem,1.6rem+2vw,2.75rem)] leading-tight tracking-[-0.015em]">
        Founder Questionnaire
      </h1>
      <Suspense fallback={<p className="mt-3 text-ink-2">Loading submissions…</p>}>
        <SubmissionList />
      </Suspense>
    </main>
  );
}
