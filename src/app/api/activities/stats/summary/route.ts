import { NextResponse, type NextRequest } from "next/server";
import { and, eq, gte, lte, sql, type SQL } from "drizzle-orm";
import { db } from "@/server/db";
import { activities } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const sp = req.nextUrl.searchParams;
  const startDate = sp.get("start_date");
  const endDate = sp.get("end_date");

  const conds: SQL[] = [eq(activities.userId, session.user.id)];
  if (startDate) conds.push(gte(activities.startDate, new Date(`${startDate}T00:00:00Z`)));
  if (endDate) conds.push(lte(activities.startDate, new Date(`${endDate}T23:59:59.999Z`)));
  const where = conds.length === 1 ? conds[0] : and(...conds);

  const [row] = await db
    .select({
      total_activities: sql<number>`count(*)::int`,
      total_distance: sql<number>`coalesce(sum(${activities.distance}), 0)::float`,
      total_duration: sql<number>`coalesce(sum(${activities.duration}), 0)::float`,
      total_elevation: sql<number>`coalesce(sum(${activities.elevationGain}), 0)::float`,
      avg_heart_rate: sql<number>`avg(${activities.avgHeartRate})::float`,
      avg_pace: sql<number>`avg(${activities.avgPace})::float`,
    })
    .from(activities)
    .where(where);

  return NextResponse.json({
    total_activities: row.total_activities ?? 0,
    total_distance_km: Math.round(((row.total_distance ?? 0) / 1000) * 100) / 100,
    total_duration_hours: Math.round(((row.total_duration ?? 0) / 3600) * 100) / 100,
    total_elevation_m: Math.round(row.total_elevation ?? 0),
    avg_heart_rate: Math.round(row.avg_heart_rate ?? 0),
    avg_pace_per_km: Math.round(row.avg_pace ?? 0),
  });
}
