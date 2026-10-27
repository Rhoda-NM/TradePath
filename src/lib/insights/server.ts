import "server-only";
import { requireUser } from "@/lib/auth/server";
import { collectRows } from "@/lib/practice/pagination";
import { localDate } from "@/lib/trading";
import type { InsightsData, Equity, ProcessFacts } from "./model";
export async function insightsWorkspace(): Promise<InsightsData> {
  const { client, user } = await requireUser();
  const tables = [
    [
      "equity_snapshots",
      "id,account_mode,account_ref,at,balance_usd,equity_usd,deposits_usd,withdrawals_usd,cashflows_confirmed,notes,revision",
    ],
    ["weekly_reviews", "id,week_start_local_date,state"],
    ["daily_sessions", "id,local_date,session_status"],
    ["daily_tasks", "id,session_id,state"],
    ["no_trade_decisions", "id,created_at"],
  ] as const;
  const [profile, ...results] = await Promise.all([
    client
      .from("profiles")
      .select("start_date")
      .eq("user_id", user.id)
      .single(),
    ...tables.map(([table, fields]) =>
      collectRows((from, to) =>
        client
          .from(table)
          .select(fields)
          .eq("user_id", user.id)
          .order("id")
          .range(from, to),
      ),
    ),
  ]);
  if (results.some((r) => r.error)) {
    if (
      results.some(
        (r) =>
          r.error &&
          ["42703", "PGRST204"].includes(
            (r.error as { code?: string }).code || "",
          ),
      )
    )
      return {
        ready: false,
        message:
          "Insights are awaiting the equity workspace update. Your journal remains available.",
      };
    throw new Error(
      "Could not load complete insight records. No empty history was substituted.",
    );
  }
  if (profile.error || !profile.data)
    throw new Error("Could not load practice start date.");
  return {
    ready: true,
    equity: results[0].data as unknown as Equity[],
    process: {
      start: (profile.data as { start_date: string }).start_date,
      today: localDate(new Date(), "Africa/Nairobi"),
      reviews: results[1].data,
      sessions: results[2].data,
      tasks: results[3].data,
      noTrades: results[4].data,
    } as unknown as ProcessFacts,
  };
}
