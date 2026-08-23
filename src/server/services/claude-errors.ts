/**
 * Classification of upstream Anthropic failures.
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
 * Turn an upstream Anthropic failure into something the UI can act on.
 *
 * Two things this deliberately does NOT do:
 *
 * 1. It never answers 401. Anthropic returns 401 for a bad API key, but the
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

  // Billing arrives as a 400 invalid_request_error, so it has to be matched on
  // the message rather than the status.
  if (text.includes("credit balance") || text.includes("billing")) {
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
