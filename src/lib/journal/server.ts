import "server-only";
import { requireUser } from "@/lib/auth/server";
import { collectRows } from "@/lib/practice/pagination";
import type { Journal, SetupRow, TradeRow, Screenshot } from "./model";
export async function journalWorkspace(): Promise<Journal> {
  const { client, user } = await requireUser();
  const [setups, trades, freezes, screenshots] = await Promise.all([
    collectRows((from, to) =>
      client
        .from("setups")
        .select(
          "id,candidate_id,revision,supersedes_id,mode,direction,account_ref,dataset_split,sequence_no,eligibility,rule_snapshot,created_at",
        )
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    collectRows((from, to) =>
      client
        .from("trades")
        .select(
          "id,setup_id,mode,side,account_ref,opened_at,closed_at,entry,stop,target,exit,volume_lots,cost_usd,planned_risk_usd,realised_pnl_usd,realised_r,rule_compliant,breach_reasons,notes,revision,created_at",
        )
        .eq("user_id", user.id)
        .order("opened_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    client.from("backtest_freezes").select("id").eq("user_id", user.id),
    collectRows((from, to) =>
      client
        .from("screenshots")
        .select("id,parent_type,parent_id,content_type,bytes,created_at")
        .eq("user_id", user.id)
        .order("created_at")
        .range(from, to),
    ),
  ]);
  const errors = [
    setups.error,
    trades.error,
    freezes.error,
    screenshots.error,
  ].filter(Boolean) as { code?: string }[];
  if (errors.length) {
    if (
      errors.some((e) =>
        ["PGRST205", "PGRST204", "42703", "42P01"].includes(e.code || ""),
      )
    )
      return {
        ready: false,
        message:
          "The setup and trade journal are awaiting a workspace update. Your daily remarks and no-trade decisions remain available.",
      };
    throw new Error(
      "Could not load your journal. No empty trade history has been substituted.",
    );
  }
  const rows = setups.data as SetupRow[];
  const superseded = new Set(rows.map((s) => s.supersedes_id).filter(Boolean));
  const latest = rows.filter((s) => !superseded.has(s.id));
  const summary = await client.rpc("journal_summary");
  if (summary.error && summary.error.code !== "PGRST202")
    throw new Error("Could not load account-specific journal facts.");
  return {
    ready: true,
    summary: summary.data || undefined,
    setups: rows,
    trades: trades.data as TradeRow[],
    screenshots: screenshots.data as Screenshot[],
    frozen: !!freezes.data?.length,
    developmentCount: latest.filter(
      (s) =>
        s.dataset_split === "development" &&
        s.rule_snapshot.result.dataValid &&
        !s.rule_snapshot.result.missing.length,
    ).length,
    heldOutCount: latest.filter(
      (s) =>
        s.dataset_split === "held_out" &&
        s.rule_snapshot.result.dataValid &&
        !s.rule_snapshot.result.missing.length,
    ).length,
  };
}
