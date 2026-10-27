"use server";
import { requireUser } from "@/lib/auth/server";
import { equitySchema } from "@/lib/insights/model";
import { revalidatePath } from "next/cache";
export async function saveEquity(raw: unknown) {
  const v = equitySchema.safeParse(raw);
  if (!v.success) return { error: "Check the equity fields and amounts." };
  const { client } = await requireUser();
  const p = v.data;
  const { error } = await client.rpc("save_equity_snapshot", {
    p_operation: p.operation,
    p_id: p.id,
    p_revision: p.revision,
    p_mode: p.mode,
    p_account: p.account,
    p_at: p.at,
    p_balance: p.balance,
    p_equity: p.equity,
    p_deposits: p.deposits,
    p_withdrawals: p.withdrawals,
    p_confirmed: p.confirmed,
    p_notes: p.notes,
  });
  if (error)
    return {
      error:
        error.code === "40001"
          ? "This snapshot changed elsewhere. Copy your edits and reload."
          : error.code === "23505"
            ? "A snapshot exists at that time. Edit the existing record."
            : "Save was not confirmed. Check timestamps, amounts and workspace setup, then retry.",
    };
  revalidatePath("/insights");
  revalidatePath("/funding");
  return { success: true };
}
