import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { chmodSync, statSync } from "node:fs";
import { configPath, pendingPath, writeConfig, writePending } from "../src/config.js";
import { useEmptyConfigDir } from "./helpers/run.js";

describe("secret files stay owner-only", () => {
  let cfg: { restore: () => void };
  beforeEach(() => {
    cfg = useEmptyConfigDir();
  });
  afterEach(() => cfg.restore());

  it("re-tightens config.json on every write, not just at creation", () => {
    writeConfig({ version: 1 });
    expect(statSync(configPath()).mode & 0o777).toBe(0o600);
    chmodSync(configPath(), 0o644);
    writeConfig({ version: 1, user: { name: "Member" } });
    expect(statSync(configPath()).mode & 0o777).toBe(0o600);
  });

  it("re-tightens pending-auth.json on every write", () => {
    const pending = {
      verifier: "v",
      redirect_uri: "http://127.0.0.1:1/callback",
      port: 1,
      resource: "https://example.com",
      auth_server: "https://example.com",
      url: "https://example.com/authorize",
      expires_at: 0,
    };
    writePending(pending);
    chmodSync(pendingPath(), 0o644);
    writePending(pending);
    expect(statSync(pendingPath()).mode & 0o777).toBe(0o600);
  });
});
