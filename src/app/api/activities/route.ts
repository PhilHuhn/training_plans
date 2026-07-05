import { NextResponse, type NextRequest } from "next/server";
import { and, desc, eq, gte, lte, sql } from "drizzle-orm";
import { db } from "@/server/db";
import { activities } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
import { activityResponse } from "@/server/serializers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const sp = req.nextUrl.searchParams;
  const startDate = sp.get("start_date");
  const endDate = sp.get("end_date");
  const activityType = sp.get("activity_type");
  const page = Math.max(1, parseInt(sp.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(100, Math.max(1, parseInt(sp.get("per_page") ?? "20", 10) || 20));

  const conds = [eq(activities.userId, session.user.id)];
  if (startDate) {
    conds.push(gte(activities.startDate, new Date(`${startDate}T00:00:00Z`)));
  }
  if (endDate) {
    conds.push(lte(activities.startDate, new Date(`${endDate}T23:59:59.999Z`)));
  }
  if (activityType) conds.push(eq(activities.activityType, activityType));

  const where = conds.length === 1 ? conds[0] : and(...conds);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(activities)
    .where(where);

  const rows = await db
    .select()
    .from(activities)
    .where(where)
    .orderBy(desc(activities.startDate))
    .limit(perPage)
    .offset((page - 1) * perPage);

  return NextResponse.json({
    activities: rows.map(activityResponse),
    total: count,
    page,
    per_page: perPage,
  });
}
