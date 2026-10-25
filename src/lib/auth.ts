/**
 * Admin session: a single password (ADMIN_PASSWORD) exchanged for an
 * HMAC-signed, httpOnly cookie (keyed with ADMIN_SECRET).
 *
 * Uses only Web Crypto so it runs in the proxy and in route handlers alike.
 * Token format: `v1.{expiresAtMs}.{base64url(HMAC-SHA256("v1.{expiresAtMs}"))}`
 */

export const SESSION_COOKIE = "hod_admin";
export const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

const encoder = new TextEncoder();

function adminSecret(): string {
  const secret = process.env.ADMIN_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("ADMIN_SECRET must be set to a random string of at least 32 characters.");
  }
  return secret;
}

function toBase64Url(buffer: ArrayBuffer): string {
  let binary = "";
  for (const byte of new Uint8Array(buffer)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(adminSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(await crypto.subtle.sign("HMAC", key, encoder.encode(data)));
}

/** Constant-time comparison for equal-length strings; length mismatch fails fast (lengths aren't secret here). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function createSessionToken(now: number = Date.now()): Promise<string> {
  const payload = `v1.${now + SESSION_MAX_AGE_SEC * 1000}`;
  return `${payload}.${await hmac(payload)}`;
}

export async function verifySessionToken(token: string | undefined, now: number = Date.now()): Promise<boolean> {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  const expiresAt = Number(parts[1]);
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return false;
  try {
    return safeEqual(parts[2], await hmac(`${parts[0]}.${parts[1]}`));
  } catch {
    return false;
  }
}

/** Compares HMACs of both values so timing doesn't leak the password's length or prefix. */
export async function verifyPassword(input: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) throw new Error("ADMIN_PASSWORD is not set.");
  const [a, b] = await Promise.all([hmac(`pw:${input}`), hmac(`pw:${expected}`)]);
  return safeEqual(a, b);
}
