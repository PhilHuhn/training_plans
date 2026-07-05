import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/server/db";
import { activities, type UserPreferences } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
import { errorJson } from "@/server/http";
import { calculateCyclingPowerZonesFromFtp } from "@/server/services/zones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RIDE_TYPES = ["Ride", "VirtualRide", "MountainBikeRide"];

interface RideRawData {
  weighted_average_watts?: number | null;
  average_watts?: number | null;
  [k: string]: unknown;
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const daysBack = parseInt(req.nextUrl.searchParams.get("days_back") ?? "90", 10) || 90;
  const cutoff = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);

  const rides = await db
    .select()
    .from(activities)
    .where(
      and(
        eq(activities.userId, session.user.id),
        inArray(activities.activityType, RIDE_TYPES),
        gte(activities.startDate, cutoff),
      ),
    )
    .orderBy(desc(activities.startDate));

  if (rides.length === 0) {
    return errorJson(`No cycling activities found in the last ${daysBack} days`, 400);
  }

  let bestAvgPower = 0;
  let ridesWithPower = 0;
  for (const ride of rides) {
    const raw = (ride.rawData ?? {}) as RideRawData;
    const weighted = raw.weighted_average_watts ?? raw.average_watts ?? 0;
    if (weighted && weighted > 0) {
      ridesWithPower += 1;
      const durationMins = (ride.duration ?? 0) / 60;
      if (durationMins >= 20 && weighted > bestAvgPower) bestAvgPower = weighted;
    }
  }

  if (bestAvgPower <= 0) {
    for (const ride of rides) {
      const raw = (ride.rawData ?? {}) as RideRawData;
      const avgW = raw.average_watts ?? 0;
      if (avgW && avgW > bestAvgPower) bestAvgPower = avgW;
    }
  }

  if (bestAvgPower <= 0) {
    const prefs = (session.user.preferences ?? {}) as UserPreferences;
    const existingFtp = prefs.ftp;
    if (existingFtp) {
      return NextResponse.json({
        ftp: existingFtp,
        cycling_power_zones: calculateCyclingPowerZonesFromFtp(existingFtp),
        activities_analyzed: rides.length,
        note: "No power data found in rides. Using existing FTP value.",
      });
    }
    return errorJson("No power data found in cycling activities. Enter FTP manually.", 400);
  }

  const estimatedFtp = Math.floor(bestAvgPower * 0.95);
  return NextResponse.json({
    ftp: estimatedFtp,
    cycling_power_zones: calculateCyclingPowerZonesFromFtp(estimatedFtp),
    activities_analyzed: rides.length,
    rides_with_power: ridesWithPower,
  });
}
