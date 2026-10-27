import { NextResponse, type NextRequest } from "next/server";
import { serverClient } from "@/lib/auth/server";
import { appOrigin } from "@/lib/auth/origin";
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const code = params.get("code");
  const flowId = params.get("sb_flow_id");
  // Supabase's default email verification link redirects here with a PKCE code.
  // The SDK reads the verifier from the HttpOnly cookie set by the email request.
  let destination = "/welcome?error=magic_link";
  if (!params.has("error") && code && code.length <= 2048) {
    try {
      const client = await serverClient();
      const { error } = await client.auth.exchangeCodeForSession(
        code,
        flowId ? { flowId } : undefined,
      );
      if (!error) destination = "/today";
    } catch {
      /* Never reflect provider errors, codes or tokens in the destination. */
    }
  }
  const response = NextResponse.redirect(new URL(destination, appOrigin()));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}
