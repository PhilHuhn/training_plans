/**
 * Whether the AI features are usable, and what to tell people when they aren't.
 *
 * Deliberately free of "server-only", the SDK and the env schema — the same
 * reasoning as @/server/services/claude-errors and @/lib/admin: keeping the
 * rule importable on its own is what lets it be tested without a server.
 */

export const DEFAULT_AI_DISABLED_NOTICE =
  "The AI coach is switched off right now. Everything else in the app still works.";

/** Shown when there is no API key at all — a misconfiguration, not a choice. */
export const AI_UNCONFIGURED_NOTICE =
  "The AI coach isn't configured right now. Everything else in the app still works.";

export interface AiSettings {
  enabled: boolean;
  /** Operator-authored line shown wherever an AI feature would have been. */
  notice: string;
  /**
   * Upstream model id, or "" for the provider's default. Stored rather than
   * env-held so switching to a cheaper model is a text field in /admin instead
   * of a redeploy — the same argument as the enabled flag itself.
   */
  model: string;
}

export const DEFAULT_AI_SETTINGS: AiSettings = {
  enabled: true,
  notice: DEFAULT_AI_DISABLED_NOTICE,
  model: "",
};

export interface AiAvailability {
  available: boolean;
  /** Null when available; otherwise the line to show the user. */
  notice: string | null;
}

/**
 * A missing API key beats the toggle: with no key every request would fail
 * upstream anyway, so clearing ANTHROPIC_API_KEY is itself a valid kill switch
 * and the UI should say so rather than offering a button that cannot work.
 */
export function resolveAiAvailability(input: {
  enabled: boolean;
  notice: string;
  hasApiKey: boolean;
}): AiAvailability {
  if (!input.hasApiKey) {
    return { available: false, notice: AI_UNCONFIGURED_NOTICE };
  }
  if (!input.enabled) {
    // An operator who blanks the notice field still gets a usable sentence.
    return { available: false, notice: input.notice.trim() || DEFAULT_AI_DISABLED_NOTICE };
  }
  return { available: true, notice: null };
}

/** Coerce a stored jsonb blob into settings, tolerating anything unexpected. */
export function parseAiSettings(value: unknown): AiSettings {
  if (!value || typeof value !== "object") return DEFAULT_AI_SETTINGS;
  const raw = value as { enabled?: unknown; notice?: unknown; model?: unknown };
  return {
    enabled: typeof raw.enabled === "boolean" ? raw.enabled : DEFAULT_AI_SETTINGS.enabled,
    notice:
      typeof raw.notice === "string" && raw.notice.trim() !== ""
        ? raw.notice
        : DEFAULT_AI_DISABLED_NOTICE,
    // Absent on rows written before the provider switch — they fall back to the
    // provider default, which is what they were already using.
    model: typeof raw.model === "string" ? raw.model.trim() : "",
  };
}
