import { describe, expect, it, vi } from "vitest";
import { readSseStream, splitSseFrames } from "../sse";

interface Ping {
  type: string;
  n?: number;
}

describe("splitSseFrames", () => {
  it("reads complete frames and keeps nothing back", () => {
    const { events, rest } = splitSseFrames<Ping>(
      'data: {"type":"a"}\n\ndata: {"type":"b"}\n\n',
    );
    expect(events).toEqual([{ type: "a" }, { type: "b" }]);
    expect(rest).toBe("");
  });

  it("holds back a frame that has not been terminated yet", () => {
    // This is the whole reason the function exists: a chunk boundary can fall
    // anywhere, and a half-read frame must not be parsed.
    const { events, rest } = splitSseFrames<Ping>('data: {"type":"a"}\n\ndata: {"ty');
    expect(events).toEqual([{ type: "a" }]);
    expect(rest).toBe('data: {"ty');
  });

  it("skips a frame whose JSON is malformed rather than throwing", () => {
    // One bad progress update should not abort an import that is otherwise fine.
    const { events } = splitSseFrames<Ping>('data: {oops\n\ndata: {"type":"b"}\n\n');
    expect(events).toEqual([{ type: "b" }]);
  });

  it("ignores frames carrying no data line, such as comments and keep-alives", () => {
    const { events } = splitSseFrames<Ping>(': keep-alive\n\ndata: {"type":"b"}\n\n');
    expect(events).toEqual([{ type: "b" }]);
  });

  it("finds the data line when the frame also carries an event name", () => {
    const { events } = splitSseFrames<Ping>('event: status\ndata: {"type":"a"}\n\n');
    expect(events).toEqual([{ type: "a" }]);
  });
});

/** A body that hands out exactly the chunks given, to control where splits land. */
function bodyOf(chunks: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let i = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (i >= chunks.length) {
        controller.close();
        return;
      }
      controller.enqueue(encoder.encode(chunks[i++]));
    },
  });
}

describe("readSseStream", () => {
  it("reassembles a frame split across two chunks", async () => {
    const seen: Ping[] = [];
    await readSseStream<Ping>(bodyOf(['data: {"type":"a","n"', ':1}\n\n']), (e) => seen.push(e));
    expect(seen).toEqual([{ type: "a", n: 1 }]);
  });

  it("delivers events in order across many chunks", async () => {
    const seen: Ping[] = [];
    await readSseStream<Ping>(
      bodyOf(['data: {"type":"a"}\n\ndata: {"typ', 'e":"b"}\n\n', 'data: {"type":"c"}\n\n']),
      (e) => seen.push(e),
    );
    expect(seen.map((e) => e.type)).toEqual(["a", "b", "c"]);
  });

  it("propagates a throw from the callback, which is how an error frame aborts", async () => {
    const onEvent = vi.fn((e: Ping) => {
      if (e.type === "error") throw new Error("upstream said no");
    });
    await expect(
      readSseStream<Ping>(
        bodyOf(['data: {"type":"a"}\n\ndata: {"type":"error"}\n\ndata: {"type":"c"}\n\n']),
        onEvent,
      ),
    ).rejects.toThrow("upstream said no");
    // And it stops there — the frame after the error is never delivered.
    expect(onEvent.mock.calls.map(([e]) => e.type)).toEqual(["a", "error"]);
  });

  it("drops an unterminated trailing frame rather than half-parsing it", async () => {
    const seen: Ping[] = [];
    await readSseStream<Ping>(bodyOf(['data: {"type":"a"}\n\ndata: {"type":"b"']), (e) =>
      seen.push(e),
    );
    expect(seen).toEqual([{ type: "a" }]);
  });
});
