import { candleSchema } from "./model";
export function parseCandles(text: string) {
  if (!text.trim()) return [];
  let rows: unknown;
  if (text.trim().startsWith("[")) rows = JSON.parse(text);
  else
    rows = text
      .trim()
      .split(/\r?\n/)
      .filter((line) => line.trim())
      .filter((line, i) => !(i === 0 && /^(time|at|date)/i.test(line)))
      .map((line) => {
        const [at, open, high, low, close, ...extra] = line
          .split(",")
          .map((v) => v.trim());
        if (extra.length || !close)
          throw new Error(
            "Each candle needs timestamp, open, high, low and close.",
          );
        return {
          at,
          open: Number(open),
          high: Number(high),
          low: Number(low),
          close: Number(close),
        };
      });
  return candleSchema.array().max(400).parse(rows);
}
export function utcInput(iso: string | null) {
  return iso ? new Date(iso).toISOString().slice(0, 19) : "";
}
export function utcValue(value: string) {
  return value ? new Date(value + "Z").toISOString() : null;
}
