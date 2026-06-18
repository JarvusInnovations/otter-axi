import { AxiError } from "axi-sdk-js";
import {
  discoverAuthorizationServerMetadata,
  discoverOAuthProtectedResourceMetadata,
  exchangeAuthorization,
  refreshAuthorization,
  registerClient,
  startAuthorization,
} from "@modelcontextprotocol/sdk/client/auth.js";
import type {
  AuthorizationServerMetadata,
  OAuthClientInformationMixed,
  OAuthTokens,
} from "@modelcontextprotocol/sdk/shared/auth.js";
import {
  clearPending,
  readConfig,
  readPending,
  writeConfig,
  writePending,
  type Config,
  type OAuthClient,
} from "../config.js";

export const MCP_URL = "https://mcp.otter.ai/mcp";
export const SCOPE = "profile:read conversations:read";
/** Candidate loopback ports (all registered as redirect_uris so any may be bound). */
export const LOOPBACK_PORTS = [41789, 41790, 41791, 41792];

interface Discovery {
  resource: string;
  authServer: string;
  asMetadata: AuthorizationServerMetadata;
}

function redirectUris(): string[] {
  return LOOPBACK_PORTS.map((p) => `http://127.0.0.1:${p}/callback`);
}

/** Discover the protected-resource + authorization-server metadata. */
export async function discover(): Promise<Discovery> {
  const prm = await discoverOAuthProtectedResourceMetadata(MCP_URL);
  const authServer = (prm.authorization_servers?.[0] ?? "https://otter.ai/").toString();
  const asMetadata = await discoverAuthorizationServerMetadata(authServer);
  if (!asMetadata) {
    throw new AxiError(
      "Could not discover Otter's OAuth authorization-server metadata",
      "AUTH",
      ["Check connectivity to https://otter.ai and retry"],
    );
  }
  return {
    resource: (prm.resource ?? "https://mcp.otter.ai/").toString(),
    authServer,
    asMetadata,
  };
}

/** Register a public client via DCR if one isn't already stored. Persists it to config. */
export async function ensureClient(
  cfg: Config,
  disc: Discovery,
): Promise<{ cfg: Config; client: OAuthClientInformationMixed }> {
  if (cfg.client?.client_id) {
    return {
      cfg,
      client: {
        client_id: cfg.client.client_id,
        ...(cfg.client.client_secret
          ? { client_secret: cfg.client.client_secret }
          : {}),
      },
    };
  }
  const full = await registerClient(disc.authServer, {
    metadata: disc.asMetadata,
    scope: SCOPE,
    clientMetadata: {
      client_name: "otter-axi",
      redirect_uris: redirectUris(),
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: SCOPE,
    },
  });
  const stored: OAuthClient = {
    client_id: full.client_id,
    ...(full.client_secret ? { client_secret: full.client_secret } : {}),
    registered_at: new Date().toISOString(),
  };
  const next: Config = { ...cfg, client: stored };
  writeConfig(next);
  return { cfg: next, client: full };
}

/**
 * Phase 1: discover, ensure a client, and build the PKCE authorize URL bound to `port`.
 * Persists the verifier + redirect_uri so phase 2 (possibly a separate process) can finish.
 */
export async function prepareLogin(port: number): Promise<{ url: string }> {
  const disc = await discover();
  const { client } = await ensureClient(readConfig(), disc);
  const redirect_uri = `http://127.0.0.1:${port}/callback`;
  const { authorizationUrl, codeVerifier } = await startAuthorization(disc.authServer, {
    metadata: disc.asMetadata,
    clientInformation: client,
    redirectUrl: redirect_uri,
    scope: SCOPE,
    resource: new URL(disc.resource),
  });
  writePending({
    verifier: codeVerifier,
    redirect_uri,
    port,
    resource: disc.resource,
    auth_server: disc.authServer,
    url: authorizationUrl.toString(),
    expires_at: Date.now() + 10 * 60 * 1000,
  });
  return { url: authorizationUrl.toString() };
}

function tokensToConfig(t: OAuthTokens) {
  return {
    access_token: t.access_token,
    refresh_token: t.refresh_token,
    token_type: t.token_type,
    scope: t.scope,
    expires_at:
      typeof t.expires_in === "number"
        ? Date.now() + t.expires_in * 1000
        : undefined,
  };
}

/** Phase 2: exchange the authorization code for tokens using the persisted pending state. */
export async function completeLogin(code: string): Promise<void> {
  const pending = readPending();
  if (!pending) {
    throw new AxiError("No pending login to complete", "AUTH", [
      "Run `otter-axi auth login` to start over",
    ]);
  }
  const disc = await discover();
  const { client } = await ensureClient(readConfig(), disc);
  let tokens: OAuthTokens;
  try {
    tokens = await exchangeAuthorization(disc.authServer, {
      // Pass metadata so the SDK uses the real token_endpoint (/oauth/token)
      // rather than guessing /token, which nginx rejects with 405.
      metadata: disc.asMetadata,
      clientInformation: client,
      authorizationCode: code,
      codeVerifier: pending.verifier,
      redirectUri: pending.redirect_uri,
      resource: new URL(pending.resource),
    });
  } catch (e) {
    throw new AxiError(
      `Token exchange failed: ${(e as Error).message}`,
      "AUTH",
      [
        "Authorization codes are short-lived — run `otter-axi auth login` and approve promptly",
      ],
    );
  }
  writeConfig({ ...readConfig(), tokens: tokensToConfig(tokens) });
  clearPending();
}

/** Refresh the stored access token using the refresh_token grant. Persists the result. */
export async function refreshTokens(): Promise<void> {
  const cfg = readConfig();
  if (!cfg.tokens?.refresh_token || !cfg.client?.client_id) {
    throw new AxiError("Cannot refresh — not fully logged in", "AUTH", [
      "Run `otter-axi auth login`",
    ]);
  }
  const disc = await discover();
  let tokens: OAuthTokens;
  try {
    tokens = await refreshAuthorization(disc.authServer, {
      metadata: disc.asMetadata,
      clientInformation: {
        client_id: cfg.client.client_id,
        ...(cfg.client.client_secret
          ? { client_secret: cfg.client.client_secret }
          : {}),
      },
      refreshToken: cfg.tokens.refresh_token,
      resource: new URL(disc.resource),
    });
  } catch {
    throw new AxiError("Session expired — please log in again", "AUTH", [
      "Run `otter-axi auth login`",
    ]);
  }
  // refreshAuthorization preserves the old refresh_token when the server omits a new one.
  writeConfig({ ...readConfig(), tokens: tokensToConfig(tokens) });
}

/** Best-effort token revocation at the authorization server's revocation endpoint. */
export async function revokeToken(): Promise<void> {
  const cfg = readConfig();
  const token = cfg.tokens?.refresh_token ?? cfg.tokens?.access_token;
  if (!token || !cfg.client?.client_id) return;
  try {
    const disc = await discover();
    const endpoint = (disc.asMetadata as Record<string, unknown>)
      .revocation_endpoint as string | undefined;
    if (!endpoint) return;
    await fetch(endpoint, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        token,
        client_id: cfg.client.client_id,
      }),
    });
  } catch {
    // Revocation is best-effort; clearing local tokens is what matters.
  }
}
