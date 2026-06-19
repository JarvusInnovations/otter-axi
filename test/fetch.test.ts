import { afterEach, describe, expect, it } from "vitest";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { resolveExportPath } from "../src/commands/fetch.js";

const now = new Date("2026-06-19T14:54:29.123Z");

describe("resolveExportPath", () => {
  afterEach(() => {
    delete process.env.OTTER_AXI_CONFIG_DIR;
  });

  it("returns an explicit absolute path unchanged", () => {
    expect(resolveExportPath("/tmp/x.json", "json", "abc", now)).toBe("/tmp/x.json");
  });

  it("expands a ~/ explicit path", () => {
    expect(resolveExportPath("~/x.csv", "csv", "abc", now)).toBe(join(homedir(), "x.csv"));
  });

  it("resolves a relative explicit path from cwd", () => {
    expect(resolveExportPath("out/x.tsv", "tsv", "abc", now)).toBe(resolve("out/x.tsv"));
  });

  it("auto-paths under the exports dir, keyed by timestamp + id + ext", () => {
    process.env.OTTER_AXI_CONFIG_DIR = "/tmp/otter-cfg";
    expect(resolveExportPath(undefined, "json", "abc123", now)).toBe(
      "/tmp/otter-cfg/exports/2026-06-19T14-54-29-123Z-abc123.json",
    );
  });
});
