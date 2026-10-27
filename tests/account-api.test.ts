import { beforeEach, it, expect, vi } from "vitest";
const m = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  adminRpc: vi.fn(),
  purge: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({
  serverClient: async () => ({
    auth: { getUser: m.getUser, signOut: m.signOut },
    rpc: m.rpc,
  }),
}));
vi.mock("@/lib/auth/config", () => ({ authConfig: () => ({}) }));
vi.mock("@/lib/auth/origin", () => ({
  appOrigin: () => "https://example.com",
}));
vi.mock("@/lib/account/admin", () => ({
  deletionConfigured: () => true,
  adminClient: () => ({ rpc: m.adminRpc }),
}));
vi.mock("@/lib/account/purge", () => ({ purgeAccount: m.purge }));
import { DELETE } from "../src/app/api/account/route";
const request = (
  body: unknown = { confirmation: "DELETE MY ACCOUNT" },
  origin = "https://example.com",
) =>
  new Request("https://example.com/api/account", {
    method: "DELETE",
    headers: { origin, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
beforeEach(() => {
  vi.resetAllMocks();
  m.getUser.mockResolvedValue({
    data: { user: { id: "verified" } },
    error: null,
  });
  m.rpc.mockResolvedValue({ data: true, error: null });
  m.adminRpc.mockResolvedValue({ error: null });
  m.purge.mockResolvedValue(true);
  m.signOut.mockResolvedValue({ error: null });
});
it("rejects CSRF before accessing identity", async () => {
  expect((await DELETE(request(undefined, "https://evil.test"))).status).toBe(
    403,
  );
  expect(m.getUser).not.toHaveBeenCalled();
});
it("requires signed-in user and explicit exact confirmation", async () => {
  expect(
    (
      await DELETE(
        request({ confirmation: "DELETE MY ACCOUNT", userId: "other" }),
      )
    ).status,
  ).toBe(400);
  expect(m.adminRpc).not.toHaveBeenCalled();
  m.getUser.mockResolvedValue({ data: { user: null }, error: null });
  expect((await DELETE(request())).status).toBe(401);
});
it("requires current-session recent authentication", async () => {
  m.rpc.mockResolvedValue({ data: false, error: null });
  expect((await DELETE(request())).status).toBe(403);
  expect(m.adminRpc).not.toHaveBeenCalled();
});
it("derives owner from verified identity and confirms only completed cleanup", async () => {
  const response = await DELETE(request());
  expect(response.status).toBe(200);
  expect(m.adminRpc).toHaveBeenCalledWith("queue_account_deletion", {
    p_user: "verified",
  });
  expect((await response.json()).deleted).toBe(true);
  expect(response.headers.get("clear-site-data")).toContain("storage");
});
it("keeps interruption explicitly pending and does not clear session", async () => {
  m.purge.mockResolvedValue(false);
  const response = await DELETE(request());
  expect(response.status).toBe(202);
  expect((await response.json()).deleted).toBeUndefined();
  expect(m.signOut).not.toHaveBeenCalled();
});
