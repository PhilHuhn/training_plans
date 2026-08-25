import "server-only";
import { eq } from "drizzle-orm";
import {
  DEFAULT_AI_SETTINGS,
  parseAiSettings,
  resolveAiAvailability,
  type AiAvailability,
  type AiSettings,
} from "@/lib/ai-availability";
import { resolveAiProvider, type AiProviderConfig } from "@/lib/ai-provider";
import { db } from "@/server/db";
import { appSettings } from "@/server/db/schema";
import { aiApiKey, env } from "@/server/env";

/** The one key in use today. Others get their own constant when they appear. */
const AI_KEY = "ai";

export function hasAiKey(): boolean {
  return aiApiKey() !== "";
}

/** Which upstream this deployment is pointed at, resolved from the env. */
export function aiProvider(): AiProviderConfig {
  return resolveAiProvider({ baseUrl: env.AI_BASE_URL, apiKey: aiApiKey() });
}

/**
 * The model to send. The operator's choice in /admin wins; otherwise the
 * provider default, because a bare Anthropic model id is not a valid OpenRouter
 * slug (and vice versa) — one cannot serve both.
 */
export async function aiModel(): Promise<string> {
  const chosen = (await getAiSettings()).model.trim();
  return chosen || aiProvider().defaultModel;
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
  return resolveAiAvailability({ ...settings, hasApiKey: hasAiKey() });
}
