"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Journal } from "@/lib/journal/model";
import {
  type Equity,
  type InsightsData,
  tradeMetrics,
  processMetrics,
  equityMetrics,
  disciplineScore,
  readiness,
} from "@/lib/insights/model";
import { utcInput, utcValue } from "@/lib/journal/input";
import { saveEquity } from "@/app/insights-actions";
const number = (n: number | null, d = 2) =>
  n === null ? "Insufficient data" : Number(n).toFixed(d);
const percent = (n: number | null) =>
  n === null ? "Insufficient data" : (n * 100).toFixed(1) + "%";
export default function Insights({
  journal,
  data,
  funding = false,
}: {
  journal: Journal;
  data: InsightsData;
  funding?: boolean;
}) {
  const [mode, setMode] = useState("demo"),
    [account, setAccount] = useState(""),
    [from, setFrom] = useState(""),
    [to, setTo] = useState(""),
    [dataset, setDataset] = useState("all");
  if (!journal.ready || !data.ready)
    return (
      <section className="panel info-block">
        <h2>Insights</h2>
        <p>
          {!journal.ready ? journal.message : !data.ready ? data.message : ""}
        </p>
      </section>
    );
  const accounts = Array.from(
    new Set([
      ...journal.trades
        .filter((t) => t.mode === mode)
        .map((t) => t.account_ref),
      ...data.equity
        .filter((e) => e.account_mode === mode)
        .map((e) => e.account_ref),
    ]),
  ).sort();
  const selected = accounts.includes(account)
    ? account
    : accounts[0] || "demo-main";
  const m = tradeMetrics(
      journal.trades,
      journal.setups,
      mode,
      selected,
      from,
      to,
      dataset,
    ),
    p = processMetrics(data.process, from, to),
    e = equityMetrics(data.equity, journal.trades, mode, selected, from, to);
  const full = tradeMetrics(journal.trades, journal.setups, "demo", selected),
    fullEquity = equityMetrics(data.equity, journal.trades, "demo", selected);
  const gates = readiness(
    full,
    fullEquity,
    journal.developmentCount,
    journal.heldOutCount,
    journal.frozen,
  );
  return (
    <div className="journal-stack">
      <section className="panel info-block">
        <span className="eyebrow">EVIDENCE BEFORE CONFIDENCE</span>
        <h2>{funding ? "Readiness evidence" : "Your practice in numbers"}</h2>
        <div className="insight-filters">
          {!funding && (
            <label>
              Mode
              <select
                value={mode}
                onChange={(ev) => {
                  setMode(ev.target.value);
                  setAccount("");
                }}
              >
                <option value="demo">Demo</option>
                <option value="backtest">Backtest</option>
                <option value="free_trial">Free trial</option>
              </select>
            </label>
          )}
          <label>
            Account
            <select
              value={selected}
              onChange={(ev) => setAccount(ev.target.value)}
            >
              {accounts.length ? (
                accounts.map((a) => <option key={a}>{a}</option>)
              ) : (
                <option value="demo-main">No recorded account</option>
              )}
            </select>
          </label>
          {!funding && (
            <>
              <label>
                From (EAT)
                <input
                  type="date"
                  value={from}
                  max={to || data.process.today}
                  onChange={(ev) => setFrom(ev.target.value)}
                />
              </label>
              <label>
                Through (EAT)
                <input
                  type="date"
                  value={to}
                  min={from}
                  max={data.process.today}
                  onChange={(ev) => setTo(ev.target.value)}
                />
              </label>
            </>
          )}
          {!funding && mode === "backtest" && (
            <label>
              Historical dataset
              <select
                value={dataset}
                onChange={(ev) => setDataset(ev.target.value)}
              >
                <option value="all">All historical (combined)</option>
                <option value="development">Development only</option>
                <option value="held_out">Held-out only</option>
              </select>
            </label>
          )}
        </div>
        <p>
          Account and mode are never pooled. Results use closing dates; entry
          and mistake counts use opening dates. Dates use Africa/Nairobi.
        </p>
        {!funding && from && to && from > to && (
          <p role="alert">The end date must be on or after the start date.</p>
        )}
      </section>
      {!funding && (
        <>
          <section className="panel info-block">
            <h2>
              Performance · {mode} · {selected}
            </h2>
            <div className="review-facts">
              <Fact
                label="Closed / open executions"
                value={`${m.closed} / ${m.open}`}
              />
              <Fact
                label="Net realised P/L (all outcomes)"
                value={m.net === null ? "Unavailable" : `USD ${number(m.net)}`}
              />
              <Fact
                label="After-cost average R · eligible setups"
                value={`${number(m.averageR, 3)} · n=${m.rSample}`}
              />
              <Fact
                label="Average R · all known-risk outcomes"
                value={`${number(m.allAverageR, 3)} · n=${m.allRSample}`}
              />
              <Fact
                label="Closed trades without initial risk"
                value={m.missingR}
              />
              <Fact
                label="Win rate (all closed, including breakeven)"
                value={percent(m.winRate)}
              />
              <Fact
                label="Profit factor (all net outcomes)"
                value={
                  m.profitFactor === null
                    ? "N/A · no losing trades"
                    : number(m.profitFactor)
                }
              />
            </div>
            <p>
              Small samples do not establish profitability. Eligible averages
              exclude {m.closed - m.rSample} closed records without an eligible
              setup or known R. Losses remain in all-outcome results.
            </p>
            <Link href="/journal" className="text-link dark-link">
              Inspect every result →
            </Link>
          </section>
          <section className="panel info-block">
            <h2>Discipline</h2>
            {mode !== "backtest" && (
              <Fact
                label="Executions journaled within 24 hours of opening"
                value={`${m.timely}/${m.timingSample} timestamped entries (application timing policy)`}
              />
            )}

            <Fact
              label="Weighted score (40 / 30 / 15 / 15)"
              value={number(disciplineScore(m, p.reviews), 1)}
            />
            <Fact
              label={`Eligible executed trade adherence · assessed ${m.adherenceAssessed}/${m.eligible}`}
              value={percent(m.adherence)}
            />
            <Fact
              label={`Risk and daily-limit compliance · assessed ${m.riskAssessed}/${m.entries}`}
              value={percent(m.risk)}
            />
            <Fact
              label={`Journal completeness · ${m.complete}/${m.closed}`}
              value={percent(m.completeness)}
            />
            <Fact
              label={`Scheduled reviews · ${p.reviewsSubmitted}/${p.reviewsDue}`}
              value={percent(p.reviews)}
            />
            <p>
              {m.unassessed} closed executions have unassessed adherence.{" "}
              {m.riskUnknown} entries lack a conclusive risk assessment.{" "}
              {m.breaches} closed executions have recorded breaches. A
              measurable score describes assessed evidence, not missing records.
            </p>
            <details>
              <summary>How the score is calculated</summary>
              <p>
                40% eligible-trade adherence, 30% conclusive risk/day-limit
                compliance, 15% complete closed journals, 15% submitted reviews
                due. Every denominator must exist. A complete journal has an
                initial stop, target, initial risk, adherence assessment and
                notes. A risk pass requires a fully compliant execution;
                explicit risk breaches fail, other ambiguous entries are
                excluded. Reviews are due after Sunday ends and are
                workspace-wide.
              </p>
            </details>
          </section>
          <section className="panel info-block">
            <h2>Daily process · whole workspace</h2>
            <Fact label="Weekdays scheduled" value={p.sessionsDue} />
            <Fact
              label="Recorded days / fully completed task sets"
              value={`${p.sessions} / ${p.complete}`}
            />
            <Fact label="No-trade decisions" value={p.noTrades} />
            <p>
              No-trade decisions count as process evidence and never as winning
              trades.
            </p>
            <Link href="/review" className="text-link dark-link">
              Write your weekly review →
            </Link>
          </section>
          <section className="panel info-block">
            <h2>Recorded mistakes · entries in this period</h2>
            {Object.entries(m.mistakes).length ? (
              Object.entries(m.mistakes)
                .sort((a, b) => b[1] - a[1])
                .map(([reason, count]) => (
                  <Fact key={reason} label={reason} value={count} />
                ))
            ) : (
              <p>
                No breach reasons recorded in this selection. This is not proof
                of perfect adherence.
              </p>
            )}
          </section>
          {mode !== "backtest" && (
            <section className="panel info-block">
              <h2>Equity and drawdown</h2>
              <Fact
                label="Observed cash-flow-adjusted maximum drawdown"
                value={
                  e.drawdown === null ? "Unavailable" : number(e.drawdown) + "%"
                }
              />
              <p>
                {e.days} recorded daily dates ·{" "}
                {e.gaps
                  ? "Gaps in equity history"
                  : "No gaps between recorded dates"}{" "}
                ·{" "}
                {e.covers
                  ? "Covers recorded execution period"
                  : "Starting or final equity coverage missing"}{" "}
                ·{" "}
                {e.cashflowsKnown
                  ? "Cash-flow context recorded"
                  : "Cash-flow context incomplete"}
              </p>
              <EquityChart points={e.points} valid={e.cashflowsKnown} />
              <p>
                The curve starts at index 100. Each return removes net
                deposits/withdrawals from the interval’s ending equity. Cash
                flows must be logged at interval end, or bracketed by snapshots
                immediately before and after the transfer. This is observed
                equity drawdown, not an intraday maximum; balance is also
                retained. Missing snapshots cannot prove losses stayed below a
                threshold.
              </p>
              <EquityForm
                key={`${mode}:${selected}`}
                mode={mode as "demo" | "free_trial"}
                account={selected}
              />
              <details>
                <summary>
                  Equity records and corrections (
                  {
                    data.equity.filter(
                      (r) =>
                        r.account_mode === mode && r.account_ref === selected,
                    ).length
                  }
                  )
                </summary>
                {data.equity
                  .filter(
                    (r) =>
                      r.account_mode === mode && r.account_ref === selected,
                  )
                  .sort((a, b) => b.at.localeCompare(a.at))
                  .map((row) => (
                    <details key={row.id}>
                      <summary>
                        {row.at} · Equity USD {number(row.equity_usd)} ·
                        revision {row.revision}
                      </summary>
                      <EquityForm
                        key={`${row.id}:${row.revision}`}
                        mode={mode as "demo" | "free_trial"}
                        account={selected}
                        existing={row}
                      />
                    </details>
                  ))}
              </details>
            </section>
          )}
        </>
      )}
      {(funding || mode === "demo") && (
        <section className="panel info-block">
          <h2>Readiness · all-time demo account {selected}</h2>
          <p>
            These indicators summarize recorded evidence. Overall readiness
            remains incomplete; they never unlock orders or recommend buying a
            challenge. Date filters do not change this panel.
          </p>
          {gates.map((g) => (
            <div className="readiness-row" key={g.label}>
              <div>
                <strong>{g.label}</strong>
                <p>{g.detail}</p>
              </div>
              <span className="small-tag">{g.state}</span>
            </div>
          ))}
          <p>
            The 30-day equity minimum and 50 assessed-trade minimum are
            conservative application evidence policies. Manual records are not
            independent verification.
          </p>
        </section>
      )}
    </div>
  );
}
function Fact({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="setting-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function EquityChart({
  points,
  valid,
}: {
  points: { at: string; value: number; equity: number; balance: number }[];
  valid: boolean;
}) {
  if (!valid || points.length < 2)
    return (
      <p>
        Curve unavailable until at least two snapshots and their cash-flow
        context are recorded.
      </p>
    );
  const min = Math.min(...points.map((p) => p.value)),
    max = Math.max(...points.map((p) => p.value));
  const path = points
    .map(
      (p, i) =>
        `${i ? "L" : "M"} ${20 + ((Date.parse(p.at) - Date.parse(points[0].at)) / (Date.parse(points.at(-1)!.at) - Date.parse(points[0].at) || 1)) * 760} ${180 - ((p.value - min) / (max - min || 1)) * 150}`,
    )
    .join(" ");
  return (
    <>
      <svg
        className="equity-chart"
        viewBox="0 0 800 210"
        role="img"
        aria-label={`Cash-flow-adjusted equity index, ${points.length} snapshots, from ${points[0].at} to ${points.at(-1)!.at}`}
      >
        <path d={path} fill="none" stroke="currentColor" strokeWidth="3" />
        <text x="20" y="205">
          {points[0].at.slice(0, 10)}
        </text>
        <text x="780" y="205" textAnchor="end">
          {points.at(-1)!.at.slice(0, 10)}
        </text>
      </svg>
      <details>
        <summary>Curve values (accessible table)</summary>
        <div className="equity-table">
          <table>
            <thead>
              <tr>
                <th>UTC time</th>
                <th>Index</th>
                <th>Equity USD</th>
                <th>Balance USD</th>
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.at}>
                  <td>{p.at}</td>
                  <td>{number(p.value)}</td>
                  <td>{number(p.equity)}</td>
                  <td>{number(p.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </>
  );
}
function EquityForm({
  mode,
  account,
  existing,
}: {
  mode: "demo" | "free_trial";
  account: string;
  existing?: Equity;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const operation = useRef<{ input: string; id: string } | null>(null);
  async function submit(form: HTMLFormElement) {
    if (pending) return;
    const f = new FormData(form);
    const input = {
      id: existing?.id || null,
      revision: existing?.revision || 0,
      mode,
      account: String(f.get("account")),
      at: utcValue(String(f.get("at"))),
      balance: Number(f.get("balance")),
      equity: Number(f.get("equity")),
      deposits: Number(f.get("deposits")),
      withdrawals: Number(f.get("withdrawals")),
      confirmed: f.get("confirmed") === "on",
      notes: String(f.get("notes")),
    };
    const text = JSON.stringify(input);
    if (operation.current?.input !== text)
      operation.current = { input: text, id: crypto.randomUUID() };
    setPending(true);
    setMessage("Saving…");
    try {
      const result = await saveEquity({
        ...input,
        operation: operation.current.id,
      });
      if (result.error) setMessage(result.error);
      else {
        setMessage("Equity snapshot saved.");
        operation.current = null;
        router.refresh();
      }
    } catch {
      setMessage("Save was not confirmed. Keep the form and retry.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form
      className="equity-form"
      onSubmit={(ev) => {
        ev.preventDefault();
        void submit(ev.currentTarget);
      }}
    >
      <h3>{existing ? "Correct this snapshot" : "Record equity snapshot"}</h3>
      <p>
        Use USD values from the same demo or free-trial account. Include
        floating P/L in equity. Deposits and withdrawals cover the interval
        since the previous snapshot; the initial snapshot uses zero flows.
      </p>
      <div className="insight-filters">
        <label>
          Account label
          <input
            name="account"
            required
            maxLength={80}
            defaultValue={account}
            readOnly={!!existing}
          />
        </label>
        <label>
          Observed at (UTC)
          <input
            name="at"
            type="datetime-local"
            step="1"
            required
            defaultValue={utcInput(existing?.at || null)}
            readOnly={!!existing}
          />
        </label>
        {(["balance", "equity", "deposits", "withdrawals"] as const).map(
          (key) => (
            <label key={key}>
              {key[0].toUpperCase() + key.slice(1)} (USD)
              <input
                name={key}
                type="number"
                step="0.0001"
                max="1000000000"
                min={
                  key === "deposits" || key === "withdrawals" ? 0 : -1000000000
                }
                required
                defaultValue={
                  existing
                    ? existing[`${key}_usd`]
                    : key === "deposits" || key === "withdrawals"
                      ? 0
                      : undefined
                }
              />
            </label>
          ),
        )}
      </div>
      <label className="equity-confirm">
        <input
          name="confirmed"
          type="checkbox"
          defaultChecked={existing?.cashflows_confirmed}
        />{" "}
        I have accounted for all cash flows in this interval.
      </label>
      <label>
        Source and notes
        <textarea
          name="notes"
          maxLength={2000}
          defaultValue={existing?.notes}
        />
      </label>
      <p role="status">{message}</p>
      <button className="button primary" disabled={pending}>
        {pending
          ? "Saving…"
          : existing
            ? "Save audited correction"
            : "Save snapshot"}
      </button>
    </form>
  );
}
