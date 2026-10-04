import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { appUrl, cookieOptions, OAUTH_COOKIE, SESSION_COOKIE, seal, unseal } from "@/lib/session";
export const runtime = "nodejs";
export async function GET(request: Request) {
  const base = appUrl();
  const fail = (reason: string) => {
    const response = NextResponse.redirect(`${base}/?error=${reason}`);
    response.cookies.delete(OAUTH_COOKIE);
    response.headers.set("Cache-Control", "no-store");
    return response;
  };
  const params = new URL(request.url).searchParams;
  const jar = await cookies();
  const oauth = await unseal<{ state: string; verifier: string }>(jar.get(OAUTH_COOKIE)?.value);
  const state = params.get("state") ?? "";
  if (!oauth || !/^[A-Za-z0-9_-]{43}$/.test(state) || state.length !== oauth.state.length || !timingSafeEqual(Buffer.from(state), Buffer.from(oauth.state))) return fail("state");
  if (params.has("error") || !params.get("code")) return fail("cancelled");
  try {
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ code: params.get("code")!, client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: `${base}/api/auth/callback`,
        grant_type: "authorization_code", code_verifier: oauth.verifier }),
      cache: "no-store", signal: AbortSignal.timeout(15000)
    });
    if (!tokenResponse.ok) return fail("signin");
    const token = await tokenResponse.json();
    if (typeof token.access_token !== "string" || typeof token.expires_in !== "number") return fail("signin");
    const userResponse = await fetch("https://openidconnect.googleapis.com/v1/userinfo", {
      headers: { Authorization: `Bearer ${token.access_token}` }, cache: "no-store", signal: AbortSignal.timeout(15000)
    });
    if (!userResponse.ok) return fail("signin");
    const user = await userResponse.json();
    if (!user.email_verified || typeof user.email !== "string") return fail("signin");
    const allowed = process.env.ALLOWED_GOOGLE_EMAIL?.trim().toLowerCase();
    if (allowed && user.email.toLowerCase() !== allowed) return fail("account");
    const lifetime = Math.max(1, Math.min(token.expires_in - 60, 3600));
    const session = await seal({ accessToken: token.access_token, email: user.email,
      name: typeof user.name === "string" ? user.name : user.email, expiresAt: Date.now() + lifetime * 1000 }, lifetime);
    const response = NextResponse.redirect(base);
    response.cookies.set(SESSION_COOKIE, session, { ...cookieOptions, maxAge: lifetime });
    response.cookies.delete(OAUTH_COOKIE);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch { return fail("signin"); }
}
