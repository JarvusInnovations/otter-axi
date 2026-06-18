import { AxiError } from "axi-sdk-js";
import { configPath, isLoggedIn, readConfig } from "../config.js";
import { getUser } from "../otter/client.js";
import type { StructuredOutput } from "../output.js";

export const DOCTOR_HELP = `usage: otter-axi doctor
checks (tiered):
  config present → credentials stored → token valid / Otter MCP reachable
exit:
  0 when authenticated and reachable; 1 on a hard failure`;

interface Check {
  name: string;
  status: "ok" | "warn" | "fail";
  detail: string;
}

export async function doctorCommand(_args: string[]): Promise<StructuredOutput> {
  const cfg = readConfig();
  const checks: Check[] = [{ name: "config", status: "ok", detail: configPath() }];

  if (!isLoggedIn(cfg)) {
    process.exitCode = 1;
    checks.push({ name: "credentials", status: "fail", detail: "no credentials stored" });
    return { checks, help: ["Run `otter-axi auth login` to connect your Otter account"] };
  }
  checks.push({
    name: "credentials",
    status: "ok",
    detail: `stored for ${cfg.user?.email ?? cfg.user?.name ?? "account"}`,
  });

  try {
    const u = await getUser();
    checks.push({
      name: "mcp",
      status: "ok",
      detail: `reachable; authenticated as ${u.email ?? u.name ?? "user"}`,
    });
    return { checks };
  } catch (e) {
    process.exitCode = 1;
    const err = e as AxiError;
    const authProblem = err.code === "AUTH";
    checks.push({
      name: authProblem ? "token" : "mcp",
      status: "fail",
      detail: err.message,
    });
    return {
      checks,
      help: authProblem
        ? ["Run `otter-axi auth login` to re-authenticate"]
        : ["Check connectivity to https://mcp.otter.ai and retry"],
    };
  }
}
