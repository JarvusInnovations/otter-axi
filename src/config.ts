import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const CONFIG_VERSION = 1;

/**
 * otter-axi authenticates to a single Otter account via OAuth, so the config holds one
 * credential set (not the multi-profile model of instance-based tools). Secrets live in
 * `tokens` / `client`; `user` is a non-secret cache for fast home/doctor rendering.
 */

/** A dynamically-registered OAuth public client (RFC 7591). */
export interface OAuthClient {
  client_id: string;
  client_secret?: string;
  redirect_uri?: string;
  registered_at?: string;
}

/** The OAuth token set. `expires_at` is epoch milliseconds. */
export interface OAuthTokens {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  scope?: string;
  expires_at?: number;
}

/** Cached, non-secret profile of the authenticated user. */
export interface UserCache {
  name?: string;
  email?: string;
  cached_at?: string;
}

export interface Config {
  version: number;
  client?: OAuthClient;
  tokens?: OAuthTokens;
  user?: UserCache;
}

// Paths ──────────────────────────────────────────────────────────────
export function configDir(): string {
  if (process.env.OTTER_AXI_CONFIG_DIR) {
    return process.env.OTTER_AXI_CONFIG_DIR;
  }
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg && xdg.length > 0 ? xdg : join(homedir(), ".config");
  return join(base, "otter-axi");
}

export function configPath(): string {
  return join(configDir(), "config.json");
}

/** Default location for auto-pathed exports (bare `--json-out` etc.). */
export function exportsDir(): string {
  return join(configDir(), "exports");
}

// Read / write ────────────────────────────────────────────────────────
export function defaultConfig(): Config {
  return { version: CONFIG_VERSION };
}

export function readConfig(): Config {
  const path = configPath();
  if (!existsSync(path)) return defaultConfig();
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as Partial<Config>;
    return {
      version: parsed.version ?? CONFIG_VERSION,
      client: parsed.client,
      tokens: parsed.tokens,
      user: parsed.user,
    };
  } catch {
    return defaultConfig();
  }
}

export function writeConfig(cfg: Config): void {
  const dir = configDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  // Restrictive perms: the file holds OAuth access/refresh tokens.
  writeFileSync(configPath(), `${JSON.stringify(cfg, null, 2)}\n`, {
    mode: 0o600,
  });
}

/** Remove the stored token set (used by `auth logout`). Idempotent. */
export function clearTokens(cfg: Config): Config {
  const { tokens: _tokens, ...rest } = cfg;
  return { ...rest };
}

/** Delete the entire config file. Idempotent. */
export function deleteConfig(): void {
  const path = configPath();
  if (existsSync(path)) rmSync(path);
}

/** True when a token set is present (logged in, possibly expired). */
export function isLoggedIn(cfg: Config): boolean {
  return Boolean(cfg.tokens?.access_token);
}

// Pending auth (two-phase login) ──────────────────────────────────────
/**
 * In-flight login state persisted between `auth login --no-wait` (prepare) and
 * `auth login --wait` (bind loopback + exchange). Holds the PKCE verifier and the exact
 * redirect_uri/port so the second phase — possibly a separate process — can complete.
 */
export interface PendingAuth {
  verifier: string;
  redirect_uri: string;
  port: number;
  resource: string;
  auth_server: string;
  url: string;
  expires_at: number;
}

export function pendingPath(): string {
  return join(configDir(), "pending-auth.json");
}

export function readPending(): PendingAuth | undefined {
  const path = pendingPath();
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as PendingAuth;
  } catch {
    return undefined;
  }
}

export function writePending(pending: PendingAuth): void {
  const dir = configDir();
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true, mode: 0o700 });
  writeFileSync(pendingPath(), `${JSON.stringify(pending, null, 2)}\n`, {
    mode: 0o600,
  });
}

export function clearPending(): void {
  const path = pendingPath();
  if (existsSync(path)) rmSync(path);
}
