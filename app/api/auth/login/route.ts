import { randomBytes, createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { appUrl, cookieOptions, isConfigured, OAUTH_COOKIE, seal } from "@/lib/session";
export const runtime = "nodejs";
export async function GET(request: Request) {
  if (!isConfigured()) return NextResponse.redirect(new URL("/?error=setup", request.url));
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: `${appUrl()}/api/auth/callback`,
    response_type: "code", scope: "openid email profile https://www.googleapis.com/auth/spreadsheets.readonly",
    state, code_challenge: createHash("sha256").update(verifier).digest("base64url"),
    code_challenge_method: "S256", access_type: "online", prompt: "select_account"
  }).toString();
  const response = NextResponse.redirect(url);
  response.cookies.set(OAUTH_COOKIE, await seal({ state, verifier }, 600), { ...cookieOptions, maxAge: 600 });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
