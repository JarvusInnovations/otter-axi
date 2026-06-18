import { AxiError } from "axi-sdk-js";

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

function toYmd(d: Date): string {
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())}`;
}

/**
 * Normalize a user-supplied date to the upstream `YYYY/MM/DD` format. Accepts ISO
 * (`2026-05-01` or `2026/5/1`) and relative forms anchored to `now`: `7d`, `2w`, `3m`, `1y`.
 */
export function normalizeDate(input: string, now: Date = new Date()): string {
  const s = input.trim();

  const rel = s.match(/^(\d+)\s*([dwmy])$/i);
  if (rel) {
    const n = Number(rel[1]);
    const unit = rel[2].toLowerCase();
    const d = new Date(now);
    if (unit === "d") d.setDate(d.getDate() - n);
    else if (unit === "w") d.setDate(d.getDate() - n * 7);
    else if (unit === "m") d.setMonth(d.getMonth() - n);
    else d.setFullYear(d.getFullYear() - n);
    return toYmd(d);
  }

  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) return `${iso[1]}/${pad(Number(iso[2]))}/${pad(Number(iso[3]))}`;

  throw new AxiError(`Unrecognized date: ${input}`, "VALIDATION_ERROR", [
    "Use ISO (2026-05-01) or relative (7d, 2w, 3m, 1y)",
  ]);
}
