import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  rpc: vi.fn(),
  learning: vi.fn(),
  review: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/curriculum/server", () => ({
  curriculumWorkspace: mocks.learning,
  reviewWorkspace: mocks.review,
}));
import {
  saveLearningEvidence,
  saveWeeklyReview,
} from "../src/app/learning-actions";
const id = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const notes =
  "I documented the experimental practice rules, daily learning time, maximum risk budget and reasons for choosing not to trade.";
describe("learning write boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.requireUser.mockResolvedValue({
      client: { rpc: mocks.rpc },
      user: { id: "verified-user" },
    });
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.learning.mockResolvedValue({
      ready: true,
      evidence: [],
      lessons: [],
      phases: [],
    });
    mocks.review.mockResolvedValue({ ready: true, week: "2026-10-26" });
  });
  it("rejects forged owner or manually passed milestones", async () => {
    const r = await saveLearningEvidence({
      id,
      lessonCode: "p1-w1",
      observedOn: "2026-10-27",
      notes,
      details: {},
      state: "completed",
    });
    expect(r.error).toBeTruthy();
    expect(mocks.requireUser).not.toHaveBeenCalled();
  });
  it("requires verified identity and passes no owner to the database", async () => {
    const r = await saveLearningEvidence({
      id,
      lessonCode: "p1-w1",
      observedOn: "2026-10-27",
      notes,
      details: {},
    });
    expect(r.success).toBe(true);
    expect(mocks.rpc).toHaveBeenCalledWith("record_learning_evidence", {
      p_operation: id,
      p_lesson: "p1-w1",
      p_observed: "2026-10-27",
      p_notes: notes,
      p_details: {},
    });
  });
  it("does not call the database for signed-out users", async () => {
    mocks.requireUser.mockRejectedValue(new Error("signed out"));
    await expect(
      saveLearningEvidence({
        id,
        lessonCode: "p1-w1",
        observedOn: "2026-10-27",
        notes,
        details: {},
      }),
    ).rejects.toThrow("signed out");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("surfaces duplicate examples without a successful save", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "23505" } });
    const r = await saveLearningEvidence({
      id,
      lessonCode: "p1-w1",
      observedOn: "2026-10-27",
      notes,
      details: {},
    });
    expect(r.error).toMatch(/already recorded/);
    expect(r.success).toBeUndefined();
  });
  it("distinguishes acknowledged writes from failed refresh", async () => {
    mocks.learning.mockRejectedValue(new Error("offline"));
    expect(
      (
        await saveLearningEvidence({
          id,
          lessonCode: "p1-w1",
          observedOn: "2026-10-27",
          notes,
          details: {},
        })
      ).error,
    ).toMatch(/acknowledged/);
  });
  it("refuses client-supplied review facts", async () => {
    expect(
      (
        await saveWeeklyReview({
          id,
          week: "2026-10-26",
          reflection: notes,
          commitment: "Review one historical chart.",
          submit: true,
          revision: 0,
          facts: { rule_breaches: 0 },
        })
      ).error,
    ).toBeTruthy();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("surfaces revision conflicts and does not refresh as if saved", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "40001" } });
    const r = await saveWeeklyReview({
      id,
      week: "2026-10-26",
      reflection: notes,
      commitment: "Review one historical chart.",
      submit: true,
      revision: 0,
    });
    expect(r.error).toMatch(/another session/);
    expect(mocks.review).not.toHaveBeenCalled();
  });
});
