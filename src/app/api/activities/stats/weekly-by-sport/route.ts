import { NextResponse, type NextRequest } from "next/server";
import { and, asc, eq, gte } from "drizzle-orm";
import { db } from "@/server/db";
import { activities } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface SportStats {
  distance_km: number;
  duration_hours: number;
  count: number;
}

function mondayOf(date: Date): string {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun, 1=Mon..6=Sat
  const diff = day === 0 ? -6 : 1 - day; // shift to Monday
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const weeksParam = parseInt(req.nextUrl.searchParams.get("weeks") ?? "12", 10) || 12;
  const weeks = Math.max(1, Math.min(52, weeksParam));
  const start = new Date(Date.now() - weeks * 7 * 24 * 60 * 60 * 1000);

  const rows = await db
    .select()
    .from(activities)
    .where(and(eq(activities.userId, session.user.id), gte(activities.startDate, start)))
    .orderBy(asc(activities.startDate));

  const weekly = new Map<string, Map<string, SportStats>>();
  for (const a of rows) {
    const wk = mondayOf(a.startDate);
    const sport = a.activityType || "Unknown";
    let bucket = weekly.get(wk);
    if (!bucket) {
      bucket = new Map();
      weekly.set(wk, bucket);
    }
    let entry = bucket.get(sport);
    if (!entry) {
      entry = { distance_km: 0, duration_hours: 0, count: 0 };
      bucket.set(sport, entry);
    }
    entry.distance_km += (a.distance ?? 0) / 1000;
    entry.duration_hours += (a.duration ?? 0) / 3600;
    entry.count += 1;
  }

  const ordered = Array.from(weekly.keys()).sort();
  const weeksData = ordered.map((wk) => {
    const sports: Record<string, SportStats> = {};
    const bucket = weekly.get(wk)!;
    for (const [sport, stats] of bucket) {
      sports[sport] = {
        distance_km: Math.round(stats.distance_km * 10) / 10,
        duration_hours: Math.round(stats.duration_hours * 10) / 10,
        count: stats.count,
      };
    }
    return { week: wk, sports };
  });

  return NextResponse.json({ weeks: weeksData });
}
