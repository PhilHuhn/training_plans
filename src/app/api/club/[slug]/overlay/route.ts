import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import type { ClubOverlayResponse } from "@/lib/types";
import type { ZoneMap } from "@/lib/zone-calc";
import { requireClubMember } from "@/server/auth/club";
import { db } from "@/server/db";
import { clubMemberships, competitions, trainingSessions, users } from "@/server/db/schema";
import { matchWeek, type EngineMember, type EngineSession } from "@/server/engine";
import {
  serializeCompromise,
  serializeOverlayRow,
  type OverlayMember,
  type OverlaySession,
  type Viewer,
} from "@/server/services/club-serializers";
import { resolveEffectiveWorkout } from "@/server/services/workout-normalize";
import { errorJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 3600 * 1000;

/** Monday of the week containing `date` (UTC date math on YYYY-MM-DD). */
function mondayOf(date: Date): string {
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const dow = (new Date(utc).getUTCDay() + 6) % 7; // 0 = Monday
  return new Date(utc - dow * DAY_MS).toISOString().slice(0, 10);
}

function addDays(date: string, days: number): string {
  return new Date(Date.parse(date) + days * DAY_MS).toISOString().slice(0, 10);
}

/**
 * GET /api/club/[slug]/overlay?week=YYYY-MM-DD
 *
 * The club week overlay: one row per member plus the computed compromises.
 * Tenancy: member sessions are selected via the membership join — client
 * input never chooses whose data is loaded. Visibility is enforced by the
 * club-serializers choke point.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireClubMember(req, slug);
  if ("response" in ctx) return ctx.response;

  const weekParam = req.nextUrl.searchParams.get("week");
  if (weekParam && !/^\d{4}-\d{2}-\d{2}$/.test(weekParam)) {
    return errorJson("Invalid week (expected YYYY-MM-DD)", 422);
  }
  const weekStart = weekParam ? mondayOf(new Date(weekParam)) : mondayOf(new Date());
  const weekEnd = addDays(weekStart, 6);

  // --- Members of this club (the tenancy boundary for everything below).
  const memberRows = await db
    .select({
      userId: clubMemberships.userId,
      name: users.name,
      role: clubMemberships.role,
      visibility: clubMemberships.visibility,
      preferences: users.preferences,
    })
    .from(clubMemberships)
    .innerJoin(users, eq(clubMemberships.userId, users.id))
    .where(eq(clubMemberships.clubId, ctx.club.id))
    .orderBy(users.name);
  const memberIds = memberRows.map((m) => m.userId);

  // --- Their sessions + races in the requested week.
  const sessionRows = memberIds.length
    ? await db
        .select()
        .from(trainingSessions)
        .where(
          and(
            inArray(trainingSessions.userId, memberIds),
            gte(trainingSessions.sessionDate, weekStart),
            lte(trainingSessions.sessionDate, weekEnd),
          ),
        )
    : [];

  const raceRows = memberIds.length
    ? await db
        .select({ userId: competitions.userId, raceDate: competitions.raceDate })
        .from(competitions)
        .where(
          and(
            inArray(competitions.userId, memberIds),
            gte(competitions.raceDate, weekStart),
            lte(competitions.raceDate, weekEnd),
          ),
        )
    : [];
  const raceDays = new Set(raceRows.map((r) => `${r.userId}|${r.raceDate}`));

  // --- Engine input (short-key recommendation workouts normalized here).
  const engineMembers: EngineMember[] = memberRows.map((m) => ({
    id: m.userId,
    name: m.name,
    visibility: m.visibility,
    thresholdPaceSec:
      typeof m.preferences?.threshold_pace === "number" ? m.preferences.threshold_pace : null,
    paceZones: (m.preferences?.pace_zones as ZoneMap | undefined) ?? null,
  }));

  const overlaySessions: OverlaySession[] = [];
  const engineSessions: EngineSession[] = [];
  for (const row of sessionRows) {
    const workout = resolveEffectiveWorkout(row);
    overlaySessions.push({
      id: row.id,
      userId: row.userId,
      sessionDate: row.sessionDate,
      status: row.status,
      workout,
    });
    if (workout) {
      engineSessions.push({
        id: row.id,
        memberId: row.userId,
        date: row.sessionDate,
        flexDays: row.flexDays,
        workout,
        isRace: raceDays.has(`${row.userId}|${row.sessionDate}`),
      });
    }
  }

  const { compromises } = matchWeek({
    members: engineMembers,
    sessions: engineSessions,
    weekStart,
  });

  // --- Serialize through the visibility choke point.
  const viewer: Viewer = { userId: ctx.user.id, isCoach: ctx.membership.role === "coach" };
  const overlayMembers: OverlayMember[] = memberRows.map((m) => ({
    userId: m.userId,
    name: m.name,
    role: m.role,
    visibility: m.visibility,
  }));

  const body: ClubOverlayResponse = {
    club: {
      id: ctx.club.id,
      name: ctx.club.name,
      slug: ctx.club.slug,
      plan_tier: ctx.club.planTier,
      role: ctx.membership.role,
      visibility: ctx.membership.visibility,
    },
    week_start: weekStart,
    week_end: weekEnd,
    rows: overlayMembers.map((m) => serializeOverlayRow(m, overlaySessions, viewer)),
    shared: compromises.map((c) => serializeCompromise(c, overlayMembers, viewer)),
  };

  return NextResponse.json(body);
}
