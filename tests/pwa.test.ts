import { expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import manifest from "../src/app/manifest";
function worker() {
  const listeners: Record<string, (event: unknown) => void> = {};
  const fetch = vi.fn().mockRejectedValue(new Error("offline"));
  const match = vi.fn().mockResolvedValue(new Response("Public offline page"));
  vm.runInNewContext(readFileSync("public/sw.js", "utf8"), {
    self: {
      addEventListener: (name: string, fn: (e: unknown) => void) =>
        (listeners[name] = fn),
      location: { origin: "https://example.com" },
    },
    fetch,
    caches: { match },
    URL,
    Response,
    Promise,
  });
  return { listeners, fetch, match };
}
it("has installable manifest and correctly sized PNG assets", () => {
  const m = manifest();
  expect(m.display).toBe("standalone");
  expect(m.start_url).toBe("/today");
  for (const icon of m.icons!) {
    const bytes = readFileSync("public" + icon.src);
    expect(bytes.subarray(1, 4).toString()).toBe("PNG");
    const size = Number(icon.sizes!.split("x")[0]);
    expect(bytes.readUInt32BE(16)).toBe(size);
    expect(bytes.readUInt32BE(20)).toBe(size);
  }
});
it("does not intercept mutations, private APIs or screenshot responses", () => {
  const w = worker();
  for (const [url, method] of [
    ["https://example.com/api/export", "GET"],
    ["https://example.com/api/screenshots?id=x", "GET"],
    ["https://example.com/today", "POST"],
    ["https://example.com/today?_rsc=x", "GET"],
  ]) {
    const respondWith = vi.fn();
    w.listeners.fetch({ request: { url, method, mode: "cors" }, respondWith });
    expect(respondWith).not.toHaveBeenCalled();
  }
  expect(w.match).not.toHaveBeenCalled();
});
it("falls back to public guidance for failed account navigation, without caching it", async () => {
  const w = worker();
  let result: Promise<Response> | undefined;
  w.listeners.fetch({
    request: {
      url: "https://example.com/journal",
      method: "GET",
      mode: "navigate",
    },
    respondWith: (value: Promise<Response>) => (result = value),
  });
  expect(await (await result!).text()).toBe("Public offline page");
  expect(w.match).toHaveBeenCalledWith("/offline.html");
});
