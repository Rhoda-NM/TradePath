"use client";
import Link from "next/link";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="auth-page">
      <section className="panel auth-card">
        <h1>Your workspace is unavailable.</h1>
        <p>
          We couldn’t load your account. Your records have not been replaced
          with empty data. Check the connection and database setup, then retry.
        </p>
        <button onClick={reset} className="button primary">
          Try again
        </button>
        <Link href="/welcome" className="button secondary">
          Sign-in page
        </Link>
      </section>
    </main>
  );
}
