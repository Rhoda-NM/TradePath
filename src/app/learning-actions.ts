"use server";
import { requireUser } from "@/lib/auth/server";
import { evidenceSchema, reviewSchema } from "@/lib/curriculum/model";
import { curriculumWorkspace, reviewWorkspace } from "@/lib/curriculum/server";
export async function saveLearningEvidence(raw: unknown) {
  const parsed = evidenceSchema.safeParse(raw);
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message || "Check the evidence fields.",
    };
  const { client } = await requireUser();
  const v = parsed.data;
  const { error } = await client.rpc("record_learning_evidence", {
    p_operation: v.id,
    p_lesson: v.lessonCode,
    p_observed: v.observedOn,
    p_notes: v.notes,
    p_details: v.details,
  });
  if (error)
    return {
      error:
        error.code === "23505"
          ? "This chart or risk exercise is already recorded. Add a different example."
          : error.code === "PGRST202"
            ? "Learning storage is awaiting a workspace update. Retry after setup is complete."
            : "Evidence save was not confirmed. Check the date and inputs, then retry with the same details.",
    };
  try {
    return { success: true, learning: await curriculumWorkspace() };
  } catch {
    return {
      error:
        "The evidence write was acknowledged, but refresh failed. Reload to confirm before changing the form.",
    };
  }
}
export async function saveWeeklyReview(raw: unknown) {
  const parsed = reviewSchema.safeParse(raw);
  if (!parsed.success)
    return {
      error: parsed.error.issues[0]?.message || "Check the review fields.",
    };
  const { client } = await requireUser();
  const v = parsed.data;
  const { error } = await client.rpc("save_weekly_review", {
    p_week: v.week,
    p_reflection: v.reflection,
    p_commitment: v.commitment,
    p_submit: v.submit,
    p_revision: v.revision,
    p_operation: v.id,
  });
  if (error)
    return {
      error:
        error.code === "40001"
          ? "This review changed in another session. Reload before saving."
          : error.code === "PGRST202"
            ? "Learning storage is awaiting a workspace update. Retry after setup is complete."
            : "Review save was not confirmed. Check the week and reflection, then retry with the same details.",
    };
  try {
    return { success: true, review: await reviewWorkspace(v.week) };
  } catch {
    return {
      error:
        "The review write was acknowledged, but refresh failed. Reload before editing again.",
    };
  }
}
