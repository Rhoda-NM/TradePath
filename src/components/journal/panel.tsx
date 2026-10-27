"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { freezeDevelopment } from "@/app/journal-actions";
import type { Journal } from "@/lib/journal/model";
import SetupForm from "./setup-form";
import TradeForm from "./trade-form";
import Screenshots from "./screenshots";
export default function JournalPanel({
  journal,
  path,
  from,
  timezone,
}: {
  journal: Journal;
  path: string;
  from?: string;
  timezone: string;
}) {
  const [mode, setMode] = useState("demo"),
    [outcome, setOutcome] = useState("all"),
    [fromDate, setFrom] = useState(""),
    [toDate, setTo] = useState(""),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  const router = useRouter();
  if (!journal.ready)
    return (
      <section className="panel info-block">
        <h2>Setups and trade journal</h2>
        <p>{journal.message}</p>
      </section>
    );
  const format = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", { timeZone: timezone });
  const id = path.split("/")[1],
    setup = journal.setups.find(
      (s) => s.id === (path === "setups/new" ? from : id),
    ),
    trade = journal.trades.find((t) => t.id === id);
  if (path === "setups/new") return <SetupForm previous={setup} />;
  if (path === "journal/new")
    return <TradeForm setup={journal.setups.find((s) => s.id === from)} />;
  if (path.startsWith("setups/")) {
    if (!setup)
      return (
        <section className="panel info-block">
          <h2>Setup not found</h2>
          <Link href="/journal">Return to Journal</Link>
        </section>
      );
    const gate = setup.rule_snapshot.result;
    return (
      <div className="journal-stack">
        <section className="panel info-block">
          <span className="eyebrow">
            {setup.mode} · {setup.direction.toUpperCase()} · EUR/USD · REVISION{" "}
            {setup.revision}
          </span>
          <h2>Gate: {gate.state}</h2>
          <p>
            Saved {format(setup.created_at)} · H4H1-v1. This is experimental
            process validation, not a profitability prediction.
          </p>
          {gate.failures.length > 0 && (
            <>
              <h3>Failed rules</h3>
              <ul>
                {gate.failures.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </>
          )}
          {gate.missing.length > 0 && (
            <>
              <h3>Missing evidence</h3>
              <ul>
                {gate.missing.map((reason) => (
                  <li key={reason}>{reason}</li>
                ))}
              </ul>
            </>
          )}
          <div className="review-facts">
            <div className="setting-row">
              <span>Modeled initial risk (USD)</span>
              <strong>
                {gate.riskUSD === null
                  ? "Unknown"
                  : Number(gate.riskUSD).toFixed(4)}
              </strong>
            </div>
            <div className="setting-row">
              <span>Suggested lots, rounded down</span>
              <strong>{gate.suggestedLots ?? "Unknown"}</strong>
            </div>
            <div className="setting-row">
              <span>Modeled equity risk</span>
              <strong>
                {gate.riskPercent === null
                  ? "Unknown"
                  : Number(gate.riskPercent).toFixed(3) + "%"}
              </strong>
            </div>
            <div className="setting-row">
              <span>EMA50 from closed H4 history</span>
              <strong>
                {gate.ema50 === null
                  ? "Unknown"
                  : Number(gate.ema50).toFixed(6)}
              </strong>
            </div>
          </div>
          <p>{setup.rule_snapshot.input.notes}</p>
          <div className="toolbar">
            <Link
              href={"/journal/new?from=" + setup.id}
              className="button primary"
            >
              Record external execution
            </Link>
            {setup.dataset_split !== "held_out" &&
              !(setup.dataset_split === "development" && journal.frozen) && (
                <Link
                  href={"/setups/new?from=" + setup.id}
                  className="button secondary"
                >
                  Create a new revision
                </Link>
              )}
            <Link href="/journal" className="button secondary">
              Back to journal
            </Link>
          </div>
          {setup.supersedes_id && (
            <Link
              className="text-link dark-link"
              href={"/setups/" + setup.supersedes_id}
            >
              Previous immutable revision →
            </Link>
          )}
        </section>
        <section className="panel info-block">
          <Screenshots
            key={setup.id}
            type="setup"
            parent={setup.id}
            items={journal.screenshots.filter(
              (s) => s.parent_type === "setup" && s.parent_id === setup.id,
            )}
          />
        </section>
      </div>
    );
  }
  if (path.startsWith("journal/") && trade)
    return (
      <div className="journal-stack">
        <section className="panel info-block">
          <span className="eyebrow">
            {trade.mode} · {trade.side.toUpperCase()} · {trade.account_ref}
          </span>
          <h2>{trade.closed_at ? "Closed trade" : "Open trade"}</h2>
          <p>
            {format(trade.opened_at)}{" "}
            {trade.closed_at ? "→ " + format(trade.closed_at) : ""}
          </p>
          <p>
            Compliance:{" "}
            {trade.rule_compliant === true
              ? "Recorded precheck followed"
              : trade.rule_compliant === false
                ? "Rule breach retained"
                : "Insufficient evidence"}
          </p>
          {trade.breach_reasons.length > 0 && (
            <ul>
              {trade.breach_reasons.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          )}
          <p>
            Initial planned risk:{" "}
            {trade.planned_risk_usd === null
              ? "Unknown"
              : "USD " + Number(trade.planned_risk_usd).toFixed(4)}{" "}
            · Net realized result:{" "}
            {trade.realised_pnl_usd === null
              ? "Open"
              : "USD " + Number(trade.realised_pnl_usd).toFixed(4)}{" "}
            · R:{" "}
            {trade.realised_r === null
              ? "Unavailable"
              : Number(trade.realised_r).toFixed(3)}
          </p>
          {trade.setup_id && (
            <Link
              href={"/setups/" + trade.setup_id}
              className="text-link dark-link"
            >
              View immutable gate →
            </Link>
          )}
          <Screenshots
            key={trade.id}
            type="trade"
            parent={trade.id}
            items={journal.screenshots.filter(
              (s) => s.parent_type === "trade" && s.parent_id === trade.id,
            )}
          />
        </section>
        <TradeForm key={`${trade.id}:${trade.revision}`} trade={trade} />
        <Link href="/journal" className="button secondary">
          Back to journal
        </Link>
      </div>
    );
  const superseded = new Set(journal.setups.map((s) => s.supersedes_id));
  const filtered = journal.trades.filter(
    (t) =>
      t.mode === mode &&
      (!fromDate || localDay(t.opened_at, timezone) >= fromDate) &&
      (!toDate || localDay(t.opened_at, timezone) <= toDate) &&
      (outcome === "all" ||
        (outcome === "open" && !t.closed_at) ||
        (outcome === "breaches" && t.rule_compliant === false) ||
        (outcome === "wins" && Number(t.realised_pnl_usd) > 0) ||
        (outcome === "losses" &&
          t.realised_pnl_usd !== null &&
          Number(t.realised_pnl_usd) < 0)),
  );
  return (
    <div className="journal-stack">
      <div className="toolbar">
        <Link className="button primary" href="/setups/new">
          Evaluate a setup
        </Link>
        <Link className="button secondary" href="/journal/new">
          Log an external execution
        </Link>
        <a
          className="button secondary"
          href={`/api/export?format=csv&mode=${mode}`}
        >
          Export {mode} trades (CSV)
        </a>
      </div>
      <section className="panel info-block">
        <h2>Trade journal</h2>
        <p>
          Modes are separate. Open trades have no realized result. Breaches
          remain visible even when P/L is positive.
        </p>
        <div className="form-grid">
          <label>
            Mode
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="demo">Forward demo</option>
              <option value="backtest">Backtest</option>
              <option value="free_trial">Free trial</option>
            </select>
          </label>
          <label>
            Outcome
            <select
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
            >
              <option value="all">All outcomes</option>
              <option value="open">Open</option>
              <option value="wins">Wins</option>
              <option value="losses">Losses</option>
              <option value="breaches">Rule breaches</option>
            </select>
          </label>
          <label>
            From local date
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label>
            Through local date
            <input
              type="date"
              value={toDate}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
        </div>
        {filtered.length ? (
          filtered.map((t) => (
            <Link
              key={t.id}
              href={"/journal/" + t.id}
              className="journal-trade-row"
            >
              <div>
                <strong>
                  {t.side.toUpperCase()} EUR/USD · {t.account_ref}
                </strong>
                <p>
                  {format(t.opened_at)} · {t.closed_at ? "Closed" : "Open"} ·{" "}
                  {t.rule_compliant === false
                    ? "Rule breach"
                    : t.rule_compliant === null
                      ? "Unassessed"
                      : "Prechecked"}
                </p>
              </div>
              <span>
                {t.realised_pnl_usd === null
                  ? "Open"
                  : `USD ${Number(t.realised_pnl_usd).toFixed(2)}`}
                <small>
                  {t.realised_r === null
                    ? "R unavailable"
                    : Number(t.realised_r).toFixed(2) + "R"}
                </small>
              </span>
            </Link>
          ))
        ) : (
          <p>No {mode} executions match this view.</p>
        )}
      </section>
      <section className="panel info-block">
        <h2>Setup evidence</h2>
        {journal.setups
          .filter((s) => s.mode === mode && !superseded.has(s.id))
          .map((s) => (
            <Link
              className="journal-trade-row"
              href={"/setups/" + s.id}
              key={s.id}
            >
              <div>
                <strong>
                  {s.direction.toUpperCase()} EUR/USD · {s.eligibility}
                </strong>
                <p>
                  {format(s.created_at)} · Revision {s.revision}
                  {s.sequence_no
                    ? ` · ${s.dataset_split} candidate ${s.sequence_no}`
                    : ""}
                </p>
              </div>
              <span>Open →</span>
            </Link>
          ))}
        <p>
          Incomplete candidates remain unknown. Earlier revisions remain
          accessible from each setup.
        </p>
      </section>
      <section className="panel info-block">
        <h2>Historical evidence freeze</h2>
        <p>
          {journal.developmentCount} fully documented development candidates ·{" "}
          {journal.heldOutCount} held-out candidates. Freeze after 70
          development candidates, then inspect 30 untouched signals later than
          the development cutoff.
        </p>
        {journal.frozen ? (
          <span className="small-tag">
            Rules frozen · Development edits locked
          </span>
        ) : (
          <button
            className="button secondary"
            disabled={pending || journal.developmentCount < 70}
            onClick={async () => {
              setPending(true);
              try {
                const r = await freezeDevelopment();
                if (r.error) setMessage(r.error);
                else router.refresh();
              } catch {
                setMessage("Freeze was not confirmed. Reload to check.");
              } finally {
                setPending(false);
              }
            }}
          >
            Freeze development rules
          </button>
        )}
        <p role="status">{message}</p>
      </section>
    </div>
  );
}
function localDay(value: string, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}
