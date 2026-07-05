import { NextResponse, type NextRequest } from "next/server";
import { and, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { users, zoneHistory, type UserPreferences } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
import { errorJson } from "@/server/http";
import { saveZonesToHistory } from "@/server/services/zones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ZoneRange = { min: number; max: number; name?: string };
type ZoneMap = Record<string, ZoneRange>;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ historyId: string }> },
) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const { historyId } = await params;
  const rows = await db
    .select()
    .from(zoneHistory)
    .where(
      and(
        eq(zoneHistory.id, Number(historyId)),
        eq(zoneHistory.userId, session.user.id),
      ),
    )
    .limit(1);
  const entry = rows[0];
  if (!entry) return errorJson("Zone history entry not found", 404);

  const prefs: UserPreferences = { ...(session.user.preferences ?? {}) } as UserPreferences;
  if (entry.maxHr != null) prefs.max_hr = entry.maxHr;
  if (entry.restingHr != null) prefs.resting_hr = entry.restingHr;
  if (entry.thresholdPace != null) prefs.threshold_pace = entry.thresholdPace;
  if (entry.hrZones != null) prefs.hr_zones = entry.hrZones as ZoneMap;
  if (entry.paceZones != null) prefs.pace_zones = entry.paceZones as ZoneMap;
  if (entry.ftp != null) prefs.ftp = entry.ftp;
  if (entry.cyclingPowerZones != null) prefs.cycling_power_zones = entry.cyclingPowerZones as ZoneMap;

  await db
    .update(users)
    .set({ preferences: prefs, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  await saveZonesToHistory(
    session.user,
    {
      max_hr: prefs.max_hr ?? null,
      resting_hr: prefs.resting_hr ?? null,
      threshold_pace: prefs.threshold_pace ?? null,
      hr_zones: (prefs.hr_zones ?? null) as ZoneMap | null,
      pace_zones: (prefs.pace_zones ?? null) as ZoneMap | null,
      ftp: prefs.ftp ?? null,
      cycling_power_zones: (prefs.cycling_power_zones ?? null) as ZoneMap | null,
      notes: `Reverted to snapshot #${historyId}`,
    },
    "reverted",
  );

  return NextResponse.json({ message: "Zones reverted", preferences: prefs });
}
