import { describe, expect, it } from "vitest";
import {
  parseTranscript,
  segmentsToText,
  segmentsToCsv,
  segmentsToTsv,
} from "../src/transcript.js";

describe("parseTranscript", () => {
  it("parses one segment per timestamped line", () => {
    const t = "[0:00:00] Speaker 1: Hello there\n[0:00:02] Speaker 2: Hi";
    const segs = parseTranscript(t);
    expect(segs).toEqual([
      { start: "0:00:00", speaker: "Speaker 1", text: "Hello there" },
      { start: "0:00:02", speaker: "Speaker 2", text: "Hi" },
    ]);
  });

  it("captures real speaker names, not just Speaker N", () => {
    const segs = parseTranscript("[1:02:03] Jane Doe: morning");
    expect(segs[0]).toEqual({ start: "1:02:03", speaker: "Jane Doe", text: "morning" });
  });

  it("appends non-matching lines as continuations (never drops content)", () => {
    const t = "[0:00:00] Speaker 1: line one\ncontinued here\n\n[0:00:05] Speaker 2: next";
    const segs = parseTranscript(t);
    expect(segs).toHaveLength(2);
    expect(segs[0].text).toBe("line one\ncontinued here\n");
    expect(segs[1].text).toBe("next");
  });

  it("keeps leading pre-timestamp text in an empty-header segment", () => {
    const segs = parseTranscript("preamble junk\n[0:00:01] Speaker 1: real");
    expect(segs[0]).toEqual({ start: "", speaker: "", text: "preamble junk" });
    expect(segs[1].start).toBe("0:00:01");
  });

  it("round-trips losslessly: segmentsToText(parse(x)) === x", () => {
    const t =
      "[0:00:00] Speaker 1: a, with comma\ntrailing line\n[0:00:09] Speaker 2: b\n[1:11:22] Speaker 1: c";
    expect(segmentsToText(parseTranscript(t))).toBe(t);
  });
});

describe("serializers", () => {
  const segs = parseTranscript('[0:00:00] Speaker 1: has "quotes", commas\nand a newline');

  it("CSV quotes commas, quotes, and embedded newlines (RFC 4180)", () => {
    const csv = segmentsToCsv(segs);
    expect(csv.split("\r\n")[0]).toBe("start,speaker,text");
    expect(csv).toContain('"has ""quotes"", commas\nand a newline"');
  });

  it("TSV escapes tabs/newlines so each segment stays one line", () => {
    const tsv = segmentsToTsv(segs);
    const lines = tsv.trimEnd().split("\n");
    expect(lines[0]).toBe("start\tspeaker\ttext");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("\\n");
  });
});
