import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AxiError } from "axi-sdk-js";
import {
  AUTH_FLAGS,
  COMMAND_FLAGS,
  DOCTOR_FLAGS,
  FETCH_FLAGS,
  SEARCH_FLAGS,
  SETUP_FLAGS,
  parseFlags,
  parseSubcommand,
  type FlagSpec,
} from "../src/flags.js";
import { AUTH_HELP } from "../src/commands/auth.js";
import { DOCTOR_HELP } from "../src/commands/doctor.js";
import { FETCH_HELP } from "../src/commands/fetch.js";
import { SEARCH_HELP } from "../src/commands/search.js";
import { SETUP_HELP } from "../src/commands/setup.js";
import { run, useEmptyConfigDir } from "./helpers/run.js";

/** Run a parse expected to fail and return the AxiError. */
function failure(fn: () => unknown): AxiError {
  try {
    fn();
  } catch (e) {
    expect(e).toBeInstanceOf(AxiError);
    return e as AxiError;
  }
  throw new Error("expected the parse to fail");
}

const SPEC: FlagSpec = {
  value: ["--limit", "-q"],
  boolean: ["--full"],
  optional: ["--json-out"],
  deprecated: {
    "--out": (value) => `--out is now --text-out${value ? `=${value}` : ""}`,
    "-n": "-n is not a flag of this tool; use --limit",
  },
  positionals: 1,
  usage: "tool cmd <id>",
};

describe("parseFlags", () => {
  it("parses value flags in both forms, switches and positionals", () => {
    const a = parseFlags("cmd", ["abc", "--limit", "5", "--full"], SPEC);
    expect(a.positional).toEqual(["abc"]);
    expect(a.flags).toEqual({ "--limit": "5", "--full": true });
    expect(parseFlags("cmd", ["--limit=5"], SPEC).flags["--limit"]).toBe("5");
    expect(parseFlags("cmd", ["-q", "roadmap"], SPEC).flags["-q"]).toBe("roadmap");
  });

  it("rejects an unknown flag as UNKNOWN_FLAG and lists the valid ones", () => {
    const err = failure(() => parseFlags("cmd", ["--bogus"], SPEC));
    expect(err.code).toBe("UNKNOWN_FLAG");
    expect(err.message).toBe("unknown flag --bogus for `cmd`");
    expect(err.suggestions[0]).toBe(
      "valid flags for `cmd`: --full, --json-out[=path], --limit, -q (--help always allowed)",
    );
  });

  it("says so when a command takes no flags", () => {
    const err = failure(() => parseFlags("doctor", ["--bogus"], {}));
    expect(err.suggestions[0]).toBe("`doctor` takes no flags (--help always allowed)");
  });

  it("answers a retired flag with its targeted hint, bare or with a value", () => {
    const bare = failure(() => parseFlags("cmd", ["abc", "--out"], SPEC));
    expect(bare.code).toBe("UNKNOWN_FLAG");
    expect(bare.suggestions).toEqual(["--out is now --text-out"]);
    const valued = failure(() => parseFlags("cmd", ["abc", "--out=t.txt"], SPEC));
    expect(valued.suggestions).toEqual(["--out is now --text-out=t.txt"]);
  });

  it("hints a guessed short flag as typed, and -h everywhere", () => {
    const n = failure(() => parseFlags("cmd", ["-n", "5"], SPEC));
    expect(n.message).toBe("unknown flag -n for `cmd`");
    expect(n.suggestions).toEqual(["-n is not a flag of this tool; use --limit"]);
    const h = failure(() => parseFlags("cmd", ["-h"], {}));
    expect(h.suggestions).toEqual(["-h is not a flag of this tool; use --help"]);
  });

  it("rejects a value flag with no value as USAGE", () => {
    expect(failure(() => parseFlags("cmd", ["--limit"], SPEC)).code).toBe("USAGE");
    const err = failure(() => parseFlags("cmd", ["--limit", "--full"], SPEC));
    expect(err.code).toBe("USAGE");
    expect(err.message).toBe("--limit requires a value");
  });

  it("rejects a switch given a value and a repeated value flag as USAGE", () => {
    const sw = failure(() => parseFlags("cmd", ["--full=yes"], SPEC));
    expect(sw.code).toBe("USAGE");
    expect(sw.message).toBe("--full is a switch and takes no value");
    const rep = failure(() => parseFlags("cmd", ["--limit", "1", "--limit", "2"], SPEC));
    expect(rep.code).toBe("USAGE");
    expect(rep.message).toBe("--limit given more than once");
  });

  it("rejects extra positionals as USAGE with the usage line", () => {
    const err = failure(() => parseFlags("cmd", ["abc", "def"], SPEC));
    expect(err.code).toBe("USAGE");
    expect(err.message).toBe("unexpected argument for `cmd`: def");
    expect(err.suggestions[0]).toContain("usage: tool cmd <id>");
  });

  it("treats dash-led text as text, and -- as the end of flags", () => {
    expect(parseFlags("cmd", ["-5"], SPEC).positional).toEqual(["-5"]);
    expect(parseFlags("cmd", ["--limit", "-5"], SPEC).flags["--limit"]).toBe("-5");
    expect(parseFlags("cmd", ["--", "--full"], SPEC).positional).toEqual(["--full"]);
  });

  describe("optional-value flags", () => {
    it("bare is present without a value and never swallows the positional", () => {
      const before = parseFlags("cmd", ["--json-out", "abc"], SPEC);
      expect(before.positional).toEqual(["abc"]);
      expect(before.flags["--json-out"]).toBe(true);
      const after = parseFlags("cmd", ["abc", "--json-out"], SPEC);
      expect(after.positional).toEqual(["abc"]);
      expect(after.flags["--json-out"]).toBe(true);
    });

    it("takes an explicit path with =", () => {
      const p = parseFlags("cmd", ["abc", "--json-out=./t.json"], SPEC);
      expect(p.flags["--json-out"]).toBe("./t.json");
      expect(p.positional).toEqual(["abc"]);
    });

    it("refuses a space-separated path, naming the = form", () => {
      const err = failure(() => parseFlags("cmd", ["abc", "--json-out", "t.json"], SPEC));
      expect(err.code).toBe("USAGE");
      expect(err.message).toBe("--json-out takes its path with =: --json-out=t.json");
    });

    it("refuses an empty path after =", () => {
      const err = failure(() => parseFlags("cmd", ["abc", "--json-out="], SPEC));
      expect(err.code).toBe("USAGE");
    });
  });
});

describe("parseSubcommand", () => {
  it("lists the valid subcommands for a missing or unknown one", () => {
    const missing = failure(() => parseSubcommand("auth", [], AUTH_FLAGS));
    expect(missing.code).toBe("VALIDATION_ERROR");
    expect(missing.suggestions[0]).toBe("valid subcommands: login, status, logout");
    const unknown = failure(() => parseSubcommand("auth", ["whoami"], AUTH_FLAGS));
    expect(unknown.message).toBe('unknown auth subcommand "whoami"');
  });

  it("parses the rest against the subcommand's own flags", () => {
    const { sub, parsed } = parseSubcommand("auth", ["status", "--offline"], AUTH_FLAGS);
    expect(sub).toBe("status");
    expect(parsed.flags["--offline"]).toBe(true);
    expect(failure(() => parseSubcommand("auth", ["logout", "acme"], AUTH_FLAGS)).code).toBe(
      "USAGE",
    );
  });
});

describe("every command rejects an unknown flag", () => {
  let cfg: { restore: () => void };
  beforeAll(() => {
    cfg = useEmptyConfigDir();
  });
  afterAll(() => cfg.restore());

  for (const [command, spec] of Object.entries(COMMAND_FLAGS)) {
    it(`${command} --bogus exits 2 and names its flags`, async () => {
      // fetch needs its id, or the missing positional would be the first complaint.
      const args = [...command.split(" "), ...(command === "fetch" ? ["abc"] : []), "--bogus"];
      const { out, code } = await run(args);
      expect(code).toBe(2);
      expect(out).toContain(`error: unknown flag --bogus for \`${command}\``);
      expect(out).toContain("code: UNKNOWN_FLAG");
      const declared = [...(spec.value ?? []), ...(spec.boolean ?? []), ...(spec.optional ?? [])];
      for (const flag of declared) expect(out).toContain(flag);
      if (declared.length === 0) expect(out).toContain("takes no flags");
    });
  }
});

describe("declared flags match --help", () => {
  const union = (specs: Record<string, FlagSpec>): string[] =>
    Object.values(specs).flatMap((s) => declaredOf(s));
  const declaredOf = (s: FlagSpec): string[] => [
    ...(s.value ?? []),
    ...(s.boolean ?? []),
    ...(s.optional ?? []),
    ...(s.multi ?? []),
  ];
  const cases: Array<[string, string, string[]]> = [
    ["auth", AUTH_HELP, union(AUTH_FLAGS)],
    ["setup", SETUP_HELP, union(SETUP_FLAGS)],
    ["doctor", DOCTOR_HELP, declaredOf(DOCTOR_FLAGS)],
    ["search", SEARCH_HELP, declaredOf(SEARCH_FLAGS)],
    ["fetch", FETCH_HELP, declaredOf(FETCH_FLAGS)],
  ];

  for (const [command, help, declared] of cases) {
    it(`${command}: every declared flag is documented and every documented flag is declared`, () => {
      const documented = new Set(help.match(/(?<![\w-])--?[a-z][a-z-]*/g) ?? []);
      for (const flag of declared) expect(documented, `${flag} missing from help`).toContain(flag);
      for (const flag of documented) {
        expect(declared, `${flag} is in help but not declared`).toContain(flag);
      }
    });
  }
});
