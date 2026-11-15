import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AxiError } from "axi-sdk-js";
import { formatError } from "../src/cli.js";
import { normalizeConversationId } from "../src/commands/fetch.js";
import { run, useEmptyConfigDir } from "./helpers/run.js";

let cfg: { restore: () => void };
beforeAll(() => {
  cfg = useEmptyConfigDir();
});
afterAll(() => cfg.restore());

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

describe("formatError", () => {
  it("exits 2 for every usage-class code", () => {
    for (const code of ["USAGE", "UNKNOWN_FLAG", "VALIDATION_ERROR"]) {
      const { output, exitCode } = formatError(new AxiError("bad call", code, ["try this"]));
      expect(exitCode).toBe(2);
      expect(output).toBe(`error: bad call\ncode: ${code}\nhelp[1]: try this\n`);
    }
  });

  it("exits 1 for an operation that failed", () => {
    expect(formatError(new AxiError("Not logged in", "AUTH", [])).exitCode).toBe(1);
  });

  it("wraps an unexpected throw as INTERNAL_ERROR with a doctor hint and no stack", () => {
    const { output, exitCode } = formatError(new TypeError("x is not a function"));
    expect(exitCode).toBe(1);
    expect(output).toContain('error: "unexpected failure: x is not a function"');
    expect(output).toContain("code: INTERNAL_ERROR");
    expect(output).toContain("Run `otter-axi doctor`");
    expect(output).not.toMatch(/^\s+at /m);
  });
});

describe("usage errors exit 2 through the CLI", () => {
  it("a parse that succeeds reaches the credential check, not a usage error", async () => {
    const { out, code } = await run(["search", "roadmap", "--after", "7d", "--limit", "5"]);
    expect(code).toBe(1);
    expect(out).toContain("code: AUTH");
  });

  it("search rejects a misspelled flag instead of running unfiltered", async () => {
    const { out, code } = await run(["search", "--querry", "roadmap"]);
    expect(code).toBe(2);
    expect(out).toContain("code: UNKNOWN_FLAG");
    expect(out).toContain("valid flags for `search`:");
    expect(out).toContain("--query");
  });

  it("search rejects an invalid date, naming the flag", async () => {
    for (const bad of ["last tuesday", "2026-02-30", ""]) {
      const { out, code } = await run(["search", "--after", bad]);
      expect(code).toBe(2);
      expect(out).toContain("code: VALIDATION_ERROR");
      expect(out).toContain("Unrecognized date for --after");
    }
  });

  it("search rejects a --limit that is not a positive whole number", async () => {
    for (const bad of ["ten", "0", "2.5"]) {
      const { out, code } = await run(["search", "--limit", bad]);
      expect(code).toBe(2);
      expect(out).toContain("code: VALIDATION_ERROR");
      expect(out).toContain("--limit expects a positive whole number");
    }
  });

  it("search rejects an empty filter value and a query given twice", async () => {
    const empty = await run(["search", "--folder", ""]);
    expect(empty.code).toBe(2);
    expect(empty.out).toContain("--folder needs a non-empty value");
    const twice = await run(["search", "roadmap", "--query", "budget"]);
    expect(twice.code).toBe(2);
    expect(twice.out).toContain("Give the query once");
  });

  it("fetch --out fails with a hint naming --text-out, carrying the path", async () => {
    const bare = await run(["fetch", "abc", "--out"]);
    expect(bare.code).toBe(2);
    expect(bare.out).toContain("error: unknown flag --out for `fetch`");
    expect(bare.out).toContain("--out is now --text-out; run again with --text-out");
    const valued = await run(["fetch", "abc", "--out=t.txt"]);
    expect(valued.code).toBe(2);
    expect(valued.out).toContain("run again with --text-out=t.txt");
  });

  it("fetch refuses a space-separated export path, naming the = form", async () => {
    const { out, code } = await run(["fetch", "abc", "--json-out", "t.json"]);
    expect(code).toBe(2);
    expect(out).toContain("code: USAGE");
    expect(out).toContain("--json-out=t.json");
  });

  it("a bare export flag never swallows the fetch id", async () => {
    // Parses cleanly (id = abc) and stops at the credential check.
    const { out, code } = await run(["fetch", "--json-out", "abc"]);
    expect(code).toBe(1);
    expect(out).toContain("code: AUTH");
  });

  it("fetch rejects a missing id, an extra argument and two output modes", async () => {
    const missing = await run(["fetch"]);
    expect(missing.code).toBe(2);
    expect(missing.out).toContain("code: USAGE");
    const extra = await run(["fetch", "abc", "def"]);
    expect(extra.code).toBe(2);
    expect(extra.out).toContain("unexpected argument for `fetch`: def");
    const modes = await run(["fetch", "abc", "--full", "--csv-out"]);
    expect(modes.code).toBe(2);
    expect(modes.out).toContain("Choose a single output mode, got --full and --csv-out");
  });

  it("auth and setup list their subcommands; doctor takes no arguments", async () => {
    const auth = await run(["auth", "whoami"]);
    expect(auth.code).toBe(2);
    expect(auth.out).toContain("valid subcommands: login, status, logout");
    const setup = await run(["setup"]);
    expect(setup.code).toBe(2);
    expect(setup.out).toContain("valid subcommands: hooks");
    const doctor = await run(["doctor", "now"]);
    expect(doctor.code).toBe(2);
    expect(doctor.out).toContain("code: USAGE");
    const login = await run(["auth", "login", "--no-wait", "--wait"]);
    expect(login.code).toBe(2);
    expect(login.out).toContain("code: VALIDATION_ERROR");
  });
});

describe("fetch --help", () => {
  it("describes the real export location and no retired alias", async () => {
    const { out } = await run(["fetch", "--help"]);
    expect(out).toContain("<os-temp-dir>/otter-axi/");
    expect(out).not.toContain(".config");
    expect(out).not.toContain("--out)");
  });
});
