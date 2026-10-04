export type Cell = string | number | boolean | null;
export type Rows = Cell[][];
export type Total = { name: string; debit: number; count: number };
export type Category = Total & { merchants: Total[] };
export type Period = { date: string; end?: string; debit: number; count: number };
export type DashboardData = {
  statistics: { merchants: Total[]; categories: Total[] };
  categories: Category[];
  performance: { note: string; daily: Period[]; weekly: Period[]; monthly: Period[] };
  warnings: string[];
};

function number(value: Cell | undefined, context: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`Expected a numeric value in ${context}. Check the sheet formulas.`);
  }
  return value;
}
function debit(value: Cell | undefined, context: string): number {
  return Math.abs(number(value, context));
}
function count(value: Cell | undefined, context: string): number {
  const n = number(value, context);
  if (!Number.isInteger(n) || n < 0) throw new Error(`Invalid transaction count in ${context}.`);
  return n;
}
export function sheetDate(value: Cell | undefined): string {
  const serial = number(value, "Performance date");
  const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
  if (!Number.isFinite(date.getTime())) throw new Error("Invalid Performance date.");
  return date.toISOString().slice(0, 10);
}
function totals(rows: Rows, offset: number, swap = false): Total[] {
  return rows.flatMap((row, i) => {
    if (row[offset] === undefined || row[offset] === "" || row[offset] === null) return [];
    return [{
      name: String(row[offset]),
      debit: debit(row[offset + (swap ? 2 : 1)], `row ${i + 1}`),
      count: count(row[offset + (swap ? 1 : 2)], `row ${i + 1}`)
    }];
  });
}
export function parseSheets(statistics: Rows, categories: Rows, performance: Rows): DashboardData {
  if (statistics[1]?.[0] !== "LOCAL" || statistics[1]?.[4] !== "CATEGORY") {
    throw new Error("Statistics must contain LOCAL / TOTAL DEBITS / TRANSACTIONS in A:C and CATEGORY / TOTAL DEBITS / TRANSACTIONS in E:G.");
  }
  if (categories[1]?.[0] !== "SUMMARY" || categories[4]?.[0] !== "LOCAL") {
    throw new Error("Categories must contain SUMMARY on row 2 and LOCAL on row 5.");
  }
  if (performance[3]?.[0] !== "VALUE DATE" || performance[3]?.[5] !== "WEEK START" || performance[3]?.[10] !== "MONTH") {
    throw new Error("Performance must contain daily, weekly, and monthly headers on row 4.");
  }
  const result: DashboardData = {
    statistics: { merchants: totals(statistics.slice(2), 0), categories: totals(statistics.slice(2), 4) },
    categories: [],
    performance: { note: String(performance[0]?.[0] ?? ""), daily: [], weekly: [], monthly: [] },
    warnings: []
  };
  for (let offset = 0; offset < (categories[0]?.length ?? 0); offset += 4) {
    const name = categories[0]?.[offset];
    if (!name) continue;
    if (categories[2]?.[offset] !== "TOTAL") throw new Error(`Missing TOTAL for category ${name}.`);
    const merchants = categories.slice(5).flatMap((row, i) => {
      if (row[offset + 2] === undefined || row[offset + 2] === "") return [];
      return [{ name: String(row[offset] || "No merchant specified"),
        count: count(row[offset + 1], `Categories row ${i + 6}`),
        debit: debit(row[offset + 2], `Categories row ${i + 6}`) }];
    });
    const category: Category = {
      name: String(name), merchants,
      count: count(categories[2][offset + 1], `Categories ${name}`),
      debit: debit(categories[2][offset + 2], `Categories ${name}`)
    };
    result.categories.push(category);
    const stat = result.statistics.categories.find(c => c.name === category.name);
    if (stat && (stat.count !== category.count || Math.abs(stat.debit - category.debit) > 0.01)) {
      result.warnings.push(`${category.name}: Statistics reports ${stat.count} transactions; Categories reports ${category.count}. Totals are displayed from their respective tabs.`);
    }
  }
  for (const row of performance.slice(4)) {
    if (row[0] !== undefined && row[0] !== "") result.performance.daily.push({ date: sheetDate(row[0]), debit: debit(row[1], "daily debit"), count: count(row[2], "daily count") });
    if (row[5] !== undefined && row[5] !== "") result.performance.weekly.push({ date: sheetDate(row[5]), end: sheetDate(row[6]), debit: debit(row[7], "weekly debit"), count: count(row[8], "weekly count") });
    if (row[10] !== undefined && row[10] !== "") result.performance.monthly.push({ date: sheetDate(row[10]), debit: debit(row[11], "monthly debit"), count: count(row[12], "monthly count") });
  }
  for (const periods of [result.performance.daily, result.performance.weekly, result.performance.monthly]) periods.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}
