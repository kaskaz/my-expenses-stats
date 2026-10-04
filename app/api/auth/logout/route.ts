import { NextResponse } from "next/server";
import { appUrl, SESSION_COOKIE, OAUTH_COOKIE } from "@/lib/session";
export async function POST(request: Request) {
  const base = appUrl();
  if (request.headers.get("origin") !== base) return new NextResponse("Forbidden", { status: 403 });
  const response = NextResponse.redirect(base, 303);
  response.cookies.delete(SESSION_COOKIE);
  response.cookies.delete(OAUTH_COOKIE);
  response.headers.set("Cache-Control", "no-store");
  return response;
}
