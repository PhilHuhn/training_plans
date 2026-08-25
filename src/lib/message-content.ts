/**
 * Defensive reading of a Messages-API `content` field.
 *
 * Anthropic guarantees `content` is an array of typed blocks. **OpenRouter does
 * not** — its Anthropic-compatible endpoint translates from whatever the routed
 * model actually speaks, and for a third-party model (NVIDIA Nemotron, say) the
 * field has been observed arriving as a bare string or missing entirely. The
 * SDK does not validate it, so `for (const b of response.content)` threw
 * "content is not iterable" and every reply died after the model had already
 * been paid for and answered.
 *
 * Pure — no "server-only", no SDK, no env — so it is testable on its own, the
 * same reasoning as @/lib/ai-provider and @/server/services/claude-errors.
 */

export interface TextBlock {
  type: "text";
  text: string;
}

export interface ToolUseBlock {
  type: "tool_use";
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export type ContentBlock = TextBlock | ToolUseBlock | { type: string };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Coerce whatever came back into a block array.
 *
 * Returns `[]` rather than throwing for anything unrecognisable: a reply we
 * cannot read is an empty reply, and the caller decides what to tell the user.
 */
export function normalizeContentBlocks(content: unknown): ContentBlock[] {
  // The shape Anthropic always sends.
  if (Array.isArray(content)) {
    return content.filter((b): b is ContentBlock => isRecord(b) && typeof b.type === "string");
  }
  // Some translations collapse a single text block to a bare string.
  if (typeof content === "string") {
    return content ? [{ type: "text", text: content }] : [];
  }
  // A lone block handed over unwrapped.
  if (isRecord(content) && typeof content.type === "string") {
    return [content as ContentBlock];
  }
  return [];
}

/** True when the content was in a shape we had to repair or could not read. */
export function isUnexpectedContentShape(content: unknown): boolean {
  return !Array.isArray(content);
}

export function textFromBlocks(blocks: ContentBlock[]): string {
  return blocks
    .filter((b): b is TextBlock => b.type === "text" && typeof (b as TextBlock).text === "string")
    .map((b) => b.text)
    .join("");
}

/**
 * Tool-use blocks, keeping only those complete enough to answer.
 *
 * A block missing its `id` cannot be replied to — the API requires the
 * `tool_use_id` to match — so returning it would guarantee a 400 on the next
 * hop. Models reached through a translation layer do emit these.
 */
export function toolUsesFromBlocks(blocks: ContentBlock[]): ToolUseBlock[] {
  return blocks.filter((b): b is ToolUseBlock => {
    if (b.type !== "tool_use") return false;
    const tu = b as Partial<ToolUseBlock>;
    return typeof tu.id === "string" && !!tu.id && typeof tu.name === "string" && !!tu.name;
  });
}
