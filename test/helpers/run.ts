import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runAxiCli } from "axi-sdk-js";
import { cliOptions } from "../../src/cli.js";

/**
 * Point the config at an empty temp dir so no test reads real credentials: with nothing
 * stored, a command that parses cleanly stops at "Not logged in" before any network call.
 */
export function useEmptyConfigDir(): { dir: string; restore: () => void } {
  const dir = mkdtempSync(join(tmpdir(), "otter-axi-test-"));
  const prev = process.env.OTTER_AXI_CONFIG_DIR;
  process.env.OTTER_AXI_CONFIG_DIR = dir;
  return {
    dir,
    restore: () => {
      if (prev === undefined) delete process.env.OTTER_AXI_CONFIG_DIR;
      else process.env.OTTER_AXI_CONFIG_DIR = prev;
      rmSync(dir, { recursive: true, force: true });
    },
  };
}

/** Drive the CLI with fake argv + captured stdout, returning output + exit code. */
export async function run(argv: string[]): Promise<{ out: string; code: number }> {
  let out = "";
  const prevExit = process.exitCode;
  process.exitCode = 0;
  await runAxiCli(
    cliOptions({
      argv,
      stdout: {
        write: (chunk: string) => {
          out += chunk;
        },
      },
    }),
  );
  const code = Number(process.exitCode ?? 0);
  process.exitCode = prevExit;
  return { out, code };
}
