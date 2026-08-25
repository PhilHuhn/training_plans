import "server-only";
import AnthropicNamespace from "@anthropic-ai/sdk";
import { normalizeContentBlocks, textFromBlocks } from "@/lib/message-content";
import { aiApiKey, env } from "@/server/env";
import { aiModel, aiProvider } from "./app-settings";

// Some bundlers (incl. Next webpack server build) resolve the default-export
// shape of @anthropic-ai/sdk inconsistently — the imported value can end up
// being the namespace object whose own `messages` resolves to undefined when
// `new` ed. Always use the explicit class on the namespace.
const AnthropicMaybeNamespaced = AnthropicNamespace as unknown as {
  Anthropic?: typeof AnthropicNamespace;
};
const Anthropic = AnthropicMaybeNamespaced.Anthropic ?? AnthropicNamespace;
type AnthropicClient = InstanceType<typeof AnthropicNamespace>;

// Re-exported so callers that only need "some model id" (logs, tests) do not
// have to reach into the settings service. The model actually sent comes from
// aiModel(), which lets the operator override it from /admin.
export { aiModel };

// Lazy singleton; recreated per-process. Anthropic uses lazy getters so the
// instance must be referenced freshly within each request to avoid stale-getter
// issues under Next.js HMR.
let _client: AnthropicClient | null = null;
export function anthropic(): AnthropicClient {
  if (!_client) {
    const provider = aiProvider();
    _client = new Anthropic({
      apiKey: aiApiKey(),
      // Undefined for Anthropic direct, so the SDK keeps its own default.
      baseURL: provider.baseUrl,
      // OpenRouter attributes traffic by these and shows the app on its
      // activity page; they are ignored by Anthropic direct.
      defaultHeaders:
        provider.provider === "openrouter"
          ? { "HTTP-Referer": env.BASE_URL, "X-Title": "Club Turbine" }
          : undefined,
    });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Short-key system (mirrors backend/app/core/claude_client.py verbatim).
// Implementation lives in workout-normalize.ts (pure, no SDK import) so the
// matching engine and Vitest suites can use it; re-exported here for existing
// callers.
// ---------------------------------------------------------------------------

import { expandShortKeys, isPlainObject } from "./workout-normalize";
export { expandShortKeys };

// ---------------------------------------------------------------------------
// JSON extractor (3-fallback: brace-match → repair → truncation recovery)
// ---------------------------------------------------------------------------

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```(?:json|JSON)?\s*\n?/, "")
    .replace(/\n?```\s*$/, "")
    .trim();
}

function extractJsonByBraces(text: string): string {
  const first = text.indexOf("{");
  if (first < 0) return text;

  let depth = 0;
  let inString = false;
  let escapeNext = false;
  for (let i = first; i < text.length; i++) {
    const ch = text[i];
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === "{") depth += 1;
      else if (ch === "}") {
        depth -= 1;
        if (depth === 0) return text.slice(first, i + 1);
      }
    }
  }
  return text.slice(first); // truncated — return what we have
}

function extractJson(text: string): string {
  const stripped = stripFences(text);
  if (stripped.startsWith("{") || stripped.startsWith("[")) return stripped;
  return extractJsonByBraces(stripped);
}

function isValidJson(text: string): boolean {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
}

function repairTruncated(text: string): string {
  const stack: string[] = [];
  let inString = false;
  let escapeNext = false;
  for (const ch of text) {
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    if (ch === "\\" && inString) {
      escapeNext = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (!inString) {
      if (ch === "{" || ch === "[") stack.push(ch);
      else if (ch === "}" || ch === "]") stack.pop();
    }
  }
  if (stack.length === 0) return text;

  let truncated = text.replace(/\s+$/, "");
  // Dangling key with partial string value:  ,"km":"12.
  truncated = truncated.replace(/,\s*"[^"]*"?\s*:\s*"[^"]*$/, "");
  // Dangling key with partial number/literal value:  ,"min":  |  ,"min":12.  |  ,"alt":tru
  truncated = truncated.replace(/,\s*"[^"]*"\s*:\s*[-+0-9.eE]*$/, "");
  truncated = truncated.replace(/,\s*"[^"]*"\s*:\s*(?:true|false|null|[a-z]*)?$/, "");
  // Dangling partial key:  ,"mi
  truncated = truncated.replace(/,\s*"[^"]*$/, "");
  // First key of an object, no comma to strip:  {"km":
  truncated = truncated.replace(/(\{)\s*"[^"]*"?\s*:?\s*$/, "$1");
  truncated = truncated.replace(/,\s*$/, "");
  for (let i = stack.length - 1; i >= 0; i--) {
    truncated += stack[i] === "{" ? "}" : "]";
  }
  return truncated;
}

function fixJson(text: string): string {
  let t = stripFences(text);
  t = t.replace(/,\s*([}\]])/g, "$1"); // trailing commas
  t = t.replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":'); // unquoted keys
  if (!isValidJson(t)) t = repairTruncated(t);
  return t;
}

// ---------------------------------------------------------------------------
// High-level helpers used by training-engine and document-parser
// ---------------------------------------------------------------------------

export interface ClaudeJsonResult {
  data: Record<string, unknown> | null;
  error?: string;
}

/** Real-time progress from a streamed generation. */
export interface GenerationProgressEvent {
  stage: "thinking" | "writing";
  /** Sessions counted so far in the partial JSON (writing stage only). */
  sessions?: number;
}
export type GenerationProgressCallback = (event: GenerationProgressEvent) => void;

// Each session object carries exactly one date field — short key `"d"` or
// expanded `"date"` — so counting those in the partial JSON counts sessions.
const SESSION_DATE_RE = /"(?:d|date)"\s*:\s*"\d{4}-\d{2}-\d{2}/g;

function countSessionsInPartialJson(text: string): number {
  const matches = text.match(SESSION_DATE_RE);
  return matches ? matches.length : 0;
}

/** Concatenate all text blocks. With adaptive thinking (Sonnet 5+), content
 *  starts with thinking blocks — content[0] is no longer guaranteed text.
 *
 *  Takes `unknown` rather than a block array on purpose: OpenRouter's
 *  translation layer does not guarantee the documented shape for a third-party
 *  model, and a bare string here used to throw "filter is not a function". */
function textFromContent(content: unknown): string {
  return textFromBlocks(normalizeContentBlocks(content));
}

async function callJson(
  systemPrompt: string,
  userPrompt: string,
  expand: boolean,
  onProgress?: GenerationProgressCallback,
): Promise<ClaudeJsonResult> {
  let responseText = "";
  let extracted = "";
  try {
    // Streamed to avoid HTTP timeouts: long plans (adaptive thinking + large
    // JSON) can take several minutes to generate. max_tokens is a combined
    // budget for thinking + output — a ~20-week plan alone runs >30K output
    // tokens, hence the large headroom.
    const stream = anthropic().messages.stream({
      model: await aiModel(),
      // Combined thinking + output budget. Must stay within the routed model's
      // own ceiling — a smaller model reached through OpenRouter will reject a
      // budget it cannot honour, which surfaces as a 400 the classifier turns
      // into "the model is unavailable".
      max_tokens: 64000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    if (onProgress) {
      let partialText = "";
      let lastEmit = 0;
      stream.on("streamEvent", (event) => {
        if (event.type === "content_block_start" && event.content_block.type === "thinking") {
          onProgress({ stage: "thinking" });
        } else if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
          partialText += event.delta.text;
          // Recounting the full partial text is cheap at this cadence; throttle
          // so we don't regex-scan on every token.
          const now = Date.now();
          if (now - lastEmit >= 400) {
            lastEmit = now;
            onProgress({ stage: "writing", sessions: countSessionsInPartialJson(partialText) });
          }
        }
      });
    }

    const message = await stream.finalMessage();

    responseText = textFromContent(message.content);
    if (!responseText) {
      return { data: null, error: "Unexpected Claude response: no text block" };
    }
    extracted = extractJson(responseText);

    if (message.stop_reason === "max_tokens") {
      // Truncated mid-plan. The repair pass below salvages complete sessions,
      // but log it — recurring hits mean max_tokens needs another bump.
      console.warn(
        `[claude] response truncated at max_tokens (${responseText.length} chars) — salvaging partial JSON`,
      );
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extracted);
    } catch {
      try {
        parsed = JSON.parse(fixJson(extracted));
      } catch (parseErr) {
        const detail = parseErr instanceof Error ? parseErr.message : String(parseErr);
        return {
          data: null,
          error: `Claude returned unparseable JSON (stop_reason: ${message.stop_reason}): ${detail.slice(0, 200)}`,
        };
      }
    }

    if (!isPlainObject(parsed)) {
      return { data: null, error: "Claude response is not a JSON object" };
    }
    return { data: expand ? expandShortKeys(parsed) : parsed };
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    return { data: null, error: `Claude error: ${detail}` };
  }
}

export function generateTrainingRecommendations(
  systemPrompt: string,
  userPrompt: string,
  onProgress?: GenerationProgressCallback,
): Promise<ClaudeJsonResult> {
  return callJson(systemPrompt, userPrompt, true, onProgress);
}

export function convertSession(
  systemPrompt: string,
  userPrompt: string,
): Promise<ClaudeJsonResult> {
  return callJson(systemPrompt, userPrompt, true);
}

export function parseDocument(
  systemPrompt: string,
  userPrompt: string,
  onProgress?: GenerationProgressCallback,
): Promise<ClaudeJsonResult> {
  // The document parse has always streamed — it just had nowhere to report to.
  // Its prompt emits the same `"sessions": [{ "date": ... }]` shape, so the
  // session counter in callJson counts an uploaded plan as accurately as a
  // generated one.
  return callJson(systemPrompt, userPrompt, false, onProgress);
}

export async function generateText(prompt: string, maxTokens = 1024): Promise<string> {
  // Thinking disabled: this is used for short snippets (e.g. the 400-token
  // profile summary) where adaptive thinking would eat the whole budget.
  const message = await anthropic().messages.create({
    model: await aiModel(),
    max_tokens: maxTokens,
    thinking: { type: "disabled" },
    messages: [{ role: "user", content: prompt }],
  });
  return textFromContent(message.content);
}
