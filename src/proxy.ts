import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { authConfig } from "@/lib/auth/config";
// Refresh only. Pages and server actions independently authorize every access.
export async function proxy(request: NextRequest) {
  const config = authConfig();
  const response = NextResponse.next({ request });
  response.headers.set("Cache-Control", "private, no-store");
  if (!config || request.nextUrl.pathname.startsWith("/preview"))
    return response;
  const client = createServerClient(config.url, config.key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(values) {
        values.forEach(({ name, value }) => request.cookies.set(name, value));
        values.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  await client.auth.getUser();
  const next = NextResponse.next({ request });
  response.cookies.getAll().forEach((cookie) => next.cookies.set(cookie));
  next.headers.set("Cache-Control", "private, no-store");
  return next;
}
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|offline.html|manifest.webmanifest|icons/).*)",
  ],
};
