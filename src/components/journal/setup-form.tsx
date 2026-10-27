"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveSetup } from "@/app/journal-actions";
import {
  initialSetup,
  type SetupInput,
  type SetupRow,
} from "@/lib/journal/model";
import { parseCandles } from "@/lib/journal/input";
import { TimeField, NumberField } from "./fields";
export default function SetupForm({ previous }: { previous?: SetupRow }) {
  const router = useRouter();
  const [input, setInput] = useState<SetupInput>(
      previous?.rule_snapshot.input || initialSetup(),
    ),
    [candles, setCandles] = useState(
      previous
        ? JSON.stringify(previous.rule_snapshot.input.h4Candles, null, 2)
        : "",
    ),
    [events, setEvents] = useState(
      previous?.rule_snapshot.input.newsEvents.join("\n") || "",
    ),
    [message, setMessage] = useState(""),
    [pending, setPending] = useState(false);
  const operation = useRef("");
  function update<K extends keyof SetupInput>(key: K, value: SetupInput[K]) {
    setInput((current) => ({ ...current, [key]: value }));
  }
  const prices: {
    key:
      | "zoneLow"
      | "zoneHigh"
      | "open"
      | "high"
      | "low"
      | "close"
      | "entry"
      | "stop"
      | "target"
      | "lots";
    label: string;
  }[] = [
    { key: "zoneLow", label: "H4 zone low" },
    { key: "zoneHigh", label: "H4 zone high" },
    { key: "open", label: "Closed H1 open" },
    { key: "high", label: "Closed H1 high" },
    { key: "low", label: "Closed H1 low" },
    { key: "close", label: "Closed H1 close" },
    { key: "entry", label: "Planned / verified entry" },
    { key: "stop", label: "Initial stop" },
    { key: "target", label: "Target (exactly 2R before costs)" },
    { key: "lots", label: "Planned lots" },
  ];
  return (
    <section className="panel journal-form">
      <div className="section-heading">
        <div>
          <span className="eyebrow">H4H1-v1 · EXPERIMENTAL · EUR/USD</span>
          <h2>
            {previous
              ? "New setup revision"
              : "Document the setup before execution."}
          </h2>
        </div>
        <Link href="/journal" className="button secondary">
          Back to journal
        </Link>
      </div>
      <p>
        Missing evidence produces an unknown gate. A failed gate never prevents
        honest logging of an external execution. The app does not transmit
        orders.
      </p>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (pending) return;
          if (!navigator.onLine) {
            setMessage("Offline: setup has not been saved.");
            return;
          }
          setPending(true);
          setMessage("Evaluating and saving…");
          operation.current ||= crypto.randomUUID();
          try {
            let history;
            try {
              history = parseCandles(candles);
            } catch {
              setMessage(
                "Check H4 data: use JSON or CSV with ISO timestamps including timezone, and positive OHLC prices.",
              );
              return;
            }
            const result = await saveSetup({
              id: operation.current,
              previous: previous?.id || null,
              input: {
                ...input,
                h4Candles: history,
                newsEvents: events
                  .split(/\r?\n/)
                  .map((v) => v.trim())
                  .filter(Boolean),
              },
            });
            if (result.error || !result.id)
              setMessage(result.error || "Save not confirmed.");
            else {
              router.push("/setups/" + result.id);
              router.refresh();
            }
          } catch {
            setMessage(
              "Connection interrupted. Keep the form open and retry unchanged.",
            );
          } finally {
            setPending(false);
          }
        }}
      >
        <fieldset disabled={pending}>
          <h3>Context and timing</h3>
          <div className="form-grid">
            <label>
              Mode
              <select
                disabled={!!previous}
                value={input.mode}
                onChange={(e) => {
                  const mode = e.target.value as SetupInput["mode"];
                  setInput({
                    ...input,
                    mode,
                    dataset: mode === "backtest" ? "development" : null,
                  });
                }}
              >
                <option value="demo">Forward demo</option>
                <option value="backtest">Historical backtest</option>
                <option value="free_trial">Free trial</option>
              </select>
            </label>
            <label>
              Direction
              <select
                disabled={!!previous}
                value={input.side}
                onChange={(e) =>
                  update("side", e.target.value as "buy" | "sell")
                }
              >
                <option value="buy">BUY</option>
                <option value="sell">SELL</option>
              </select>
            </label>
            <label>
              Account reference
              <input
                disabled={!!previous}
                required
                maxLength={80}
                value={input.accountRef}
                onChange={(e) => update("accountRef", e.target.value)}
              />
            </label>
            {input.mode === "backtest" && (
              <label>
                Dataset
                <select
                  disabled={!!previous}
                  value={input.dataset || "development"}
                  onChange={(e) =>
                    update(
                      "dataset",
                      e.target.value as "development" | "held_out",
                    )
                  }
                >
                  <option value="development">Development</option>
                  <option value="held_out">
                    Untouched held-out (requires freeze)
                  </option>
                </select>
              </label>
            )}
            <TimeField
              label="H1 confirmation close"
              value={input.signalCloseAt}
              onChange={(v) => update("signalCloseAt", v)}
            />
            <TimeField
              label="Entry quote / execution evidence"
              value={input.entryAt}
              onChange={(v) => update("entryAt", v)}
            />
            <TimeField
              label="Zone created"
              value={input.zoneCreatedAt}
              onChange={(v) => update("zoneCreatedAt", v)}
            />
            <TimeField
              label="Zone first tested by H1 candle"
              value={input.zoneTestedAt}
              onChange={(v) => update("zoneTestedAt", v)}
            />
            {input.mode === "backtest" && (
              <>
                <TimeField
                  label="Historical decision time"
                  value={input.decisionAt}
                  onChange={(v) => update("decisionAt", v)}
                  required
                />
                <NumberField
                  label="Next H1 open price"
                  value={input.nextH1Open}
                  onChange={(v) => update("nextH1Open", v)}
                />
              </>
            )}
          </div>
          <h3>Closed H4 history</h3>
          <p>
            Paste at least 50 closed H4 candles, oldest first. EMA50 starts with
            the first 50-close average. Swings require two closed candles on
            each side. Do not include candles unavailable at the signal.
            Timestamps identify candle opens; each candle spans four hours.
          </p>
          <label>
            JSON array or CSV: timestamp,open,high,low,close
            <textarea
              className="candle-input"
              value={candles}
              onChange={(e) => setCandles(e.target.value)}
              placeholder={
                '[{"at":"2026-10-01T00:00:00Z","open":1.10,"high":1.11,"low":1.09,"close":1.105}]'
              }
            />
          </label>
          <h3>Zone, candle and position</h3>
          <div className="form-grid">
            {prices.map((f) => (
              <NumberField
                key={f.key}
                label={f.label}
                value={input[f.key]}
                onChange={(v) => update(f.key, v)}
              />
            ))}
          </div>
          <h3>Equity and costs</h3>
          <div className="form-grid">
            <NumberField
              label="Selected demo account equity"
              value={input.equity}
              onChange={(v) => update("equity", v)}
            />
            <label>
              Equity currency
              <select
                value={input.currency}
                onChange={(e) =>
                  update("currency", e.target.value as "USD" | "KES")
                }
              >
                <option>USD</option>
                <option>KES</option>
              </select>
            </label>
            <TimeField
              label="Equity reference time"
              value={input.equityAt}
              onChange={(v) => update("equityAt", v)}
            />
            {input.currency === "KES" && (
              <>
                <NumberField
                  label="Manual USD/KES exchange rate"
                  value={input.rate}
                  onChange={(v) => update("rate", v)}
                />
                <TimeField
                  label="Exchange-rate reference"
                  value={input.rateAt}
                  onChange={(v) => update("rateAt", v)}
                />
                <label>
                  Rate source
                  <input
                    maxLength={200}
                    value={input.rateSource}
                    onChange={(e) => update("rateSource", e.target.value)}
                  />
                </label>
              </>
            )}
            {(["pipCost", "commission", "minLot", "lotStep"] as const).map(
              (key, i) => (
                <NumberField
                  key={key}
                  label={
                    [
                      "Estimated spread/slippage allowance (pips)",
                      "Estimated commission per lot (USD)",
                      "Broker minimum lot",
                      "Broker lot increment",
                    ][i]
                  }
                  value={input[key]}
                  onChange={(v) => update(key, v ?? 0)}
                  required
                />
              ),
            )}
          </div>
          <h3>Manual news check</h3>
          <p>
            This is a manual acknowledgement, not an authoritative live
            calendar. Avoid high-impact EUR/USD events within 30 minutes either
            side of entry.
          </p>
          <div className="form-grid">
            <label>
              Calendar result
              <select
                value={input.news}
                onChange={(e) =>
                  update("news", e.target.value as SetupInput["news"])
                }
              >
                <option value="unknown">Not verified</option>
                <option value="clear">Manually checked — clear</option>
                <option value="blocked">Blocked news window</option>
              </select>
            </label>
            <TimeField
              label="News checked"
              value={input.newsCheckedAt}
              onChange={(v) => update("newsCheckedAt", v)}
            />
          </div>
          <label>
            Relevant event times — one ISO timestamp with timezone per line
            <textarea
              value={events}
              onChange={(e) => setEvents(e.target.value)}
              placeholder="2026-10-27T15:00:00+03:00"
            />
          </label>
          <label>
            Setup notes
            <textarea
              maxLength={6000}
              value={input.notes}
              onChange={(e) => update("notes", e.target.value)}
            />
          </label>
          <p role="status">{message}</p>
          <button className="button primary" disabled={pending}>
            {pending ? "Evaluating…" : "Evaluate and save immutable snapshot"}
          </button>
        </fieldset>
      </form>
    </section>
  );
}
