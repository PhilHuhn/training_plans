import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/admin";
import { errorJson, parseJson } from "@/server/http";
import {
  aiProvider,
  getAiSettings,
  hasAiKey,
  setAiSettings,
} from "@/server/services/app-settings";
import { resolveAiAvailability, type AiSettings } from "@/lib/ai-availability";
import { providerLabel } from "@/lib/ai-provider";
import type { AiSettingsWire } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    enabled: z.boolean().optional(),
    notice: z.string().trim().max(300).optional(),
    // "" is meaningful — it clears the override and returns to the provider
    // default — so this cannot use .min(1).
    model: z.string().trim().max(120).optional(),
  })
  .refine((v) => v.enabled !== undefined || v.notice !== undefined || v.model !== undefined, {
    message: "Nothing to update",
  });

function wire(settings: AiSettings): AiSettingsWire {
  const availability = resolveAiAvailability({ ...settings, hasApiKey: hasAiKey() });
  const provider = aiProvider();
  return {
    enabled: settings.enabled,
    notice: settings.notice,
    model: settings.model,
    // What an empty model field actually resolves to, so the card can show the
    // model in use without the operator having to know the defaults.
    effective_model: settings.model.trim() || provider.defaultModel,
    provider: provider.provider,
    provider_label: providerLabel(provider.provider),
    // Lets the dashboard explain a switch that is on but still not working,
    // the same way admin_via_env explains a locked admin toggle.
    api_key_configured: hasAiKey(),
    effective: availability.available,
  };
}

/** GET /api/admin/settings/ai — the AI kill switch and its notice. */
export async function GET(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("response" in gate) return gate.response;
  return NextResponse.json(wire(await getAiSettings()));
}

/** PATCH /api/admin/settings/ai — flip the switch or reword the notice. */
export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin(req);
  if ("response" in gate) return gate.response;

  const parsed = await parseJson(req, patchSchema);
  if ("response" in parsed) return parsed.response;

  try {
    const next = await setAiSettings(parsed.data, gate.user.id);
    return NextResponse.json(wire(next));
  } catch (err) {
    console.error("[api] admin settings ai PATCH", err);
    return errorJson("Failed to save the AI settings", 500);
  }
}
