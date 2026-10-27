import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { authConfig } from "./config";
export async function serverClient() {
  const config = authConfig();
  if (!config) throw new Error("Supabase is not configured.");
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    },
    cookies: {
      getAll: () => jar.getAll(),
      setAll(values) {
        try {
          values.forEach(({ name, value, options }) =>
            jar.set(name, value, options),
          );
        } catch {
          /* Server Components are read-only; proxy refreshes cookies. */
        }
      },
    },
  });
}
export async function requireUser() {
  if (!authConfig()) redirect("/welcome");
  const client = await serverClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) redirect("/welcome");
  return { client, user };
}
