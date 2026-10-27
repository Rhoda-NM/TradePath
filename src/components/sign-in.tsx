"use client";
import { useState } from "react";
import { requestMagicLink } from "@/app/welcome/actions";
export default function SignIn() {
  const [email, setEmail] = useState(""),
    [sent, setSent] = useState(false),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await requestMagicLink({ email });
      if (result.error) setError(result.error);
      else setSent(true);
    } catch {
      setError("Connection lost. Please try again.");
    } finally {
      setPending(false);
    }
  }
  return (
    <form onSubmit={submit}>
      <label>
        Email address
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          disabled={sent || pending}
          onChange={(e) => setEmail(e.target.value.trim())}
        />
      </label>
      {sent && (
        <p role="status">
          Check your email for your sign-in link. Open it in this same browser
          on this device to continue.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      {!sent && (
        <button className="button primary" disabled={pending}>
          {pending ? "Sending…" : "Email me a sign-in link"}
        </button>
      )}
      {sent && (
        <button
          type="button"
          className="button secondary"
          onClick={() => {
            setSent(false);
            setError("");
          }}
        >
          Change email / request a new link
        </button>
      )}
    </form>
  );
}
