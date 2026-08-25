import { describe, expect, it } from "vitest";
import {
  IMPORT_STAGE_ORDER,
  formatBytes,
  formatElapsed,
  importStageLabel,
  type ImportStage,
} from "../import-progress";

describe("IMPORT_STAGE_ORDER", () => {
  it("runs in wall-clock order, uploading first and saving last", () => {
    expect(IMPORT_STAGE_ORDER).toEqual([
      "uploading",
      "extracting",
      "thinking",
      "writing",
      "saving",
    ]);
  });

  it("has a label for every stage", () => {
    // The progress list renders straight from this array, so a stage without a
    // label would show as a blank line mid-import.
    for (const stage of IMPORT_STAGE_ORDER) {
      expect(importStageLabel(stage)).not.toBe("");
    }
  });

  it("lists each stage once, so the tick/spinner index is unambiguous", () => {
    expect(new Set(IMPORT_STAGE_ORDER).size).toBe(IMPORT_STAGE_ORDER.length);
  });
});

describe("formatBytes", () => {
  it("scales through the units", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3.5 * 1024 * 1024)).toBe("3.5 MB");
  });

  it("returns '' for nothing worth showing, so the caller can omit it", () => {
    expect(formatBytes(0)).toBe("");
    expect(formatBytes(-1)).toBe("");
    expect(formatBytes(Number.NaN)).toBe("");
  });
});

describe("formatElapsed", () => {
  it("is m:ss, since an import routinely passes a minute", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(9)).toBe("0:09");
    expect(formatElapsed(75)).toBe("1:15");
    expect(formatElapsed(600)).toBe("10:00");
  });

  it("does not render a negative clock from a skewed timer", () => {
    expect(formatElapsed(-5)).toBe("0:00");
  });
});

describe("importStageLabel", () => {
  it("names the file being uploaded, with its size", () => {
    expect(
      importStageLabel("uploading", { stage: "uploading", filename: "plan.pdf", size: 2048 }),
    ).toBe("Uploading plan.pdf (2 KB)");
  });

  it("falls back to a generic line before a file is known", () => {
    expect(importStageLabel("uploading")).toBe("Uploading the file");
  });

  it("omits the size when there isn't one", () => {
    expect(importStageLabel("uploading", { stage: "uploading", filename: "plan.pdf" })).toBe(
      "Uploading plan.pdf",
    );
  });

  it("counts sessions once the model has emitted some", () => {
    expect(importStageLabel("writing", { stage: "writing", sessions: 24 })).toBe(
      "Reading off sessions — 24 so far",
    );
  });

  it("omits a zero count, which is the state for the first second or two", () => {
    expect(importStageLabel("writing", { stage: "writing", sessions: 0 })).toBe(
      "Reading off sessions",
    );
    expect(importStageLabel("writing")).toBe("Reading off sessions");
  });

  it("shows n of N while saving", () => {
    expect(importStageLabel("saving", { stage: "saving", done: 12, total: 86 })).toBe(
      "Saving to your calendar — 12 of 86",
    );
  });

  it("shows 0 of N at the start of saving, so the total appears immediately", () => {
    expect(importStageLabel("saving", { stage: "saving", done: 0, total: 86 })).toBe(
      "Saving to your calendar — 0 of 86",
    );
  });

  it("drops the counter when the total is unknown or empty", () => {
    expect(importStageLabel("saving", { stage: "saving", done: 0, total: 0 })).toBe(
      "Saving to your calendar",
    );
  });

  it("ignores counts belonging to another stage", () => {
    // Progress state is carried forward between frames, so a stale `sessions`
    // must not leak into the extracting line.
    const stage: ImportStage = "extracting";
    expect(importStageLabel(stage, { stage, sessions: 12, done: 3, total: 9 })).toBe(
      "Reading the document",
    );
  });
});
