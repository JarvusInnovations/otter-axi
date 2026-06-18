import { AxiError } from "axi-sdk-js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { readConfig } from "../config.js";
import { readVersion } from "../meta.js";
import { MCP_URL, refreshTokens } from "./oauth.js";

// Typed views of the upstream tool payloads (see specs/api/mcp-server.md).
export interface UserInfo {
  name?: string;
  email?: string;
  datetime?: string;
}

export interface Meeting {
  id: string;
  title?: string;
  url?: string;
  start_time?: string;
  duration?: number;
  short_summary?: string;
  action_items?: unknown[];
}

export interface Transcript {
  id: string;
  title?: string;
  url?: string;
  text: string;
  metadata?: {
    action_items?: unknown[];
    duration?: number;
    short_summary?: string;
    start_time?: string;
  };
}

/** Return a valid access token, refreshing first if it's within 60s of expiry. */
async function validAccessToken(): Promise<string> {
  const cfg = readConfig();
  if (!cfg.tokens?.access_token) {
    throw new AxiError("Not logged in", "AUTH", [
      "Run `otter-axi auth login` to connect your Otter account",
    ]);
  }
  const { expires_at, refresh_token } = cfg.tokens;
  if (expires_at && refresh_token && expires_at - Date.now() < 60_000) {
    await refreshTokens();
    return readConfig().tokens?.access_token ?? cfg.tokens.access_token;
  }
  return cfg.tokens.access_token;
}

function isUnauthorized(e: unknown): boolean {
  const msg = String((e as Error)?.message ?? e);
  return /401|unauthor/i.test(msg);
}

async function connect(token: string): Promise<{ client: Client; close: () => Promise<void> }> {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL), {
    requestInit: { headers: { Authorization: `Bearer ${token}` } },
  });
  const client = new Client(
    { name: "otter-axi", version: readVersion() },
    { capabilities: {} },
  );
  await client.connect(transport);
  return { client, close: () => transport.close() };
}

/** Call an MCP tool, transparently refreshing + retrying once on a 401. */
async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const run = async (token: string) => {
    const { client, close } = await connect(token);
    try {
      return await client.callTool({ name, arguments: args });
    } finally {
      await close().catch(() => {});
    }
  };

  let token = await validAccessToken();
  try {
    return await run(token);
  } catch (e) {
    if (isUnauthorized(e) && readConfig().tokens?.refresh_token) {
      await refreshTokens();
      token = readConfig().tokens?.access_token ?? token;
      try {
        return await run(token);
      } catch (e2) {
        throw mapError(e2);
      }
    }
    throw mapError(e);
  }
}

function mapError(e: unknown): AxiError {
  if (e instanceof AxiError) return e;
  const msg = String((e as Error)?.message ?? e);
  if (isUnauthorized(e)) {
    return new AxiError("Authentication failed or session expired", "AUTH", [
      "Run `otter-axi auth login`",
    ]);
  }
  if (/429|rate limit/i.test(msg)) {
    return new AxiError("Otter rate limit hit — retry shortly", "RATE_LIMIT", []);
  }
  return new AxiError(`Otter MCP request failed: ${msg}`, "UPSTREAM", []);
}

type ContentEnvelope = { content?: Array<{ type?: string; text?: string }> };

/** Pull the text from a single MCP `content[0].text` envelope. */
function textOf(envelope: unknown): string | undefined {
  const content = (envelope as ContentEnvelope)?.content;
  const first = content?.find((c) => c?.type === "text") ?? content?.[0];
  return typeof first?.text === "string" ? first.text : undefined;
}

/** Pull the inner payload string from the MCP `content[0].text` envelope. */
function innerText(result: unknown): string {
  const text = textOf(result);
  if (text === undefined) {
    throw new AxiError("Unexpected response shape from Otter MCP", "UPSTREAM", []);
  }
  return text;
}

/**
 * The `search`/`fetch` tools double-wrap: `content[0].text` is itself an MCP content
 * envelope whose inner `text` holds the real JSON payload. Unwrap that second layer when
 * present; otherwise return the first-layer text unchanged (e.g. `get_user_info` prose).
 */
function payloadText(result: unknown): string {
  const text = innerText(result);
  try {
    const inner = textOf(JSON.parse(text));
    if (inner !== undefined) return inner;
  } catch {
    // first-layer text isn't a JSON envelope — use it as-is
  }
  return text;
}

export async function getUser(): Promise<UserInfo> {
  const text = innerText(await callTool("get_user_info", {}));
  const grab = (label: string) =>
    text.match(new RegExp(`${label}:\\s*(.+)`))?.[1]?.trim();
  return { name: grab("Name"), email: grab("Email"), datetime: grab("Current DateTime") };
}

export async function search(params: Record<string, unknown>): Promise<Meeting[]> {
  const parsed = JSON.parse(payloadText(await callTool("search", params))) as {
    results?: Meeting[];
  };
  return parsed.results ?? [];
}

export async function fetchTranscript(id: string): Promise<Transcript> {
  return JSON.parse(payloadText(await callTool("fetch", { id }))) as Transcript;
}
