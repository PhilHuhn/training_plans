import { describe, expect, it } from "vitest";
import { classifyClaudeError, classifyEngineError } from "../claude-errors";

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

describe("classifyClaudeError — OpenRouter", () => {
  it("treats a 402 as out of credit, not as a generic failure", () => {
    // OpenRouter's code for an empty balance; Anthropic sends a 400 whose
    // message mentions the credit balance instead.
    const f = classifyClaudeError(Object.assign(new Error("Payment Required"), { status: 402 }));
    expect(f.status).toBe(503);
    expect(f.retryable).toBe(false);
    expect(f.detail).toContain("out of credit");
  });

  it("matches OpenRouter's insufficient-credits wording", () => {
    const f = classifyClaudeError(new Error("Insufficient credits for this request"));
    expect(f.retryable).toBe(false);
    expect(f.detail).toContain("out of credit");
  });

  it("still never answers 401 for an OpenRouter auth failure", () => {
    // The axios interceptor signs the user out on any 401 — an operator's bad
    // key must not log every athlete out.
    const f = classifyClaudeError(Object.assign(new Error("No auth credentials found"), { status: 401 }));
    expect(f.status).not.toBe(401);
    expect(f.status).toBe(503);
  });
});

describe("classifyEngineError — status recovery", () => {
  it("recovers the status the SDK put at the front of the message", () => {
    // The thrown error (and its .status) is gone by the time the engine
    // reports a string, so the code has to come back out of the text.
    const f = classifyEngineError("Claude error: 402 Insufficient credits");
    expect(f.retryable).toBe(false);
    expect(f.detail).toContain("out of credit");
  });

  it("classifies a 429 from the engine path as retryable", () => {
    const f = classifyEngineError("Claude error: 429 Rate limit exceeded");
    expect(f.status).toBe(429);
    expect(f.retryable).toBe(true);
  });

  it("does not answer 401 even when the message starts with one", () => {
    expect(classifyEngineError("Claude error: 401 Unauthorized").status).toBe(503);
  });

  it("leaves a message with no leading status to the text rules", () => {
    const f = classifyEngineError("Claude error: connection reset");
    expect(f.status).toBe(500);
    expect(f.retryable).toBe(true);
  });

  it("does not mistake a number inside the text for a status", () => {
    // "returned 404 sessions" is a count, not an HTTP code.
    const f = classifyEngineError("Claude error: request failed after 402 seconds");
    expect(f.detail).not.toContain("out of credit");
  });
});
