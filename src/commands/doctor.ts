import { configPath, isLoggedIn, readConfig } from "../config.js";
import type { StructuredOutput } from "../output.js";

export const DOCTOR_HELP = `usage: otter-axi doctor
checks:
  config present, credentials stored, token validity (live probe — plan 03)
exit:
  0 on ok/warn, 1 on a hard failure (no credentials)`;

interface Check {
  name: string;
  status: "ok" | "warn" | "fail";
  detail: string;
}

/**
 * Tiered diagnostics. The scaffold reports the local credential state; the live
 * token-validity / MCP-reachability probes are added with the client in plan 03.
 */
export async function doctorCommand(_args: string[]): Promise<StructuredOutput> {
  const cfg = readConfig();
  const checks: Check[] = [];

  checks.push({ name: "config", status: "ok", detail: configPath() });

  if (isLoggedIn(cfg)) {
    checks.push({
      name: "credentials",
      status: "ok",
      detail: `stored for ${cfg.user?.email ?? cfg.user?.name ?? "account"}`,
    });
    checks.push({
      name: "token",
      status: "warn",
      detail: "live validity probe arrives with the MCP client (plan 03)",
    });
  } else {
    process.exitCode = 1;
    checks.push({
      name: "credentials",
      status: "fail",
      detail: "no credentials stored",
    });
  }

  return {
    checks,
    ...(isLoggedIn(cfg)
      ? {}
      : { help: ["Run `otter-axi auth login` to connect your Otter account"] }),
  };
}
