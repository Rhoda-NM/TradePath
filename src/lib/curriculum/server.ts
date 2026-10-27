import "server-only";
import { requireUser } from "@/lib/auth/server";
import { collectRows } from "@/lib/practice/pagination";
import type {
  Learning,
  Evidence,
  LearningPhase,
  ReviewData,
  ReviewFacts,
  WeeklyReview,
} from "./model";
import { lessons, weekStart } from "./model";
import { localDate } from "@/lib/trading";
const missingMessage =
  "Learning features are awaiting a workspace update. Your existing practice records remain available. Retry after setup is complete.";
export async function curriculumWorkspace(): Promise<Learning> {
  const { client, user } = await requireUser();
  const { error } = await client.rpc("refresh_learning_plan");
  if (error) {
    if (error.code === "PGRST202" || error.code === "PGRST205")
      return { ready: false, message: missingMessage };
    throw new Error("Could not refresh learning progress. Please retry.");
  }
  const [evidence, phases] = await Promise.all([
    collectRows((from, to) =>
      client
        .from("learning_evidence")
        .select("id,lesson_code,observed_on,notes,details,backdated,created_at")
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
  if (evidence.error || phases.error)
    throw new Error(
      "Could not load learning evidence. No empty history has been substituted.",
    );
  const source = await client.rpc("journal_evidence_counts");
  if (source.error && source.error.code !== "PGRST202")
    throw new Error("Could not load journal evidence counts.");
  return {
    ready: true,
    journalEvidence: source.data || undefined,
    lessons,
    evidence: evidence.data as Evidence[],
    phases: phases.data as LearningPhase[],
  };
}
export async function reviewWorkspace(
  week = weekStart(localDate(new Date(), "Africa/Nairobi")),
): Promise<ReviewData> {
  const { client, user } = await requireUser();
  const { data: facts, error } = await client.rpc("weekly_review_facts", {
    p_week: week,
  });
  if (error) {
    if (error.code === "PGRST202")
      return { ready: false, message: missingMessage };
    if (error.code !== "22023")
      throw new Error("Could not load review facts. Please retry.");
    return {
      ready: false,
      message:
        "This review week is unavailable. Choose a Monday from your curriculum start week through the current week.",
    };
  }
  const result = await client
    .from("weekly_reviews")
    .select(
      "week_start_local_date,reflection,commitment,reviewed_at,revision,state,facts",
    )
    .eq("user_id", user.id)
    .eq("week_start_local_date", week)
    .maybeSingle();
  if (result.error)
    throw new Error("Could not load your review. Please retry.");
  return {
    ready: true,
    week,
    facts: facts as ReviewFacts,
    review: result.data as WeeklyReview | null,
  };
}
