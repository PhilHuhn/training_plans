// The matching engine core. Per weekday (with flexDays shifting), cluster
// club members' sessions by compatibility class, resolve the merge mode from
// the matrix (+ pace spread / interval skeleton), and emit Compromises — each
// one validated by the guardrail before it leaves this module.

import { assertStimulusPreserved } from "./guardrails";
import { MERGE_MATRIX, THRESHOLD_SHARE_BAND_SEC } from "./matrix";
import { sharedEasyPace, thresholdPaceOf } from "./pace-band";
import { classifyWorkout } from "./taxonomy";
import type {
  CompatClass,
  Compromise,
  EngineMember,
  EngineSession,
  MatchWeekInput,
  MatchWeekResult,
  MergeMode,
  SessionShift,
} from "./types";

const DAY_MS = 24 * 3600 * 1000;

function utcOf(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

function addDays(date: string, days: number): string {
  const t = new Date(utcOf(date) + days * DAY_MS);
  return t.toISOString().slice(0, 10);
}

function dayIndex(date: string, weekStart: string): number {
  return Math.round((utcOf(date) - utcOf(weekStart)) / DAY_MS);
}

type Placed = {
  session: EngineSession;
  cls: CompatClass;
  /** Current day index after any shift. */
  day: number;
  shiftedFrom?: string;
};

/** Interval skeleton, e.g. "6×1000m" or "5×3min". Null when unstructured. */
export function intervalSkeleton(session: EngineSession): string | null {
  const intervals = session.workout.intervals;
  if (!intervals?.length) return null;
  const parts = intervals.map((set) => {
    const reps = set.reps ?? 1;
    if (set.distance_m) return `${reps}×${set.distance_m}m`;
    if (set.duration_sec) return `${reps}×${Math.round(set.duration_sec / 60)}min`;
    return `${reps}×?`;
  });
  return parts.join(" + ");
}

const MODE_ORDER: MergeMode[] = [
  "SHARED_PACE",
  "SHARED_EASY_SEGMENT",
  "SHARED",
  "PARALLEL_TIME_BASED",
  "PARALLEL_SAME_STRUCTURE",
  "COLOCATED_OPTIONAL",
  "NO_MATCH",
];

export function matchWeek(input: MatchWeekInput): MatchWeekResult {
  const { members, weekStart } = input;
  const memberById = new Map(members.map((m) => [m.id, m]));

  // --- Classify + bucket into week days (sessions outside the week ignored).
  const placed: Placed[] = [];
  for (const session of [...input.sessions].sort((a, b) => a.id - b.id)) {
    if (!memberById.has(session.memberId)) continue;
    const cls = classifyWorkout(session.workout, { isRace: session.isRace });
    if (!cls) continue;
    const day = dayIndex(session.date, weekStart);
    if (day < 0 || day > 6) continue;
    placed.push({ session, cls, day });
  }

  const occupiedDays = (memberId: number) =>
    new Set(placed.filter((p) => p.session.memberId === memberId).map((p) => p.day));

  const clusterPartners = (p: Placed, day: number) =>
    placed.filter(
      (q) => q !== p && q.day === day && q.cls === p.cls && q.session.memberId !== p.session.memberId,
    );

  // --- Flex shifting: greedy + deterministic (session-id order, smallest
  // shift first, forward before backward). A session only moves onto a day
  // where (a) a compatible cluster with another member exists and (b) the
  // member doesn't already train. rest_race never shifts.
  const shifts: SessionShift[] = [];
  for (const p of placed) {
    const flex = Math.max(0, Math.trunc(p.session.flexDays));
    if (flex === 0 || p.cls === "rest_race") continue;
    if (clusterPartners(p, p.day).length > 0) continue; // already has partners

    const deltas: number[] = [];
    for (let d = 1; d <= flex; d++) deltas.push(d, -d);

    for (const delta of deltas) {
      const target = p.day + delta;
      if (target < 0 || target > 6) continue;
      if (clusterPartners(p, target).length === 0) continue;
      const occupied = occupiedDays(p.session.memberId);
      occupied.delete(p.day);
      if (occupied.has(target)) continue;

      shifts.push({
        sessionId: p.session.id,
        from: p.session.date,
        to: addDays(weekStart, target),
      });
      p.shiftedFrom = p.session.date;
      p.day = target;
      break;
    }
  }

  // --- Cluster per (day, class); one session per member (lowest id wins).
  const compromises: Compromise[] = [];
  const clusters = new Map<string, Placed[]>();
  for (const p of placed) {
    if (p.cls === "rest_race") continue;
    const key = `${p.day}|${p.cls}`;
    const list = clusters.get(key) ?? [];
    if (!list.some((q) => q.session.memberId === p.session.memberId)) list.push(p);
    clusters.set(key, list);
  }

  for (const [key, cluster] of [...clusters.entries()].sort()) {
    if (cluster.length < 2) continue;
    const [dayStr, cls] = key.split("|") as [string, CompatClass];
    const day = Number(dayStr);
    const date = addDays(weekStart, day);
    const entry = MERGE_MATRIX[cls];

    const emit = (partial: Omit<Compromise, "date" | "weekday" | "compatClass" | "noteKey">) => {
      const shiftedHere = (partial.memberSessionIds ?? [])
        .map((id) => shifts.find((s) => s.sessionId === id))
        .filter((s): s is SessionShift => !!s);
      const compromise: Compromise = {
        date,
        weekday: day,
        compatClass: cls,
        noteKey: entry.noteKey,
        ...partial,
        ...(shiftedHere.length ? { shifted: shiftedHere } : {}),
      };
      const verdict = assertStimulusPreserved(
        compromise,
        cluster.map((p) => p.session),
        members,
      );
      if (verdict.ok) compromises.push(compromise);
    };

    const clusterMembers = cluster.map((p) => memberById.get(p.session.memberId) as EngineMember);
    const sessionOf = (memberId: number) =>
      cluster.find((p) => p.session.memberId === memberId)?.session.id as number;

    if (cls === "recovery_easy" || cls === "long") {
      const result = sharedEasyPace(clusterMembers);
      if (result) {
        emit({
          mode: cls === "long" ? "SHARED_EASY_SEGMENT" : "SHARED_PACE",
          memberIds: result.memberIds,
          memberSessionIds: result.memberIds.map(sessionOf),
          sharedPaceSecPerKm: result.sharedPaceSecPerKm,
        });
      }
    } else if (cls === "threshold_tempo") {
      const band = entry.thresholdBandSec ?? THRESHOLD_SHARE_BAND_SEC;
      const withPace = clusterMembers
        .map((m) => ({ member: m, threshold: thresholdPaceOf(m) }))
        .filter((x): x is { member: EngineMember; threshold: number } => x.threshold != null)
        .sort((a, b) => a.threshold - b.threshold || a.member.id - b.member.id);

      // Greedy band groups over sorted thresholds.
      const groups: { member: EngineMember; threshold: number }[][] = [];
      for (const x of withPace) {
        const current = groups[groups.length - 1];
        if (current && x.threshold - current[0].threshold <= band) current.push(x);
        else groups.push([x]);
      }

      const sharedGroups = groups.filter((g) => g.length >= 2);
      for (const group of sharedGroups) {
        const ids = group.map((x) => x.member.id).sort((a, b) => a - b);
        emit({
          mode: "SHARED",
          memberIds: ids,
          memberSessionIds: ids.map(sessionOf),
          // Slowest threshold in the group — faster members ease off within band.
          sharedPaceSecPerKm: Math.max(...group.map((x) => x.threshold)),
        });
      }

      // Unless the whole cluster shares one pace, everyone can still run the
      // same route time-based at their own threshold.
      const allInOneSharedGroup =
        sharedGroups.length === 1 && sharedGroups[0].length === clusterMembers.length;
      if (!allInOneSharedGroup) {
        const ids = clusterMembers.map((m) => m.id).sort((a, b) => a - b);
        emit({
          mode: "PARALLEL_TIME_BASED",
          memberIds: ids,
          memberSessionIds: ids.map(sessionOf),
        });
      }
    } else if (cls === "intervals") {
      // Group by identical skeleton; own pace, no shared pace ever.
      const bySkeleton = new Map<string, Placed[]>();
      for (const p of cluster) {
        const skeleton = intervalSkeleton(p.session);
        if (!skeleton) continue;
        bySkeleton.set(skeleton, [...(bySkeleton.get(skeleton) ?? []), p]);
      }
      for (const [skeleton, group] of [...bySkeleton.entries()].sort()) {
        if (group.length < 2) continue;
        const ids = group.map((p) => p.session.memberId).sort((a, b) => a - b);
        emit({
          mode: "PARALLEL_SAME_STRUCTURE",
          memberIds: ids,
          memberSessionIds: ids.map(sessionOf),
          skeleton,
        });
      }
    } else if (cls === "strength_cross") {
      const ids = clusterMembers.map((m) => m.id).sort((a, b) => a - b);
      emit({
        mode: "COLOCATED_OPTIONAL",
        memberIds: ids,
        memberSessionIds: ids.map(sessionOf),
      });
    }
  }

  compromises.sort(
    (a, b) =>
      a.weekday - b.weekday ||
      MODE_ORDER.indexOf(a.mode) - MODE_ORDER.indexOf(b.mode) ||
      a.memberIds.join(",").localeCompare(b.memberIds.join(",")),
  );

  return { compromises, shifts };
}
