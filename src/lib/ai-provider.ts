/**
 * Which upstream serves the AI features, and what to talk to it with.
 *
 * Deliberately free of "server-only", the SDK and the env schema — the same
 * reasoning as @/lib/ai-availability and @/server/services/claude-errors:
 * keeping the rule importable on its own is what lets it be tested without
 * booting a server.
 *
 * OpenRouter exposes an Anthropic-compatible Messages endpoint (its "Anthropic
 * skin"), so pointing the Anthropic SDK's baseURL at it keeps streaming, the
 * tool loop and thinking blocks working unchanged. That is the whole reason
 * this is a configuration module rather than a second client implementation.
 */

export const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

/** Anthropic's own API takes bare model ids. */
export const DEFAULT_ANTHROPIC_MODEL = "claude-sonnet-5";
/** OpenRouter namespaces every model by its provider. */
export const DEFAULT_OPENROUTER_MODEL = "anthropic/claude-sonnet-4.5";

export type AiProvider = "anthropic" | "openrouter";

export interface AiProviderConfig {
  provider: AiProvider;
  /** Passed to the SDK. Undefined means "use the SDK's own default". */
  baseUrl: string | undefined;
  /** Model to use when the operator has not chosen one in /admin. */
  defaultModel: string;
}

/**
 * Resolve the provider from configuration.
 *
 * The key prefix is the load-bearing half of this: OpenRouter issues keys
 * beginning `sk-or-`, so pasting one is enough — the operator does not also
 * have to remember to set a base URL. An explicit AI_BASE_URL still wins for
 * anything else that speaks the same protocol (a gateway, a local proxy).
 */
export function resolveAiProvider(input: { baseUrl: string; apiKey: string }): AiProviderConfig {
  const baseUrl = input.baseUrl.trim().replace(/\/+$/, "");
  const key = input.apiKey.trim();

  const looksLikeOpenRouter = baseUrl.includes("openrouter.ai") || key.startsWith("sk-or-");

  if (looksLikeOpenRouter) {
    return {
      provider: "openrouter",
      baseUrl: baseUrl || OPENROUTER_BASE_URL,
      defaultModel: DEFAULT_OPENROUTER_MODEL,
    };
  }

  return {
    provider: "anthropic",
    // An explicit base URL is honoured even when it isn't OpenRouter, so a
    // self-hosted gateway or a test double can stand in for Anthropic.
    baseUrl: baseUrl || undefined,
    defaultModel: DEFAULT_ANTHROPIC_MODEL,
  };
}

/** Human-readable provider name for the admin card. */
export function providerLabel(provider: AiProvider): string {
  return provider === "openrouter" ? "OpenRouter" : "Anthropic (direct)";
}
