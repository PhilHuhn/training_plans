export * from "./types";
export { MERGE_MATRIX, THRESHOLD_SHARE_BAND_SEC } from "./matrix";
export { classifyWorkout } from "./taxonomy";
export {
  easyPaceRange,
  sharedEasyPace,
  thresholdPaceOf,
  thresholdSpread,
  typicalEasyPace,
} from "./pace-band";
export { matchWeek, intervalSkeleton } from "./match-week";
export { assertStimulusPreserved } from "./guardrails";
export { buildNote, type CompromiseNote } from "./notes";
