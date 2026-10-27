import { afterEach, it, expect, vi } from "vitest";
import { appOrigin } from "../src/lib/auth/origin";
afterEach(() => vi.unstubAllEnvs());
it("uses localhost for local development", () => {
  vi.stubEnv("NODE_ENV", "development");
  vi.stubEnv("APP_URL", "");
  expect(appOrigin()).toBe("http://localhost:3000");
});
it("requires an explicit production origin", () => {
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("APP_URL", "");
  expect(() => appOrigin()).toThrow();
});
it("accepts HTTPS origins and alternate local ports", () => {
  for (const origin of ["https://tradepath.example", "http://localhost:3001"]) {
    vi.stubEnv("APP_URL", origin);
    expect(appOrigin()).toBe(origin);
  }
});
it("rejects external HTTP, credentials, paths and query redirects", () => {
  for (const origin of [
    "http://evil.example",
    "https://name:password@example.com",
    "https://example.com/path",
    "https://example.com?next=evil",
    "https://example.com#token",
  ]) {
    vi.stubEnv("APP_URL", origin);
    expect(() => appOrigin()).toThrow();
  }
});
