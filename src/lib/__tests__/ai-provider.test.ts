import { describe, expect, it } from "vitest";
import {
  DEFAULT_ANTHROPIC_MODEL,
  DEFAULT_OPENROUTER_MODEL,
  OPENROUTER_BASE_URL,
  providerLabel,
  resolveAiProvider,
} from "../ai-provider";

describe("resolveAiProvider", () => {
  it("stays on Anthropic with a plain key and no base URL", () => {
    const c = resolveAiProvider({ baseUrl: "", apiKey: "sk-ant-api03-abc" });
    expect(c.provider).toBe("anthropic");
    // Undefined, not "": the SDK must fall back to its own default host.
    expect(c.baseUrl).toBeUndefined();
    expect(c.defaultModel).toBe(DEFAULT_ANTHROPIC_MODEL);
  });

  it("detects OpenRouter from the key prefix alone", () => {
    // The whole point: pasting the key is enough, no second variable to set.
    const c = resolveAiProvider({ baseUrl: "", apiKey: "sk-or-v1-abc" });
    expect(c.provider).toBe("openrouter");
    expect(c.baseUrl).toBe(OPENROUTER_BASE_URL);
    expect(c.defaultModel).toBe(DEFAULT_OPENROUTER_MODEL);
  });

  it("detects OpenRouter from the base URL even with an unrecognised key", () => {
    const c = resolveAiProvider({
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "some-proxied-key",
    });
    expect(c.provider).toBe("openrouter");
    expect(c.baseUrl).toBe(OPENROUTER_BASE_URL);
  });

  it("honours an explicit non-OpenRouter base URL without changing the model default", () => {
    const c = resolveAiProvider({ baseUrl: "https://gateway.internal/v1", apiKey: "sk-ant-x" });
    expect(c.provider).toBe("anthropic");
    expect(c.baseUrl).toBe("https://gateway.internal/v1");
    expect(c.defaultModel).toBe(DEFAULT_ANTHROPIC_MODEL);
  });

  it("trims whitespace and a trailing slash off the base URL", () => {
    const c = resolveAiProvider({ baseUrl: "  https://openrouter.ai/api/v1/  ", apiKey: "" });
    expect(c.baseUrl).toBe("https://openrouter.ai/api/v1");
  });

  it("falls back to Anthropic when nothing is configured", () => {
    // No key at all is a misconfiguration, but it must not crash the resolver —
    // aiAvailability() is what reports it to the operator.
    expect(resolveAiProvider({ baseUrl: "", apiKey: "" }).provider).toBe("anthropic");
  });
});

describe("providerLabel", () => {
  it("names both providers", () => {
    expect(providerLabel("openrouter")).toBe("OpenRouter");
    expect(providerLabel("anthropic")).toBe("Anthropic (direct)");
  });
});
