import { AxiError } from "axi-sdk-js";

/**
 * Strict per-command flag parsing (specs/behaviors/invocation.md).
 *
 * A silently-dropped flag is worse than an error: the agent gets output it believes is
 * filtered and proceeds on wrong data. Every command declares the flags it takes here, and
 * anything else — an unknown flag, an extra positional, a missing value — fails with exit 2
 * before any network call or file write.
 */

/** A targeted hint for a retired or commonly-guessed flag; may fold in the value given with `=`. */
export type DeprecatedHint = string | ((value: string | undefined) => string);

export interface FlagSpec {
  /** Flags that take a value, e.g. `--limit 10` or `--limit=10`. */
  value?: string[];
  /** Flags that are standalone switches, e.g. `--mine`. */
  boolean?: string[];
  /**
   * Flags that may carry a value with `=` and only with `=`: `--json-out` (auto path) or
   * `--json-out=./t.json`. A following token is never consumed, so a bare export flag can
   * never swallow a positional.
   */
  optional?: string[];
  /** Repeatable value flags — every occurrence accumulates into a `string[]`. */
  multi?: string[];
  /** Renamed, removed or commonly-guessed flags mapped to a targeted hint. */
  deprecated?: Record<string, DeprecatedHint>;
  /**
   * How many positional arguments the command accepts: a count, or `"many"` for a variadic
   * tail. Defaults to 0. Extras fail as USAGE rather than being dropped.
   */
  positionals?: number | "many";
  /** Usage line shown when positionals are wrong. */
  usage?: string;
}

export interface Parsed {
  positional: string[];
  /** Value flags hold their string; switches and bare optional-value flags hold `true`. */
  flags: Record<string, string | true>;
  /** Values collected from `multi`-declared flags, in the order given. */
  multi: Record<string, string[]>;
}

const BIN = "otter-axi";

/** Only `--<letter>` starts a flag; `- item`, `---` and `-5` are text. */
const FLAG_SHAPED = /^--[A-Za-z]/;

/** Hints for flags no command has, but agents reach for out of habit. */
const GLOBAL_HINTS: Record<string, string> = {
  "-h": "-h is not a flag of this tool; use --help",
};

/**
 * Parse argv for one command, rejecting anything not declared. An unrecognized flag fails
 * as UNKNOWN_FLAG and lists the valid flags inline, which collapses the agent's correction
 * from two turns into one.
 */
export function parseFlags(command: string, argv: string[], spec: FlagSpec): Parsed {
  const valueFlags = new Set(spec.value ?? []);
  const boolFlags = new Set(spec.boolean ?? []);
  const optionalFlags = new Set(spec.optional ?? []);
  const multiFlags = new Set(spec.multi ?? []);
  const deprecated: Record<string, DeprecatedHint> = { ...GLOBAL_HINTS, ...spec.deprecated };
  const declared = new Set([...valueFlags, ...boolFlags, ...optionalFlags, ...multiFlags]);
  const known = [
    ...valueFlags,
    ...boolFlags,
    ...multiFlags,
    ...[...optionalFlags].map((f) => `${f}[=path]`),
  ].sort();

  const positional: string[] = [];
  const flags: Record<string, string | true> = {};
  const multi: Record<string, string[]> = {};
  /** Positionals that directly followed a bare optional-value flag, keyed by token. */
  const followers = new Map<string, string>();

  const nameOf = (token: string): string => {
    const eq = token.indexOf("=");
    return eq === -1 ? token : token.slice(0, eq);
  };
  /** Flag-shaped, or a short name this command declares or has a hint for (`-q`, `-n`). */
  const isFlagToken = (token: string): boolean =>
    FLAG_SHAPED.test(token) ||
    (token.startsWith("-") && (declared.has(nameOf(token)) || nameOf(token) in deprecated));

  const unknown = (name: string, inlineValue: string | undefined): never => {
    const hint = deprecated[name];
    throw new AxiError(
      `unknown flag ${name} for \`${command}\``,
      "UNKNOWN_FLAG",
      hint !== undefined
        ? [typeof hint === "function" ? hint(inlineValue) : hint]
        : [
            known.length > 0
              ? `valid flags for \`${command}\`: ${known.join(", ")} (--help always allowed)`
              : `\`${command}\` takes no flags (--help always allowed)`,
          ],
    );
  };

  const set = (name: string, value: string | true): void => {
    if (flags[name] !== undefined) {
      throw new AxiError(`${name} given more than once`, "USAGE", [
        `Pass ${name} once to \`${BIN} ${command}\``,
      ]);
    }
    flags[name] = value;
  };

  const takeValue = (name: string, inlineValue: string | undefined, i: number): string => {
    if (inlineValue !== undefined) return inlineValue;
    const next = argv[i + 1];
    // Only a flag-shaped token is a missing value; `--- draft ---` and `-5` are values.
    if (next === undefined || isFlagToken(next)) {
      throw new AxiError(`${name} requires a value`, "USAGE", [
        `Run \`${BIN} ${command} ${name} <value>\``,
      ]);
    }
    return next;
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]!;

    if (arg === "--") {
      positional.push(...argv.slice(i + 1));
      break;
    }

    if (!isFlagToken(arg)) {
      positional.push(arg);
      continue;
    }

    if (arg === "--help") {
      flags["--help"] = true;
      continue;
    }

    const eq = arg.indexOf("=");
    const name = eq === -1 ? arg : arg.slice(0, eq);
    const inlineValue = eq === -1 ? undefined : arg.slice(eq + 1);

    if (boolFlags.has(name)) {
      if (inlineValue !== undefined) {
        throw new AxiError(`${name} is a switch and takes no value`, "USAGE", [
          `Run \`${BIN} ${command} ${name}\` without a value`,
        ]);
      }
      flags[name] = true;
      continue;
    }

    if (optionalFlags.has(name)) {
      if (inlineValue === "") {
        throw new AxiError(`${name}= needs a path after the =`, "USAGE", [
          `Pass ${name} alone for an auto-generated path, or ${name}=<path>`,
        ]);
      }
      set(name, inlineValue ?? true);
      const next = argv[i + 1];
      if (inlineValue === undefined && next !== undefined && !isFlagToken(next) && next !== "--") {
        followers.set(next, name);
      }
      continue;
    }

    if (valueFlags.has(name)) {
      const value = takeValue(name, inlineValue, i);
      if (inlineValue === undefined) i++;
      set(name, value);
      continue;
    }

    if (multiFlags.has(name)) {
      const value = takeValue(name, inlineValue, i);
      if (inlineValue === undefined) i++;
      (multi[name] ??= []).push(value);
      continue;
    }

    unknown(name, inlineValue);
  }

  const maxPositionals = spec.positionals ?? 0;
  if (
    maxPositionals !== "many" &&
    positional.length > maxPositionals &&
    flags["--help"] === undefined
  ) {
    // `--json-out out.json`: the likely intent was a path, which rides on `=`.
    for (const token of positional) {
      const flag = followers.get(token);
      if (flag !== undefined) {
        throw new AxiError(`${flag} takes its path with =: ${flag}=${token}`, "USAGE", [
          `Run again with ${flag}=${token}, or ${flag} alone for a file in the OS temp dir`,
        ]);
      }
    }
    const extra = positional.slice(maxPositionals);
    const takes =
      maxPositionals === 0
        ? `\`${command}\` takes no positional arguments`
        : `\`${command}\` takes ${maxPositionals} positional argument${maxPositionals > 1 ? "s" : ""}`;
    throw new AxiError(
      `unexpected argument${extra.length > 1 ? "s" : ""} for \`${command}\`: ${extra.join(" ")}`,
      "USAGE",
      [`${takes}${spec.usage ? ` — usage: ${spec.usage}` : ""}`],
    );
  }

  return { positional, flags, multi };
}

/** Read a value flag as a string, or fall back to a default. */
export function str(parsed: Parsed, name: string, fallback: string): string;
export function str(parsed: Parsed, name: string): string | undefined;
export function str(parsed: Parsed, name: string, fallback?: string): string | undefined {
  const raw = parsed.flags[name];
  return typeof raw === "string" ? raw : fallback;
}

/** True when a boolean (or value, if simply present) flag was supplied. */
export function bool(parsed: Parsed, name: string): boolean {
  return parsed.flags[name] !== undefined;
}

/** Read all values collected for a `multi`-declared flag (empty array if absent). */
export function multiStr(parsed: Parsed, name: string): string[] {
  return parsed.multi[name] ?? [];
}

/** Require the Nth positional argument, or fail with usage. */
export function requirePositional(
  parsed: Parsed,
  index: number,
  label: string,
  usage: string,
): string {
  const value = parsed.positional[index];
  if (value === undefined || value.length === 0) {
    throw new AxiError(`${label} is required`, "USAGE", [usage]);
  }
  return value;
}

/**
 * Read a value flag that must not be empty. An empty filter (`--folder ""`) would otherwise
 * be dropped and the command would run unfiltered.
 */
export function nonEmptyStr(parsed: Parsed, name: string): string | undefined {
  const value = str(parsed, name);
  if (value === undefined) return undefined;
  if (value.trim().length === 0) {
    throw new AxiError(`${name} needs a non-empty value`, "VALIDATION_ERROR", [
      `Pass a value to ${name}, or leave the flag out`,
    ]);
  }
  return value;
}

/** Read a positive whole-number flag; anything else is a VALIDATION_ERROR, never a default. */
export function positiveInt(parsed: Parsed, name: string, fallback: number): number {
  const raw = str(parsed, name);
  if (raw === undefined) return fallback;
  if (!/^\d+$/.test(raw.trim()) || Number(raw) < 1) {
    throw new AxiError(`${name} expects a positive whole number, got: ${raw}`, "VALIDATION_ERROR", [
      `Pass a number such as ${name} ${fallback}`,
    ]);
  }
  return Number(raw);
}

/**
 * Resolve a command's subcommand (`auth login`, `setup hooks`) and parse the remaining argv
 * against that subcommand's declared flag set.
 */
export function parseSubcommand(
  command: string,
  args: string[],
  specs: Record<string, FlagSpec>,
): { sub: string; parsed: Parsed } {
  const first = args[0];
  const sub = first === undefined || first.startsWith("-") ? undefined : first;

  if (sub === undefined || !Object.hasOwn(specs, sub)) {
    throw new AxiError(
      sub === undefined
        ? `\`${command}\` requires a subcommand`
        : `unknown ${command} subcommand "${sub}"`,
      "VALIDATION_ERROR",
      [
        `valid subcommands: ${Object.keys(specs).join(", ")}`,
        `Run \`${BIN} ${command} --help\` for usage`,
      ],
    );
  }

  const parsed = parseFlags(`${command} ${sub}`, args.slice(1), specs[sub]!);
  return { sub, parsed };
}

// ── Declared per-command flag sets ──────────────────────────────────
// One entry per command/subcommand pair. Keeping them all here (rather than scattered
// across command files) is what makes "unknown flag" rejection consistent, and lets a test
// walk the table — see specs/commands/*.md for the flags each surface declares.

export const AUTH_FLAGS: Record<string, FlagSpec> = {
  login: { boolean: ["--no-wait", "--wait"] },
  status: { boolean: ["--offline"] },
  logout: {},
};

export const SETUP_FLAGS: Record<string, FlagSpec> = {
  hooks: {},
};

export const DOCTOR_FLAGS: FlagSpec = {};

export const SEARCH_FLAGS: FlagSpec = {
  value: [
    "--query",
    "-q",
    "--after",
    "--before",
    "--title-contains",
    "--in-transcript",
    "--attended-by",
    "--channel",
    "--folder",
    "--limit",
  ],
  boolean: ["--mine", "--full"],
  deprecated: {
    "-n": "-n is not a flag of this tool; use --limit",
    "--since": "--since is not a flag of this tool; use --after",
    "--until": "--until is not a flag of this tool; use --before",
  },
  positionals: "many",
};

export const FETCH_USAGE = "otter-axi fetch <id|url> [output-mode]";

export const FETCH_FLAGS: FlagSpec = {
  boolean: ["--full"],
  optional: ["--text-out", "--json-out", "--csv-out", "--tsv-out"],
  deprecated: {
    "--out": (value) =>
      `--out is now --text-out; run again with --text-out${value ? `=${value}` : ""}`,
    "--json":
      "--json is not supported; use --json-out to write the parsed segments as JSON to a file",
  },
  positionals: 1,
  usage: FETCH_USAGE,
};

/** Every command's declaration by its full name, for tests that sweep the table. */
export const COMMAND_FLAGS: Record<string, FlagSpec> = {
  ...Object.fromEntries(Object.entries(AUTH_FLAGS).map(([sub, spec]) => [`auth ${sub}`, spec])),
  ...Object.fromEntries(Object.entries(SETUP_FLAGS).map(([sub, spec]) => [`setup ${sub}`, spec])),
  doctor: DOCTOR_FLAGS,
  search: SEARCH_FLAGS,
  fetch: FETCH_FLAGS,
};
