"use server";
import { z } from "zod";
import { appOrigin } from "@/lib/auth/origin";
import { serverClient } from "@/lib/auth/server";
import { authConfig } from "@/lib/auth/config";
export async function requestMagicLink(raw: unknown) {
  const parsed = z
    .object({ email: z.email().max(254) })
    .strict()
    .safeParse(raw);
  if (!parsed.success) return { error: "Enter a valid email address." };
  if (!authConfig()) return { error: "Account sign-in is not configured yet." };
  try {
    const client = await serverClient();
    const { error } = await client.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: new URL("/auth/callback", appOrigin()).href,
      },
    });
    if (error)
      return {
        error: "Unable to send a sign-in link. Wait a minute and try again.",
      };
    return { success: true };
  } catch {
    return { error: "Sign-in is temporarily unavailable. Please try again." };
  }
}
export async function signOut() {
  try {
    const client = await serverClient();
    const { error } = await client.auth.signOut({ scope: "local" });
    if (error) return { error: "Could not sign out. Please retry." };
    return { success: true };
  } catch {
    return { error: "Could not sign out. Please retry." };
  }
}
