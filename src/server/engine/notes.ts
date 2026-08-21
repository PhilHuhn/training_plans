// German note templates per merge mode. `full` may contain concrete paces;
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
        full: `Gemeinsamer lockerer Lauf${pace ? ` @ ${pace}` : ""} — Tempo des langsamsten Easy-Bereichs.`,
        visibilitySafe: "Gemeinsamer lockerer Lauf im gemeinsamen Wohlfühltempo.",
      };
    case "SHARED_EASY_SEGMENT":
      return {
        full: `Gemeinsame Easy-Kilometer${pace ? ` @ ${pace}` : ""}, Qualitätsabschnitte getrennt laufen.`,
        visibilitySafe: "Gemeinsame Easy-Kilometer, Qualitätsabschnitte getrennt laufen.",
      };
    case "SHARED":
      return {
        full: `Gemeinsamer Schwellenlauf${pace ? ` @ ${pace}` : ""} — Tempo-Spread liegt im Band.`,
        visibilitySafe: "Gemeinsamer Schwellenlauf — Tempos liegen nah genug beieinander.",
      };
    case "PARALLEL_TIME_BASED":
      return {
        full: "Gleiche Strecke, zeitbasiert — jede:r im eigenen Schwellentempo.",
        visibilitySafe: "Gleiche Strecke, zeitbasiert — jede:r im eigenen Schwellentempo.",
      };
    case "PARALLEL_SAME_STRUCTURE":
      return {
        full: `Gleiche Intervallstruktur${compromise.skeleton ? ` (${compromise.skeleton})` : ""}, eigenes Tempo — Treffpunkt Bahn.`,
        visibilitySafe: `Gleiche Intervallstruktur${compromise.skeleton ? ` (${compromise.skeleton})` : ""}, eigenes Tempo — Treffpunkt Bahn.`,
      };
    case "COLOCATED_OPTIONAL":
      return {
        full: "Gleiche Location möglich (Kraft/Cross) — kein gemeinsames Laufen nötig.",
        visibilitySafe: "Gleiche Location möglich (Kraft/Cross) — kein gemeinsames Laufen nötig.",
      };
    default:
      return { full: "", visibilitySafe: "" };
  }
}
