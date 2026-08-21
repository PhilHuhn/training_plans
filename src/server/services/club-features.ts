// The plan_tier gate. Free clubs fall back to the default theme + "Powered
// by" footer; theme and sponsor slots activate on the paid tier only. Pure
// (no "server-only") so the gate rules are unit-testable.

import type { ClubThemeWire } from "@/lib/types";
import type { Club, ClubTheme } from "@/server/db/schema";

export function clubFeatures(club: Pick<Club, "planTier">): {
  theming: boolean;
  sponsor: boolean;
} {
  const paid = club.planTier === "paid";
  return { theming: paid, sponsor: paid };
}

// theme_json is stored data that ends up inside style attributes — treat it
// as an injection vector. Only plain hex colors and https image URLs survive.
const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const SAFE_URL = /^https:\/\/[^\s"'<>()]+$/;

export function sanitizeClubTheme(theme: ClubTheme | null | undefined): ClubThemeWire | null {
  if (!theme) return null;
  const out: ClubThemeWire = {};
  if (theme.primary && HEX_COLOR.test(theme.primary)) out.primary = theme.primary;
  if (theme.accent && HEX_COLOR.test(theme.accent)) out.accent = theme.accent;
  if (theme.background && HEX_COLOR.test(theme.background)) out.background = theme.background;
  if (theme.logoUrl && SAFE_URL.test(theme.logoUrl)) out.logo_url = theme.logoUrl;
  return Object.keys(out).length ? out : null;
}
