import { expect, it } from "vitest";
import { initialSetup, saveSetupSchema } from "../src/lib/journal/model";
import { parseCandles, utcInput, utcValue } from "../src/lib/journal/input";
import { tradesCSV } from "../src/lib/journal/csv";
import type { TradeRow } from "../src/lib/journal/model";
it("allows incomplete evidence without accepting client eligibility or ownership", () => {
  const input = {
    id: "11111111-1111-4111-8111-111111111111",
    previous: null,
    input: initialSetup(),
  };
  expect(saveSetupSchema.safeParse(input).success).toBe(true);
  expect(
    saveSetupSchema.safeParse({ ...input, user_id: "other" }).success,
  ).toBe(false);
  expect(
    saveSetupSchema.safeParse({
      ...input,
      input: { ...input.input, eligibility: "eligible" },
    }).success,
  ).toBe(false);
});
it("parses closed candle input and rejects malformed or excessive data", () => {
  expect(
    parseCandles(
      "timestamp,open,high,low,close\n2026-01-01T00:00:00Z,1.1,1.2,1,1.15",
    ),
  ).toHaveLength(1);
  expect(() => parseCandles("2026-01-01T00:00:00Z,1,2,0,1,extra")).toThrow();
  expect(() =>
    parseCandles(
      JSON.stringify(
        Array(401).fill({
          at: "2026-01-01T00:00:00Z",
          open: 1,
          high: 2,
          low: 1,
          close: 2,
        }),
      ),
    ),
  ).toThrow();
});
it("converts explicit UTC fields independently of the browser timezone", () => {
  expect(utcInput("2026-01-01T03:00:00+03:00")).toBe("2026-01-01T00:00:00");
  expect(utcValue("2026-01-01T00:00:00")).toBe("2026-01-01T00:00:00.000Z");
});
it("exports losses and escapes spreadsheet formulas and multiline notes", () => {
  const trade = {
    id: "id",
    mode: "demo",
    account_ref: "=SUM(1,2)",
    side: "sell",
    opened_at: "2026-01-01T00:00:00Z",
    closed_at: null,
    realised_pnl_usd: -10,
    realised_r: null,
    breach_reasons: ["Missing stop"],
    notes: 'line one\n"quoted"',
  } as TradeRow;
  const csv = tradesCSV([trade], "Africa/Nairobi");
  expect(csv).toContain("'=SUM(1,2)");
  expect(csv).toContain('"-10"');
  expect(csv).toContain('line one\n""quoted""');
  expect(csv).toContain("03:00:00");
});
