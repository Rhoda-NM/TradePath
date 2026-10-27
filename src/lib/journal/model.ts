import { z } from "zod";
const price = z
  .number()
  .finite()
  .positive()
  .max(1000)
  .refine(
    (v) => Math.abs(v * 1e6 - Math.round(v * 1e6)) < 1e-6,
    "Use at most six decimal places.",
  );
const stamp = z.iso.datetime({ offset: true });
const nullablePrice = price.nullable();
export const candleSchema = z
  .object({ at: stamp, open: price, high: price, low: price, close: price })
  .strict();
export const setupSchema = z
  .object({
    mode: z.enum(["demo", "backtest", "free_trial"]),
    side: z.enum(["buy", "sell"]),
    accountRef: z.string().trim().min(1).max(80),
    dataset: z.enum(["development", "held_out"]).nullable(),
    decisionAt: stamp.nullable(),
    h4Candles: z.array(candleSchema).max(400),
    signalCloseAt: stamp.nullable(),
    zoneCreatedAt: stamp.nullable(),
    zoneTestedAt: stamp.nullable(),
    zoneLow: nullablePrice,
    zoneHigh: nullablePrice,
    open: nullablePrice,
    high: nullablePrice,
    low: nullablePrice,
    close: nullablePrice,
    entry: nullablePrice,
    stop: nullablePrice,
    target: nullablePrice,
    lots: z.number().finite().positive().max(1000).nullable(),
    entryAt: stamp.nullable(),
    nextH1Open: nullablePrice,
    equity: z.number().finite().positive().max(1e9).nullable(),
    currency: z.enum(["USD", "KES"]),
    rate: z.number().finite().positive().max(1e6).nullable(),
    equityAt: stamp.nullable(),
    rateAt: stamp.nullable(),
    rateSource: z.string().trim().max(200),
    pipCost: z.number().finite().nonnegative().max(1000),
    commission: z.number().finite().nonnegative().max(1e6),
    minLot: z.number().finite().positive().max(1000),
    lotStep: z.number().finite().positive().max(1000),
    news: z.enum(["clear", "blocked", "unknown"]),
    newsCheckedAt: stamp.nullable(),
    newsEvents: z.array(stamp).max(40),
    notes: z.string().trim().max(6000),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (v.mode === "backtest" ? !v.dataset : !!v.dataset)
      ctx.addIssue({
        code: "custom",
        message: "Only backtests use a development/held-out dataset.",
      });
  });
export type SetupInput = z.infer<typeof setupSchema>;
export const saveSetupSchema = z
  .object({ id: z.uuid(), previous: z.uuid().nullable(), input: setupSchema })
  .strict();
export const openTradeSchema = z
  .object({
    id: z.uuid(),
    setupId: z.uuid().nullable(),
    mode: z.enum(["demo", "backtest", "free_trial"]),
    side: z.enum(["buy", "sell"]),
    accountRef: z.string().trim().min(1).max(80),
    openedAt: stamp,
    entry: price,
    stop: nullablePrice,
    target: nullablePrice,
    lots: z.number().finite().positive().max(1000),
    costUSD: z.number().finite().nonnegative().max(1e9),
    notes: z.string().trim().max(6000),
  })
  .strict();
export const closeTradeSchema = z
  .object({
    id: z.uuid(),
    tradeId: z.uuid(),
    revision: z.number().int().nonnegative(),
    closedAt: stamp,
    exit: price,
    costUSD: z.number().finite().nonnegative().max(1e9),
    notes: z.string().trim().max(6000),
  })
  .strict();
export type GateResult = {
  dataValid: boolean;
  state: "eligible" | "ineligible" | "unknown";
  failures: string[];
  missing: string[];
  rulesVersion: string;
  ema50: number | null;
  riskUSD: number | null;
  riskPercent: number | null;
  suggestedLots: number | null;
  dailyEntries: number;
  dailyStopouts: number;
};
export type SetupRow = {
  id: string;
  candidate_id: string;
  revision: number;
  supersedes_id: string | null;
  mode: string;
  direction: string;
  account_ref: string;
  dataset_split: string | null;
  sequence_no: number | null;
  eligibility: string;
  rule_snapshot: {
    input: SetupInput;
    result: GateResult;
    rules: Record<string, unknown>;
  };
  created_at: string;
};
export type TradeRow = {
  created_at?: string;
  id: string;
  setup_id: string | null;
  mode: string;
  side: string;
  account_ref: string;
  opened_at: string;
  closed_at: string | null;
  entry: number;
  stop: number | null;
  target: number | null;
  exit: number | null;
  volume_lots: number;
  cost_usd: number;
  planned_risk_usd: number | null;
  realised_pnl_usd: number | null;
  realised_r: number | null;
  rule_compliant: boolean | null;
  breach_reasons: string[];
  notes: string | null;
  revision: number;
};
export type Screenshot = {
  id: string;
  parent_type: "setup" | "trade";
  parent_id: string;
  content_type: string;
  bytes: number;
  created_at: string;
};
export type Journal =
  | {
      ready: true;
      summary?: JournalSummary[];
      setups: SetupRow[];
      trades: TradeRow[];
      screenshots: Screenshot[];
      frozen: boolean;
      developmentCount: number;
      heldOutCount: number;
    }
  | { ready: false; message: string };
export function initialSetup(): SetupInput {
  return {
    mode: "demo",
    side: "buy",
    accountRef: "demo-main",
    dataset: null,
    decisionAt: null,
    h4Candles: [],
    signalCloseAt: null,
    zoneCreatedAt: null,
    zoneTestedAt: null,
    zoneLow: null,
    zoneHigh: null,
    open: null,
    high: null,
    low: null,
    close: null,
    entry: null,
    stop: null,
    target: null,
    lots: null,
    entryAt: null,
    nextH1Open: null,
    equity: null,
    currency: "USD",
    rate: null,
    equityAt: null,
    rateAt: null,
    rateSource: "",
    pipCost: 1,
    commission: 0,
    minLot: 0.01,
    lotStep: 0.01,
    news: "unknown",
    newsCheckedAt: null,
    newsEvents: [],
    notes: "",
  };
}

export type JournalSummary = {
  mode: string;
  account_ref: string;
  entries: number;
  open_trades: number;
  closed_trades: number;
  r_sample: number;
  missing_r: number;
  average_r: number | null;
  breaches: number;
  unassessed: number;
  net_pnl_usd: number | null;
  profit_factor: number | null;
};
