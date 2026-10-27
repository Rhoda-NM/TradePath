"use client";
import { useState, useRef } from "react";
export default function DailyRemarks({
  date,
  saved,
  account,
  onSave,
}: {
  date: string;
  saved: string;
  account: boolean;
  onSave: (notes: string, expectedNotes: string) => Promise<{ error?: string }>;
}) {
  const [entryDate] = useState(date);
  const [baseline, setBaseline] = useState(saved);
  const [notes, setNotes] = useState(saved),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const busy = useRef(false);
  return (
    <section className="daily-remarks" aria-labelledby="daily-remarks-title">
      <span className="eyebrow">YOUR DAILY JOURNAL</span>
      <h2 id="daily-remarks-title">A few remarks about today.</h2>
      <p>
        Capture what you noticed, how you felt, or what you learned—even if you
        didn’t trade.
      </p>
      {date !== entryDate && (
        <p role="status" className="callout">
          A new day has started. Copy any unsaved remarks before reloading to
          begin today’s entry.
        </p>
      )}
      <form
        onSubmit={async (event) => {
          event.preventDefault();
          if (busy.current || date !== entryDate) return;
          if (account && !navigator.onLine) {
            setMessage(
              "Offline: remarks have not been saved. Reconnect and retry.",
            );
            return;
          }
          busy.current = true;
          setPending(true);
          setMessage("Saving…");
          try {
            const result = await onSave(notes, baseline);
            if (!result.error) {
              setBaseline(notes.trim());
              setNotes(notes.trim());
            }
            setMessage(
              result.error ||
                (account
                  ? "Remarks saved to your account."
                  : "Remarks saved on this device."),
            );
          } catch {
            setMessage(
              "Connection interrupted. Your remarks are still in this form; retry to confirm the save.",
            );
          } finally {
            busy.current = false;
            setPending(false);
          }
        }}
      >
        <label htmlFor="daily-remarks">
          Journal remarks · {entryDate}
          <textarea
            id="daily-remarks"
            placeholder="What stood out today? What will you carry into the next session?"
            maxLength={6000}
            value={notes}
            disabled={pending}
            onChange={(event) => setNotes(event.target.value)}
          />
        </label>
        <div className="remarks-footer">
          <span>{notes.length} / 6000 characters</span>
          <button
            className="button primary"
            disabled={
              pending || date !== entryDate || notes.trim() === baseline
            }
          >
            {pending ? "Saving…" : "Save remarks"}
          </button>
        </div>
        <p className="remarks-status" role="status">
          {message ||
            (baseline
              ? "Your saved remarks are available in Journal."
              : "Optional. Remarks do not create a trade or automatically complete a task.")}
        </p>
      </form>
    </section>
  );
}
