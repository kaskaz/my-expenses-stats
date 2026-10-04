import type { DashboardData, Period } from "./parser";
// Entirely synthetic preview data. Never copy private workbook values into this file.
const names = ["GROCERIES", "RESTAURANTS", "BARS", "RENT", "WITHDRAW", "COFFEE BAR", "UNKNOWN"];
const amounts = [84000, 62000, 43000, 180000, 30000, 9000, 5500];
const categories = names.map((name, i) => ({ name, debit: amounts[i], count: (i + 1) * 7,
  merchants: ["Market Square", "Harbour Corner", "Neighbourhood Shop"].map((merchant, j) => ({ name: `${merchant} ${i + 1}`, debit: amounts[i] * [0.5, 0.3, 0.2][j], count: (i + 1) * [4, 2, 1][j] })) }));
const daily: Period[] = Array.from({ length: 120 }, (_, i) => ({
  date: new Date(Date.UTC(2026, 4, 1 + i)).toISOString().slice(0, 10),
  debit: 900 + ((i * 1373) % 5600), count: 2 + (i % 8)
}));
function grouped(kind: "weekly" | "monthly") {
  const map = new Map<string, Period>();
  for (const row of daily) {
    const date = new Date(`${row.date}T00:00:00Z`);
    if (kind === "weekly") date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    else date.setUTCDate(1);
    const key = date.toISOString().slice(0, 10);
    const total = map.get(key) ?? { date: key, debit: 0, count: 0 };
    total.debit += row.debit; total.count += row.count;
    if (kind === "weekly") total.end = new Date(date.getTime() + 6 * 86400000).toISOString().slice(0, 10);
    map.set(key, total);
  }
  return [...map.values()];
}
export type DashboardPayload = DashboardData & { currency: string; fetchedAt: string; sourceUrl: string };
export const demoData: DashboardPayload = {
  statistics: { categories, merchants: categories.flatMap(c => c.merchants).sort((a, b) => b.debit - a.debit) }, categories,
  performance: { note: "Signed debit totals grouped by VALUE DATE. Weeks run Monday–Sunday. RENT and BANK FEES are excluded; uncategorized debits remain included.", daily, weekly: grouped("weekly"), monthly: grouped("monthly") },
  warnings: [], currency: "CVE", fetchedAt: "", sourceUrl: ""
};
