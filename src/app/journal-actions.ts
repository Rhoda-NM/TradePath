"use server";
import { requireUser } from "@/lib/auth/server";
import {
  saveSetupSchema,
  openTradeSchema,
  closeTradeSchema,
} from "@/lib/journal/model";
import { journalWorkspace } from "@/lib/journal/server";
function message(code?: string) {
  return code === "40001"
    ? "This record changed elsewhere. Keep a copy of your edits and reload."
    : code === "23505"
      ? "This candidate or execution is already recorded."
      : code === "PGRST202"
        ? "The journal is awaiting a workspace update."
        : "Save was not confirmed. Check the inputs, timestamps and dataset freeze, then retry with the same details.";
}
export async function saveSetup(raw: unknown) {
  const parsed = saveSetupSchema.safeParse(raw);
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message || "Check the setup fields.",
    };
  const { client } = await requireUser();
  const v = parsed.data;
  const { data: id, error } = await client.rpc("evaluate_and_save_setup", {
    p_operation: v.id,
    p_input: v.input,
    p_previous: v.previous,
  });
  if (error) return { error: message(error.code) };
  try {
    return {
      success: true,
      id: id as string,
      journal: await journalWorkspace(),
    };
  } catch {
    return {
      error:
        "The setup was saved, but refresh failed. Reload before changing its inputs.",
    };
  }
}
export async function openTrade(raw: unknown) {
  const parsed = openTradeSchema.safeParse(raw);
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message || "Check the execution fields.",
    };
  const { client } = await requireUser();
  const { id, ...input } = parsed.data;
  const { data: tradeId, error } = await client.rpc("record_journal_trade", {
    p_operation: id,
    p: input,
  });
  if (error) return { error: message(error.code) };
  try {
    return {
      success: true,
      id: tradeId as string,
      journal: await journalWorkspace(),
    };
  } catch {
    return {
      error:
        "The trade was recorded, but refresh failed. Reload before repeating.",
    };
  }
}
export async function closeTrade(raw: unknown) {
  const parsed = closeTradeSchema.safeParse(raw);
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message || "Check the closing fields.",
    };
  const { client } = await requireUser();
  const v = parsed.data;
  const { error } = await client.rpc("close_journal_trade", {
    p_operation: v.id,
    p_trade: v.tradeId,
    p_revision: v.revision,
    p_closed: v.closedAt,
    p_exit: v.exit,
    p_cost: v.costUSD,
    p_notes: v.notes,
  });
  if (error) return { error: message(error.code) };
  try {
    return { success: true, journal: await journalWorkspace() };
  } catch {
    return {
      error:
        "The close was acknowledged, but refresh failed. Reload to confirm.",
    };
  }
}
export async function freezeDevelopment() {
  const { client } = await requireUser();
  const { error } = await client.rpc("freeze_backtest_development");
  if (error)
    return {
      error:
        "Record at least 70 fully documented sequential development candidates before freezing. Held-out data must remain untouched until then.",
    };
  return { success: true, journal: await journalWorkspace() };
}
