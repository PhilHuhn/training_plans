/**
 * Stage vocabulary for importing a training plan file.
 *
 * Every stage here reports something the server (or the browser) actually did —
 * none of it is a timer pretending to be progress. The upload's slow phase is
 * the model call, which can run for minutes; before this the browser showed a
 * static "Parsing..." badge for the whole of it.
 *
 * Pure — no React, no server imports — so the ordering and the wording are
 * testable, and the server and the client cannot drift on the stage names.
 */

export type ImportStage = "uploading" | "extracting" | "thinking" | "writing" | "saving";

/**
 * Wall-clock order. `uploading` is the only client-side stage: it holds from
 * the moment the request is sent until the server's first frame arrives. The
 * rest are emitted by the server as it reaches them.
 */
export const IMPORT_STAGE_ORDER: ImportStage[] = [
  "uploading",
  "extracting",
  "thinking",
  "writing",
  "saving",
];

/** Server-side stages only — what `processUploadedPlan` is allowed to report. */
export type ServerImportStage = Exclude<ImportStage, "uploading">;

export interface ImportProgress {
  stage: ImportStage;
  /** Sessions counted in the model's partial JSON (writing stage). */
  sessions?: number;
  /** Sessions written so far / in total (saving stage). */
  done?: number;
  total?: number;
  /** Shown while uploading, so the reader can see which file is in flight. */
  filename?: string;
  size?: number;
}

/** Human-readable file size. Deliberately coarse — this is a reassurance, not a measurement. */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

/** m:ss, for an elapsed counter that routinely passes a minute. */
export function formatElapsed(seconds: number): string {
  const safe = Math.max(0, Math.floor(seconds));
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * The line shown for one stage.
 *
 * Counts are omitted until they are non-zero: "Reading off sessions" reads
 * better than "Reading off sessions — 0 so far" in the second before the model
 * emits its first date.
 */
export function importStageLabel(stage: ImportStage, p: ImportProgress = { stage }): string {
  switch (stage) {
    case "uploading": {
      const size = p.size ? ` (${formatBytes(p.size)})` : "";
      return p.filename ? `Uploading ${p.filename}${size}` : "Uploading the file";
    }
    case "extracting":
      return "Reading the document";
    case "thinking":
      return "Working out the shape of the plan — weeks, phases, key sessions";
    case "writing":
      return p.sessions && p.sessions > 0
        ? `Reading off sessions — ${p.sessions} so far`
        : "Reading off sessions";
    case "saving":
      return p.total && p.total > 0
        ? `Saving to your calendar — ${p.done ?? 0} of ${p.total}`
        : "Saving to your calendar";
  }
}
