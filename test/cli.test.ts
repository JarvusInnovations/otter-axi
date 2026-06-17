import { describe, expect, it } from "vitest";
import { runAxiCli } from "axi-sdk-js";
import { cliOptions } from "../src/cli.js";
import { normalizeConversationId } from "../src/commands/fetch.js";

/** Drive the CLI with fake argv + captured stdout, returning output + exit code. */
async function run(argv: string[]): Promise<{ out: string; code: number }> {
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

describe("otter-axi cli", () => {
  it("prints top-level help", async () => {
    const { out } = await run(["--help"]);
    expect(out).toContain("usage: otter-axi");
    expect(out).toContain("search");
    expect(out).toContain("fetch");
  });

  it("prints a version", async () => {
    const { out } = await run(["--version"]);
    expect(out.trim()).toMatch(/^\d+\.\d+\.\d+/);
  });

  it("rejects an unknown command with exit code 2", async () => {
    const { out, code } = await run(["bogus"]);
    expect(code).toBe(2);
    expect(out).toMatch(/error/i);
  });

  it("renders a home view without throwing", async () => {
    const { out } = await run([]);
    expect(out).toContain("status");
    // bin/description header is injected by the SDK
    expect(out).toContain("otter-axi");
  });

  it("routes search --help", async () => {
    const { out } = await run(["search", "--help"]);
    expect(out).toContain("browse mode");
  });
});

describe("normalizeConversationId", () => {
  it("passes a bare id through", () => {
    expect(normalizeConversationId("aBcDeFgHiJkLmNoPqRsTuVwXyZ0")).toBe(
      "aBcDeFgHiJkLmNoPqRsTuVwXyZ0",
    );
  });

  it("extracts the id from an otter.ai URL with query/fragment", () => {
    expect(
      normalizeConversationId(
        "https://otter.ai/u/Zy9XwVuTsRqPoNmLkJiHgFeDcB1?tab=chat&view=summary",
      ),
    ).toBe("Zy9XwVuTsRqPoNmLkJiHgFeDcB1");
  });
});
