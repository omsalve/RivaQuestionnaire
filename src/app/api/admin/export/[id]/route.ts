import { requireAdminRoute } from "@/lib/admin-session";
import { isSubmissionId } from "@/lib/paths";
import { zipResponse } from "@/lib/zip";

export const maxDuration = 300;

export async function GET(_request: Request, ctx: RouteContext<"/api/admin/export/[id]">): Promise<Response> {
  const denied = await requireAdminRoute();
  if (denied) return denied;

  const { id } = await ctx.params;
  if (!isSubmissionId(id)) return Response.json({ error: "Not found" }, { status: 404 });

  return zipResponse([id], `house-of-design-${id}.zip`);
}
