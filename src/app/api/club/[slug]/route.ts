import { eq } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import type { ClubDetailResponse } from "@/lib/types";
import { requireClubMember } from "@/server/auth/club";
import { db } from "@/server/db";
import { clubMemberships, sponsors, users } from "@/server/db/schema";
import { clubFeatures, sanitizeClubTheme } from "@/server/services/club-features";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/club/[slug] — club profile, members, and (paid tier only) theme +
 * sponsor. The tier gate is enforced HERE, server-side: free clubs get null
 * theme/sponsor no matter what is stored.
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const ctx = await requireClubMember(req, slug);
  if ("response" in ctx) return ctx.response;

  const memberRows = await db
    .select({
      userId: clubMemberships.userId,
      name: users.name,
      role: clubMemberships.role,
      visibility: clubMemberships.visibility,
    })
    .from(clubMemberships)
    .innerJoin(users, eq(clubMemberships.userId, users.id))
    .where(eq(clubMemberships.clubId, ctx.club.id))
    .orderBy(users.name);

  const features = clubFeatures(ctx.club);

  let sponsor: ClubDetailResponse["sponsor"] = null;
  if (features.sponsor) {
    const sponsorRows = await db
      .select()
      .from(sponsors)
      .where(eq(sponsors.clubId, ctx.club.id))
      .limit(1);
    const s = sponsorRows[0];
    if (s) {
      sponsor = { name: s.name, logo_url: s.logoUrl, url: s.url, discount_code: s.discountCode };
    }
  }

  const body: ClubDetailResponse = {
    id: ctx.club.id,
    name: ctx.club.name,
    slug: ctx.club.slug,
    plan_tier: ctx.club.planTier,
    donation_url: ctx.club.donationUrl,
    // Only coaches hand out the code, so only coaches receive it.
    join_code: ctx.membership.role === "coach" ? ctx.club.joinCode : null,
    members: memberRows.map((m) => ({
      user_id: m.userId,
      name: m.name,
      role: m.role,
      visibility: m.visibility,
    })),
    theme: features.theming ? sanitizeClubTheme(ctx.club.themeJson) : null,
    sponsor,
    powered_by: !features.theming,
  };

  return NextResponse.json(body);
}
