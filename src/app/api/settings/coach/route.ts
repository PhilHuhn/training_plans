import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
import { parseJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  coach_instructions: z.string().max(20_000).nullable().optional(),
  athlete_profile: z.string().max(20_000).nullable().optional(),
});

export async function PUT(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (data.coach_instructions !== undefined) {
    update.coachInstructions = data.coach_instructions?.trim() || null;
  }
  if (data.athlete_profile !== undefined) {
    update.athleteProfile = data.athlete_profile?.trim() || null;
  }

  const [updated] = await db
    .update(users)
    .set(update)
    .where(eq(users.id, session.user.id))
    .returning({
      coachInstructions: users.coachInstructions,
      athleteProfile: users.athleteProfile,
    });

  return NextResponse.json({
    message: "Coach settings updated",
    coach_instructions: updated.coachInstructions,
    athlete_profile: updated.athleteProfile,
  });
}
