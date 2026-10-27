import { beforeEach, describe, it, expect, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  serverClient: vi.fn(),
  authConfig: vi.fn(),
  appOrigin: vi.fn(),
  signInWithOtp: vi.fn(),
  signOut: vi.fn(),
}));
vi.mock("@/lib/auth/server", () => ({ serverClient: mocks.serverClient }));
vi.mock("@/lib/auth/config", () => ({ authConfig: mocks.authConfig }));
vi.mock("@/lib/auth/origin", () => ({ appOrigin: mocks.appOrigin }));
import { requestMagicLink, signOut } from "../src/app/welcome/actions";
describe("magic-link actions", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.authConfig.mockReturnValue({
      url: "https://example.supabase.co",
      key: "publishable",
    });
    mocks.appOrigin.mockReturnValue("https://tradepath.example");
    mocks.serverClient.mockResolvedValue({ auth: mocks });
    mocks.signInWithOtp.mockResolvedValue({ error: null });
    mocks.signOut.mockResolvedValue({ error: null });
  });
  it("validates before requesting an email", async () => {
    expect((await requestMagicLink({ email: "invalid" })).error).toBeTruthy();
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });
  it("fails closed without configuration", async () => {
    mocks.authConfig.mockReturnValue(null);
    expect(
      (await requestMagicLink({ email: "learner@example.com" })).error,
    ).toMatch(/not configured/);
    expect(mocks.serverClient).not.toHaveBeenCalled();
  });
  it("uses the trusted callback origin and PKCE-capable provider method", async () => {
    expect(
      (await requestMagicLink({ email: "learner@example.com" })).success,
    ).toBe(true);
    expect(mocks.signInWithOtp).toHaveBeenCalledWith({
      email: "learner@example.com",
      options: {
        shouldCreateUser: true,
        emailRedirectTo: "https://tradepath.example/auth/callback",
      },
    });
  });
  it("rejects client-supplied redirects", async () => {
    expect(
      (
        await requestMagicLink({
          email: "learner@example.com",
          redirectTo: "https://evil.example",
        })
      ).error,
    ).toBeTruthy();
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });
  it("does not disclose provider diagnostics", async () => {
    mocks.signInWithOtp.mockResolvedValue({
      error: { message: "private diagnostic" },
    });
    expect(
      (await requestMagicLink({ email: "learner@example.com" })).error,
    ).not.toContain("private");
  });
  it("does not send when trusted origin configuration is invalid", async () => {
    mocks.appOrigin.mockImplementation(() => {
      throw new Error("config");
    });
    expect(
      (await requestMagicLink({ email: "learner@example.com" })).error,
    ).toBeTruthy();
    expect(mocks.signInWithOtp).not.toHaveBeenCalled();
  });
  it("signs out only this device and reports failures", async () => {
    expect((await signOut()).success).toBe(true);
    expect(mocks.signOut).toHaveBeenCalledWith({ scope: "local" });
    mocks.signOut.mockResolvedValue({ error: { message: "network" } });
    expect((await signOut()).error).toBeTruthy();
  });
});
