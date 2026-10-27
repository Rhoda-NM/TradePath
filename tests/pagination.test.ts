import { it, expect } from "vitest";
import { collectRows } from "../src/lib/practice/pagination";
it("loads records beyond the provider default row cap", async () => {
  const rows = Array.from({ length: 1203 }, (_, i) => ({ id: i }));
  const result = await collectRows(async (from, to) => ({
    data: rows.slice(from, to + 1),
    error: null,
  }));
  expect(result.data).toHaveLength(1203);
  expect(result.data[1202].id).toBe(1202);
});
it("does not return partial history as a successful export", async () => {
  const result = await collectRows(
    async (from) =>
      from
        ? { data: null, error: new Error("connection lost") }
        : { data: [1, 2], error: null },
    2,
  );
  expect(result.error).toBeTruthy();
  expect(result.data).toEqual([]);
});
