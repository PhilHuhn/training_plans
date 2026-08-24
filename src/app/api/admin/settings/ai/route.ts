import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/server/auth/admin";
import { errorJson, parseJson } from "@/server/http";
import {
  getAiSettings,
  hasAnthropicKey,
  setAiSettings,
} from "@/server/services/app-settings";
import { resolveAiAvailability } from "@/lib/ai-availability";
import type { AiSettingsWire } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const patchSchema = z
  .object({
    enabled: z.boolean().optional(),
    notice: z.string().trim().max(300).optional(),
  })
  .refine((v) => v.enabled !== undefined || v.notice !== undefined, {
    message: "Nothing to update",
  });

function wire(settings: { enabled: boolean; notice: string }): AiSettingsWire {
  const availability = resolveAiAvailability({ ...settings, hasApiKey: hasAnthropicKey() });
  return {
    enabled: settings.enabled,
    notice: settings.notice,
    // Lets the dashboard explain a switch that is on but still not working,
    // the same way admin_via_env explains a locked admin toggle.
    api_key_configured: hasAnthropicKey(),
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
