import "server-only";
import { parseSheets, type Rows } from "./parser";
export class SheetError extends Error {
  constructor(message: string, public status = 502) { super(message); }
}
export async function readDashboard(accessToken: string) {
  const id = process.env.GOOGLE_SPREADSHEET_ID;
  if (!id || !/^[\w-]+$/.test(id)) throw new SheetError("Set GOOGLE_SPREADSHEET_ID to the native 2026 spreadsheet ID.", 503);
  const endpoint = new URL(`https://sheets.googleapis.com/v4/spreadsheets/${id}/values:batchGet`);
  // Bounded to the inspected native grids; no Transactions data is requested.
  for (const range of ["'Statistics'!A1:J1000", "'Categories'!A1:AV1000", "'Performance'!A1:N1002"]) endpoint.searchParams.append("ranges", range);
  endpoint.searchParams.set("valueRenderOption", "UNFORMATTED_VALUE");
  endpoint.searchParams.set("dateTimeRenderOption", "SERIAL_NUMBER");
  let response: Response;
  try {
    response = await fetch(endpoint, { headers: { Authorization: `Bearer ${accessToken}` }, cache: "no-store", signal: AbortSignal.timeout(20000) });
  } catch { throw new SheetError("Google Sheets could not be reached. Try refreshing shortly."); }
  if (response.status === 401) throw new SheetError("Your Google session expired. Sign in again.", 401);
  if (response.status === 403) throw new SheetError("This Google account cannot read the spreadsheet, or the Google Sheets API is disabled.", 403);
  if (response.status === 404) throw new SheetError("The spreadsheet was not found. Check its ID and account access.", 404);
  if (response.status === 429) throw new SheetError("Google Sheets is rate limiting requests. Wait a moment and refresh.", 429);
  if (!response.ok) throw new SheetError("Google Sheets could not load the three required tabs. Check their names and try again.");
  const body = await response.json() as { valueRanges?: { values?: Rows }[] };
  if (body.valueRanges?.length !== 3) throw new SheetError("Google Sheets returned an incomplete response.");
  let data;
  try { data = parseSheets(...body.valueRanges.map(range => range.values ?? []) as [Rows, Rows, Rows]); }
  catch (error) { throw new SheetError(error instanceof Error ? error.message : "The sheet layout is invalid.", 422); }
  const currency = process.env.EXPENSE_CURRENCY || "CVE";
  try { new Intl.NumberFormat("en", { style: "currency", currency }); }
  catch { throw new SheetError("EXPENSE_CURRENCY must be a valid ISO currency code.", 503); }
  return { ...data, currency, fetchedAt: new Date().toISOString(), sourceUrl: `https://docs.google.com/spreadsheets/d/${id}/edit` };
}
