import { beforeEach, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  rpc: vi.fn(),
  revalidate: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ requireUser: mocks.auth }));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidate }));
import { saveEquity } from "../src/app/insights-actions";
const input = {
  operation: "11111111-1111-4111-8111-111111111111",
  id: null,
  revision: 0,
  mode: "demo",
  account: "main",
  at: "2026-01-01T00:00:00Z",
  balance: 1000,
  equity: 950,
  deposits: 0,
  withdrawals: 0,
  confirmed: true,
  notes: "Broker statement",
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({
    client: { rpc: mocks.rpc },
    user: { id: "verified" },
  });
  mocks.rpc.mockResolvedValue({ error: null });
});
it("requires an authenticated session independently of the page", async () => {
  mocks.auth.mockRejectedValue(new Error("Sign in"));
  await expect(saveEquity(input)).rejects.toThrow("Sign in");
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("rejects owner spoofing before writes", async () => {
  expect((await saveEquity({ ...input, user_id: "other" })).error).toBeTruthy();
  expect(mocks.rpc).not.toHaveBeenCalled();
});
it("saves only validated fields with owner derived by the RPC", async () => {
  expect((await saveEquity(input)).success).toBe(true);
  const args = mocks.rpc.mock.calls[0][1];
  expect(args.p_operation).toBe(input.operation);
  expect(args.p_equity).toBe(950);
  expect(args.user_id).toBeUndefined();
  expect(mocks.revalidate).toHaveBeenCalledWith("/insights");
});
it("never reports success or invalidates after a conflict", async () => {
  mocks.rpc.mockResolvedValue({ error: { code: "40001" } });
  expect((await saveEquity(input)).error).toContain("changed elsewhere");
  expect(mocks.revalidate).not.toHaveBeenCalled();
});
