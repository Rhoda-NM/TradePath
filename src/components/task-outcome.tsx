"use client";
import { useRef, useState } from "react";
import { mutatePractice } from "@/app/practice-actions";
import type { PracticeCommand } from "@/lib/practice/model";
import type { accountWorkspace } from "@/lib/practice/server";
type AccountResult = Awaited<ReturnType<typeof accountWorkspace>>;
export default function TaskOutcome({
  date,
  task,
  revision,
  state,
  reason,
  onSaved,
  disabled,
}: {
  date: string;
  task: string;
  revision: number;
  state: string;
  reason: string;
  onSaved: (data: AccountResult) => void;
  disabled: boolean;
}) {
  const [outcome, setOutcome] = useState(state),
    [note, setNote] = useState(reason),
    [pending, setPending] = useState(false),
    [message, setMessage] = useState("");
  const operation = useRef("");
  return (
    <details className="task-outcome">
      <summary>
        Outcome:{" "}
        {state === "skipped"
          ? "Skipped with reason"
          : state === "missed"
            ? "Missed"
            : state === "done"
              ? "Done"
              : "Pending"}
      </summary>
      {state === "skipped" && <p>{reason}</p>}
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (pending || disabled) return;
          if (!navigator.onLine) {
            setMessage("Offline: no change saved.");
            return;
          }
          setPending(true);
          operation.current ||= crypto.randomUUID();
          try {
            const result = await mutatePractice({
              kind: "taskOutcome",
              date,
              task,
              state: outcome,
              reason: outcome === "skipped" ? note : "",
              revision,
              id: operation.current,
            } as PracticeCommand);
            if (result.error || !result.workspace)
              setMessage(result.error || "Save not confirmed.");
            else {
              operation.current = "";
              setMessage("Outcome saved.");
              onSaved(result.workspace);
            }
          } catch {
            setMessage("Connection interrupted. Retry the same outcome.");
          } finally {
            setPending(false);
          }
        }}
      >
        <label>
          Task outcome
          <select
            value={outcome}
            onChange={(e) => setOutcome(e.target.value)}
            disabled={pending || disabled}
          >
            <option value="pending">Pending</option>
            <option value="done">Done</option>
            <option value="skipped">Skipped — valid reason</option>
            <option value="missed">Missed</option>
          </select>
        </label>
        {outcome === "skipped" && (
          <label>
            Reason (10–500 characters)
            <textarea
              required
              minLength={10}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </label>
        )}
        <p role="status">{message}</p>
        <button className="button secondary" disabled={pending || disabled}>
          Save outcome
        </button>
      </form>
    </details>
  );
}
