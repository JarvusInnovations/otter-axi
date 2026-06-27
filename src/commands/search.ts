import { readConfig } from "../config.js";
import { normalizeDate } from "../dates.js";
import { hasFlag, numFlag, parseArgs, strFlag } from "../flags.js";
import { search as searchMeetings } from "../otter/client.js";
import { countLabel, truncateCell } from "../output.js";
import type { StructuredOutput } from "../output.js";

export const SEARCH_HELP = `usage: otter-axi search [query...] [flags]
flags:
  -q, --query <str>        keyword/semantic query (or pass positionally; may be empty)
  --after <date>           created on/after — ISO (2026-05-01) or relative (7d, 30d)
  --before <date>          created on/before — same formats
  --title-contains <str>   space-separated keywords matched against the title
  --in-transcript <str>    comma-separated keywords searched within transcripts
  --attended-by <name>     comma-separated attendee names (not emails)
  --channel <name>         comma-separated channel name(s) to search within
  --folder <name>          comma-separated folder name(s) to search within
  --mine                   restrict to your own meetings (exclude shared)
  --limit <n>              cap rows shown (default 20)
  --full                   show all rows, untruncated
notes:
  empty query + a date range is browse mode — list meetings in a window`;

const VALUED = [
  "query",
  "q",
  "after",
  "before",
  "title-contains",
  "in-transcript",
  "attended-by",
  "channel",
  "folder",
  "limit",
];

export async function searchCommand(args: string[]): Promise<StructuredOutput> {
  const parsed = parseArgs(args, { valued: VALUED });

  const query =
    parsed.positionals.join(" ") || strFlag(parsed, "query") || strFlag(parsed, "q") || "";
  const params: Record<string, unknown> = { query };

  const after = strFlag(parsed, "after");
  if (after) params.created_after = normalizeDate(after);
  const before = strFlag(parsed, "before");
  if (before) params.created_before = normalizeDate(before);
  const titleContains = strFlag(parsed, "title-contains");
  if (titleContains) params.title_contains = titleContains;
  const inTranscript = strFlag(parsed, "in-transcript");
  if (inTranscript) params.keywords_in_transcript = inTranscript;
  const attendedBy = strFlag(parsed, "attended-by");
  if (attendedBy) params.attended_by = attendedBy;
  const channel = strFlag(parsed, "channel");
  if (channel) params.channel_name = channel;
  const folder = strFlag(parsed, "folder");
  if (folder) params.folder_name = folder;
  if (hasFlag(parsed, "mine")) params.include_shared_meetings = false;

  // username (from cache) lets the upstream compute participation_status — not a flag.
  const cachedName = readConfig().user?.name;
  if (cachedName) params.username = cachedName;

  const limit = numFlag(parsed, "limit") ?? 20;
  const full = hasFlag(parsed, "full");

  const meetings = await searchMeetings(params);

  if (meetings.length === 0) {
    return {
      matched: 0,
      result: "0 meetings found",
      filters: describeFilters(query, params),
      help: [
        "Widen the date window (e.g. --after 90d) or relax filters",
        "Empty query + a date range browses everything in that window",
      ],
    };
  }

  const shown = full ? meetings : meetings.slice(0, limit);
  const rows = shown.map((m) => ({
    id: m.id,
    title: full ? (m.title ?? "") : truncateCell(m.title ?? "", 60),
    start: (m.start_time ?? "").slice(0, 10),
    dur: m.duration ?? "—",
    summary: full ? (m.short_summary ?? "") : truncateCell(m.short_summary ?? "", 80),
    ai: Array.isArray(m.action_items) ? m.action_items.length : 0,
  }));

  const out: StructuredOutput = {
    matched: meetings.length,
    ...(shown.length < meetings.length ? { shown: shown.length } : {}),
    count: countLabel(shown.length, meetings.length),
    meetings: rows,
    help: ["Run `otter-axi fetch <id>` to pull a transcript"],
  };
  return out;
}

function describeFilters(query: string, params: Record<string, unknown>): string {
  const parts = [`query="${query}"`];
  for (const [k, v] of Object.entries(params)) {
    if (k === "query" || k === "username") continue;
    parts.push(`${k}=${String(v)}`);
  }
  return parts.join(", ");
}
