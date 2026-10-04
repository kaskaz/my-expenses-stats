import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { readDashboard, SheetError } from "@/lib/sheets";
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export async function GET() {
  const headers = { "Cache-Control": "private, no-store, max-age=0", Vary: "Cookie" };
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Sign in with Google to load the private spreadsheet." }, { status: 401, headers });
  try { return NextResponse.json(await readDashboard(session.accessToken), { headers }); }
  catch (error) {
    return NextResponse.json({ error: error instanceof SheetError ? error.message : "Unable to load the spreadsheet. Please try again." }, { status: error instanceof SheetError ? error.status : 500, headers });
  }
}
