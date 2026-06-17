/**
 * Output helpers. Handlers return plain objects (StructuredOutput) and the AXI SDK
 * serializes them to TOON at the boundary — never print here.
 */

export type StructuredOutput = Record<string, unknown>;

/** Default caps for token-frugal output. */
export const CELL_CHAR_CAP = 120;
export const PREVIEW_ROW_CAP = 20;

/** Truncate a cell value with a visible marker showing the full length. */
export function truncateCell(value: string, cap = CELL_CHAR_CAP): string {
  if (value.length <= cap) return value;
  return `${value.slice(0, cap)}…(truncated, ${value.length} chars total)`;
}

/** Cap a list to `limit` rows, returning the kept rows and whether more exist. */
export function capList<T>(
  rows: T[],
  limit = PREVIEW_ROW_CAP,
): { rows: T[]; total: number; capped: boolean } {
  if (rows.length <= limit) return { rows, total: rows.length, capped: false };
  return { rows: rows.slice(0, limit), total: rows.length, capped: true };
}

/** "N of M" when a total is known, else "N". */
export function countLabel(shown: number, total?: number): string {
  if (total === undefined || total === shown) return `${shown}`;
  return `${shown} of ${total}`;
}

/** Compact relative time like "2h ago" / "3d ago" from an ISO/epoch input. */
export function relativeTime(when: string | number | Date, now: Date): string {
  const then = when instanceof Date ? when : new Date(when);
  const ms = now.getTime() - then.getTime();
  if (!Number.isFinite(ms)) return "unknown";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}
