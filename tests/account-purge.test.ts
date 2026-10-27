import { expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { purgeAccount } from "../src/lib/account/purge";
import type { SupabaseClient } from "@supabase/supabase-js";
const user = "11111111-1111-4111-8111-111111111111";
function fixture(paths: string[][], storageError = false) {
  let index = 0;
  const rpc = vi.fn(async (name: string) => ({
    data:
      name === "deletion_jobs"
        ? [user]
        : name === "deletion_objects"
          ? (paths[index++] || []).map((name) => ({ name }))
          : null,
    error: null,
  }));
  const remove = vi.fn(async () => ({
    error: storageError ? { message: "offline" } : null,
  }));
  const deleteUser = vi.fn(async () => ({ error: null }));
  const admin = {
    rpc,
    storage: { from: () => ({ remove }) },
    auth: { admin: { deleteUser } },
  } as unknown as SupabaseClient;
  return { admin, rpc, remove, deleteUser };
}
it("removes stored bytes before Auth and confirms completion", async () => {
  const f = fixture([[user + "/setup/x/a.png"], []]);
  expect(await purgeAccount(f.admin, user)).toBe(true);
  expect(f.remove).toHaveBeenCalled();
  expect(f.deleteUser).toHaveBeenCalledWith(user);
  expect(f.remove.mock.invocationCallOrder[0]).toBeLessThan(
    f.deleteUser.mock.invocationCallOrder[0],
  );
  expect(f.rpc).toHaveBeenCalledWith("finish_account_deletion", {
    p_user: user,
  });
});
it("leaves a durable job when Storage fails and never deletes Auth", async () => {
  const f = fixture([[user + "/trade/x/a.png"]], true);
  expect(await purgeAccount(f.admin, user)).toBe(false);
  expect(f.deleteUser).not.toHaveBeenCalled();
  expect(f.rpc).not.toHaveBeenCalledWith("finish_account_deletion", {
    p_user: user,
  });
});
it("refuses an unexpected foreign path", async () => {
  const f = fixture([["other/trade/a.png"]]);
  expect(await purgeAccount(f.admin, user)).toBe(false);
  expect(f.remove).not.toHaveBeenCalled();
});
it("bounds cleanup work and resumes from remaining objects", async () => {
  const f = fixture(Array.from({ length: 6 }, () => [user + "/trade/a.png"]));
  expect(await purgeAccount(f.admin, user)).toBe(false);
  expect(f.remove).toHaveBeenCalledTimes(5);
  expect(f.deleteUser).not.toHaveBeenCalled();
});
it("does not act on an account without a queued request", async () => {
  const f = fixture([]);
  expect(await purgeAccount(f.admin, "other")).toBe(false);
  expect(f.deleteUser).not.toHaveBeenCalled();
});
