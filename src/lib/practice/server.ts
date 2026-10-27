import "server-only";
import { collectRows } from "./pagination";
import { requireUser } from "@/lib/auth/server";
import { localDate } from "@/lib/trading";
import type { Profile, Stored } from "./model";
import { redirect } from "next/navigation";
export async function accountWorkspace() {
  const { client, user } = await requireUser();
  const profileResult = await client
    .from("profiles")
    .select("timezone,available_minutes,start_date,capital_kes")
    .eq("user_id", user.id)
    .maybeSingle();
  if (profileResult.error)
    throw new Error(
      "Account storage is unavailable. Confirm migrations are applied.",
    );
  if (!profileResult.data) redirect("/onboarding");
  const profile = profileResult.data as Profile;
  const today = localDate(new Date(), profile.timezone);
  const { error: dayError } = await client.rpc("ensure_practice_day", {
    p_date: today,
  });
  if (dayError)
    throw new Error("Could not load today’s practice session. Please reload.");
  const results = await Promise.all([
    collectRows((from, to) =>
      client
        .from("daily_sessions")
        .select("id,local_date,session_status,reflection")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
    collectRows((from, to) =>
      client
        .from("daily_tasks")
        .select("session_id,task_code,state,revision,skip_reason")
        .eq("user_id", user.id)
        .order("id")
        .range(from, to),
    ),
    collectRows((from, to) =>
      client
        .from("no_trade_decisions")
        .select("id,session_id,reason,notes,created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .order("id")
        .range(from, to),
    ),
    collectRows((from, to) =>
      client
        .from("curriculum_phases")
        .select("phase_number,planned_start,planned_end,state")
        .eq("user_id", user.id)
        .order("phase_number")
        .range(from, to),
    ),
  ]);
  if (results.some((r) => r.error))
    throw new Error("Could not load your account records. Please reload.");
  const [sessions, tasks, decisions, phases] = results;
  const dates = new Map((sessions.data || []).map((s) => [s.id, s.local_date]));
  const data: Stored = {
    version: 1,
    days: {},
    sessions: {},
    decisions: [],
    remarks: {},
  };
  for (const s of sessions.data || [])
    if (s.session_status !== "planned")
      data.sessions[s.local_date] = s.session_status;
  for (const session of sessions.data || [])
    if (session.reflection)
      data.remarks[session.local_date] = session.reflection;
  const revisions: Record<string, number> = {};
  const taskOutcomes: Record<string, { state: string; reason: string }> = {};
  for (const t of tasks.data || []) {
    const date = dates.get(t.session_id);
    if (date)
      taskOutcomes[`${date}:${t.task_code}`] = {
        state: t.state,
        reason: t.skip_reason || "",
      };
    if (date) revisions[`${date}:${t.task_code}`] = Number(t.revision);
    if (date && t.state === "done") (data.days[date] ??= []).push(t.task_code);
  }
  data.decisions = (decisions.data || []).map((d) => ({
    id: d.id,
    date: dates.get(d.session_id) || "",
    reason: d.reason,
    notes: d.notes || "",
  }));
  return {
    data,
    revisions,
    taskOutcomes,
    profile,
    today,
    phases: phases.data || [],
  };
}
