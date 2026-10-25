import { requireAdminRoute } from "@/lib/admin-session";
import { listSubmissionIds } from "@/lib/blob";
import { zipResponse } from "@/lib/zip";

export const maxDuration = 300;

/** Every submission in one ZIP, one folder per submission. */
export async function GET(): Promise<Response> {
  const denied = await requireAdminRoute();
  if (denied) return denied;

  const ids = await listSubmissionIds();
  if (ids.length === 0) return Response.json({ error: "There are no submissions yet." }, { status: 404 });

  const stamp = new Date().toISOString().slice(0, 10);
  return zipResponse(ids, `house-of-design-submissions-${stamp}.zip`);
}
