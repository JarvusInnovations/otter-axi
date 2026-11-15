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
 * Anything else — including a well-shaped date that isn't on the calendar (`2026-02-30`) —
 * is a VALIDATION_ERROR; `flag` names the flag it came from in the message.
 */
export function normalizeDate(input: string, now: Date = new Date(), flag?: string): string {
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
    if (Number.isFinite(d.getTime())) return toYmd(d);
  }

  const iso = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (iso) {
    const [y, m, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
    const d = new Date(y, m - 1, day);
    // `new Date` rolls 2026-02-30 over to March; a real date round-trips unchanged.
    if (d.getFullYear() === y && d.getMonth() === m - 1 && d.getDate() === day) {
      return `${iso[1]}/${pad(m)}/${pad(day)}`;
    }
  }

  throw new AxiError(
    `Unrecognized date${flag ? ` for ${flag}` : ""}: ${input}`,
    "VALIDATION_ERROR",
    ["Use a calendar date (2026-05-01) or a relative span (7d, 2w, 3m, 1y)"],
  );
}
