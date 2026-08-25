import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
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
 * Read-modify-write rather than a jsonb path update: preferences also carries
 * zones, FTP and thresholds, and a whole-column write built from a partial
 * object would silently drop them.
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
  const onboarding: OnboardingState = { ...(prefs.onboarding ?? {}) };

  // First write wins: welcomed_at is when setup was first seen, and re-running
  // it later must not rewrite that.
  if (welcomed && !onboarding.welcomed_at) onboarding.welcomed_at = new Date().toISOString();

  if (tour_done) {
    const done = new Set(onboarding.tours_done ?? []);
    done.add(tour_done);
    onboarding.tours_done = [...done];
  }

  const next: UserPreferences = { ...prefs, onboarding };

  await db
    .update(users)
    .set({ preferences: next, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ onboarding });
}
