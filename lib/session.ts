import "server-only";
import { createHash } from "node:crypto";
import { EncryptJWT, jwtDecrypt } from "jose";
import { cookies } from "next/headers";

export const SESSION_COOKIE = "expenses_session";
export const OAUTH_COOKIE = "expenses_oauth";
export const cookieOptions = { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/" };
export type Session = { accessToken: string; email: string; name: string; expiresAt: number };
function key() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) throw new Error("SESSION_SECRET must contain at least 32 characters.");
  return createHash("sha256").update(secret).digest();
}
export async function seal(payload: Record<string, unknown>, seconds: number) {
  return new EncryptJWT(payload).setProtectedHeader({ alg: "dir", enc: "A256GCM" })
    .setIssuedAt().setIssuer("my-expenses-stats").setAudience("my-expenses-stats")
    .setExpirationTime(`${seconds}s`).encrypt(key());
}
export async function unseal<T>(value?: string): Promise<T | null> {
  if (!value) return null;
  try {
    const { payload } = await jwtDecrypt(value, key(), { issuer: "my-expenses-stats", audience: "my-expenses-stats" });
    return payload as T;
  } catch { return null; }
}
export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  const session = await unseal<Session>(jar.get(SESSION_COOKIE)?.value);
  return session && session.expiresAt > Date.now() ? session : null;
}
export function appUrl() {
  const value = process.env.APP_URL;
  if (!value) throw new Error("APP_URL is required.");
  const url = new URL(value);
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") throw new Error("APP_URL must use HTTPS in production.");
  return url.origin;
}
export function isConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET &&
    process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32 && process.env.APP_URL && process.env.GOOGLE_SPREADSHEET_ID);
}
