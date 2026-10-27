import { serverClient } from "@/lib/auth/server";
import { authConfig } from "@/lib/auth/config";
import { z } from "zod";
const noStore = { "Cache-Control": "private, no-store" };
function error(message: string, status: number) {
  return Response.json({ error: message }, { status, headers: noStore });
}
async function identity() {
  if (!authConfig()) return null;
  const client = await serverClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  return error || !user ? null : { client, user };
}
function imageType(bytes: Uint8Array) {
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)
    return { type: "image/jpeg", ext: "jpg" };
  if (
    bytes
      .slice(0, 8)
      .every((v, i) => v === [137, 80, 78, 71, 13, 10, 26, 10][i]) &&
    bytes.length > 8
  )
    return { type: "image/png", ext: "png" };
  if (
    new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP"
  )
    return { type: "image/webp", ext: "webp" };
  return null;
}
export async function POST(request: Request) {
  const auth = await identity();
  if (!auth) return error("Sign in to upload.", 401);
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return error("Cross-origin upload denied.", 403);
  if (Number(request.headers.get("content-length")) > 5300000)
    return error("Choose an image under 5 MB.", 413);
  let form: FormData;
  try {
    const reader = request.body?.getReader();
    if (!reader) return error("Invalid upload.", 400);
    const bytes = new Uint8Array(5300000);
    let length = 0;
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      if (length + chunk.value.length > bytes.length) {
        await reader.cancel();
        return error("Choose an image under 5 MB.", 413);
      }
      bytes.set(chunk.value, length);
      length += chunk.value.length;
    }
    form = await new Response(bytes.slice(0, length), {
      headers: { "Content-Type": request.headers.get("content-type") || "" },
    }).formData();
  } catch {
    return error("Invalid upload.", 400);
  }
  const parsed = z
    .object({ type: z.enum(["setup", "trade"]), parent: z.uuid() })
    .safeParse({ type: form.get("type"), parent: form.get("parent") });
  const file = form.get("file");
  if (
    !parsed.success ||
    !(file instanceof File) ||
    file.size === 0 ||
    file.size > 5242880
  )
    return error("Choose a PNG, JPEG or WebP image under 5 MB.", 400);
  const bytes = new Uint8Array(await file.arrayBuffer());
  const detected = imageType(bytes);
  if (!detected || detected.type !== file.type)
    return error("The file is not a supported image.", 400);
  const { client, user } = auth;
  const { type, parent } = parsed.data;
  const { data: owned, error: parentError } = await client
    .from(type === "setup" ? "setups" : "trades")
    .select("id")
    .eq("id", parent)
    .eq("user_id", user.id)
    .maybeSingle();
  if (parentError || !owned) return error("Journal record not found.", 404);
  const id = crypto.randomUUID(),
    path = `${user.id}/${type}/${parent}/${id}.${detected.ext}`;
  const uploaded = await client.storage
    .from("tradepath-journal")
    .upload(path, bytes, { contentType: detected.type, upsert: false });
  if (uploaded.error)
    return error(
      "Upload was not confirmed. Retry after checking the connection and storage setup.",
      503,
    );
  const attached = await client.rpc("attach_journal_screenshot", {
    p_id: id,
    p_type: type,
    p_parent: parent,
    p_path: path,
    p_content_type: detected.type,
    p_bytes: bytes.length,
  });
  if (attached.error) {
    await client.storage.from("tradepath-journal").remove([path]);
    return error("The image could not be attached. Please retry.", 503);
  }
  return Response.json({ id }, { headers: noStore });
}
export async function GET(request: Request) {
  const auth = await identity();
  if (!auth) return error("Sign in to view screenshots.", 401);
  const parsed = z
    .uuid()
    .safeParse(new URL(request.url).searchParams.get("id"));
  if (!parsed.success) return error("Image not found.", 404);
  const { data: row, error: missing } = await auth.client
    .from("screenshots")
    .select("storage_path,content_type")
    .eq("id", parsed.data)
    .eq("user_id", auth.user.id)
    .maybeSingle();
  if (missing || !row) return error("Image not found.", 404);
  const { data, error: downloadError } = await auth.client.storage
    .from("tradepath-journal")
    .download(row.storage_path);
  if (downloadError || !data) return error("Image unavailable.", 404);
  return new Response(data, {
    headers: {
      ...noStore,
      "Content-Type": row.content_type,
      "X-Content-Type-Options": "nosniff",
      "Content-Disposition": "inline",
    },
  });
}
