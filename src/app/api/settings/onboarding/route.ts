import { NextResponse, type NextRequest } from "next/server";
import { eq, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { users, type OnboardingState, type UserPreferences } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
import { errorJson, parseJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  welcomed: z.boolean().optional(),
  /** A tour id to record as finished. Recording is idempotent. */
  tour_done: z.string().trim().min(1).max(64).optional(),
});

/**
 * PATCH /api/settings/onboarding — record that setup happened.
 *
 * The write is a SQL-level jsonb merge, not a read-modify-write of the whole
 * column. Two of these race routinely: /welcome records the visit on mount
 * while the user is already clicking into the tour, and the tour's completion
 * write can overlap a zones save from the settings page the tour walks through.
 * Reading the column and writing it back whole would let the loser's changes
 * vanish — including `welcomed_at`, whose absence permanently stops the tour
 * from ever auto-starting for that account.
 */
export async function PATCH(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;
  const { welcomed, tour_done } = parsed.data;
  if (welcomed === undefined && tour_done === undefined) {
    return errorJson("Nothing to update", 400);
  }

  const prefs = (session.user.preferences ?? {}) as UserPreferences;
  const existing: OnboardingState = prefs.onboarding ?? {};

  const patch: OnboardingState = {};
  // First write wins: welcomed_at is when setup was first seen, and re-running
  // setup later must not rewrite it.
  if (welcomed && !existing.welcomed_at) patch.welcomed_at = new Date().toISOString();
  if (tour_done) patch.tours_done = [...new Set([...(existing.tours_done ?? []), tour_done])];

  if (Object.keys(patch).length === 0) {
    // Nothing new to record (already welcomed, tour already logged). Answering
    // with the current state keeps the call idempotent without a pointless write.
    return NextResponse.json({ onboarding: existing });
  }

  // `||` merges at the top level only, so the nested onboarding object is
  // rebuilt from the snapshot and merged as a unit; sibling keys (zones,
  // thresholds, FTP) are never named and therefore never at risk.
  const merged: OnboardingState = { ...existing, ...patch };
  const [updated] = await db
    .update(users)
    .set({
      preferences: sql`${users.preferences} || ${JSON.stringify({ onboarding: merged })}::jsonb`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, session.user.id))
    .returning({ preferences: users.preferences });

  const saved = (updated?.preferences as UserPreferences | undefined)?.onboarding ?? merged;
  return NextResponse.json({ onboarding: saved });
}
