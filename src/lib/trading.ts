import { z } from "zod";

export function localDate(at = new Date(), timezone = "Africa/Nairobi") {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}
export const riskSchema = z
  .object({
    balance: z.number().positive(),
    currency: z.enum(["USD", "KES"]),
    rate: z.number().positive(),
    side: z.enum(["buy", "sell"]),
    entry: z.number().positive(),
    stop: z.number().positive(),
    riskPercent: z.number().positive().max(0.5),
    pipCost: z.number().nonnegative(),
    commission: z.number().nonnegative(),
    minLot: z.number().positive(),
    lotStep: z.number().positive(),
  })
  .superRefine((v, ctx) => {
    if (v.side === "buy" ? v.stop >= v.entry : v.stop <= v.entry)
      ctx.addIssue({
        code: "custom",
        message: "Stop must be below a BUY entry or above a SELL entry.",
        path: ["stop"],
      });
  });
export type RiskInput = z.infer<typeof riskSchema>;
export function sizePosition(raw: RiskInput) {
  const v = riskSchema.parse(raw);
  const balanceUSD = v.currency === "KES" ? v.balance / v.rate : v.balance;
  const riskUSD = (balanceUSD * v.riskPercent) / 100;
  const distancePips = Math.abs(v.entry - v.stop) * 10000;
  const costPerLot = (distancePips + v.pipCost) * 10 + v.commission;
  const theoreticalLots = riskUSD / costPerLot;
  let units = Math.floor(theoreticalLots / v.lotStep);
  // Never allow floating point error to recommend risk above the budget.
  while (units > 0 && units * v.lotStep * costPerLot > riskUSD) units--;
  const lots = Number((units * v.lotStep).toFixed(8));
  return {
    riskUSD,
    distancePips,
    theoreticalLots,
    lots,
    skip: lots < v.minLot,
    modeledLossUSD: lots * costPerLot,
  };
}
export type GateInput = {
  side: "buy" | "sell";
  entry?: number;
  stop?: number;
  target?: number;
  zoneLow?: number;
  zoneHigh?: number;
  open?: number;
  high?: number;
  low?: number;
  close?: number;
  signalCloseAt?: string;
  zoneCreatedAt?: string;
  h4Aligned?: boolean;
  newsClear?: boolean;
  riskPercent?: number;
  tradesToday?: number;
  stopoutsToday?: number;
};
export function evaluateGate(v: GateInput, now = new Date()) {
  const failures: string[] = [],
    missing: string[] = [];
  for (const key of [
    "entry",
    "stop",
    "target",
    "zoneLow",
    "zoneHigh",
    "open",
    "high",
    "low",
    "close",
    "signalCloseAt",
    "zoneCreatedAt",
    "h4Aligned",
    "newsClear",
    "riskPercent",
    "tradesToday",
    "stopoutsToday",
  ] as const) {
    if (v[key] === undefined) missing.push(key);
  }
  for (const key of [
    "entry",
    "stop",
    "target",
    "zoneLow",
    "zoneHigh",
    "open",
    "high",
    "low",
    "close",
  ] as const) {
    if (v[key] !== undefined && (!Number.isFinite(v[key]) || v[key]! <= 0))
      failures.push(`${key} must be a positive finite price.`);
  }
  if (v.h4Aligned === false)
    failures.push("H4 structure and EMA50 must align with direction.");
  if (v.newsClear === false)
    failures.push("High-impact news exclusion window has not cleared.");
  if (
    v.riskPercent !== undefined &&
    (!Number.isFinite(v.riskPercent) ||
      v.riskPercent <= 0 ||
      v.riskPercent > 0.5)
  )
    failures.push("Planned risk must be positive and at most 0.5%.");
  if (
    v.tradesToday !== undefined &&
    (!Number.isInteger(v.tradesToday) ||
      v.tradesToday < 0 ||
      v.tradesToday >= 2)
  )
    failures.push("Daily entry limit reached or invalid count.");
  if (
    v.stopoutsToday !== undefined &&
    (!Number.isInteger(v.stopoutsToday) ||
      v.stopoutsToday < 0 ||
      v.stopoutsToday >= 2)
  )
    failures.push("Daily stop-out limit reached or invalid count.");
  const signal = v.signalCloseAt ? Date.parse(v.signalCloseAt) : NaN;
  const zone = v.zoneCreatedAt ? Date.parse(v.zoneCreatedAt) : NaN;
  if (v.signalCloseAt && (!Number.isFinite(signal) || signal > now.getTime()))
    failures.push("H1 confirmation candle must have closed.");
  if (v.zoneCreatedAt && (!Number.isFinite(zone) || zone >= signal))
    failures.push("Zone must exist before the signal closes.");
  if (v.entry && v.stop && v.target) {
    const sign = v.side === "buy" ? 1 : -1;
    const distance = (v.entry - v.stop) * sign;
    if (distance <= 0) failures.push("Stop orientation is invalid.");
    if ((v.target - v.entry) * sign < distance * 2)
      failures.push("Target must provide at least 2R.");
  }
  if (
    [v.open, v.high, v.low, v.close, v.zoneLow, v.zoneHigh].every(
      (x) => x !== undefined,
    )
  ) {
    const {
      open: o,
      high: h,
      low: l,
      close: c,
      zoneLow: zl,
      zoneHigh: zh,
    } = v as Required<GateInput>;
    if (h <= l || h < Math.max(o, c) || l > Math.min(o, c) || zl > zh)
      failures.push("Candle or zone bounds are invalid.");
    if (l > zh || h < zl) failures.push("H1 candle did not touch the zone.");
    if (
      v.side === "buy"
        ? !(c > o && c > zh && c > (h + l) / 2)
        : !(c < o && c < zl && c < (h + l) / 2)
    )
      failures.push("Closed candle does not confirm the direction.");
  }
  // These inputs intentionally do not capture all strategy evidence yet.
  missing.push(
    "confirmed H4 swing evidence",
    "opposing structure room",
    "news acknowledgement timestamp",
    "2-pip stop buffer evidence",
  );
  return {
    state: failures.length ? "ineligible" : "unknown",
    failures,
    missing,
    rulesVersion: "H4H1-v1",
  } as const;
}
export function realisedTrade(
  side: "buy" | "sell",
  entry: number,
  exit: number,
  lots: number,
  costs: number,
  plannedRisk: number,
) {
  if (
    ![entry, exit, lots, plannedRisk].every(
      (v) => Number.isFinite(v) && v > 0,
    ) ||
    !Number.isFinite(costs) ||
    costs < 0
  )
    throw new Error("Invalid trade values");
  const pnl =
    (exit - entry) * (side === "buy" ? 1 : -1) * 100000 * lots - costs;
  return { pnl, r: pnl / plannedRisk };
}
