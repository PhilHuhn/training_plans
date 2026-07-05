import "server-only";
import AnthropicNamespace from "@anthropic-ai/sdk";
import { env } from "@/server/env";

// Some bundlers (incl. Next webpack server build) resolve the default-export
// shape of @anthropic-ai/sdk inconsistently — the imported value can end up
// being the namespace object whose own `messages` resolves to undefined when
// `new` ed. Always use the explicit class on the namespace.
const AnthropicMaybeNamespaced = AnthropicNamespace as unknown as {
  Anthropic?: typeof AnthropicNamespace;
};
const Anthropic = AnthropicMaybeNamespaced.Anthropic ?? AnthropicNamespace;
type AnthropicClient = InstanceType<typeof AnthropicNamespace>;

export const CLAUDE_MODEL = "claude-sonnet-5";

// Lazy singleton; recreated per-process. Anthropic uses lazy getters so the
// instance must be referenced freshly within each request to avoid stale-getter
// issues under Next.js HMR.
let _client: AnthropicClient | null = null;
export function anthropic(): AnthropicClient {
  if (!_client) _client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  return _client;
}

// ---------------------------------------------------------------------------
// Short-key system (mirrors backend/app/core/claude_client.py verbatim)
// ---------------------------------------------------------------------------

const TOP_KEYS: Record<string, string> = {
  a: "analysis",
  wf: "weekly_focus",
  ss: "sessions",
  w: "warnings",
};

const SESSION_KEYS: Record<string, string> = {
  d: "date",
  t: "type",
  s: "sport",
  desc: "description",
  km: "distance_km",
  min: "duration_min",
  int: "intensity",
  hr: "hr_zone",
  pace: "pace_range",
  pw: "power_target_watts",
  ivl: "intervals",
  n: "notes",
  ph: "training_phase",
  tr: "terrain",
  el: "elevation_target_m",
  load: "estimated_load",
  rpe: "rpe_target",
  alt: "alternative_workout",
};

const INTERVAL_KEYS: Record<string, string> = {
  r: "reps",
  dm: "distance_m",
  tp: "target_pace",
  rec: "recovery",
};

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function expandSessionKeys(session: Record<string, unknown>): Record<string, unknown> {
  const expanded: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(session)) {
    const fullKey = SESSION_KEYS[k] ?? k;
    if (fullKey === "intervals" && Array.isArray(v)) {
      expanded[fullKey] = v.map((ivl) =>
        isPlainObject(ivl)
          ? Object.fromEntries(
              Object.entries(ivl).map(([ik, iv]) => [INTERVAL_KEYS[ik] ?? ik, iv]),
            )
          : ivl,
      );
    } else if (fullKey === "alternative_workout" && isPlainObject(v)) {
      expanded[fullKey] = Object.fromEntries(
        Object.entries(v).map(([ak, av]) => [SESSION_KEYS[ak] ?? ak, av]),
      );
    } else {
      expanded[fullKey] = v;
    }
  }
  return expanded;
}

/** Idempotent expansion of compressed Claude responses to full keys. */
export function expandShortKeys(data: unknown): Record<string, unknown> {
  if (!isPlainObject(data)) return {} as Record<string, unknown>;

  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) out[TOP_KEYS[k] ?? k] = v;

  if (Array.isArray(out.sessions)) {
    out.sessions = (out.sessions as unknown[]).map((s) =>
      isPlainObject(s) ? expandSessionKeys(s) : s,
    );
  }
  return out;
}

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
 *  starts with thinking blocks — content[0] is no longer guaranteed text. */
function textFromContent(content: Array<{ type: string; text?: string }>): string {
  return content
    .filter((b) => b.type === "text" && typeof b.text === "string")
    .map((b) => b.text)
    .join("");
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
      model: CLAUDE_MODEL,
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
): Promise<ClaudeJsonResult> {
  return callJson(systemPrompt, userPrompt, false);
}

export async function generateText(prompt: string, maxTokens = 1024): Promise<string> {
  // Thinking disabled: this is used for short snippets (e.g. the 400-token
  // profile summary) where adaptive thinking would eat the whole budget.
  const message = await anthropic().messages.create({
    model: CLAUDE_MODEL,
    max_tokens: maxTokens,
    thinking: { type: "disabled" },
    messages: [{ role: "user", content: prompt }],
  });
  return textFromContent(message.content);
}
