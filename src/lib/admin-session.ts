import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

/*
 * The proxy already gates /admin and /api/admin, but every page and route that
 * reads private data checks again here, next to the read (Vercel's guidance
 * for private Blob stores: never rely on the proxy alone).
 */

export async function isAdmin(): Promise<boolean> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

export async function requireAdminPage(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}

/** Returns a 401 response to send, or null when the request is authorised. */
export async function requireAdminRoute(): Promise<Response | null> {
  return (await isAdmin()) ? null : Response.json({ error: "Unauthorized" }, { status: 401 });
}
