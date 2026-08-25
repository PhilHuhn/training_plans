/**
 * Server-sent-event framing, split out so it can be tested.
 *
 * The subtle part is that a frame is not a chunk: a `data:` line can arrive
 * split across two network reads, so a decoder has to hold the tail back until
 * it sees the blank line that terminates a frame. Getting that wrong shows up
 * only under load, as an occasional dropped or mangled progress update.
 */

/** A parsed frame's payload, plus whatever is left over for the next read. */
export interface SseSplit<T> {
  events: T[];
  /** The incomplete tail, to be prepended to the next chunk. */
  rest: string;
}

/**
 * Splits accumulated text into complete frames, parsing each frame's `data:`
 * line as JSON.
 *
 * Unparseable frames are dropped rather than thrown: one malformed progress
 * update should not abort an import that is otherwise going fine.
 */
export function splitSseFrames<T>(buffer: string): SseSplit<T> {
  const frames = buffer.split("\n\n");
  // The final piece is either an incomplete frame or "" — either way it is not
  // ready, and it becomes the seed for the next chunk.
  const rest = frames.pop() ?? "";
  const events: T[] = [];

  for (const frame of frames) {
    const dataLine = frame.split("\n").find((l) => l.startsWith("data: "));
    if (!dataLine) continue;
    try {
      events.push(JSON.parse(dataLine.slice(6)) as T);
    } catch {
      // malformed frame — skip it
    }
  }

  return { events, rest };
}

/**
 * Reads an SSE response body to completion, invoking `onEvent` per frame.
 *
 * Callers own the meaning of the events; this only handles transport.
 */
export async function readSseStream<T>(
  body: ReadableStream<Uint8Array>,
  onEvent: (event: T) => void,
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const { events, rest } = splitSseFrames<T>(buffer);
      buffer = rest;
      // onEvent may throw to abort — an error frame does exactly that. The
      // finally below releases the connection rather than leaving it hanging.
      for (const event of events) onEvent(event);
    }
  } finally {
    reader.cancel().catch(() => {});
  }
}
