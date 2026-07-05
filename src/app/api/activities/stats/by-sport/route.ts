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

  const rows = await db
    .select({
      sport: activities.activityType,
      count: sql<number>`count(*)::int`,
      total_distance: sql<number>`coalesce(sum(${activities.distance}), 0)::float`,
      total_duration: sql<number>`coalesce(sum(${activities.duration}), 0)::float`,
      total_elevation: sql<number>`coalesce(sum(${activities.elevationGain}), 0)::float`,
      avg_hr: sql<number>`avg(${activities.avgHeartRate})::float`,
      total_calories: sql<number>`coalesce(sum(${activities.calories}), 0)::int`,
    })
    .from(activities)
    .where(where)
    .groupBy(activities.activityType);

  const sports = rows
    .map((r) => ({
      sport: r.sport ?? "Unknown",
      count: r.count,
      distance_km: Math.round(((r.total_distance ?? 0) / 1000) * 10) / 10,
      duration_hours: Math.round(((r.total_duration ?? 0) / 3600) * 10) / 10,
      elevation_m: Math.round(r.total_elevation ?? 0),
      avg_hr: Math.round(r.avg_hr ?? 0),
      calories: Math.round(r.total_calories ?? 0),
    }))
    .sort((a, b) => b.count - a.count);

  return NextResponse.json({ sports });
}
