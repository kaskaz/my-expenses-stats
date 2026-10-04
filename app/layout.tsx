import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = { title: "My Expenses · Your spending, in perspective", description: "Private Google Sheets expense analytics across Statistics, Categories, and Performance." };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
