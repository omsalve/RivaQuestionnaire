import { Suspense } from "react";
import Link from "next/link";
import type { Metadata } from "next";
import { PERSON_SLOTS } from "@/config/questions";
import { DeleteSubmission } from "@/components/admin/DeleteSubmission";
import { AudioPlayer } from "@/components/AudioPlayer";
import { ArrowLeft, Download, StarMark } from "@/components/Icons";
import { buttonClass } from "@/components/ui";
import { requireAdminPage } from "@/lib/admin-session";
import { readManifest } from "@/lib/blob";
import { answerSlots, formatDateTime } from "@/lib/export";
import { formatBytes, formatDuration } from "@/lib/format";
import type { Manifest, SlotAnswer } from "@/lib/manifest";
import { isSubmissionId, type SlotKey } from "@/lib/paths";

export const metadata: Metadata = { title: "Submission · Riva Chavan Studio" };

function mediaUrl(submissionId: string, pathname: string): string {
  return `/api/admin/media/${submissionId}/${encodeURIComponent(pathname.split("/").pop() ?? "")}`;
}

const SHADOW = "shadow-[0_1px_2px_rgb(36_32_30/0.08),0_8px_24px_-12px_rgb(36_32_30/0.25)]";

function Answer({ value, submissionId, label }: { value: SlotAnswer; submissionId: string; label: string }) {
  const voice = value.voice;
  return (
    <div className="space-y-5">
      {value.text && (
        <p className="whitespace-pre-wrap break-words text-[1.0625rem] leading-[1.7] text-ink">{value.text}</p>
      )}
      {voice && (
        <div className="max-w-[34rem] space-y-2">
          <AudioPlayer
            src={mediaUrl(submissionId, voice.pathname)}
            knownDuration={voice.durationSec}
            label={`recording, ${label}`}
          />
          <p className="text-sm tabular-nums text-ink-3">
            Voice · {formatDuration(voice.durationSec)} · {voice.mimeType} · {formatBytes(voice.sizeBytes)} ·{" "}
            <a
              href={mediaUrl(submissionId, voice.pathname)}
              download
              className="text-ink-2 underline hover:text-clay-deep"
            >
              Download
            </a>
          </p>
        </div>
      )}
      {value.images && value.images.length > 0 && (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {value.images.map((img, i) => {
            const src = mediaUrl(submissionId, img.pathname);
            return (
              <li key={img.pathname}>
                <figure className="space-y-1.5">
                  <a href={src} target="_blank" rel="noreferrer" className="block">
                    {/* eslint-disable-next-line @next/next/no-img-element -- authenticated private media */}
                    <img
                      src={src}
                      alt={`Photo ${i + 1}, ${label}`}
                      loading="lazy"
                      width={img.width}
                      height={img.height}
                      className={`aspect-[4/5] w-full rounded-[2px] bg-paper-2 object-cover ${SHADOW}`}
                    />
                  </a>
                  <figcaption className="text-xs tabular-nums text-ink-3">
                    {img.width}×{img.height} · {formatBytes(img.sizeBytes)}
                  </figcaption>
                </figure>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function QuestionList({ manifest }: { manifest: Manifest }) {
  const people = manifest.respondent.people ?? {};
  const sectionStarts = new Map<number, { number: number; title: string; description?: string }>();
  const questionNumbers: number[] = [];
  let currentSection: string | undefined;
  let questionNumber = 0;
  manifest.questions.forEach((q, i) => {
    const prev = i > 0 ? manifest.questions[i - 1].section : undefined;
    if (q.section && q.section !== prev) {
      currentSection = q.section;
      questionNumber = 0;
      sectionStarts.set(i, {
        number: sectionStarts.size + 1,
        title: q.section,
        ...(q.sectionDescription ? { description: q.sectionDescription } : {}),
      });
    }
    questionNumbers.push(currentSection === q.section ? ++questionNumber : i + 1);
  });

  return (
    <ol className="mt-4">
      {manifest.questions.map((q, index) => {
        const answer = manifest.answers[q.id];
        const bySlot = new Map<SlotKey, SlotAnswer>(answer ? answerSlots(answer).map(([slot, v]) => [slot, v]) : []);
        const slots: SlotKey[] = q.perPerson ? [...PERSON_SLOTS] : ["main"];
        const heading = sectionStarts.get(index);
        const questionNumber = questionNumbers[index];

        return (
          <li key={q.id}>
            {heading && (
              <>
                <h2 className="mt-14 flex items-baseline gap-4 font-serif text-[1.5rem] text-ink">
                  <span className="tabular-nums text-clay">{heading.number}.</span>
                  {heading.title}
                </h2>
                {heading.description && (
                  <p className="mt-3 whitespace-pre-line text-[0.9375rem] leading-[1.7] text-ink-2">
                    {heading.description}
                  </p>
                )}
              </>
            )}
            <article className="mt-4 border-t border-rule py-7">
              <p className="font-serif text-[1.1875rem] leading-[1.4] text-ink">
                <span className="mr-2 font-sans text-[0.8125rem] font-bold tabular-nums text-clay">
                  {questionNumber}.
                </span>
                {q.perPerson && <StarMark size={11} className="mr-1.5 inline align-[0.05em] text-clay" />}
                {q.prompt}
              </p>
              {q.helperText && (
                <p className="mt-3 whitespace-pre-line text-[0.9375rem] text-ink-2">{q.helperText}</p>
              )}
              <p className="mt-1 text-xs uppercase tracking-[0.12em] text-ink-3">
                {[
                  q.accepts.text && "text",
                  q.accepts.voice && "voice",
                  q.accepts.images > 0 && `up to ${q.accepts.images} photos`,
                  q.required && "required",
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              <div className="mt-5 space-y-6">
                {slots.map((slot) => {
                  const value = bySlot.get(slot);
                  const person = slot === "main" ? undefined : (people[slot] ?? slot);
                  return (
                    <div key={slot}>
                      {person && (
                        <p className="mb-2 text-[0.75rem] font-bold uppercase tracking-[0.14em] text-clay">{person}</p>
                      )}
                      {value ? (
                        <Answer
                          value={value}
                          submissionId={manifest.submissionId}
                          label={`${person ? `${person}'s answer` : "Answer"} to question ${questionNumber}`}
                        />
                      ) : (
                        <p className="text-[0.9375rem] italic text-ink-3">No answer</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </article>
          </li>
        );
      })}
    </ol>
  );
}

async function Detail({ params }: { params: PageProps<"/admin/[id]">["params"] }) {
  await requireAdminPage();
  const { id } = await params;
  const back = (
    <Link href="/admin" className={buttonClass("quiet", "min-h-10 text-sm")}>
      <ArrowLeft size={16} /> All submissions
    </Link>
  );

  if (!isSubmissionId(id)) {
    return (
      <>
        {back}
        <p className="mt-8 text-ink-2">That submission doesn&rsquo;t exist.</p>
      </>
    );
  }

  const result = await readManifest(id);
  if (result.status !== "ok") {
    return (
      <>
        {back}
        <h1 className="mt-8 font-serif text-[2rem]">No manifest</h1>
        <p className="mt-3 max-w-prose text-ink-2">
          {result.status === "missing"
            ? "This session uploaded media but was never submitted."
            : "The manifest for this submission couldn’t be read."}
        </p>
        <div className="mt-8">
          <DeleteSubmission submissionId={id} returnToList />
        </div>
      </>
    );
  }

  const m = result.manifest;
  const people = m.respondent.people ?? {};
  const answered = m.questions.filter((q) => m.answers[q.id]).length;

  return (
    <>
      {back}
      <header className="mt-8">
        <h1 className="font-serif text-[clamp(2rem,1.6rem+2vw,3rem)] leading-[1.08] tracking-[-0.018em]">
          {m.respondent.name || "Unnamed submission"}
        </h1>
        <dl className="mt-5 grid gap-x-10 gap-y-3 text-[0.9375rem] sm:grid-cols-[auto_1fr]">
          <dt className="text-ink-3">Submitted</dt>
          <dd className="tabular-nums">{formatDateTime(m.submittedAt)}</dd>
          {m.respondent.email && (
            <>
              <dt className="text-ink-3">Email</dt>
              <dd>
                <a href={`mailto:${m.respondent.email}`} className="underline decoration-rule hover:decoration-clay">
                  {m.respondent.email}
                </a>
              </dd>
            </>
          )}
          {m.questions.some((q) => q.perPerson) && (
            <>
              <dt className="text-ink-3">Answer spaces</dt>
              <dd>{PERSON_SLOTS.map((s) => people[s] ?? s).join(" · ")}</dd>
            </>
          )}
          <dt className="text-ink-3">Answered</dt>
          <dd className="tabular-nums">
            {answered} of {m.questions.length}
          </dd>
          <dt className="text-ink-3">Reference</dt>
          <dd className="break-all tabular-nums text-ink-2">{m.submissionId}</dd>
        </dl>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <a href={`/api/admin/export/${m.submissionId}`} className={buttonClass("primary")} download>
            <Download size={16} /> Download ZIP
          </a>
          <DeleteSubmission submissionId={m.submissionId} returnToList />
        </div>
        <span aria-hidden="true" className="mt-10 block h-px w-full bg-clay" />
      </header>
      <QuestionList manifest={m} />
    </>
  );
}

export default function SubmissionPage({ params }: PageProps<"/admin/[id]">) {
  return (
    <main className="mx-auto w-full max-w-[48rem] px-6 pb-24 pt-8 sm:px-8">
      <Suspense fallback={<p className="mt-10 text-ink-2">Loading submission…</p>}>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}
