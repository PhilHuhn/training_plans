/**
 * The message to show a user when a request fails.
 *
 * Every route in this app answers an error as `{ detail: "..." }`, written for
 * the person reading it — "Message cannot be empty", not a status code. axios
 * throws with its own `message` ("Request failed with status code 422"), so a
 * `catch` that reaches for `err.message` reliably shows the wrong one.
 *
 * Pure and defensive: the shape is whatever the network handed back, so every
 * step is guarded and the fallback is always available.
 */
export function detailOf(err: unknown, fallback: string): string {
  const detail = (err as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  return typeof detail === 'string' && detail.trim() ? detail : fallback
}
