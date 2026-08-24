import "server-only";
import { and, eq, sql } from "drizzle-orm";
import { generateJoinCode, slugify } from "@/lib/club-codes";
import type { ClubSummary } from "@/lib/types";
import { db } from "@/server/db";
import { clubMemberships, clubs, type Club } from "@/server/db/schema";

/** Both unique indexes we may race against when inserting a club. */
const SLUG_KEY = "clubs_slug_key";
const JOIN_CODE_KEY = "clubs_join_code_key";

function isUniqueViolation(err: unknown, constraint: string): boolean {
  const e = err as { code?: string; constraint_name?: string; message?: string };
  if (e?.code !== "23505") return false;
  return e.constraint_name === constraint || Boolean(e.message?.includes(constraint));
}

/** Shape a club row + the caller's membership into the wire summary. */
export function clubSummary(
  club: Pick<Club, "id" | "name" | "slug" | "planTier">,
  role: ClubSummary["role"],
  visibility: ClubSummary["visibility"],
): ClubSummary {
  return {
    id: club.id,
    name: club.name,
    slug: club.slug,
    plan_tier: club.planTier,
    role,
    visibility,
  };
}

/**
 * Create a club and make the creator its coach.
 *
 * Slug and join code both sit behind unique indexes, so rather than SELECT-then-
 * INSERT (which races), we insert and retry on a 23505 — the DB is the arbiter.
 */
export async function createClubForUser(name: string, userId: number): Promise<Club> {
  const base = slugify(name);

  for (let attempt = 0; attempt < 12; attempt++) {
    // First attempt uses the bare slug; later ones disambiguate with -2, -3, ...
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    try {
      const [club] = await db
        .insert(clubs)
        .values({ name, slug, joinCode: generateJoinCode(), createdByUserId: userId })
        .returning();

      await db.insert(clubMemberships).values({
        clubId: club.id,
        userId,
        // The creator runs the club and needs the full overlay to do so.
        role: "coach",
        visibility: "full",
      });

      return club;
    } catch (err) {
      // A join-code collision is pure bad luck — retry the same slug attempt.
      if (isUniqueViolation(err, JOIN_CODE_KEY)) {
        attempt--;
        continue;
      }
      if (isUniqueViolation(err, SLUG_KEY)) continue;
      throw err;
    }
  }

  throw new Error(`Could not find a free slug for club name "${name}"`);
}

/** Look a club up by join code, case-insensitively. */
export async function findClubByJoinCode(code: string): Promise<Club | undefined> {
  const rows = await db
    .select()
    .from(clubs)
    .where(sql`upper(${clubs.joinCode}) = ${code}`)
    .limit(1);
  return rows[0];
}

export async function isMemberOf(clubId: number, userId: number): Promise<boolean> {
  const rows = await db
    .select({ id: clubMemberships.id })
    .from(clubMemberships)
    .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.userId, userId)))
    .limit(1);
  return rows.length > 0;
}

/** How many coaches a club has — used to refuse the last coach leaving. */
export async function countCoaches(clubId: number): Promise<number> {
  const rows = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(clubMemberships)
    .where(and(eq(clubMemberships.clubId, clubId), eq(clubMemberships.role, "coach")));
  return rows[0]?.n ?? 0;
}
