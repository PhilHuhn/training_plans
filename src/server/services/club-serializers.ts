// The single visibility choke point for the club overlay. Everything a
// club member sees about a teammate flows through here — UI never filters
// secrets, the server strips them. Deliberately NOT "server-only" so the
// redaction rules are unit-testable under Vitest.
//
// Rules:
//   - viewer is coach → full data for everyone
//   - viewer is the member themself → full
//   - member.visibility === "full" → full
//   - else → availability + session type + duration only (redacted: true)
//   - compromise pace/notes may leak a typ_only member's pace indirectly:
//     shared_pace_sec and the pace-bearing note are included only when EVERY
//     participant is "full" (or the viewer is coach).

import type {
  ClubMemberSessionWire,
  ClubOverlayRow,
  CompromiseMode,
  CompromiseWire,
  WorkoutDetails,
} from "@/lib/types";
import { buildNote } from "@/server/engine/notes";
import type { Compromise } from "@/server/engine/types";

export type Viewer = {
  userId: number;
  isCoach: boolean;
};

export type OverlayMember = {
  userId: number;
  name: string;
  role: "coach" | "athlete" | "captain";
  visibility: "typ_only" | "full";
};

export type OverlaySession = {
  id: number;
  userId: number;
  sessionDate: string;
  status: "planned" | "completed" | "skipped" | "modified";
  workout: WorkoutDetails | null;
};

export function canSeeFull(viewer: Viewer, member: OverlayMember): boolean {
  return viewer.isCoach || viewer.userId === member.userId || member.visibility === "full";
}

export function serializeMemberSession(
  session: OverlaySession,
  member: OverlayMember,
  viewer: Viewer,
): ClubMemberSessionWire {
  const workout = session.workout;
  const base = {
    session_id: session.id,
    user_id: session.userId,
    session_date: session.sessionDate,
    status: session.status,
    session_type: workout?.type ?? null,
    duration_min: workout?.duration_min ?? null,
  };

  if (!canSeeFull(viewer, member)) {
    return { ...base, redacted: true };
  }

  return {
    ...base,
    redacted: false,
    distance_km: workout?.distance_km ?? null,
    pace_range: workout?.pace_range ?? null,
    hr_zone: workout?.hr_zone ?? null,
    intensity: workout?.intensity ?? null,
    description: workout?.description ?? null,
    intervals: workout?.intervals ?? null,
  };
}

export function serializeOverlayRow(
  member: OverlayMember,
  sessions: OverlaySession[],
  viewer: Viewer,
): ClubOverlayRow {
  return {
    user_id: member.userId,
    name: member.name,
    role: member.role,
    visibility: member.visibility,
    sessions: sessions
      .filter((s) => s.userId === member.userId)
      .map((s) => serializeMemberSession(s, member, viewer)),
  };
}

export function serializeCompromise(
  compromise: Compromise,
  members: OverlayMember[],
  viewer: Viewer,
): CompromiseWire {
  const memberById = new Map(members.map((m) => [m.userId, m]));
  const participants = compromise.memberIds
    .map((id) => memberById.get(id))
    .filter((m): m is OverlayMember => !!m);

  // Pace-safe only when every participant opted into full visibility (their
  // shared pace derives from the slowest participant's zones) or viewer=coach.
  const paceSafe = viewer.isCoach || participants.every((m) => m.visibility === "full");
  const note = buildNote(compromise);

  return {
    date: compromise.date,
    weekday: compromise.weekday,
    mode: compromise.mode as CompromiseMode,
    compat_class: compromise.compatClass,
    member_ids: [...compromise.memberIds],
    member_session_ids: [...compromise.memberSessionIds],
    note: paceSafe ? note.full : note.visibilitySafe,
    shared_pace_sec: paceSafe ? (compromise.sharedPaceSecPerKm ?? null) : null,
    skeleton: compromise.skeleton ?? null,
    ...(compromise.shifted?.length
      ? {
          shifted: compromise.shifted.map((s) => ({
            session_id: s.sessionId,
            from: s.from,
            to: s.to,
          })),
        }
      : {}),
  };
}
