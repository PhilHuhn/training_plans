import { describe, expect, it } from "vitest";
import {
  isUnexpectedContentShape,
  normalizeContentBlocks,
  textFromBlocks,
  toolUsesFromBlocks,
} from "../message-content";

describe("normalizeContentBlocks", () => {
  it("passes through the shape Anthropic documents", () => {
    const blocks = [{ type: "text", text: "hello" }];
    expect(normalizeContentBlocks(blocks)).toEqual(blocks);
  });

  it("wraps a bare string, which is what actually broke in production", () => {
    // OpenRouter routing to a non-Anthropic model returned this; the old code
    // did `for (const b of content)` and threw "content is not iterable" after
    // the model had already answered.
    expect(normalizeContentBlocks("just text")).toEqual([{ type: "text", text: "just text" }]);
  });

  it("wraps a single unwrapped block", () => {
    expect(normalizeContentBlocks({ type: "text", text: "hi" })).toEqual([
      { type: "text", text: "hi" },
    ]);
  });

  it("returns [] for null, undefined and an empty string rather than throwing", () => {
    for (const value of [null, undefined, "", 42, true]) {
      expect(normalizeContentBlocks(value)).toEqual([]);
    }
  });

  it("drops array entries that are not typed blocks", () => {
    const mixed = [{ type: "text", text: "keep" }, null, "loose", { notType: 1 }];
    expect(normalizeContentBlocks(mixed)).toEqual([{ type: "text", text: "keep" }]);
  });

  it("keeps unknown block types, so thinking/reasoning blocks survive the round trip", () => {
    const blocks = [{ type: "thinking" }, { type: "text", text: "answer" }];
    expect(normalizeContentBlocks(blocks)).toHaveLength(2);
  });
});

describe("isUnexpectedContentShape", () => {
  it("flags anything that is not an array", () => {
    expect(isUnexpectedContentShape([])).toBe(false);
    expect(isUnexpectedContentShape("text")).toBe(true);
    expect(isUnexpectedContentShape(null)).toBe(true);
    expect(isUnexpectedContentShape({ type: "text" })).toBe(true);
  });
});

describe("textFromBlocks", () => {
  it("concatenates every text block, skipping the others", () => {
    const blocks = normalizeContentBlocks([
      { type: "thinking" },
      { type: "text", text: "one " },
      { type: "tool_use", id: "t1", name: "x", input: {} },
      { type: "text", text: "two" },
    ]);
    expect(textFromBlocks(blocks)).toBe("one two");
  });

  it("ignores a text block whose text is not a string", () => {
    expect(textFromBlocks(normalizeContentBlocks([{ type: "text", text: 42 }]))).toBe("");
  });

  it("is empty for no blocks", () => {
    expect(textFromBlocks([])).toBe("");
  });
});

describe("toolUsesFromBlocks", () => {
  it("returns well-formed tool uses", () => {
    const blocks = normalizeContentBlocks([
      { type: "text", text: "thinking out loud" },
      { type: "tool_use", id: "t1", name: "get_user_zones", input: { a: 1 } },
    ]);
    expect(toolUsesFromBlocks(blocks)).toEqual([
      { type: "tool_use", id: "t1", name: "get_user_zones", input: { a: 1 } },
    ]);
  });

  it("drops a tool_use with no id", () => {
    // The reply must echo tool_use_id; without one the next hop is a certain
    // 400, so it is better to end the loop than to send it.
    const blocks = normalizeContentBlocks([{ type: "tool_use", name: "x", input: {} }]);
    expect(toolUsesFromBlocks(blocks)).toEqual([]);
  });

  it("drops a tool_use with no name", () => {
    const blocks = normalizeContentBlocks([{ type: "tool_use", id: "t1", input: {} }]);
    expect(toolUsesFromBlocks(blocks)).toEqual([]);
  });

  it("drops one with an empty-string id or name", () => {
    expect(
      toolUsesFromBlocks(normalizeContentBlocks([{ type: "tool_use", id: "", name: "x" }])),
    ).toEqual([]);
    expect(
      toolUsesFromBlocks(normalizeContentBlocks([{ type: "tool_use", id: "t", name: "" }])),
    ).toEqual([]);
  });
});
