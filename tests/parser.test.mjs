import test from "node:test";
import assert from "node:assert/strict";
import { parseSheets, sheetDate } from "../lib/parser.ts";

function fixture() {
  return {
    statistics: [["DEBITS BY LOCAL", "", "", "", "DEBITS BY CATEGORY"], ["LOCAL", "TOTAL DEBITS", "TRANSACTIONS", "", "CATEGORY", "TOTAL DEBITS", "TRANSACTIONS"], ["Demo Market", -120, 2, "", "GROCERIES", -120, 2], ["Demo Cafe", -80, 1, "", "COFFEE BAR", -80, 1]],
    categories: [["GROCERIES", "", "", "", "COFFEE BAR"], ["SUMMARY", "TRANSACTIONS", "TOTAL DEBITS"], ["TOTAL", 2, -120, "", "TOTAL", 1, -80], [], ["LOCAL", "TRANSACTIONS", "TOTAL DEBITS"], ["Demo Market", 2, -120, "", "", 1, -80]],
    performance: [["RENT and BANK FEES excluded"], ["DAILY DEBITS"], ["AVERAGE / PERIOD", -100, 1.5], ["VALUE DATE", "TOTAL DEBITS", "TRANSACTIONS", "", "", "WEEK START", "WEEK END", "TOTAL DEBITS", "TRANSACTIONS", "", "MONTH", "TOTAL DEBITS", "TRANSACTIONS"], [46151, -80, 1, "", "", 46146, 46152, -200, 3, "", 46143, -200, 3], [46150, -120, 2]]
  };
}
test("maps the three tab layouts without mixing source scopes", () => {
  const { statistics, categories, performance } = fixture();
  const data = parseSheets(statistics, categories, performance);
  assert.equal(data.statistics.categories[0].debit, 120);
  assert.equal(data.statistics.merchants[0].count, 2);
  assert.equal(data.categories[0].merchants[0].debit, 120);
  assert.equal(data.categories[1].merchants[0].name, "No merchant specified");
  assert.equal(data.performance.weekly[0].count, 3);
  assert.equal(data.performance.monthly[0].debit, 200);
  assert.ok(data.performance.daily[0].date < data.performance.daily[1].date);
  assert.equal(data.warnings.length, 0);
});
test("preserves and reports count discrepancies between source tabs", () => {
  const { statistics, categories, performance } = fixture();
  categories[2][1] = 3;
  const data = parseSheets(statistics, categories, performance);
  assert.equal(data.statistics.categories[0].count, 2);
  assert.equal(data.categories[0].count, 3);
  assert.equal(data.warnings.length, 1);
});
test("converts serial dates in UTC independent of server timezone", () => {
  assert.equal(sheetDate(25569), "1970-01-01");
  assert.equal(sheetDate(25569.8), "1970-01-01");
});
test("refuses formula errors and changed layouts instead of inventing zero totals", () => {
  const { statistics, categories, performance } = fixture();
  statistics[2][1] = "#REF!";
  assert.throws(() => parseSheets(statistics, categories, performance), /numeric value/);
  statistics[1][0] = "Changed header";
  assert.throws(() => parseSheets(statistics, categories, performance), /Statistics must contain/);
});
test("keeps genuine zero totals and rejects negative counts", () => {
  const { statistics, categories, performance } = fixture();
  statistics[2][1] = 0;
  assert.equal(parseSheets(statistics, categories, performance).statistics.merchants[0].debit, 0);
  performance[4][2] = -1;
  assert.throws(() => parseSheets(statistics, categories, performance), /Invalid transaction count/);
});
