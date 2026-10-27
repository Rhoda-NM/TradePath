"use client";
import { useEffect, useState } from "react";
export default function Pwa() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    if ("serviceWorker" in navigator && window.isSecureContext)
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch(() => {
          /* Online app still works if installation is unavailable. */
        });
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return offline ? (
    <div className="connection-banner" role="status">
      Offline · Account saves need a connection. Changes are not queued. Keep
      unsaved forms open until you reconnect.
    </div>
  ) : null;
}
export function InstallGuide() {
  return (
    <section className="info-block">
      <h2>Install TradePath</h2>
      <p>
        On Android Chrome, open the browser menu and choose “Install app” or
        “Add to Home screen”. On iPhone, use Share → Add to Home Screen.
        Installation requires HTTPS (or localhost for development).
      </p>
      <p>
        The offline page offers read-only practice guidance. Private account
        records are not stored in the offline cache, and offline writes are not
        queued.
      </p>
    </section>
  );
}
