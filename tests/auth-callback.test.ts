import { beforeEach, describe, it, expect, vi } from "vitest";
import { NextRequest } from "next/server";
const mocks = vi.hoisted(() => ({ serverClient: vi.fn(), exchange: vi.fn() }));
vi.mock("@/lib/auth/server", () => ({ serverClient: mocks.serverClient }));
vi.mock("@/lib/auth/origin", () => ({
  appOrigin: () => "http://localhost:3000",
}));
import { GET } from "../src/app/auth/callback/route";
describe("magic-link callback", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.serverClient.mockResolvedValue({
      auth: { exchangeCodeForSession: mocks.exchange },
    });
    mocks.exchange.mockResolvedValue({ error: null });
  });
  it("exchanges the code and respects the PKCE flow identifier", async () => {
    const response = await GET(
      new NextRequest(
        "http://localhost:3000/auth/callback?code=test-code&sb_flow_id=test-flow",
      ),
    );
    expect(mocks.exchange).toHaveBeenCalledWith("test-code", {
      flowId: "test-flow",
    });
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/today",
    );
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("uses only the trusted destination even with an external next parameter", async () => {
    const response = await GET(
      new NextRequest(
        "http://untrusted.example/auth/callback?code=test-code&next=https://evil.example",
      ),
    );
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/today",
    );
  });
  it("returns an actionable failure for expired or unverifiable links", async () => {
    mocks.exchange.mockResolvedValue({
      error: { message: "private provider detail" },
    });
    const response = await GET(
      new NextRequest("http://localhost:3000/auth/callback?code=expired"),
    );
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/welcome?error=magic_link",
    );
  });
  it("does not exchange absent codes or provider error callbacks", async () => {
    for (const query of ["", "?error=access_denied&code=bad"]) {
      const r = await GET(
        new NextRequest("http://localhost:3000/auth/callback" + query),
      );
      expect(r.headers.get("location")).toContain("error=magic_link");
    }
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it("handles verifier-cookie or network failures without leaking codes", async () => {
    mocks.exchange.mockRejectedValue(new Error("secret"));
    const r = await GET(
      new NextRequest("http://localhost:3000/auth/callback?code=sensitive"),
    );
    expect(r.headers.get("location")).not.toContain("sensitive");
    expect(r.headers.get("location")).toContain("error=magic_link");
  });
});
