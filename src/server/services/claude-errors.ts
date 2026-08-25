/**
 * Classification of upstream AI failures.
 *
 * Covers both providers this app can be pointed at: Anthropic direct and
 * OpenRouter's Anthropic-compatible endpoint. They disagree on how an empty
 * balance arrives (Anthropic: a 400 whose message mentions the credit balance;
 * OpenRouter: a 402), which is why the billing branch matches on both.
 *
 * Deliberately free of "server-only", the SDK and the env schema: it is pure
 * string-and-status logic, and keeping it importable on its own is what lets it
 * be tested without booting a server environment.
 */

export interface ClaudeFailure {
  /** Status to answer the browser with. */
  status: number;
  /** Message safe to show a user — never the raw upstream text. */
  detail: string;
  /** False when trying again cannot help (billing, bad key, bad model). */
  retryable: boolean;
}

/**
 * Prefix claude.ts stamps onto an upstream failure it caught and turned into a
 * `{ data, error }` result. Its presence is how a caller tells an upstream
 * failure apart from its own domain errors ("Unsupported file type", "No
 * sessions found"), which are useful to the user and must survive untouched.
 */
export const UPSTREAM_ERROR_PREFIX = "Claude error: ";

export function isUpstreamClaudeError(message: string): boolean {
  return message.startsWith(UPSTREAM_ERROR_PREFIX);
}

/**
 * Classify an error string that came back through a `{ data, error }` result
 * rather than being thrown. Same guarantees as classifyClaudeError.
 *
 * The SDK's own message begins with the HTTP status ("402 Insufficient
 * credits"), and by this point the thrown error — and its `status` field — is
 * long gone. Recovering the code from the text is what keeps the engine routes
 * classifying as precisely as chat does: without it an exhausted balance during
 * plan generation reads as "try again", advising a retry that cannot work.
 */
export function classifyEngineError(message: string): ClaudeFailure {
  const stripped = message.replace(UPSTREAM_ERROR_PREFIX, "");
  const leadingStatus = /^\s*(\d{3})\b/.exec(stripped);
  const err = new Error(stripped);
  if (leadingStatus) {
    (err as Error & { status?: number }).status = Number(leadingStatus[1]);
  }
  return classifyClaudeError(err);
}

/**
 * Turn an upstream provider failure into something the UI can act on.
 *
 * Two things this deliberately does NOT do:
 *
 * 1. It never answers 401. Both providers return 401 for a bad API key, but the
 *    browser's axios interceptor treats any 401 as "session expired" and signs
 *    the user out. An operator's expired key must not log everyone out.
 * 2. It never forwards the upstream message. "Your credit balance is too low"
 *    is information for the operator, not for a runner asking about intervals.
 *    The detail goes to the server log instead.
 */
export function classifyClaudeError(err: unknown): ClaudeFailure {
  const status = typeof (err as { status?: unknown })?.status === "number"
    ? (err as { status: number }).status
    : undefined;
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const text = raw.toLowerCase();

  // Anthropic sends billing failures as a 400 invalid_request_error, so status
  // alone is not enough; OpenRouter uses 402 for the same condition.
  if (
    status === 402 ||
    text.includes("credit balance") ||
    text.includes("insufficient credits") ||
    text.includes("billing")
  ) {
    return {
      status: 503,
      detail: "The AI coach is out of credit. Retrying won't help — this needs the operator.",
      retryable: false,
    };
  }

  if (status === 401 || status === 403 || text.includes("authentication")) {
    return {
      status: 503,
      detail: "The AI coach is not configured correctly. Retrying won't help.",
      retryable: false,
    };
  }

  if (status === 404 || text.includes("model")) {
    return {
      status: 503,
      detail: "The AI coach's model is unavailable. Retrying won't help.",
      retryable: false,
    };
  }

  if (status === 429) {
    return {
      status: 429,
      detail: "Too many requests to the AI coach. Please wait a moment and try again.",
      retryable: true,
    };
  }

  if (status === 529 || status === 500 || status === 502 || status === 503) {
    return {
      status: 503,
      detail: "The AI coach is busy. Please try again in a moment.",
      retryable: true,
    };
  }

  return {
    status: 500,
    detail: "Something went wrong talking to the AI coach. Please try again.",
    retryable: true,
  };
}
