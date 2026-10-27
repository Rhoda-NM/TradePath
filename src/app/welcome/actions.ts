"use server";
import { z } from "zod";
import { emailError } from "@/lib/auth/email-errors";
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
  let callback: string;
  try {
    callback = new URL("/auth/callback", appOrigin()).href;
  } catch {
    return {
      error:
        "Sign-in callback is not configured. Set APP_URL to this app’s origin and restart the server.",
    };
  }
  try {
    const client = await serverClient();
    const { error } = await client.auth.signInWithOtp({
      email: parsed.data.email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: callback,
      },
    });
    if (error) return { error: emailError(error) };
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
