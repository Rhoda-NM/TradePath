"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { saveWeeklyReview } from "@/app/learning-actions";
import {
  addDays,
  weekStart,
  type ReviewFacts,
  type ReviewData,
} from "@/lib/curriculum/model";
export default function WeeklyReview({
  initial,
  today,
  startDate,
}: {
  initial: ReviewData;
  today: string;
  startDate: string;
}) {
  const [data, setData] = useState(initial),
    [reflection, setReflection] = useState(
      initial.ready ? initial.review?.reflection || "" : "",
    ),
    [commitment, setCommitment] = useState(
      initial.ready ? initial.review?.commitment || "" : "",
    ),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const operation = useRef<{ id: string; submit: boolean } | null>(null);
  if (!data.ready)
    return (
      <section className="panel info-block">
        <h2>Weekly review</h2>
        <p>{data.message}</p>
        <Link className="button secondary" href="/review">
          Current week
        </Link>
      </section>
    );
  const week = data.week,
    previous = addDays(week, -7),
    next = addDays(week, 7);
  async function save(submit: boolean) {
    if (pending || !data.ready) return;
    if (!navigator.onLine) {
      setMessage(
        "Offline: the review has not been saved. Reconnect and retry.",
      );
      return;
    }
    setPending(true);
    setMessage("Saving…");
    if (!operation.current || operation.current.submit !== submit)
      operation.current = { id: crypto.randomUUID(), submit };
    try {
      const response = await saveWeeklyReview({
        week,
        reflection,
        commitment,
        submit,
        revision: data.review?.revision || 0,
        id: operation.current.id,
      });
      if (response.error || !response.review)
        setMessage(response.error || "Save not confirmed.");
      else {
        setData(response.review);
        operation.current = null;
        setMessage(
          submit ? "Review submitted." : "Draft saved to your account.",
        );
      }
    } catch {
      setMessage(
        "Connection interrupted. Keep your reflection and retry the same action.",
      );
    } finally {
      setPending(false);
    }
  }
  const f = data.facts;
  return (
    <section className="panel review-panel">
      <div className="section-heading">
        <div>
          <span className="eyebrow">MONDAY – SUNDAY · AFRICA/NAIROBI</span>
          <h2>
            {week} – {addDays(week, 6)}
          </h2>
        </div>
        <span className="small-tag">
          {data.review?.state === "submitted"
            ? "Submitted"
            : data.review
              ? "Draft"
              : "Not started"}
        </span>
      </div>
      <div className="toolbar">
        {previous >= weekStart(startDate) ? (
          <Link className="text-link dark-link" href={`/review/${previous}`}>
            ← Previous week
          </Link>
        ) : (
          <span />
        )}
        {next <= weekStart(today) && (
          <Link className="text-link dark-link" href={`/review/${next}`}>
            Next week →
          </Link>
        )}
      </div>
      <h3>Current logged facts</h3>
      <div className="review-facts">
        {factEntries(f).map(([label, value]) => (
          <div className="setting-row" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
      <p>
        Weekday sessions due use a Monday–Friday learning schedule through
        today. Missed days are review context, not failed trades. No
        trade-volume target is implied. Account-specific journal results appear
        below.
      </p>
      <JournalFacts facts={f} />
      {data.review?.state === "submitted" && (
        <details>
          <summary>Facts captured at submission</summary>
          <JournalFacts facts={data.review.facts} />
          <div className="review-facts">
            {factEntries(data.review.facts).map(([label, value]) => (
              <div className="setting-row" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
        </details>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save(true);
        }}
      >
        <label>
          Your reflection (at least 80 characters to submit)
          <textarea
            maxLength={6000}
            value={reflection}
            onChange={(e) => setReflection(e.target.value)}
          />
        </label>
        <label>
          One actionable commitment for next week (at least 10 characters)
          <textarea
            maxLength={1000}
            value={commitment}
            onChange={(e) => setCommitment(e.target.value)}
          />
        </label>
        <p role="status">{message}</p>
        <div className="modal-actions">
          {data.review?.state !== "submitted" && (
            <button
              className="button secondary"
              type="button"
              disabled={pending}
              onClick={() => void save(false)}
            >
              Save draft
            </button>
          )}
          <button className="button primary" disabled={pending}>
            {data.review?.state === "submitted"
              ? "Update submitted review"
              : "Submit review"}
          </button>
        </div>
      </form>
    </section>
  );
}

function factEntries(f: ReviewFacts): [string, string | number][] {
  return [
    ["Weekday sessions due", f.weekday_sessions_due ?? "Unavailable"],
    ["Recorded check-ins", f.recorded_sessions ?? "Unavailable"],
    ["Setups inspected", f.setups_inspected ?? "Unavailable"],
    ["No-trade decisions", f.no_trade_decisions ?? "Unavailable"],
    ["Recorded demo rule breaches", f.rule_breaches ?? "Unavailable"],
    ["Closed demo trades", f.closed_demo_trades ?? "Unavailable"],
    [
      "Realised demo R (all demo accounts)",
      f.realised_r == null
        ? "Insufficient data"
        : Number(f.realised_r).toFixed(2),
    ],
    ["Learning records", f.learning_records ?? "Unavailable"],
  ];
}

function JournalFacts({ facts }: { facts: ReviewFacts }) {
  return (
    <div>
      {facts.journal_accounts === undefined ? (
        <p>Journal review facts are awaiting a workspace update.</p>
      ) : facts.journal_accounts.length ? (
        facts.journal_accounts.map((a) => (
          <section className="info-block" key={a.mode + ":" + a.account_ref}>
            <h3>
              {a.mode} · {a.account_ref}
              {a.mode === "backtest" ? " · development + held-out" : ""}
            </h3>
            <p>
              {a.closed} closed · {a.r_sample} with known R · {a.breaches} entry
              breaches
            </p>
            <p>
              Net USD{" "}
              {a.net_usd === null
                ? "Unavailable"
                : Number(a.net_usd).toFixed(2)}{" "}
              · Eligible average R{" "}
              {a.eligible_average_r === null
                ? "Insufficient data"
                : Number(a.eligible_average_r).toFixed(3)}{" "}
              · n={a.eligible_r_sample ?? "Unavailable"}
            </p>
          </section>
        ))
      ) : (
        <p>No journal activity in this week.</p>
      )}
    </div>
  );
}
