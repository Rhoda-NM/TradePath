"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { completeOnboarding } from "@/app/practice-actions";
import { timezones, type Profile } from "@/lib/practice/model";
import { localDate } from "@/lib/trading";
export default function Onboarding({ profile }: { profile?: Profile | null }) {
  const router = useRouter();
  const [startDate, setStartDate] = useState(
      profile?.start_date || localDate(),
    ),
    [timezone, setTimezone] = useState(profile?.timezone || "Africa/Nairobi"),
    [minutes, setMinutes] = useState(profile?.available_minutes || 90),
    [capital, setCapital] = useState(profile?.capital_kes?.toString() || ""),
    [pending, setPending] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setPending(true);
        setError("");
        try {
          const result = await completeOnboarding({
            startDate,
            timezone,
            availableMinutes: minutes,
            capitalKes: capital === "" ? null : Number(capital),
          });
          if (result.error) setError(result.error);
          else {
            router.replace("/today");
            router.refresh();
          }
        } catch {
          setError(
            "Connection lost. Your preferences were not confirmed. Please retry.",
          );
        } finally {
          setPending(false);
        }
      }}
    >
      <label>
        Curriculum start date
        <input
          type="date"
          required
          min="2020-01-01"
          max="2100-01-01"
          readOnly={!!profile}
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
        />
      </label>
      <label>
        Timezone
        <select value={timezone} onChange={(e) => setTimezone(e.target.value)}>
          {timezones.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </label>
      <label>
        Daily time budget
        <select
          value={minutes}
          onChange={(e) => setMinutes(Number(e.target.value))}
        >
          {[60, 90, 120].map((m) => (
            <option value={m} key={m}>
              {m} minutes
            </option>
          ))}
        </select>
      </label>
      <label>
        Optional learning capital (KES)
        <input
          type="number"
          min="0"
          max="100000000"
          step="0.01"
          value={capital}
          onChange={(e) => setCapital(e.target.value)}
        />
      </label>
      <div className="callout">
        Demo only · EUR/USD · H4H1-v1 experimental rules. Your six phases
        advance on evidence. No live orders or broker credentials.
      </div>
      {error && <p role="alert">{error}</p>}
      <button className="button primary" disabled={pending}>
        {pending
          ? "Saving…"
          : profile
            ? "Save preferences"
            : "Create my learning plan"}
      </button>
    </form>
  );
}
