"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { openTrade, closeTrade } from "@/app/journal-actions";
import type { SetupRow, TradeRow } from "@/lib/journal/model";
import { TimeField, NumberField } from "./fields";
export default function TradeForm({
  setup,
  trade,
}: {
  setup?: SetupRow;
  trade?: TradeRow;
}) {
  const router = useRouter();
  const [mode, setMode] = useState(setup?.mode || "demo"),
    [side, setSide] = useState(setup?.direction || "buy"),
    [accountRef, setAccount] = useState(setup?.account_ref || "demo-main"),
    [openedAt, setOpened] = useState<string | null>(
      setup?.mode === "backtest"
        ? setup.rule_snapshot.input.entryAt
        : new Date().toISOString(),
    ),
    [closedAt, setClosed] = useState<string | null>(
      trade?.closed_at || new Date().toISOString(),
    ),
    [entry, setEntry] = useState<number | null>(
      setup?.rule_snapshot.input.entry || null,
    ),
    [stop, setStop] = useState<number | null>(
      setup?.rule_snapshot.input.stop || null,
    ),
    [target, setTarget] = useState<number | null>(
      setup?.rule_snapshot.input.target || null,
    ),
    [lots, setLots] = useState<number | null>(
      setup?.rule_snapshot.input.lots || null,
    ),
    [exit, setExit] = useState<number | null>(trade?.exit || null),
    [cost, setCost] = useState<number | null>(trade?.cost_usd || 0),
    [notes, setNotes] = useState(trade?.notes || ""),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const operation = useRef("");
  return (
    <section className="panel journal-form">
      <h2>
        {trade
          ? trade.closed_at
            ? "Correct the closing record"
            : "Close this journal entry"
          : "Record an external execution"}
      </h2>
      <p>
        {trade
          ? "Initial risk and the original compliance decision remain frozen. Corrections create audit revisions."
          : "This records what you executed externally. It does not place an order. A missing or failed gate remains visible even if the trade wins."}
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (pending) return;
          if (!navigator.onLine) {
            setMessage("Offline: this entry has not been saved.");
            return;
          }
          setPending(true);
          setMessage("Saving…");
          operation.current ||= crypto.randomUUID();
          try {
            const result = trade
              ? await closeTrade({
                  id: operation.current,
                  tradeId: trade.id,
                  revision: trade.revision,
                  closedAt,
                  exit,
                  costUSD: cost,
                  notes,
                })
              : await openTrade({
                  id: operation.current,
                  setupId: setup?.id || null,
                  mode,
                  side,
                  accountRef,
                  openedAt,
                  entry,
                  stop,
                  target,
                  lots,
                  costUSD: cost,
                  notes,
                });
            if (result.error) setMessage(result.error);
            else {
              const id = trade?.id || ("id" in result ? result.id : undefined);
              if (id) router.push("/journal/" + id);
              router.refresh();
            }
          } catch {
            setMessage(
              "Connection interrupted. Retry with the same details to confirm the record.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <fieldset disabled={pending}>
          <div className="form-grid">
            {!trade && (
              <>
                <label>
                  Mode
                  <select
                    value={mode}
                    disabled={!!setup}
                    onChange={(e) => setMode(e.target.value)}
                  >
                    <option value="demo">Forward demo</option>
                    <option value="backtest">Backtest</option>
                    <option value="free_trial">Free trial</option>
                  </select>
                </label>
                <label>
                  Direction
                  <select
                    disabled={!!setup}
                    value={side}
                    onChange={(e) => setSide(e.target.value)}
                  >
                    <option value="buy">BUY</option>
                    <option value="sell">SELL</option>
                  </select>
                </label>
                <label>
                  Account reference
                  <input
                    required
                    maxLength={80}
                    disabled={!!setup}
                    value={accountRef}
                    onChange={(e) => setAccount(e.target.value)}
                  />
                </label>
                <TimeField
                  label="Actual opening time"
                  value={openedAt}
                  onChange={setOpened}
                  required
                />
                <NumberField
                  label="Actual entry"
                  value={entry}
                  onChange={setEntry}
                  required
                />
                <NumberField
                  label="Initial stop (blank if none — risk will be unknown)"
                  value={stop}
                  onChange={setStop}
                />
                <NumberField
                  label="Initial target"
                  value={target}
                  onChange={setTarget}
                />
                <NumberField
                  label="Actual lots"
                  value={lots}
                  onChange={setLots}
                  required
                />
              </>
            )}
            {trade && (
              <>
                <TimeField
                  label="Actual closing time"
                  value={closedAt}
                  onChange={setClosed}
                  required
                />
                <NumberField
                  label="Actual exit"
                  value={exit}
                  onChange={setExit}
                  required
                />
              </>
            )}
            <NumberField
              label={
                trade
                  ? "Total additional realized fees (USD)"
                  : "Known additional fees at entry (USD)"
              }
              value={cost}
              onChange={setCost}
              required
            />
          </div>
          <p>
            Do not add spread twice if it is already reflected in entry and exit
            prices. Closing fees may exceed initial assumptions. Missing initial
            risk means R stays unavailable.
          </p>
          <label>
            Journal notes
            <textarea
              maxLength={6000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </label>
          <p role="status">{message}</p>
          <button className="button primary" disabled={pending}>
            {pending
              ? "Saving…"
              : trade
                ? "Save closing result"
                : "Record execution"}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
