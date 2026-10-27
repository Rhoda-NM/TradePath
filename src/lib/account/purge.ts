import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
// A bounded, resumable pass. Storage API deletion removes actual file bytes;
// deleting storage.objects rows alone would orphan files.
export async function purgeAccount(admin: SupabaseClient, userId: string) {
  const { data: jobs, error: jobError } = await admin.rpc("deletion_jobs");
  if (jobError || !Array.isArray(jobs) || !jobs.includes(userId)) return false;
  for (let batch = 0; batch < 5; batch++) {
    const { data, error } = await admin.rpc("deletion_objects", {
      p_user: userId,
    });
    if (error || !Array.isArray(data)) return false;
    const paths = data.map((r: { name: string }) => r.name);
    if (paths.some((path) => !path.startsWith(userId + "/"))) return false;
    if (!paths.length) {
      const removed = await admin.auth.admin.deleteUser(userId);
      if (
        removed.error &&
        removed.error.code !== "user_not_found" &&
        removed.error.status !== 404
      )
        return false;
      const finish = await admin.rpc("finish_account_deletion", {
        p_user: userId,
      });
      return !finish.error;
    }
    const removed = await admin.storage.from("tradepath-journal").remove(paths);
    if (removed.error) return false;
  }
  return false;
}
