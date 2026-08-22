// Note templates per merge mode. `full` may contain concrete paces;
// `visibilitySafe` must not (used when any participant is typ_only — see
// club-serializers.ts, the single visibility choke point).

import { formatPace } from "@/lib/pace-utils";
import type { Compromise } from "./types";

export type CompromiseNote = { full: string; visibilitySafe: string };

export function buildNote(compromise: Compromise): CompromiseNote {
  const pace = compromise.sharedPaceSecPerKm
    ? `${formatPace(compromise.sharedPaceSecPerKm)}/km`
    : null;

  switch (compromise.mode) {
    case "SHARED_PACE":
      return {
        full: `Shared easy run${pace ? ` @ ${pace}` : ""} — at the slowest easy range in the group.`,
        visibilitySafe: "Shared easy run at a pace comfortable for everyone.",
      };
    case "SHARED_EASY_SEGMENT":
      return {
        full: `Shared easy kilometers${pace ? ` @ ${pace}` : ""}, run the quality segments separately.`,
        visibilitySafe: "Shared easy kilometers, run the quality segments separately.",
      };
    case "SHARED":
      return {
        full: `Shared threshold run${pace ? ` @ ${pace}` : ""} — the pace spread fits inside the band.`,
        visibilitySafe: "Shared threshold run — paces are close enough together.",
      };
    case "PARALLEL_TIME_BASED":
      return {
        full: "Same route, time-based — everyone at their own threshold pace.",
        visibilitySafe: "Same route, time-based — everyone at their own threshold pace.",
      };
    case "PARALLEL_SAME_STRUCTURE":
      return {
        full: `Same interval structure${compromise.skeleton ? ` (${compromise.skeleton})` : ""}, own pace — meet at the track.`,
        visibilitySafe: `Same interval structure${compromise.skeleton ? ` (${compromise.skeleton})` : ""}, own pace — meet at the track.`,
      };
    case "COLOCATED_OPTIONAL":
      return {
        full: "Same location possible (strength/cross) — no shared running required.",
        visibilitySafe: "Same location possible (strength/cross) — no shared running required.",
      };
    default:
      return { full: "", visibilitySafe: "" };
  }
}
