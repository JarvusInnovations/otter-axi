import { spawn } from "node:child_process";
import { AxiError } from "axi-sdk-js";
import { parseArgs, hasFlag } from "../flags.js";
import {
  clearPending,
  clearTokens,
  isLoggedIn,
  readConfig,
  readPending,
  writeConfig,
} from "../config.js";
import { getUser } from "../otter/client.js";
import { completeLogin, LOOPBACK_PORTS, prepareLogin, revokeToken } from "../otter/oauth.js";
import { pickPort, startLoopback } from "../otter/loopback.js";
import type { StructuredOutput } from "../output.js";

export const AUTH_HELP = `usage: otter-axi auth <login|status|logout> [flags]
subcommands:
  login            one-time browser approval; stores refreshable OAuth tokens
    --no-wait      prepare only: print the authorize URL and return immediately
    --wait         bind the loopback and block for the callback (pairs with --no-wait)
  status           show the connected account (--offline to skip the live probe)
  logout           revoke and clear stored tokens
notes:
  Default \`login\` opens your browser and blocks (~5 min) until you approve.
  Agents: run \`auth login --no-wait\` to get the URL, relay it, then \`auth login
  --wait\` in a separate turn. Authorization codes are short-lived — approve promptly.`;

const SUBCOMMANDS = new Set(["login", "status", "logout"]);

function openBrowser(url: string): void {
  const cmd =
    process.platform === "darwin" ? "open" : process.platform === "win32" ? "start" : "xdg-open";
  try {
    spawn(cmd, [url], { stdio: "ignore", detached: true }).unref();
  } catch {
    // best-effort; the URL is also printed to stderr
  }
}

async function cacheProfile(): Promise<{ name?: string; email?: string }> {
  const u = await getUser();
  writeConfig({
    ...readConfig(),
    user: { name: u.name, email: u.email, cached_at: new Date().toISOString() },
  });
  return u;
}

async function bindWaitComplete(port: number): Promise<StructuredOutput> {
  const lb = await startLoopback(port);
  try {
    const code = await lb.waitForCode(300_000);
    await completeLogin(code);
    const u = await cacheProfile();
    return {
      status: "logged in",
      account: u.email ?? u.name ?? "connected",
      help: [
        'Run `otter-axi search "<query>" --after 30d` to find meetings',
        "Run `otter-axi fetch <id>` to pull a transcript",
      ],
    };
  } finally {
    lb.close();
  }
}

async function login(args: string[]): Promise<StructuredOutput> {
  const parsed = parseArgs(args);
  const noWait = hasFlag(parsed, "no-wait");
  const waitOnly = hasFlag(parsed, "wait");

  if (waitOnly) {
    const pending = readPending();
    if (!pending) {
      throw new AxiError("No pending login to wait on", "AUTH", [
        "Run `otter-axi auth login --no-wait` first",
      ]);
    }
    return await bindWaitComplete(pending.port);
  }

  const port = await pickPort(LOOPBACK_PORTS);
  const { url } = await prepareLogin(port);

  if (noWait) {
    return {
      action: "authorize",
      url,
      help: [
        "Open the URL above, sign in to Otter, and click Authorize access",
        "Then run `otter-axi auth login --wait` (within ~5 min) to capture the redirect",
      ],
    };
  }

  process.stderr.write(`\nAuthorize otter-axi in your browser:\n${url}\n\n`);
  openBrowser(url);
  return await bindWaitComplete(port);
}

async function status(args: string[]): Promise<StructuredOutput> {
  const parsed = parseArgs(args);
  const offline = hasFlag(parsed, "offline");
  const cfg = readConfig();

  if (!isLoggedIn(cfg)) {
    process.exitCode = 1;
    return {
      status: "not logged in",
      help: ["Run `otter-axi auth login` to connect your Otter account"],
    };
  }

  const account = cfg.user?.email ?? cfg.user?.name ?? "unknown";
  if (offline) return { status: "logged in", account, token: "not probed (--offline)" };

  try {
    const u = await getUser();
    writeConfig({
      ...readConfig(),
      user: { name: u.name, email: u.email, cached_at: new Date().toISOString() },
    });
    return { status: "logged in", account: u.email ?? u.name ?? account, token: "valid" };
  } catch {
    process.exitCode = 1;
    return {
      status: "logged in",
      account,
      token: "invalid",
      help: ["Run `otter-axi auth login` to re-authenticate"],
    };
  }
}

async function logout(): Promise<StructuredOutput> {
  const cfg = readConfig();
  clearPending();
  if (!isLoggedIn(cfg)) return { status: "already logged out" };
  await revokeToken();
  // Keep the registered client_id so re-login skips DCR; drop tokens + cached profile.
  const { user: _user, ...rest } = clearTokens(cfg);
  writeConfig(rest);
  return { status: "logged out" };
}

export async function authCommand(args: string[]): Promise<StructuredOutput> {
  const sub = args[0];
  if (sub === undefined || !SUBCOMMANDS.has(sub)) {
    throw new AxiError(
      sub ? `Unknown auth subcommand: ${sub}` : "Missing auth subcommand",
      "VALIDATION_ERROR",
      ["Run `otter-axi auth login`", "Run `otter-axi auth --help`"],
    );
  }
  const rest = args.slice(1);
  if (sub === "login") return await login(rest);
  if (sub === "status") return await status(rest);
  return await logout();
}
