import { serverClient } from "@/lib/auth/server";
import { authConfig } from "@/lib/auth/config";
import { adminClient, deletionConfigured } from "@/lib/account/admin";
import { purgeAccount } from "@/lib/account/purge";
import { appOrigin } from "@/lib/auth/origin";
const headers = { "Cache-Control": "private, no-store" };
export async function DELETE(request: Request) {
  if (request.headers.get("origin") !== appOrigin())
    return Response.json(
      { error: "Cross-origin request denied." },
      { status: 403, headers },
    );
  if (!authConfig() || !deletionConfigured())
    return Response.json(
      {
        error:
          "Account deletion requires server configuration. Contact the administrator.",
      },
      { status: 503, headers },
    );
  if (Number(request.headers.get("content-length")) > 1000)
    return Response.json(
      { error: "Invalid confirmation." },
      { status: 400, headers },
    );
  const client = await serverClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user)
    return Response.json({ error: "Sign in first." }, { status: 401, headers });
  let body;
  try {
    const reader = request.body?.getReader();
    if (!reader) throw new Error("body");
    let text = "";
    const decoder = new TextDecoder();
    let bytes = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.length;
      if (bytes > 1000) {
        await reader.cancel();
        throw new Error("size");
      }
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    body = JSON.parse(text);
  } catch {
    return Response.json(
      { error: "Invalid confirmation." },
      { status: 400, headers },
    );
  }
  if (
    body?.confirmation !== "DELETE MY ACCOUNT" ||
    Object.keys(body).length !== 1
  )
    return Response.json(
      { error: "Type DELETE MY ACCOUNT to confirm." },
      { status: 400, headers },
    );
  // The database verifies this specific signed session, not user-wide login time.
  const recent = await client.rpc("recent_account_sign_in");
  if (recent.error || recent.data !== true)
    return Response.json(
      {
        error:
          "Use a fresh magic-link sign-in, then confirm deletion within 15 minutes.",
      },
      { status: 403, headers },
    );
  try {
    const admin = adminClient();
    const queued = await admin.rpc("queue_account_deletion", {
      p_user: user.id,
    });
    if (queued.error)
      return Response.json(
        { error: "Deletion was not queued. Check workspace setup and retry." },
        { status: 503, headers },
      );
    const done = await purgeAccount(admin, user.id);
    if (!done)
      return Response.json(
        {
          pending: true,
          message:
            "Deletion is queued. Account writes are locked. Retry here or the configured deletion worker will continue.",
        },
        { status: 202, headers },
      );
    await client.auth.signOut({ scope: "local" }).catch(() => undefined);
    return Response.json(
      { deleted: true },
      {
        headers: {
          ...headers,
          "Clear-Site-Data": '"cache", "cookies", "storage"',
        },
      },
    );
  } catch {
    return Response.json(
      {
        pending: true,
        message:
          "Deletion may be queued. Retry to confirm; no completion is claimed.",
      },
      { status: 202, headers },
    );
  }
}
