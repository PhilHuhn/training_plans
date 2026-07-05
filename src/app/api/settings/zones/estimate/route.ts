import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/server/auth/session";
import { errorJson } from "@/server/http";
import { estimateZonesFromStrava } from "@/server/services/zones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const daysBack = parseInt(req.nextUrl.searchParams.get("days_back") ?? "90", 10) || 90;
  const result = await estimateZonesFromStrava(session.user, daysBack);
  if (!result.success) return errorJson(result.error ?? "Failed to estimate zones", 400);
  return NextResponse.json(result);
}
