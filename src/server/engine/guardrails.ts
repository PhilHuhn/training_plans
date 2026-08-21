// THE invariant of the matching engine: no merge may change any member's
// zone/stimulus. A recovery run is never pulled into someone's threshold
// pace; diverging stimulus means "same location, parallel session", never a
// forced shared effort. match-week runs every candidate through here before
// emitting it, and the test suite calls it directly with hand-built bad
// compromises.

import { MERGE_MATRIX, THRESHOLD_SHARE_BAND_SEC } from "./matrix";
import { easyPaceRange, thresholdPaceOf } from "./pace-band";
import { classifyWorkout } from "./taxonomy";
import type { Compromise, EngineMember, EngineSession, GuardrailResult } from "./types";

const PACE_SHARING_MODES = new Set(["SHARED_PACE", "SHARED_EASY_SEGMENT", "SHARED"]);

export function assertStimulusPreserved(
  compromise: Compromise,
  sessions: EngineSession[],
  members: EngineMember[],
): GuardrailResult {
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const memberById = new Map(members.map((m) => [m.id, m]));

  const entry = MERGE_MATRIX[compromise.compatClass];
  if (!entry) return { ok: false, reason: `Unknown compat class: ${compromise.compatClass}` };

  // 1. Mode must be allowed for the class (rest_race allows nothing).
  if (!entry.allowedModes.includes(compromise.mode)) {
    return {
      ok: false,
      reason: `Mode ${compromise.mode} not allowed for class ${compromise.compatClass}`,
    };
  }

  if (compromise.memberSessionIds.length < 2) {
    return { ok: false, reason: "A compromise needs at least two sessions" };
  }

  // 2. Intra-cluster only: every participating session must classify to the
  //    compromise's class. This is what makes cross-class merges impossible.
  for (const sessionId of compromise.memberSessionIds) {
    const session = sessionById.get(sessionId);
    if (!session) return { ok: false, reason: `Unknown session ${sessionId}` };
    const cls = classifyWorkout(session.workout, { isRace: session.isRace });
    if (cls !== compromise.compatClass) {
      return {
        ok: false,
        reason: `Session ${sessionId} is ${cls ?? "unclassifiable"}, not ${compromise.compatClass} — cross-class merge`,
      };
    }
  }

  // 3. Shifts must respect each session's flexDays.
  for (const shift of compromise.shifted ?? []) {
    const session = sessionById.get(shift.sessionId);
    if (!session) return { ok: false, reason: `Unknown shifted session ${shift.sessionId}` };
    const delta = Math.abs(
      (Date.parse(shift.to) - Date.parse(shift.from)) / (24 * 3600 * 1000),
    );
    if (delta > session.flexDays) {
      return { ok: false, reason: `Shift of ${delta}d exceeds flexDays=${session.flexDays}` };
    }
  }

  // 4. Shared-pace rules.
  const shared = compromise.sharedPaceSecPerKm;
  if (shared != null) {
    if (!PACE_SHARING_MODES.has(compromise.mode)) {
      return { ok: false, reason: `Mode ${compromise.mode} must not carry a shared pace` };
    }
    if (compromise.compatClass === "intervals") {
      return { ok: false, reason: "Interval sessions never get a shared pace" };
    }

    for (const memberId of compromise.memberIds) {
      const member = memberById.get(memberId);
      if (!member) return { ok: false, reason: `Unknown member ${memberId}` };

      if (compromise.mode === "SHARED") {
        // Shared threshold effort: everyone's own threshold within the band.
        const threshold = thresholdPaceOf(member);
        if (threshold == null) {
          return { ok: false, reason: `Member ${memberId} has no threshold pace — cannot SHARE` };
        }
        const band = entry.thresholdBandSec ?? THRESHOLD_SHARE_BAND_SEC;
        if (Math.abs(shared - threshold) > band) {
          return {
            ok: false,
            reason: `Shared threshold pace ${shared} is ${Math.abs(shared - threshold)}s from member ${memberId}'s threshold (band ${band}s)`,
          };
        }
      } else {
        // Easy-based sharing: pace must sit inside everyone's Z1–2 band.
        const range = easyPaceRange(member);
        if (!range) {
          return { ok: false, reason: `Member ${memberId} has no pace data — cannot pace-share` };
        }
        if (shared > range.slow || shared < range.fast) {
          return {
            ok: false,
            reason: `Shared pace ${shared} outside member ${memberId}'s easy band [${range.fast}–${range.slow}]`,
          };
        }
      }
    }
  } else if (entry.paceSharing && PACE_SHARING_MODES.has(compromise.mode)) {
    return { ok: false, reason: `Mode ${compromise.mode} requires a shared pace` };
  }

  return { ok: true };
}
