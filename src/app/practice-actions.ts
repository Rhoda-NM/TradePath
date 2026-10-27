"use server";
import { requireUser } from "@/lib/auth/server";
import { commandSchema, onboardingSchema } from "@/lib/practice/model";
import { accountWorkspace } from "@/lib/practice/server";
import { localDate } from "@/lib/trading";
export async function completeOnboarding(raw: unknown) {
  const parsed = onboardingSchema.safeParse(raw);
  if (!parsed.success)
    return {
      error:
        "Check your start date, supported timezone, time budget, and capital.",
    };
  const { client } = await requireUser();
  const v = parsed.data;
  const { error } = await client.rpc("complete_onboarding", {
    p_start: v.startDate,
    p_timezone: v.timezone,
    p_minutes: v.availableMinutes,
    p_capital: v.capitalKes,
  });
  if (error)
    return {
      error:
        "Could not save preferences. Verify your original start date and retry.",
    };
  return { success: true };
}
export async function mutatePractice(raw: unknown) {
  const parsed = commandSchema.safeParse(raw);
  if (!parsed.success)
    return { error: "Invalid practice update. Reload and try again." };
  const { client, user } = await requireUser();
  const v = parsed.data;
  const { data: profile, error } = await client
    .from("profiles")
    .select("timezone")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error || !profile)
    return { error: "Complete onboarding before saving practice." };
  if (v.date !== localDate(new Date(), profile.timezone))
    return { error: "The local date changed. Reload before saving." };
  const result =
    v.kind === "remarks"
      ? await client.rpc("save_daily_remarks", {
          p_date: v.date,
          p_notes: v.notes,
          p_expected_notes: v.expectedNotes,
        })
      : v.kind === "taskOutcome"
        ? await client.rpc("set_practice_task_outcome", {
            p_date: v.date,
            p_task: v.task,
            p_state: v.state,
            p_reason: v.reason,
            p_revision: v.revision,
            p_operation: v.id,
          })
        : v.kind === "task"
          ? await client.rpc("set_practice_task", {
              p_date: v.date,
              p_task: v.task,
              p_done: v.done,
              p_revision: v.revision,
              p_operation: v.id,
            })
          : v.kind === "session"
            ? await client.rpc("check_in_practice", {
                p_date: v.date,
                p_emotion: v.emotion,
              })
            : await client.rpc("record_no_trade", {
                p_date: v.date,
                p_operation: v.id,
                p_reason: v.reason,
                p_notes: v.notes,
              });
  if (result.error)
    return {
      error:
        result.error.code === "40001"
          ? v.kind === "remarks"
            ? "These remarks changed elsewhere. Keep a copy of your text and reload before saving."
            : "This task changed elsewhere. Reload before trying again."
          : "Save was not confirmed. Keep this form open and retry; if the date changed, reload first.",
    };
  try {
    return { success: true, workspace: await accountWorkspace() };
  } catch {
    return {
      error:
        "The write was acknowledged, but records could not be refreshed. Reload to confirm before repeating the action.",
    };
  }
}
