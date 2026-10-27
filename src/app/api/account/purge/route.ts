import { timingSafeEqual } from "node:crypto";
import { adminClient, deletionConfigured } from "@/lib/account/admin";
import { purgeAccount } from "@/lib/account/purge";
export const maxDuration = 60;
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET,
    actual = request.headers.get("authorization") || "",
    expected = `Bearer ${secret}`;
  if (
    !secret ||
    Buffer.byteLength(actual) !== Buffer.byteLength(expected) ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(expected))
  )
    return Response.json(
      { error: "Unauthorized" },
      { status: 401, headers: { "Cache-Control": "no-store" } },
    );
  if (!deletionConfigured())
    return Response.json({ error: "Worker not configured" }, { status: 503 });
  const admin = adminClient();
  const jobs = await admin.rpc("deletion_jobs");
  if (jobs.error || !Array.isArray(jobs.data))
    return Response.json({ error: "Queue unavailable" }, { status: 503 });
  let complete = 0;
  for (const id of jobs.data) {
    try {
      if (await purgeAccount(admin, id)) complete++;
    } catch {
      /* Durable job remains for the next run. */
    }
  }
  return Response.json(
    { processed: jobs.data.length, complete },
    { headers: { "Cache-Control": "no-store" } },
  );
}
