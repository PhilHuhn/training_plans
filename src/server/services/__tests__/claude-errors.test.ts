import { describe, expect, it } from "vitest";
import { classifyClaudeError } from "../claude-errors";

/** Mimics an Anthropic SDK APIError closely enough for classification. */
function apiError(status: number, message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status });
}

describe("classifyClaudeError", () => {
  it("never answers 401, so a bad key cannot sign the user out", () => {
    // The browser's axios interceptor logs out on any 401. An operator's
    // expired key must not take every signed-in athlete down with it.
    for (const status of [401, 403]) {
      expect(classifyClaudeError(apiError(status, "authentication_error")).status).toBe(503);
    }
  });

  it("recognises an exhausted credit balance as not retryable", () => {
    const failure = classifyClaudeError(
      apiError(400, "Your credit balance is too low to access the Anthropic API."),
    );
    expect(failure.status).toBe(503);
    expect(failure.retryable).toBe(false);
  });

  it("marks rate limits and overload as retryable", () => {
    expect(classifyClaudeError(apiError(429, "rate_limit_error"))).toMatchObject({
      status: 429,
      retryable: true,
    });
    expect(classifyClaudeError(apiError(529, "overloaded_error"))).toMatchObject({
      status: 503,
      retryable: true,
    });
  });

  it("treats an unknown model as a configuration problem", () => {
    const failure = classifyClaudeError(apiError(404, "model: claude-does-not-exist"));
    expect(failure.retryable).toBe(false);
  });

  it("falls back without leaking the upstream message", () => {
    const failure = classifyClaudeError(new Error("socket hang up at 10.0.0.1:443"));
    expect(failure.status).toBe(500);
    expect(failure.detail).not.toContain("10.0.0.1");
  });

  it("never returns the raw upstream text as the user-facing detail", () => {
    const raw = "Your credit balance is too low to access the Anthropic API.";
    expect(classifyClaudeError(apiError(400, raw)).detail).not.toBe(raw);
  });
});
