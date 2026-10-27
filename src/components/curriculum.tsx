"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { saveLearningEvidence } from "@/app/learning-actions";
import {
  additionalGates,
  phaseNames,
  type Learning,
  type Lesson,
} from "@/lib/curriculum/model";
import { sizePosition, type RiskInput } from "@/lib/trading";
export default function Curriculum({
  learning,
  onSaved,
  phase,
  today,
  startDate,
}: {
  learning: Learning;
  onSaved: (data: Learning) => void;
  phase?: number;
  today: string;
  startDate: string;
}) {
  const [selected, setSelected] = useState<Lesson | null>(null);
  if (!learning.ready)
    return (
      <section className="panel info-block">
        <h2>Your learning plan</h2>
        <p>{learning.message}</p>
      </section>
    );
  const shown = phase
    ? learning.phases.filter((p) => p.phase_number === phase)
    : learning.phases;
  return (
    <div className="curriculum">
      <div className="toolbar">
        <p className="muted">
          Milestones count documented learning evidence. They do not establish
          profitability.
        </p>
        <Link className="button secondary" href="/review">
          Weekly review →
        </Link>
      </div>
      {learning.journalEvidence && (
        <section className="panel info-block">
          <h2>Journal evidence milestones</h2>
          <p>
            {learning.journalEvidence.development} / 70 development candidates ·{" "}
            {learning.journalEvidence.held_out} / 30 held-out candidates ·{" "}
            {learning.journalEvidence.frozen
              ? "Rules frozen"
              : "Rules not frozen"}
          </p>
          <p>
            Closed results: {learning.journalEvidence.development_results}{" "}
            development · {learning.journalEvidence.held_out_results} held-out.
            Forward demo accounts remain separate:
          </p>
          {learning.journalEvidence.forward_accounts.length ? (
            learning.journalEvidence.forward_accounts.map((a) => (
              <p key={a.account_ref}>
                {a.account_ref}: {a.closed_trades} closed records,{" "}
                {a.prechecked_trades} prechecked.
              </p>
            ))
          ) : (
            <p>No closed forward demo records yet.</p>
          )}
          <Link className="text-link dark-link" href="/journal">
            Open trade journal →
          </Link>
        </section>
      )}
      {phase && (
        <Link href="/plan" className="text-link dark-link">
          ← All phases
        </Link>
      )}
      {shown.map((p) => {
        const phaseLessons = learning.lessons.filter(
          (l) => l.phase_number === p.phase_number,
        );
        return (
          <section className="panel learning-phase" key={p.phase_number}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  PHASE {p.phase_number} · {p.planned_start} – {p.planned_end}
                </span>
                <h2>{phaseNames[p.phase_number - 1]}</h2>
              </div>
              <span className="small-tag">
                {p.state === "completed"
                  ? "Evidence recorded"
                  : p.state === "needs_practice"
                    ? "Needs more practice"
                    : p.state === "active"
                      ? "In progress"
                      : "Evidence gated"}
              </span>
            </div>
            {!phase && (
              <Link
                href={`/plan/${p.phase_number}`}
                className="text-link dark-link"
              >
                Open phase lessons →
              </Link>
            )}
            <div className="lesson-grid">
              {phaseLessons.map((l) => {
                const count = learning.evidence.filter(
                  (e) => e.lesson_code === l.code,
                ).length;
                return (
                  <article className="lesson" key={l.code}>
                    <span className="eyebrow">
                      WEEK {l.week_number} ·{" "}
                      {l.evidence_kind === "risk"
                        ? "RISK EXERCISE"
                        : l.evidence_kind === "chart"
                          ? "CHART ANNOTATION"
                          : l.evidence_kind.toUpperCase()}
                    </span>
                    <h3>{l.title}</h3>
                    <p>{l.instructions}</p>
                    <div className="progress-track">
                      <div
                        style={{
                          width: `${Math.min(count / l.required_count, 1) * 100}%`,
                        }}
                      />
                    </div>
                    <div className="lesson-footer">
                      <span>
                        {count} / {l.required_count} records
                      </span>
                      <button
                        className="button secondary"
                        onClick={() => setSelected(l)}
                      >
                        Add evidence
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            {p.phase_number > 1 && (
              <div className="callout">
                {additionalGates[p.phase_number - 1]} Lesson reflections alone
                cannot pass this phase.
              </div>
            )}
          </section>
        );
      })}
      <section className="panel info-block">
        <h2>Your evidence trail</h2>
        <p>
          Records are append-only. Past observations show their backdated label.
          Private screenshot uploads will be added with the journal.
        </p>
        {learning.evidence.length ? (
          learning.evidence
            .filter(
              (e) =>
                !phase ||
                learning.lessons.find((l) => l.code === e.lesson_code)
                  ?.phase_number === phase,
            )
            .map((e) => (
              <article className="evidence-record" key={e.id}>
                <span className="eyebrow">
                  {e.observed_on} ·{" "}
                  {
                    learning.lessons.find((l) => l.code === e.lesson_code)
                      ?.title
                  }{" "}
                  {e.backdated ? "· BACKDATED" : ""}
                </span>
                <p>{e.notes}</p>
                {typeof e.details.suggestedLots === "number" && (
                  <small>
                    Server-calculated size: {e.details.suggestedLots} lots
                    {e.details.skip ? " · Below broker minimum: skip" : ""}
                  </small>
                )}
              </article>
            ))
        ) : (
          <p>
            No learning evidence recorded yet. Start with your written plan.
          </p>
        )}
      </section>
      {selected && (
        <EvidenceForm
          key={selected.code}
          lesson={selected}
          today={today}
          startDate={startDate}
          onCancel={() => setSelected(null)}
          onSaved={(value) => {
            onSaved(value);
            setSelected(null);
          }}
        />
      )}
    </div>
  );
}
function EvidenceForm({
  lesson,
  today,
  startDate,
  onCancel,
  onSaved,
}: {
  lesson: Lesson;
  today: string;
  startDate: string;
  onCancel: () => void;
  onSaved: (data: Learning) => void;
}) {
  const [observedOn, setObserved] = useState(today),
    [notes, setNotes] = useState(""),
    [chartTime, setChartTime] = useState(""),
    [timeframe, setTimeframe] = useState("H4"),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const [risk, setRisk] = useState<RiskInput>({
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
  });
  const operation = useRef("");
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const previousOverflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = previousOverflow;
      trigger?.focus({ preventScroll: true });
    };
  }, []);
  let result: ReturnType<typeof sizePosition> | null = null;
  if (lesson.evidence_kind === "risk") {
    try {
      result = sizePosition(risk);
    } catch {
      /* The form shows a validation hint until complete. */
    }
  }
  const fields: {
    key: Exclude<keyof RiskInput, "side" | "currency">;
    label: string;
  }[] = [
    { key: "balance", label: "Demo balance" },
    { key: "rate", label: "Manual USD/KES rate" },
    { key: "entry", label: "Entry price" },
    { key: "stop", label: "Stop price" },
    { key: "riskPercent", label: "Risk (%) — maximum 0.5" },
    { key: "pipCost", label: "Pip cost allowance" },
    { key: "commission", label: "Commission per lot (USD)" },
    { key: "minLot", label: "Broker minimum lot" },
    { key: "lotStep", label: "Lot increment" },
  ];
  return (
    <dialog
      ref={dialogRef}
      className="evidence-dialog evidence-form"
      aria-labelledby="evidence-title"
      aria-describedby="evidence-description"
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onCancel();
      }}
    >
      <header className="evidence-dialog-header">
        <div>
          <span className="eyebrow">ADD LEARNING EVIDENCE</span>
          <h2 id="evidence-title">{lesson.title}</h2>
        </div>
        <button
          type="button"
          className="dialog-close"
          aria-label="Close evidence form"
          disabled={pending}
          onClick={onCancel}
        >
          ×
        </button>
      </header>
      <div className="evidence-dialog-body">
        <p id="evidence-description">
          One record per chart or risk exercise. Describe what you learned; do
          not include broker credentials.
        </p>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            if (pending) return;
            if (!navigator.onLine) {
              setMessage(
                "Offline: evidence has not been saved. Reconnect and retry.",
              );
              return;
            }
            setPending(true);
            setMessage("Saving…");
            operation.current ||= crypto.randomUUID();
            try {
              const details =
                lesson.evidence_kind === "risk"
                  ? risk
                  : lesson.evidence_kind === "chart"
                    ? { symbol: "EURUSD", timeframe, chartTime }
                    : {};
              const response = await saveLearningEvidence({
                id: operation.current,
                lessonCode: lesson.code,
                observedOn,
                notes,
                details,
              });
              if (response.error || !response.learning)
                setMessage(response.error || "Save not confirmed.");
              else onSaved(response.learning);
            } catch {
              setMessage(
                "Connection interrupted. Keep the form open and retry without changing its details.",
              );
            } finally {
              setPending(false);
            }
          }}
        >
          <label>
            Observation date
            <input
              type="date"
              autoFocus
              required
              min={startDate}
              max={today}
              value={observedOn}
              onChange={(e) => setObserved(e.target.value)}
            />
          </label>
          {observedOn < today && (
            <p className="callout">This record will be labelled backdated.</p>
          )}
          {lesson.evidence_kind === "chart" && (
            <div className="form-grid">
              <label>
                Timeframe
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                >
                  <option>H4</option>
                  <option>H1</option>
                </select>
              </label>
              <label>
                Historical candle timestamp (ISO, with offset)
                <input
                  required
                  placeholder="2026-10-20T12:00:00+03:00"
                  value={chartTime}
                  onChange={(e) => setChartTime(e.target.value)}
                />
              </label>
            </div>
          )}
          {lesson.evidence_kind === "risk" && (
            <>
              <div className="form-grid">
                <label>
                  Currency
                  <select
                    value={risk.currency}
                    onChange={(e) =>
                      setRisk({
                        ...risk,
                        currency: e.target.value as "KES" | "USD",
                      })
                    }
                  >
                    <option>KES</option>
                    <option>USD</option>
                  </select>
                </label>
                <label>
                  Side
                  <select
                    value={risk.side}
                    onChange={(e) =>
                      setRisk({
                        ...risk,
                        side: e.target.value as "buy" | "sell",
                      })
                    }
                  >
                    <option value="buy">BUY</option>
                    <option value="sell">SELL</option>
                  </select>
                </label>
                {fields.map((f) => (
                  <label key={f.key}>
                    {f.label}
                    <input
                      required
                      type="number"
                      step="any"
                      value={Number.isNaN(risk[f.key]) ? "" : risk[f.key]}
                      onChange={(e) =>
                        setRisk({
                          ...risk,
                          [f.key]:
                            e.target.value === ""
                              ? NaN
                              : Number(e.target.value),
                        })
                      }
                    />
                  </label>
                ))}
              </div>
              <div className="callout">
                {result
                  ? `Risk budget USD ${result.riskUSD.toFixed(4)} · ${result.lots} lots, rounded down${result.skip ? " · Below minimum: skip" : ""}. The database recomputes this on save.`
                  : "Check positive inputs, risk ≤0.5%, and stop orientation."}
              </div>
            </>
          )}
          <label>
            Your annotation / reasoning (80–6000 characters)
            <textarea
              required
              minLength={80}
              maxLength={6000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <p role="status">{message}</p>
          <div className="modal-actions">
            <button
              className="button secondary"
              type="button"
              disabled={pending}
              onClick={onCancel}
            >
              Cancel
            </button>
            <button className="button primary" disabled={pending}>
              Save evidence
            </button>
          </div>
        </form>
      </div>
    </dialog>
  );
}
