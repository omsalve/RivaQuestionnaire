"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { refresh } from "next/cache";
import { z } from "zod";
import { isAdmin } from "@/lib/admin-session";
import { createSessionToken, SESSION_COOKIE, SESSION_MAX_AGE_SEC, verifyPassword } from "@/lib/auth";
import { deleteSubmission } from "@/lib/blob";
import { SUBMISSION_ID_RE } from "@/lib/paths";

export type LoginState = { error: string | null };

const LoginSchema = z.object({
  password: z.string().min(1, "Enter the admin password.").max(500),
  next: z.string().max(300).optional(),
});

export async function login(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    password: formData.get("password") ?? "",
    next: formData.get("next") ?? undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Enter the admin password." };

  let ok = false;
  try {
    ok = await verifyPassword(parsed.data.password);
  } catch (error) {
    console.error("[admin] login misconfigured", error);
    return { error: "Admin sign-in isn't configured. Set ADMIN_PASSWORD and ADMIN_SECRET." };
  }
  if (!ok) {
    // Slow down guessing; there's no database to count attempts in.
    await new Promise((r) => setTimeout(r, 800));
    return { error: "That password isn't right." };
  }

  (await cookies()).set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  });

  const next = parsed.data.next;
  redirect(next && /^\/admin(\/[\w-]+)*$/.test(next) ? next : "/admin");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/admin/login");
}

export async function removeSubmission(submissionId: string, returnToList: boolean): Promise<{ error: string } | void> {
  if (!(await isAdmin())) return { error: "Your session expired. Sign in again." };
  if (!SUBMISSION_ID_RE.test(submissionId)) return { error: "Unknown submission." };
  try {
    await deleteSubmission(submissionId);
  } catch (error) {
    console.error("[admin] delete failed", error);
    return { error: "Couldn't delete it just now. Try again." };
  }
  if (returnToList) redirect("/admin");
  refresh();
}
