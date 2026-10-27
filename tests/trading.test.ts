import { describe, it, expect } from "vitest";
import {
  sizePosition,
  realisedTrade,
  localDate,
  evaluateGate,
  type RiskInput,
} from "../src/lib/trading";
const base: RiskInput = {
  balance: 10000,
  currency: "KES",
  rate: 129.89,
  side: "buy",
  entry: 1.08,
  stop: 1.078,
  riskPercent: 0.5,
  pipCost: 1,
  commission: 0,
  minLot: 0.01,
  lotStep: 0.01,
};
describe("position sizing", () => {
  it("AC-07 skips broker minimum rather than rounding up", () => {
    const r = sizePosition(base);
    expect(r.riskUSD).toBeCloseTo(0.384941, 5);
    expect(r.theoreticalLots).toBeCloseTo(0.001833, 6);
    expect(r.skip).toBe(true);
    expect(r.lots).toBe(0);
  });
  it("AC-08 permits 0.001 lots with supported increment", () => {
    const r = sizePosition({ ...base, minLot: 0.001, lotStep: 0.001 });
    expect(r.lots).toBe(0.001);
    expect(r.skip).toBe(false);
    expect(r.modeledLossUSD).toBeLessThanOrEqual(r.riskUSD);
  });
  it("validates BUY/SELL stops and nonfinite amounts", () => {
    expect(() => sizePosition({ ...base, side: "sell" })).toThrow();
    expect(() => sizePosition({ ...base, entry: 0 })).toThrow();
    expect(() => sizePosition({ ...base, balance: NaN })).toThrow();
    expect(() => sizePosition({ ...base, riskPercent: 1 })).toThrow();
    expect(
      sizePosition({ ...base, side: "sell", stop: 1.082 }).distancePips,
    ).toBeCloseTo(20);
  });
});
describe("trade accounting and dates", () => {
  it("AC-12 subtracts costs on a winning SELL", () => {
    const r = realisedTrade("sell", 1.1, 1.098, 0.01, 0.1, 2);
    expect(r.pnl).toBeCloseTo(1.9);
    expect(r.r).toBeCloseTo(0.95);
  });
  it("retains negative outcomes", () =>
    expect(realisedTrade("buy", 1.1, 1.098, 0.01, 0.1, 2).pnl).toBeCloseTo(
      -2.1,
    ));
  it("AC-03 separates local days at Nairobi midnight", () => {
    expect(localDate(new Date("2026-10-26T20:59:59Z"))).toBe("2026-10-26");
    expect(localDate(new Date("2026-10-26T21:00:00Z"))).toBe("2026-10-27");
  });
});
describe("partial evidence gate fails safely", () => {
  it("missing evidence is unknown", () =>
    expect(evaluateGate({ side: "buy" }).state).toBe("unknown"));
  it("future candle cannot pass", () =>
    expect(
      evaluateGate({ side: "buy", signalCloseAt: "2099-01-01T12:00:00Z" })
        .state,
    ).toBe("ineligible"));
  it("late zone fails", () =>
    expect(
      evaluateGate({
        side: "buy",
        signalCloseAt: "2026-01-01T12:00:00Z",
        zoneCreatedAt: "2026-01-01T13:00:00Z",
      }).state,
    ).toBe("ineligible"));
  it("rejects zero range candle and daily limits", () => {
    expect(
      evaluateGate({
        side: "buy",
        open: 1,
        high: 1,
        low: 1,
        close: 1,
        zoneLow: 1,
        zoneHigh: 1,
      }).state,
    ).toBe("ineligible");
    expect(evaluateGate({ side: "sell", tradesToday: 2 }).state).toBe(
      "ineligible",
    );
  });
});
