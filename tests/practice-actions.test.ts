import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  eq: vi.fn(),
  accountWorkspace: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/practice/server", () => ({
  accountWorkspace: mocks.accountWorkspace,
}));
import {
  mutatePractice,
  completeOnboarding,
} from "../src/app/practice-actions";
import { localDate } from "../src/lib/trading";
describe("authenticated practice boundary", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.eq.mockReturnValue({
      maybeSingle: async () => ({
        data: { timezone: "Africa/Nairobi" },
        error: null,
      }),
    });
    mocks.from.mockReturnValue({ select: () => ({ eq: mocks.eq }) });
    mocks.requireUser.mockResolvedValue({
      user: { id: "verified-user" },
      client: { rpc: mocks.rpc, from: mocks.from },
    });
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.accountWorkspace.mockResolvedValue({
      data: { days: {} },
      today: localDate(),
    });
  });
  it("does not call storage for invalid client payload", async () => {
    const result = await mutatePractice({
      kind: "session",
      date: localDate(),
      emotion: "Calm",
      user_id: "victim",
    });
    expect(result.error).toBeTruthy();
    expect(mocks.requireUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("requires a fresh verified identity before valid mutations", async () => {
    mocks.requireUser.mockRejectedValue(new Error("unauthenticated"));
    await expect(
      mutatePractice({ kind: "session", date: localDate(), emotion: "Calm" }),
    ).rejects.toThrow("unauthenticated");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("derives profile lookup from verified user, not the client", async () => {
    const r = await mutatePractice({
      kind: "session",
      date: localDate(),
      emotion: "Fatigued",
    });
    expect(r.success).toBe(true);
    expect(mocks.eq).toHaveBeenCalledWith("user_id", "verified-user");
    expect(mocks.rpc).toHaveBeenCalledWith("check_in_practice", {
      p_date: localDate(),
      p_emotion: "Fatigued",
    });
  });
  it("rejects stale local dates before calling a mutation RPC", async () => {
    const r = await mutatePractice({
      kind: "session",
      date: "2020-01-01",
      emotion: "Calm",
    });
    expect(r.error).toMatch(/date changed/);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
  it("reports conflicts without claiming save success", async () => {
    mocks.rpc.mockResolvedValue({ error: { code: "40001" } });
    const r = await mutatePractice({
      kind: "task",
      date: localDate(),
      task: "Check the economic calendar",
      done: true,
      revision: 0,
      id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    });
    expect(r.error).toMatch(/changed elsewhere/);
    expect(r.success).toBeUndefined();
    expect(mocks.accountWorkspace).not.toHaveBeenCalled();
  });
  it("reports acknowledged write plus refresh failure distinctly", async () => {
    mocks.accountWorkspace.mockRejectedValue(new Error("offline"));
    const r = await mutatePractice({
      kind: "session",
      date: localDate(),
      emotion: "Calm",
    });
    expect(r.error).toMatch(/write was acknowledged/);
    expect(r.success).toBeUndefined();
  });
  it("does not accept live-mode or owner input in onboarding", async () => {
    const r = await completeOnboarding({
      startDate: localDate(),
      timezone: "Africa/Nairobi",
      availableMinutes: 90,
      capitalKes: null,
      mode: "live",
    });
    expect(r.error).toBeTruthy();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
