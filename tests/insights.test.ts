import { describe, it, expect } from "vitest";
import {
  tradeMetrics,
  equityMetrics,
  disciplineScore,
  readiness,
  processMetrics,
  equitySchema,
} from "../src/lib/insights/model";
import type { Equity } from "../src/lib/insights/model";
import type { TradeRow, SetupRow } from "../src/lib/journal/model";
const setup = {
  id: "s",
  eligibility: "eligible",
  dataset_split: "development",
} as SetupRow;
function trade(p: Partial<TradeRow> = {}): TradeRow {
  return {
    id: "t",
    setup_id: "s",
    mode: "demo",
    side: "buy",
    account_ref: "one",
    opened_at: "2026-01-01T10:00:00Z",
    closed_at: "2026-01-02T10:00:00Z",
    entry: 1.1,
    stop: 1.09,
    target: 1.12,
    exit: 1.12,
    volume_lots: 0.1,
    cost_usd: 0,
    planned_risk_usd: 100,
    realised_pnl_usd: 200,
    realised_r: 2,
    rule_compliant: true,
    breach_reasons: [],
    notes: "Reflection",
    revision: 1,
    ...p,
  };
}
function equity(
  at: string,
  value: number,
  extra: Partial<Equity> = {},
): Equity {
  return {
    id: at,
    at,
    account_mode: "demo",
    account_ref: "one",
    balance_usd: value,
    equity_usd: value,
    deposits_usd: 0,
    withdrawals_usd: 0,
    cashflows_confirmed: true,
    notes: "statement",
    revision: 0,
    ...extra,
  };
}
describe("performance and discipline", () => {
  it("keeps losses and segregates mode/account, using close date for results", () => {
    const trades = [
      trade(),
      trade({
        realised_pnl_usd: -100,
        realised_r: -1,
        rule_compliant: false,
        breach_reasons: [
          "Actual modeled loss exceeds the selected equity risk budget.",
        ],
      }),
      trade({ mode: "backtest", realised_pnl_usd: 900 }),
      trade({ account_ref: "other", realised_pnl_usd: 900 }),
    ];
    const m = tradeMetrics(
      trades,
      [setup],
      "demo",
      "one",
      "2026-01-02",
      "2026-01-02",
    );
    expect(m.closed).toBe(2);
    expect(m.entries).toBe(0);
    expect(m.net).toBe(100);
    expect(m.averageR).toBe(0.5);
    expect(m.winRate).toBe(0.5);
    expect(m.profitFactor).toBe(2);
    expect(m.adherence).toBe(0.5);
  });
  it("does not fabricate denominators or exclude unassessed losses from net results", () => {
    const m = tradeMetrics(
      [
        trade({
          setup_id: null,
          rule_compliant: null,
          realised_r: null,
          realised_pnl_usd: -10,
        }),
      ],
      [setup],
      "demo",
      "one",
    );
    expect(m.averageR).toBeNull();
    expect(m.net).toBe(-10);
    expect(m.profitFactor).toBe(0);
    expect(m.missingR).toBe(1);
    expect(m.riskUnknown).toBe(1);
    expect(disciplineScore(m, 1)).toBeNull();
  });
  it("uses 40/30/15/15 only with measurable components", () => {
    const m = tradeMetrics([trade()], [setup], "demo", "one");
    expect(disciplineScore(m, 0.5)).toBe(92.5);
    expect(disciplineScore(m, null)).toBeNull();
  });
  it("separates held-out data and includes breakevens in win denominator", () => {
    const held = { ...setup, id: "held", dataset_split: "held_out" };
    const m = tradeMetrics(
      [
        trade({ mode: "backtest" }),
        trade({
          mode: "backtest",
          setup_id: "held",
          realised_pnl_usd: 0,
          realised_r: 0,
        }),
      ],
      [setup, held],
      "backtest",
      "one",
      "",
      "",
      "held_out",
    );
    expect(m.closed).toBe(1);
    expect(m.winRate).toBe(0);
    expect(m.profitFactor).toBeNull();
  });
});
describe("equity and readiness", () => {
  it("adjusts deposits and withdrawals without manufacturing drawdown", () => {
    const e = equityMetrics(
      [
        equity("2026-01-01T00:00:00Z", 1000),
        equity("2026-01-02T00:00:00Z", 1500, { deposits_usd: 500 }),
        equity("2026-01-03T00:00:00Z", 1200, { withdrawals_usd: 300 }),
      ],
      [],
      "demo",
      "one",
    );
    expect(e.drawdown).toBe(0);
    expect(e.points.map((p) => p.value)).toEqual([100, 100, 100]);
    expect(e.adequate).toBe(false);
  });
  it("measures peak-to-subsequent-trough, not first-to-last, and retains account isolation", () => {
    const e = equityMetrics(
      [
        equity("2026-01-01T00:00:00Z", 1000),
        equity("2026-01-02T00:00:00Z", 1200),
        equity("2026-01-03T00:00:00Z", 900),
        equity("2026-01-04T00:00:00Z", 1250),
        equity("2026-01-05T00:00:00Z", 1, { account_ref: "other" }),
      ],
      [],
      "demo",
      "one",
    );
    expect(e.drawdown).toBeCloseTo(25);
    expect(e.points).toHaveLength(4);
  });
  it("unknown cash flows and starting equity never pass readiness", () => {
    const e = equityMetrics(
      [
        equity("2026-01-01T00:00:00Z", 1000),
        equity("2026-01-02T00:00:00Z", 999, { cashflows_confirmed: false }),
      ],
      [],
      "demo",
      "one",
    );
    expect(e.drawdown).toBeNull();
    expect(e.adequate).toBe(false);
    const m = tradeMetrics(
      Array.from({ length: 50 }, () => trade()),
      [setup],
      "demo",
      "one",
    );
    expect(
      readiness(m, e, 70, 30, true).find((g) => g.label.includes("drawdown"))
        ?.state,
    ).toBe("Insufficient data");
  });
  it("requires 30 daily dates, full execution coverage and no open trades", () => {
    const rows = Array.from({ length: 30 }, (_, i) =>
      equity(`2026-01-${String(i + 1).padStart(2, "0")}T00:00:00Z`, 1000),
    );
    expect(equityMetrics(rows, [trade()], "demo", "one").adequate).toBe(true);
    expect(
      equityMetrics(
        rows.filter((_, i) => i !== 5),
        [trade()],
        "demo",
        "one",
      ).adequate,
    ).toBe(false);
    expect(
      equityMetrics(rows, [trade({ closed_at: null })], "demo", "one").adequate,
    ).toBe(false);
  });
  it("does not let snapshots after the end filter invalidate an earlier curve", () => {
    const rows = [
      equity("2026-01-01T00:00:00Z", 1000),
      equity("2026-01-02T00:00:00Z", 900),
      equity("2026-01-03T00:00:00Z", 800, { cashflows_confirmed: false }),
    ];
    expect(
      equityMetrics(rows, [], "demo", "one", "", "2026-01-02").drawdown,
    ).toBeCloseTo(10);
  });
});
it("counts reviews only after the week ends and keeps no-trade evidence separate", () => {
  const m = processMetrics(
    {
      start: "2026-01-05",
      today: "2026-01-12",
      reviews: [{ week_start_local_date: "2026-01-05", state: "submitted" }],
      sessions: [],
      tasks: [],
      noTrades: [{ created_at: "2026-01-07T12:00:00Z" }],
    },
    "",
    "",
  );
  expect(m.reviewsDue).toBe(1);
  expect(m.reviews).toBe(1);
  expect(m.sessionsDue).toBe(6);
  expect(m.noTrades).toBe(1);
});
it("rejects spoofed owners and nonfinite snapshot values", () => {
  const p = {
    operation: "11111111-1111-4111-8111-111111111111",
    id: null,
    revision: 0,
    mode: "demo",
    account: "one",
    at: "2026-01-01T00:00:00Z",
    balance: 100,
    equity: 100,
    deposits: 0,
    withdrawals: 0,
    confirmed: true,
    notes: "",
  };
  expect(equitySchema.safeParse(p).success).toBe(true);
  expect(equitySchema.safeParse({ ...p, user_id: "other" }).success).toBe(
    false,
  );
  expect(equitySchema.safeParse({ ...p, equity: Infinity }).success).toBe(
    false,
  );
});
it("does not mistake floating-point cancellation for positive expectancy", () => {
  const m = tradeMetrics(
    [
      trade({ realised_r: 0.1 }),
      trade({ realised_r: 0.2 }),
      trade({ realised_r: -0.3 }),
    ],
    [setup],
    "demo",
    "one",
  );
  expect(m.averageR).toBe(0);
});
