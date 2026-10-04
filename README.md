# My Expenses Stats

A Next.js application for the **2026** spreadsheet in **EXTRATOS-BCN**. It reads the existing **Statistics**, **Categories**, and **Performance** tabs and turns their calculated values into interactive charts. The Google Sheet stays unchanged.

## What you get

- **Statistics:** spending totals, transaction counts, category donut and comparison charts, and a searchable, sortable merchant table.
- **Categories:** category selection and merchant drill-down charts, including blank merchant labels.
- **Performance:** daily, weekly, and monthly trends; date filters; spending/transaction metric selection; area/bar views; chart zoom; and a paginated data table.
- CSV export of the selected view, refresh on demand, loading/error/empty states, and mobile navigation.
- An explicitly labelled **synthetic demo** before sign-in. No private financial records are committed to this public repository.

## Setup

Requires Node.js **22.18+ within the 22.x release line**, npm, and a Google account with access to the source spreadsheet. Node.js 22.x is also configured for Vercel.

1. Clone this repository and install:

   ```sh
   npm install
   cp .env.example .env.local
   ```

2. In [Google Cloud Console](https://console.cloud.google.com/), create/select a project and enable the **Google Sheets API**.
3. Configure the OAuth consent screen. Add `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/spreadsheets.readonly`. For an external app in testing, add your Google account as a test user. A public OAuth app may require Google's verification; a personal test app can remain limited to test users.
4. Create an **OAuth client ID → Web application**. Add this exact authorised redirect URI:

   ```text
   http://localhost:3000/api/auth/callback
   ```

   For production, add `https://YOUR-DOMAIN/api/auth/callback` as well. Set `APP_URL` to that exact origin, without a path.

5. Fill `.env.local`:

   ```dotenv
   GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
   GOOGLE_CLIENT_SECRET=your-client-secret
   SESSION_SECRET=generate-at-least-32-random-characters
   APP_URL=http://localhost:3000
   GOOGLE_SPREADSHEET_ID=the-native-2026-spreadsheet-id
   ALLOWED_GOOGLE_EMAIL=your-google-account@example.com
   EXPENSE_CURRENCY=CVE
   ```

   Generate a secret with `openssl rand -base64 48`. Find the native **2026** Google Sheet in **EXTRATOS-BCN**, then copy the ID between `/d/` and `/edit` in its URL. Use the native Sheet, not one of the `.xls` files. The spreadsheet ID and credentials are configured at runtime rather than committed here. `ALLOWED_GOOGLE_EMAIL` is optional, but useful for a personal dashboard. **Confirm the currency:** the three source tabs do not declare one; CVE is a configurable display default. Values are never scaled or converted.

6. Run `npm run dev`, open [localhost:3000](http://localhost:3000), and click **Connect Google Sheet**. Sign in with the account that can read the workbook.

The ChatGPT Google Drive connection lets the assistant inspect the source; it does not supply credentials to this deployed application. The application needs its own OAuth client and runtime environment variables.

## Source semantics

The parser matches the inspected workbook structure:

| Tab | Values read | Layout |
| --- | --- | --- |
| Statistics | Merchant and category debit totals and counts | A:C and E:G; headers on row 2; values from row 3 |
| Categories | Category summaries and their merchants | Repeating four-column blocks across A:AV; title row 1; summary row 3; merchant headers row 5; values from row 6 |
| Performance | Daily, weekly, and monthly debit totals and counts | A:C, F:I, K:M; headers on row 4; values from row 5 |

- **Statistics and Categories include rent and bank fees. Performance excludes them**, as defined in the source sheet. These totals should not be compared as if they have the same scope.
- Debits are signed negative in the source and displayed as positive spending using their absolute values. These tabs are debit summaries, not net cash flow or income.
- Performance dates are Sheets serial dates, converted in UTC. Weeks are Monday–Sunday. Date filters select **period start dates**, preserving each source period's complete total. Filtering mid-week/mid-month does not prorate a period.
- Averages use recorded periods only, matching the sheet's approach. Missing dates are not inserted as zero-spend days. Edge weeks/months may be incomplete; no current-month projection is invented.
- Categories contains twelve category blocks; Statistics can contain additional categories. Both views preserve their tab's own coverage.
- The inspected source has count differences for **BARS** and **RESTAURANTS** between Statistics and Categories. The UI reports discrepancies while preserving each tab's own figures.
- The application does not read the Transactions tab. It has no transaction-level/category filters for Performance because those dimensions are not present in the Performance aggregates.
- Reads are bounded to the inspected grids (Statistics A1:J1000, Categories A1:AV1000, Performance A1:N1002). If you expand the workbook beyond those ranges, update `lib/sheets.ts`. If you change the headers or block layout, update `lib/parser.ts`. Invalid formulas or changed layouts produce errors rather than silent zero values.

## Privacy and authentication

Google OAuth uses PKCE and a random state verified against an encrypted, short-lived, HTTP-only cookie. The application requests read-only Sheets access; Google's scope grants read access to spreadsheets the signed-in account can access, while this app only requests the configured workbook. Access tokens live only inside an encrypted HTTP-only session cookie; they are never returned to the browser's JavaScript or stored in local storage. Sessions expire with the Google access token (about one hour); sign in again after expiry. No refresh token or persistent database is used.

The dashboard API checks authentication before reading Sheets and returns `private, no-store` responses. Each signed-in Google account must have permission to the workbook; optional email restrictions provide an additional gate. Signing out clears the application session. It does not revoke Google's consent; you can revoke that in your Google Account settings. Use HTTPS for production so session cookies are secure. Keep `.env.local` and all credentials out of source control.

## Verification

```sh
npm test
npm run lint
npm run typecheck
npm run build
```

Parser tests run directly with Node's TypeScript stripping and synthetic fixtures. GitHub Actions also installs dependencies, lints, typechecks, and builds without real Google credentials. After OAuth setup, verify sign-in, all three views, refresh, expiry/sign-out, and an account without spreadsheet access. Runtime financial data is fetched only after sign-in.

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fkaskaz%2Fmy-expenses-stats&env=GOOGLE_CLIENT_ID,GOOGLE_CLIENT_SECRET,SESSION_SECRET,APP_URL,GOOGLE_SPREADSHEET_ID&envDescription=Configure%20Google%20OAuth%20and%20the%20private%202026%20spreadsheet.%20APP_URL%20must%20be%20your%20production%20HTTPS%20origin.&envLink=https%3A%2F%2Fgithub.com%2Fkaskaz%2Fmy-expenses-stats%23deploy-to-vercel)

To deploy this existing repository directly, use [Vercel → New Project](https://vercel.com/new), import **kaskaz/my-expenses-stats**, and select **master** as the production branch. Keep the root directory at the repository root. `vercel.json` supplies the Next.js framework, install, and build commands; `package.json` selects Node.js 22.x. Leave the output directory at the Next.js default. No separate backend, database, or static export is needed.

1. Import the project and deploy. Without credentials the app builds and opens in synthetic demo mode, so you can obtain its stable production domain first.
2. Under **Project Settings → Environment Variables**, add the following for **Production**:

   | Variable | Value |
   | --- | --- |
   | `GOOGLE_CLIENT_ID` | Your Google OAuth Web application client ID |
   | `GOOGLE_CLIENT_SECRET` | Its client secret; mark it sensitive |
   | `SESSION_SECRET` | At least 32 random characters; generate with `openssl rand -base64 48`; mark it sensitive |
   | `APP_URL` | The exact stable HTTPS origin, e.g. `https://my-expenses-stats.vercel.app`, with no path |
   | `GOOGLE_SPREADSHEET_ID` | The native **2026** Sheet ID from **EXTRATOS-BCN** |
   | `ALLOWED_GOOGLE_EMAIL` | Optional: the Google account allowed to sign in |
   | `EXPENSE_CURRENCY` | Optional: ISO currency code; defaults to `CVE`; confirm the workbook's currency |

   Use server environment variables with these exact names. Do not add a `NEXT_PUBLIC_` prefix. The one-click button above asks for the five required variables up front; verify `APP_URL` matches the domain Vercel assigns and update it if necessary.

3. In Google Cloud Console, enable the **Google Sheets API** and configure the OAuth consent screen and test user as described in [Setup](#setup). Add this authorised redirect URI to the Web application OAuth client, replacing the domain with the exact `APP_URL`:

   ```text
   https://my-expenses-stats.vercel.app/api/auth/callback
   ```

4. **Redeploy** after changing environment variables. Open the production domain, connect Google, and verify the three dashboard views and refresh. Sign in using an account with spreadsheet access.

OAuth redirects and sign-out use `APP_URL`, so always use that canonical domain. When adding a custom domain, update both `APP_URL` and the Google redirect URI, then redeploy. For preview deployments, keep demo mode or configure a separate exact preview origin and matching Google callback URI; production credentials alone do not configure preview sign-in. Google does not accept wildcard callback URLs.

The callback runs as a Node.js server function with a 60-second limit, and the dashboard API has a 30-second limit to accommodate its bounded Google requests. Financial responses use `private, no-store` and are not cached by the Vercel CDN. The build does not fetch the private workbook or require real Google credentials.

For self-hosting, run `npm run build` and `npm start` with the same runtime variables. Static export is unsupported because OAuth and Sheets reads require server routes.

After your first successful install, commit the generated `package-lock.json` and switch CI to `npm ci` for reproducible dependency installs. This repository initially uses `npm install` because the authoring environment could not access the package registry.
