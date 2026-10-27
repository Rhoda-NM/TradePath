import { beforeEach, it, expect, vi } from "vitest";
import { commandSchema, storedSchema } from "../src/lib/practice/model";
import { localDate } from "../src/lib/trading";
const mocks = vi.hoisted(() => ({
  requireUser: vi.fn(),
  rpc: vi.fn(),
  workspace: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ requireUser: mocks.requireUser }));
vi.mock("@/lib/practice/server", () => ({ accountWorkspace: mocks.workspace }));
import { mutatePractice } from "../src/app/practice-actions";
beforeEach(() => {
  vi.resetAllMocks();
  mocks.requireUser.mockResolvedValue({
    user: { id: "verified-user" },
    client: {
      rpc: mocks.rpc,
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { timezone: "Africa/Nairobi" },
              error: null,
            }),
          }),
        }),
      }),
    },
  });
  mocks.rpc.mockResolvedValue({ error: null });
  mocks.workspace.mockResolvedValue({
    data: { remarks: { [localDate()]: "My reflection" } },
  });
});
it("validates remarks, expected text and forbidden owner fields", () => {
  const value = {
    kind: "remarks",
    date: localDate(),
    notes: "My reflection",
    expectedNotes: "",
  };
  expect(commandSchema.safeParse(value).success).toBe(true);
  expect(
    commandSchema.safeParse({ ...value, notes: "x".repeat(6001) }).success,
  ).toBe(false);
  expect(commandSchema.safeParse({ ...value, user_id: "victim" }).success).toBe(
    false,
  );
});
it("keeps older device workspaces readable", () =>
  expect(
    storedSchema.parse({ version: 1, days: {}, sessions: {}, decisions: [] })
      .remarks,
  ).toEqual({}));
it("saves through the owner-derived RPC and refreshes the workspace", async () => {
  const result = await mutatePractice({
    kind: "remarks",
    date: localDate(),
    notes: "My reflection",
    expectedNotes: "",
  });
  expect(result.success).toBe(true);
  expect(mocks.rpc).toHaveBeenCalledWith("save_daily_remarks", {
    p_date: localDate(),
    p_notes: "My reflection",
    p_expected_notes: "",
  });
});
it("reports a conflict without claiming that remarks were saved", async () => {
  mocks.rpc.mockResolvedValue({ error: { code: "40001" } });
  const result = await mutatePractice({
    kind: "remarks",
    date: localDate(),
    notes: "My reflection",
    expectedNotes: "",
  });
  expect(result.error).toMatch(/remarks changed elsewhere/);
  expect(mocks.workspace).not.toHaveBeenCalled();
});
