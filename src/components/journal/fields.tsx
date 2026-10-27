"use client";
import { utcInput, utcValue } from "@/lib/journal/input";
export function TimeField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string | null;
  onChange: (value: string | null) => void;
  required?: boolean;
}) {
  return (
    <label>
      {label} (UTC)
      <input
        type="datetime-local"
        step="1"
        required={required}
        value={utcInput(value)}
        onChange={(e) => onChange(utcValue(e.target.value))}
      />
    </label>
  );
}
export function NumberField({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: number | null;
  onChange: (value: number | null) => void;
  required?: boolean;
}) {
  return (
    <label>
      {label}
      <input
        type="number"
        step="any"
        required={required}
        value={value === null ? "" : value}
        onChange={(e) =>
          onChange(e.target.value === "" ? null : Number(e.target.value))
        }
      />
    </label>
  );
}
