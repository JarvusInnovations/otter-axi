import { afterEach, describe, expect, it } from "vitest";
import { homedir, tmpdir } from "node:os";
import { mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { resolveExportPath, writeExport } from "../src/commands/fetch.js";

const now = new Date("2026-06-19T14:54:29.123Z");

describe("resolveExportPath", () => {
  it("returns an explicit absolute path unchanged", () => {
    expect(resolveExportPath("/tmp/x.json", "json", "abc", now)).toBe("/tmp/x.json");
  });

  it("expands a ~/ explicit path", () => {
    expect(resolveExportPath("~/x.csv", "csv", "abc", now)).toBe(join(homedir(), "x.csv"));
  });

  it("resolves a relative explicit path from cwd", () => {
    expect(resolveExportPath("out/x.tsv", "tsv", "abc", now)).toBe(resolve("out/x.tsv"));
  });

  it("auto-paths under the OS temp dir, keyed by timestamp + id + ext", () => {
    expect(resolveExportPath(undefined, "json", "abc123", now)).toBe(
      join(tmpdir(), "otter-axi", "2026-06-19T14-54-29-123Z-abc123.json"),
    );
  });
});

describe("writeExport", () => {
  let scratch: string;
  afterEach(() => rmSync(scratch, { recursive: true, force: true }));

  it("writes auto-generated files owner-only (0600)", () => {
    scratch = mkdtempSync(join(tmpdir(), "otter-axi-test-"));
    const p = join(scratch, "auto.json");
    writeExport(p, "data", true);
    expect(readFileSync(p, "utf-8")).toBe("data");
    expect(statSync(p).mode & 0o777).toBe(0o600);
  });
});
