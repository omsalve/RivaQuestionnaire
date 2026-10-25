"use client";

import { useState, useTransition } from "react";
import { removeSubmission } from "@/app/admin/actions";
import { Trash } from "@/components/Icons";
import { Button } from "@/components/ui";

/** Two-step inline confirm: a deliberate, local action that doesn't need a modal. */
export function DeleteSubmission({
  submissionId,
  returnToList = false,
  compact = false,
}: {
  submissionId: string;
  returnToList?: boolean;
  compact?: boolean;
}) {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const size = compact ? "min-h-10 text-sm" : "";

  if (!confirming) {
    return (
      <Button variant={compact ? "quiet" : "outline"} onClick={() => setConfirming(true)} className={size}>
        <Trash size={16} /> Delete
      </Button>
    );
  }

  return (
    <span className="inline-flex flex-wrap items-center gap-x-4 gap-y-2" role="group" aria-label="Confirm delete">
      <span className="text-sm text-ink-2">Delete permanently, with all media?</span>
      <Button
        variant="danger"
        className={size}
        disabled={pending}
        autoFocus
        onClick={() =>
          startTransition(async () => {
            const result = await removeSubmission(submissionId, returnToList);
            if (result?.error) setError(result.error);
          })
        }
      >
        {pending ? "Deleting…" : "Yes, delete"}
      </Button>
      <Button variant="quiet" className={size} disabled={pending} onClick={() => setConfirming(false)}>
        Cancel
      </Button>
      {error && (
        <span role="alert" className="w-full text-sm text-danger">
          {error}
        </span>
      )}
    </span>
  );
}
