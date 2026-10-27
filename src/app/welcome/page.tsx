import Link from "next/link";
import { redirect } from "next/navigation";
import { authConfig } from "@/lib/auth/config";
import { serverClient } from "@/lib/auth/server";
import SignIn from "@/components/sign-in";
export const dynamic = "force-dynamic";
export default async function Welcome({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reauth?: string }>;
}) {
  const { error, reauth } = await searchParams;
  const configured = !!authConfig();
  if (configured) {
    const client = await serverClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (user && reauth !== "1") redirect("/today");
  }
  return (
    <main className="auth-page">
      <Link href="/welcome" className="auth-brand">
        ↗ TradePath.
      </Link>
      <section className="panel auth-card">
        <span className="eyebrow">PROCESS BEFORE PROFIT</span>
        <h1>
          A little practice.
          <br />A stronger process.
        </h1>
        <p>
          Sign in with a link sent to your email. No password or broker
          credentials.
        </p>
        {error === "magic_link" && (
          <p role="alert">
            This sign-in link could not be verified. It may have expired,
            already been used, or opened in a different browser. Request a fresh
            link and open it in this browser.
          </p>
        )}
        {configured ? (
          <SignIn />
        ) : (
          <div className="callout">
            Account sign-in awaits Supabase configuration. Add the project URL
            and publishable key to .env.local, then restart the app. The
            existing device workspace is available below.
          </div>
        )}
        <Link href="/guide" className="text-link dark-link">
          New here? Read the walkthrough →
        </Link>
        <Link href="/preview/today" className="text-link dark-link">
          Open device-only practice →
        </Link>
      </section>
    </main>
  );
}
