import "server-only";
import type { NextResponse } from "next/server";
import { errorJson } from "@/server/http";
import { aiAvailability } from "./app-settings";

/**
 * The gate every credit-spending route starts with, in the same union shape as
 * requireSession / requireClubMember / requireAdmin.
 *
 * Answers 503 with the operator's notice as `detail`. That is deliberately the
 * same contract classifyClaudeError already uses for "retrying cannot help", so
 * the chat client renders it without any change: see use-chat.ts, which shows
 * `detail` as the assistant's reply.
 *
 * It must never answer 401 — claude-errors.ts explains why: the browser's axios
 * interceptor treats any 401 as an expired session and would sign every athlete
 * out over an operator's switch.
 */
export async function requireAiEnabled(): Promise<null | { response: NextResponse }> {
  const availability = await aiAvailability();
  if (availability.available) return null;
  return {
    response: errorJson(availability.notice ?? "The AI coach is unavailable.", 503),
  };
}
