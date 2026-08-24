import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/admin";
import { db } from "@/server/db";
import { clubs } from "@/server/db/schema";
import { errorJson, parseJson } from "@/server/http";
import { isSafeExternalUrl } from "@/server/services/club-features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    plan_tier: z.enum(["free", "paid"]).optional(),
    donation_url: z.string().trim().max(500).nullable().optional(),
  })
  .refine((v) => v.plan_tier !== undefined || v.donation_url !== undefined, {
    message: "Nothing to update",
  });

/** PATCH /api/admin/clubs/[id] — flip the tier or set the donation link. */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const gate = await requireAdmin(req);
  if ("response" in gate) return gate.response;

  const { id } = await params;
  const clubId = Number(id);
  if (!Number.isInteger(clubId) || clubId <= 0) return errorJson("Invalid club id", 422);

  const parsed = await parseJson(req, patchSchema);
  if ("response" in parsed) return parsed.response;
  const { plan_tier, donation_url } = parsed.data;

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (plan_tier !== undefined) update.planTier = plan_tier;
  if (donation_url !== undefined) {
    // The club page renders this as an href — same https-only guard as themes.
    const trimmed = donation_url?.trim() || null;
    if (trimmed && !isSafeExternalUrl(trimmed)) {
      return errorJson("Donation URL must be an https:// link", 422);
    }
    update.donationUrl = trimmed;
  }

  const updated = await db.update(clubs).set(update).where(eq(clubs.id, clubId)).returning();
  if (!updated.length) return errorJson("Club not found", 404);

  return NextResponse.json({
    id: updated[0].id,
    plan_tier: updated[0].planTier,
    donation_url: updated[0].donationUrl,
  });
}
