import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { users, type UserPreferences } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
import { errorJson, parseJson } from "@/server/http";
import {
  calculateCyclingPowerZonesFromFtp,
  calculateHrZonesFromMax,
  calculateHrZonesFromThreshold,
  calculatePaceZonesFromThreshold,
  saveZonesToHistory,
  validateHrAnchors,
  validateZones,
} from "@/server/services/zones";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ZoneRange = z.object({
  min: z.number(),
  max: z.number(),
  name: z.string().optional(),
});
const ZoneMap = z.record(z.string(), ZoneRange);

const Body = z.object({
  max_hr: z.number().int().nullable().optional(),
  resting_hr: z.number().int().nullable().optional(),
  threshold_hr: z.number().int().nullable().optional(),
  threshold_pace: z.number().int().nullable().optional(),
  hr_zones: ZoneMap.nullable().optional(),
  pace_zones: ZoneMap.nullable().optional(),
  ftp: z.number().int().nullable().optional(),
  cycling_power_zones: ZoneMap.nullable().optional(),
});

export async function PUT(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;
  const data = parsed.data;

  const prefs: UserPreferences = { ...(session.user.preferences ?? {}) } as UserPreferences;

  // Apply scalar fields first
  for (const key of [
    "max_hr",
    "resting_hr",
    "threshold_hr",
    "threshold_pace",
    "ftp",
  ] as const) {
    const value = data[key];
    if (value !== undefined && value !== null) {
      (prefs as Record<string, unknown>)[key] = value;
    }
  }

  // Validate HR anchors (max_hr, resting_hr, threshold_hr coherent)
  const anchorCheck = validateHrAnchors({
    max_hr: prefs.max_hr,
    resting_hr: prefs.resting_hr,
    threshold_hr: prefs.threshold_hr,
  });
  if (!anchorCheck.ok) return errorJson(anchorCheck.errors.join("; "), 400);

  // Apply zone maps with validation
  const errors: string[] = [];
  if (data.hr_zones !== undefined && data.hr_zones !== null) {
    const v = validateZones(data.hr_zones, "hr");
    if (!v.ok) errors.push(...v.errors.map((e) => `hr_zones: ${e}`));
    else prefs.hr_zones = data.hr_zones;
  }
  if (data.pace_zones !== undefined && data.pace_zones !== null) {
    const v = validateZones(data.pace_zones, "pace");
    if (!v.ok) errors.push(...v.errors.map((e) => `pace_zones: ${e}`));
    else prefs.pace_zones = data.pace_zones;
  }
  if (data.cycling_power_zones !== undefined && data.cycling_power_zones !== null) {
    const v = validateZones(data.cycling_power_zones, "power");
    if (!v.ok) errors.push(...v.errors.map((e) => `cycling_power_zones: ${e}`));
    else prefs.cycling_power_zones = data.cycling_power_zones;
  }
  if (errors.length > 0) return errorJson(errors.join("; "), 400);

  // Auto-recompute zones when scalar anchors are provided without explicit zone maps.
  // Marks the source as "manual" so the UI can surface that the user authored these.
  if (
    data.threshold_hr != null &&
    data.hr_zones === undefined &&
    prefs.max_hr &&
    prefs.resting_hr
  ) {
    prefs.hr_zones = calculateHrZonesFromThreshold(prefs.threshold_hr!, prefs.max_hr, prefs.resting_hr);
    prefs.threshold_hr_source = "manual";
  } else if (
    data.max_hr != null &&
    data.hr_zones === undefined &&
    prefs.max_hr &&
    prefs.resting_hr &&
    !prefs.threshold_hr
  ) {
    prefs.hr_zones = calculateHrZonesFromMax(prefs.max_hr, prefs.resting_hr);
  }

  if (data.threshold_pace != null && data.pace_zones === undefined) {
    prefs.pace_zones = calculatePaceZonesFromThreshold(data.threshold_pace);
    prefs.threshold_pace_source = "manual";
  }

  if (data.ftp != null && data.cycling_power_zones === undefined) {
    prefs.cycling_power_zones = calculateCyclingPowerZonesFromFtp(data.ftp);
  }

  await db
    .update(users)
    .set({ preferences: prefs, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  await saveZonesToHistory(
    session.user,
    {
      max_hr: prefs.max_hr ?? null,
      resting_hr: prefs.resting_hr ?? null,
      threshold_hr: prefs.threshold_hr ?? null,
      threshold_pace: prefs.threshold_pace ?? null,
      hr_zones: (prefs.hr_zones ?? null) as Record<string, { min: number; max: number; name?: string }> | null,
      pace_zones: (prefs.pace_zones ?? null) as Record<string, { min: number; max: number; name?: string }> | null,
      ftp: prefs.ftp ?? null,
      cycling_power_zones: (prefs.cycling_power_zones ?? null) as Record<string, { min: number; max: number; name?: string }> | null,
    },
    "manual",
  );

  return NextResponse.json({ message: "Zones updated", preferences: prefs });
}
