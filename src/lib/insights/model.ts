import { z } from "zod";
import type { SetupRow, TradeRow } from "@/lib/journal/model";
import { localDate } from "@/lib/trading";
export const equitySchema = z
  .object({
    operation: z.uuid(),
    id: z.uuid().nullable(),
    revision: z.number().int().nonnegative(),
    mode: z.enum(["demo", "free_trial"]),
    account: z.string().trim().min(1).max(80),
    at: z.iso.datetime({ offset: true }),
    balance: z.number().min(-1e9).max(1e9),
    equity: z.number().min(-1e9).max(1e9),
    deposits: z.number().min(0).max(1e9),
    withdrawals: z.number().min(0).max(1e9),
    confirmed: z.boolean(),
    notes: z.string().max(2000),
  })
  .strict();
export type Equity = {
  id: string;
  account_mode: string;
  account_ref: string;
  at: string;
  balance_usd: number;
  equity_usd: number;
  deposits_usd: number;
  withdrawals_usd: number;
  cashflows_confirmed: boolean;
  notes: string;
  revision: number;
};
export type ProcessFacts = {
  start: string;
  today: string;
  reviews: { week_start_local_date: string; state: string }[];
  sessions: { id: string; local_date: string; session_status: string }[];
  tasks: { session_id: string; state: string }[];
  noTrades: { created_at: string }[];
};
export type InsightsData =
  | { ready: true; equity: Equity[]; process: ProcessFacts }
  | { ready: false; message: string };
// Monetary results are persisted to four decimals and R to six. Sum scaled
// values so binary cancellation cannot turn a zero expectancy into a pass.
const sum = (a: number[], precision = 6) => {
  const factor = 10 ** precision;
  return (
    Number(
      a.reduce(
        (total, value) => total + BigInt(Math.round(value * factor)),
        0n,
      ),
    ) / factor
  );
};
const mean = (a: number[]) => (a.length ? sum(a) / a.length : null);
export const ratio = (n: number, d: number) => (d ? n / d : null);
export function day(iso: string) {
  return localDate(new Date(iso), "Africa/Nairobi");
}
function inRange(iso: string, from: string, to: string) {
  const d = day(iso);
  return (!from || d >= from) && (!to || d <= to);
}
export function processMetrics(p: ProcessFacts, from: string, to: string) {
  const start = from && from > p.start ? from : p.start,
    end = to && to < p.today ? to : p.today;
  let due = 0,
    sessionsDue = 0;
  const weeks: string[] = [];
  for (
    let time = Date.parse(start + "T12:00:00Z");
    time <= Date.parse(end + "T12:00:00Z");
    time += 86400000
  ) {
    const d = new Date(time);
    if (d.getUTCDay() > 0 && d.getUTCDay() < 6) sessionsDue++;
    if (d.getUTCDay() === 0 && d.toISOString().slice(0, 10) < p.today) {
      due++;
      weeks.push(new Date(time - 6 * 86400000).toISOString().slice(0, 10));
    }
  }
  const submitted = p.reviews.filter(
    (r) => r.state === "submitted" && weeks.includes(r.week_start_local_date),
  ).length;
  const sessions = p.sessions.filter(
    (s) => s.local_date >= start && s.local_date <= end,
  );
  const complete = sessions.filter((s) => {
    const tasks = p.tasks.filter((t) => t.session_id === s.id);
    return (
      tasks.length > 0 &&
      tasks.every((t) => t.state === "done" || t.state === "skipped")
    );
  }).length;
  return {
    reviewsDue: due,
    reviewsSubmitted: submitted,
    reviews: ratio(submitted, due),
    sessionsDue,
    sessions: sessions.length,
    complete,
    noTrades: p.noTrades.filter((n) => inRange(n.created_at, start, end))
      .length,
  };
}
export function tradeMetrics(
  trades: TradeRow[],
  setups: SetupRow[],
  mode: string,
  account: string,
  from = "",
  to = "",
  dataset = "all",
) {
  const byId = new Map(setups.map((s) => [s.id, s]));
  const selected = trades.filter(
    (t) =>
      t.mode === mode &&
      t.account_ref === account &&
      (mode !== "backtest" ||
        dataset === "all" ||
        byId.get(t.setup_id || "")?.dataset_split === dataset),
  );
  const entries = selected.filter((t) => inRange(t.opened_at, from, to));
  const closed = selected.filter(
    (t) => t.closed_at && inRange(t.closed_at, from, to),
  );
  const eligible = closed.filter(
    (t) => byId.get(t.setup_id || "")?.eligibility === "eligible",
  );
  const assessed = closed.filter((t) => t.rule_compliant !== null);
  const eligibleAssessed = eligible.filter((t) => t.rule_compliant !== null);
  const pnl = closed.map((t) => Number(t.realised_pnl_usd));
  const losses = -sum(pnl.filter((v) => v < 0)),
    gains = sum(pnl.filter((v) => v > 0));
  const r = eligible
    .filter((t) => t.realised_r !== null)
    .map((t) => Number(t.realised_r));
  const allR = closed
    .filter((t) => t.realised_r !== null)
    .map((t) => Number(t.realised_r));
  // H4H1-v1 reasons are immutable. A clean complete gate plus unchanged execution
  // proves these rules; incomplete evidence stays unassessed, never inferred good.
  const riskFailure = (t: TradeRow) =>
    t.breach_reasons.some((reason) =>
      /risk|lot|daily entry|full.loss|full planned losses|protective stop/i.test(
        reason,
      ),
    );
  const riskAssessed = entries.filter(
    (t) => t.rule_compliant === true || riskFailure(t),
  );
  const riskGood = riskAssessed.filter((t) => t.rule_compliant === true).length;
  const complete = closed.filter(
    (t) =>
      t.stop !== null &&
      t.target !== null &&
      t.planned_risk_usd !== null &&
      t.rule_compliant !== null &&
      !!t.notes?.trim(),
  ).length;
  const mistakes: Record<string, number> = {};
  for (const t of entries)
    for (const reason of new Set(t.breach_reasons))
      mistakes[reason] = (mistakes[reason] || 0) + 1;
  return {
    timely: entries.filter(
      (t) =>
        t.created_at &&
        Date.parse(t.created_at) >= Date.parse(t.opened_at) &&
        Date.parse(t.created_at) - Date.parse(t.opened_at) <= 86400000,
    ).length,
    timingSample: entries.filter((t) => t.created_at).length,
    entries: entries.length,
    open: selected.filter((t) => !t.closed_at && inRange(t.opened_at, from, to))
      .length,
    closed: closed.length,
    net: closed.length ? sum(pnl) : null,
    winRate: ratio(pnl.filter((v) => v > 0).length, closed.length),
    profitFactor: losses > 0 ? gains / losses : null,
    averageR: mean(r),
    rSample: r.length,
    allAverageR: mean(allR),
    allRSample: allR.length,
    missingR: closed.length - allR.length,
    eligible: eligible.length,
    adherence: ratio(
      eligibleAssessed.filter((t) => t.rule_compliant === true).length,
      eligibleAssessed.length,
    ),
    adherenceAssessed: eligibleAssessed.length,
    unassessed: closed.length - assessed.length,
    breaches: assessed.filter((t) => t.rule_compliant === false).length,
    risk: ratio(riskGood, riskAssessed.length),
    riskAssessed: riskAssessed.length,
    riskUnknown: entries.length - riskAssessed.length,
    completeness: ratio(complete, closed.length),
    complete,
    mistakes,
  };
}
export function disciplineScore(
  m: ReturnType<typeof tradeMetrics>,
  review: number | null,
) {
  return m.adherence === null ||
    m.risk === null ||
    m.completeness === null ||
    review === null
    ? null
    : 100 *
        (0.4 * m.adherence +
          0.3 * m.risk +
          0.15 * m.completeness +
          0.15 * review);
}
export function equityMetrics(
  rows: Equity[],
  trades: TradeRow[],
  mode: string,
  account: string,
  from = "",
  to = "",
) {
  const all = rows
    .filter((s) => s.account_mode === mode && s.account_ref === account)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  const selected = all.filter((s) => inRange(s.at, from, to));
  const points: {
    at: string;
    value: number;
    equity: number;
    balance: number;
  }[] = [];
  let value = 100,
    peak = 100,
    max = 0,
    valid = true;
  for (let i = 0; i < all.length; i++) {
    if (to && day(all[i].at) > to) break;
    const s = all[i],
      prev = all[i - 1];
    if (!s.cashflows_confirmed) valid = false;
    if (!prev) {
      if (
        Number(s.equity_usd) <= 0 ||
        Number(s.deposits_usd) !== 0 ||
        Number(s.withdrawals_usd) !== 0
      )
        valid = false;
    } else if (Number(prev.equity_usd) <= 0) valid = false;
    else
      value *=
        (Number(s.equity_usd) -
          Number(s.deposits_usd) +
          Number(s.withdrawals_usd)) /
        Number(prev.equity_usd);
    if (!Number.isFinite(value)) valid = false;
    if (inRange(s.at, from, to)) {
      if (points.length === 0) peak = value;
      peak = Math.max(peak, value);
      if (peak > 0) max = Math.max(max, ((peak - value) / peak) * 100);
      points.push({
        at: s.at,
        value,
        equity: Number(s.equity_usd),
        balance: Number(s.balance_usd),
      });
    }
  }
  const accountTrades = trades.filter(
    (t) => t.mode === mode && t.account_ref === account,
  );
  const firstTrade = accountTrades.map((t) => t.opened_at).sort()[0];
  const lastClose = accountTrades
    .map((t) => t.closed_at || t.opened_at)
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .at(-1);
  const covers = !!(
    firstTrade &&
    lastClose &&
    all[0] &&
    all.at(-1) &&
    Date.parse(all[0].at) <= Date.parse(firstTrade) &&
    Date.parse(all.at(-1)!.at) >= Date.parse(lastClose)
  );
  const dates = new Set(all.map((s) => day(s.at)));
  let gap = false;
  if (all.length)
    for (
      let t = Date.parse(day(all[0].at) + "T12:00:00Z");
      t <= Date.parse(day(all.at(-1)!.at) + "T12:00:00Z");
      t += 86400000
    ) {
      if (!dates.has(new Date(t).toISOString().slice(0, 10))) gap = true;
    }
  return {
    points,
    drawdown: valid && selected.length >= 2 ? max : null,
    adequate:
      valid &&
      covers &&
      !gap &&
      dates.size >= 30 &&
      !accountTrades.some((t) => !t.closed_at),
    cashflowsKnown: valid,
    covers,
    gaps: gap,
    days: dates.size,
  };
}
export function readiness(
  m: ReturnType<typeof tradeMetrics>,
  e: ReturnType<typeof equityMetrics>,
  development: number,
  held: number,
  frozen: boolean,
) {
  return [
    {
      label: "Historical development and held-out evidence",
      state:
        development >= 70 && held >= 30 && frozen ? "Met" : "Needs evidence",
      detail: `${development}/70 development · ${held}/30 held-out · ${frozen ? "frozen" : "not frozen"}`,
    },
    {
      label: "Forward demo sample",
      state: m.closed >= 50 ? "Met" : "Needs evidence",
      detail: `${m.closed}/50 closed demo executions in this account`,
    },
    {
      label: "Positive after-cost average R",
      state:
        m.rSample < 50
          ? "Insufficient data"
          : m.averageR !== null && m.averageR > 0
            ? "Met"
            : "Not met",
      detail: `${m.rSample} eligible closed executions with known R; at least 50 required`,
    },
    {
      label: "Documented adherence ≥90%",
      state:
        m.adherenceAssessed < 50 || m.unassessed > 0
          ? "Insufficient data"
          : m.adherence !== null && m.adherence >= 0.9
            ? "Met"
            : "Not met",
      detail: `${m.adherenceAssessed} assessed eligible executions; ${m.unassessed} unassessed closed trades; ${m.breaches} recorded breaches`,
    },
    {
      label: "Observed equity drawdown <5%",
      state:
        !e.adequate || e.drawdown === null
          ? "Insufficient data"
          : e.drawdown < 5
            ? "Met"
            : "Not met",
      detail:
        "Requires 30 daily equity dates, no gaps, confirmed cash flows, coverage from before first entry through last close and no open trades.",
    },
    {
      label: "Two free evaluations without violations",
      state: "Not verified",
      detail:
        "External evaluation verification belongs to the later simulator release.",
    },
    {
      label: "Affordability and current eligibility / payout terms",
      state: "Not verified",
      detail:
        "Requires independent, current confirmation. No paid challenge is recommended by this screen.",
    },
  ];
}
