import type { TradeRow } from "./model";
function cell(value: unknown) {
  let text = value === null || value === undefined ? "" : String(value);
  if (typeof value === "string" && /^[\s]*[=+@-]/.test(text)) text = "'" + text;
  return '"' + text.replaceAll('"', '""') + '"';
}
export function tradesCSV(trades: TradeRow[], timezone: string) {
  const local = (value: string | null) =>
    value
      ? new Intl.DateTimeFormat("sv-SE", {
          timeZone: timezone,
          dateStyle: "short",
          timeStyle: "medium",
        }).format(new Date(value))
      : "";
  const rows: unknown[][] = [
    [
      "id",
      "mode",
      "account",
      "side",
      "opened_utc",
      "opened_local",
      "closed_utc",
      "closed_local",
      "timezone",
      "entry",
      "initial_stop",
      "target",
      "lots",
      "additional_cost_usd",
      "initial_risk_usd",
      "net_pnl_usd",
      "realised_r",
      "rule_compliant",
      "breach_reasons",
      "notes",
    ],
  ];
  for (const t of trades)
    rows.push([
      t.id,
      t.mode,
      t.account_ref,
      t.side,
      t.opened_at,
      local(t.opened_at),
      t.closed_at,
      local(t.closed_at),
      timezone,
      t.entry,
      t.stop,
      t.target,
      t.volume_lots,
      t.cost_usd,
      t.planned_risk_usd,
      t.realised_pnl_usd,
      t.realised_r,
      t.rule_compliant,
      t.breach_reasons.join("; "),
      t.notes,
    ]);
  return "\uFEFF" + rows.map((row) => row.map(cell).join(",")).join("\r\n");
}
