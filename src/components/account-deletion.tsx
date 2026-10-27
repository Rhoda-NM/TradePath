"use client";
import { useState } from "react";
export default function AccountDeletion({
  configured,
}: {
  configured: boolean;
}) {
  const [confirmation, setConfirmation] = useState(""),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function remove() {
    if (busy || confirmation !== "DELETE MY ACCOUNT") return;
    if (!navigator.onLine) {
      setMessage("Reconnect before requesting deletion.");
      return;
    }
    setBusy(true);
    setMessage("Requesting deletion…");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      const result = await response.json();
      if (result.deleted) {
        sessionStorage.clear();
        localStorage.setItem("tradepath.auth-event", String(Date.now()));
        window.location.replace("/welcome");
      } else
        setMessage(
          result.error ||
            result.message ||
            "Deletion was not confirmed. Retry.",
        );
    } catch {
      setMessage(
        "Connection interrupted. Deletion may be pending. Reconnect and retry to confirm.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="account-deletion">
      <h2>Delete your account</h2>
      <p>
        Download your export first. Deletion permanently removes your sign-in,
        journal, learning records, equity history, audit records and stored
        screenshots. Account writes stop once deletion is queued. This cannot be
        undone.
      </p>
      <p>
        Active app records and files are removed; provider backups may remain
        until their configured retention expires. Previously downloaded exports
        and independent browser preview records are not removed from other
        devices.
      </p>
      <a className="text-link dark-link" href="/api/export" download>
        Download account export
      </a>
      {!configured ? (
        <p>
          Deletion is awaiting server configuration. Contact the app
          administrator to enable the deletion worker.
        </p>
      ) : (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void remove();
          }}
        >
          <p>Use a fresh magic-link sign-in within the last 15 minutes.</p>
          <label>
            Type DELETE MY ACCOUNT
            <input
              value={confirmation}
              autoComplete="off"
              onChange={(event) => setConfirmation(event.target.value)}
              maxLength={17}
            />
          </label>
          <button
            className="button primary"
            disabled={busy || confirmation !== "DELETE MY ACCOUNT"}
          >
            {busy ? "Processing…" : "Permanently delete my account"}
          </button>
        </form>
      )}
      <p role="status">{message}</p>
    </section>
  );
}
