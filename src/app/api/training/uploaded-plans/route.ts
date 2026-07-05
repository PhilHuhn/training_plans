import { NextResponse, type NextRequest } from "next/server";
import { desc, eq } from "drizzle-orm";
import { db } from "@/server/db";
import { uploadedPlans } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const rows = await db
    .select()
    .from(uploadedPlans)
    .where(eq(uploadedPlans.userId, session.user.id))
    .orderBy(desc(uploadedPlans.uploadDate));

  return NextResponse.json(
    rows.map((p) => ({
      id: p.id,
      filename: p.filename,
      is_active: Boolean(p.isActive),
      parsed_sessions_count: Array.isArray(p.parsedSessions)
        ? (p.parsedSessions as unknown[]).length
        : 0,
      upload_date: p.uploadDate.toISOString(),
    })),
  );
}
