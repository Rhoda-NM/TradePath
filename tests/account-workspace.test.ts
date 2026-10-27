import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  redirect: vi.fn(),
  rows: {} as Record<string, unknown[]>,
  failure: "",
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/auth/server", () => ({ requireUser: mocks.requireUser }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
import { accountWorkspace } from "../src/lib/practice/server";
import { localDate } from "../src/lib/trading";
describe("account loading", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.failure = "";
    mocks.rows = {
      profiles: [
        {
          timezone: "Africa/Nairobi",
          available_minutes: 90,
          start_date: "2026-10-26",
          capital_kes: null,
        },
      ],
      daily_sessions: [
        {
          id: "session-a",
          local_date: localDate(),
          session_status: "study_only",
          reflection: "I reviewed structure without taking a trade.",
        },
      ],
      daily_tasks: [
        {
          session_id: "session-a",
          task_code: "Check the economic calendar",
          state: "done",
          revision: 3,
        },
      ],
      no_trade_decisions: [
        {
          id: "decision-a",
          session_id: "session-a",
          reason: "No qualifying setup",
          notes: "Waited for a closed candle",
        },
      ],
      curriculum_phases: [],
    };
    mocks.from.mockImplementation((table: string) => {
      const result = () => ({
        data: mocks.rows[table],
        error: mocks.failure === table ? { message: "unavailable" } : null,
      });
      const query = {
        select: vi.fn(),
        eq: vi.fn(),
        order: vi.fn(),
        range: vi.fn(),
        maybeSingle: vi.fn(),
        then: (resolve: (value: unknown) => void) => resolve(result()),
      };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      query.order.mockReturnValue(query);
      query.range.mockReturnValue(query);
      query.maybeSingle.mockImplementation(async () => ({
        ...result(),
        data: mocks.rows[table]?.[0] || null,
      }));
      return query;
    });
    mocks.requireUser.mockResolvedValue({
      client: { from: mocks.from, rpc: mocks.rpc },
      user: { id: "verified-user" },
    });
    mocks.rpc.mockResolvedValue({ error: null });
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error("redirect:" + url);
    });
  });
  it("maps evidence to its local date and preserves task revisions", async () => {
    const account = await accountWorkspace();
    const date = localDate();
    expect(account.data.days[date]).toEqual(["Check the economic calendar"]);
    expect(account.revisions[`${date}:Check the economic calendar`]).toBe(3);
    expect(account.data.decisions[0].date).toBe(date);
    expect(account.data.sessions[date]).toBe("study_only");
    expect(account.data.remarks[date]).toBe(
      "I reviewed structure without taking a trade.",
    );
    expect(mocks.rpc).toHaveBeenCalledWith("ensure_practice_day", {
      p_date: date,
    });
  });
  it("never replaces an unavailable table with a successful empty workspace", async () => {
    mocks.failure = "daily_tasks";
    await expect(accountWorkspace()).rejects.toThrow(
      "Could not load your account records",
    );
  });
  it("sends first-time users to onboarding", async () => {
    mocks.rows.profiles = [];
    await expect(accountWorkspace()).rejects.toThrow("redirect:/onboarding");
    expect(mocks.rpc).not.toHaveBeenCalled();
  });
});
