import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  authConfig: vi.fn(),
  createServerClient: vi.fn(),
  cookies: vi.fn(),
  redirect: vi.fn(),
  getUser: vi.fn(),
  getSession: vi.fn(),
}));
vi.mock("server-only", () => ({}));
vi.mock("@supabase/ssr", () => ({
  createServerClient: mocks.createServerClient,
}));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("@/lib/auth/config", () => ({ authConfig: mocks.authConfig }));
import { requireUser } from "../src/lib/auth/server";
describe("server-side identity verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.authConfig.mockReturnValue({
      url: "https://example.supabase.co",
      key: "publishable",
    });
    mocks.cookies.mockResolvedValue({ getAll: () => [], set: vi.fn() });
    mocks.createServerClient.mockReturnValue({
      auth: { getUser: mocks.getUser, getSession: mocks.getSession },
    });
    mocks.redirect.mockImplementation((url: string) => {
      throw new Error("redirect:" + url);
    });
  });
  it("rejects a stale session even if client session data exists", async () => {
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: "stale-user" } } },
    });
    mocks.getUser.mockResolvedValue({
      data: { user: null },
      error: { message: "revoked" },
    });
    await expect(requireUser()).rejects.toThrow("redirect:/welcome");
    expect(mocks.getSession).not.toHaveBeenCalled();
  });
  it("returns only the server-verified user", async () => {
    mocks.getUser.mockResolvedValue({
      data: { user: { id: "verified-user" } },
      error: null,
    });
    expect((await requireUser()).user.id).toBe("verified-user");
    expect(
      mocks.createServerClient.mock.calls[0][2].cookieOptions,
    ).toMatchObject({ httpOnly: true, sameSite: "lax" });
  });
  it("redirects without creating a client when configuration is missing", async () => {
    mocks.authConfig.mockReturnValue(null);
    await expect(requireUser()).rejects.toThrow("redirect:/welcome");
    expect(mocks.createServerClient).not.toHaveBeenCalled();
  });
});
