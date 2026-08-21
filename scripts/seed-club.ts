// Seed: club "sub-77" (Tenant 0) + sponsor "Hamburger Laufladen" + 4 athletes
// with the fixture week from src/server/engine/__tests__/fixtures/sub77-week.ts
// (single source of truth for seed AND engine tests — they cannot drift).
//
// Idempotent: users upserted by email, club by slug; memberships, sponsors,
// competitions and fixture-week sessions are wiped and rewritten per run.
//
// Run: npm run db:seed:club
// Demo login: <athlete>@sub77.example / sub77-demo

import { config as dotenv } from "dotenv";
dotenv({ path: ".env" });
dotenv({ path: ".env.local", override: true });

import bcrypt from "bcryptjs";
import { and, eq, gte, inArray, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { calculatePaceZonesFromThreshold } from "@/lib/zone-calc";
import { matchWeek } from "@/server/engine";
import { buildNote } from "@/server/engine/notes";
import {
  SUB77_ATHLETES,
  SUB77_SESSIONS,
  SUB77_WEEK_START,
  sub77EngineInput,
} from "@/server/engine/__tests__/fixtures/sub77-week";
import * as schema from "@/server/db/schema";
import {
  clubMemberships,
  clubs,
  competitions,
  DEFAULT_USER_PREFERENCES,
  sponsors,
  trainingSessions,
  users,
} from "@/server/db/schema";

const DEMO_PASSWORD = "sub77-demo";

const ROLES: Record<string, "coach" | "athlete" | "captain"> = {
  mara: "coach",
  tade: "captain",
  timo: "athlete",
  hanna: "athlete",
};

// Hanna stays typ_only to demo server-side redaction of paces.
const VISIBILITY: Record<string, "typ_only" | "full"> = {
  mara: "full",
  tade: "full",
  timo: "full",
  hanna: "typ_only",
};

const GOAL_RACES: Record<string, { name: string; raceType: "M" | "10K" | "HM"; date: string }> = {
  mara: { name: "Hamburg Marathon", raceType: "M", date: "2026-09-27" },
  tade: { name: "Alsterlauf 10k", raceType: "10K", date: "2026-08-23" },
  timo: { name: "Alsterlauf 10k", raceType: "10K", date: "2026-08-23" },
  hanna: { name: "Halbmarathon Lübeck", raceType: "HM", date: "2026-09-13" },
};

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is not set");
  const client = postgres(databaseUrl, { max: 1 });
  const db = drizzle(client, { schema });

  // --- Club ---------------------------------------------------------------
  const [club] = await db
    .insert(clubs)
    .values({
      name: "sub-77",
      slug: "sub-77",
      planTier: "paid",
      donationUrl: "https://ko-fi.com/clubturbine",
      themeJson: { primary: "#0B5A38", accent: "#C8471B" },
    })
    .onConflictDoUpdate({
      target: clubs.slug,
      set: {
        name: "sub-77",
        planTier: "paid",
        donationUrl: "https://ko-fi.com/clubturbine",
        themeJson: { primary: "#0B5A38", accent: "#C8471B" },
        updatedAt: new Date(),
      },
    })
    .returning();
  console.log(`Club: ${club.name} (id ${club.id}, tier ${club.planTier})`);

  // --- Sponsor ------------------------------------------------------------
  await db.delete(sponsors).where(eq(sponsors.clubId, club.id));
  await db.insert(sponsors).values({
    clubId: club.id,
    name: "Hamburger Laufladen",
    url: "https://hamburger-laufladen.example",
    logoUrl: null,
    discountCode: "SUB77-10",
  });
  console.log("Sponsor: Hamburger Laufladen (SUB77-10)");

  // --- Athletes -----------------------------------------------------------
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userIdByKey = new Map<string, number>();

  for (const athlete of SUB77_ATHLETES) {
    const preferences = {
      ...DEFAULT_USER_PREFERENCES,
      threshold_pace: athlete.thresholdPaceSec,
      pace_zones: calculatePaceZonesFromThreshold(athlete.thresholdPaceSec),
    };
    const [row] = await db
      .insert(users)
      .values({ email: athlete.email, name: athlete.name, passwordHash, preferences })
      .onConflictDoUpdate({
        target: users.email,
        set: { name: athlete.name, passwordHash, preferences, updatedAt: new Date() },
      })
      .returning();
    userIdByKey.set(athlete.key, row.id);
    console.log(`User: ${athlete.name} <${athlete.email}> (id ${row.id}, LT ${athlete.thresholdPaceSec} s/km)`);
  }
  const seededUserIds = [...userIdByKey.values()];

  // --- Memberships ----------------------------------------------------------
  await db.delete(clubMemberships).where(eq(clubMemberships.clubId, club.id));
  for (const athlete of SUB77_ATHLETES) {
    await db.insert(clubMemberships).values({
      clubId: club.id,
      userId: userIdByKey.get(athlete.key) as number,
      role: ROLES[athlete.key],
      visibility: VISIBILITY[athlete.key],
    });
  }
  console.log("Memberships: mara=coach, tade=captain, timo/hanna=athlete (hanna typ_only)");

  // --- Competitions (goal races + Hanna's in-week tune-up race) ------------
  await db.delete(competitions).where(inArray(competitions.userId, seededUserIds));
  for (const athlete of SUB77_ATHLETES) {
    const goal = GOAL_RACES[athlete.key];
    await db.insert(competitions).values({
      userId: userIdByKey.get(athlete.key) as number,
      name: goal.name,
      raceType: goal.raceType,
      raceDate: goal.date,
      priority: "A",
      location: "Hamburg",
    });
  }
  await db.insert(competitions).values({
    userId: userIdByKey.get("hanna") as number,
    name: "10k Testwettkampf",
    raceType: "10K",
    raceDate: "2026-07-18",
    priority: "C",
    location: "Hamburg",
  });
  console.log("Competitions: 4 goal races + Hanna's tune-up on 2026-07-18");

  // --- Fixture-week training sessions ---------------------------------------
  const weekEnd = "2026-07-19";
  await db
    .delete(trainingSessions)
    .where(
      and(
        inArray(trainingSessions.userId, seededUserIds),
        gte(trainingSessions.sessionDate, SUB77_WEEK_START),
        lte(trainingSessions.sessionDate, weekEnd),
      ),
    );
  for (const s of SUB77_SESSIONS) {
    await db.insert(trainingSessions).values({
      userId: userIdByKey.get(s.athleteKey) as number,
      sessionDate: s.date,
      source: "manual",
      status: "planned",
      plannedWorkout: s.workout,
      flexDays: s.flexDays,
    });
  }
  console.log(`Sessions: ${SUB77_SESSIONS.length} planned sessions in week ${SUB77_WEEK_START}`);

  // --- Engine sanity output --------------------------------------------------
  const { compromises, shifts } = matchWeek(sub77EngineInput());
  console.log("\n=== Compromise-Vorschläge für die Seed-Woche ===");
  for (const shift of shifts) {
    console.log(`  Shift: Session ${shift.sessionId} ${shift.from} → ${shift.to}`);
  }
  const nameById = new Map(SUB77_ATHLETES.map((a, i) => [i + 1, a.name.split(" ")[0]]));
  for (const c of compromises) {
    const who = c.memberIds.map((id) => nameById.get(id)).join(", ");
    console.log(`  ${c.date} [${c.mode}] ${who} — ${buildNote(c).full}`);
  }

  await client.end();
  console.log(`\nDone. Demo-Login: <vorname>@sub77.example / ${DEMO_PASSWORD}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
