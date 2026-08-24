import "server-only";
import { eq } from "drizzle-orm";
import {
  DEFAULT_AI_SETTINGS,
  parseAiSettings,
  resolveAiAvailability,
  type AiAvailability,
  type AiSettings,
} from "@/lib/ai-availability";
import { db } from "@/server/db";
import { appSettings } from "@/server/db/schema";
import { env } from "@/server/env";

/** The one key in use today. Others get their own constant when they appear. */
const AI_KEY = "ai";

export function hasAnthropicKey(): boolean {
  return env.ANTHROPIC_API_KEY.trim() !== "";
}

/** Stored AI settings, or the defaults when the row has never been written. */
export async function getAiSettings(): Promise<AiSettings> {
  const rows = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, AI_KEY))
    .limit(1);

  if (!rows.length) return DEFAULT_AI_SETTINGS;
  return parseAiSettings(rows[0].value);
}

/** Merge a partial change into the stored settings and return the new state. */
export async function setAiSettings(
  patch: Partial<AiSettings>,
  userId: number,
): Promise<AiSettings> {
  const next: AiSettings = { ...(await getAiSettings()), ...patch };

  await db
    .insert(appSettings)
    .values({ key: AI_KEY, value: next, updatedByUserId: userId })
    .onConflictDoUpdate({
      target: appSettings.key,
      set: { value: next, updatedAt: new Date(), updatedByUserId: userId },
    });

  return next;
}

/**
 * The question every AI surface actually asks: may this run, and if not, what
 * do we tell the user? Combines the stored flag with the presence of a key.
 */
export async function aiAvailability(): Promise<AiAvailability> {
  const settings = await getAiSettings();
  return resolveAiAvailability({ ...settings, hasApiKey: hasAnthropicKey() });
}
