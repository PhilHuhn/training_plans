import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/server/auth/session";
import { errorJson } from "@/server/http";
import { requireAiEnabled } from "@/server/services/ai-gate";
import { classifyEngineError, isUpstreamClaudeError } from "@/server/services/claude-errors";
import { processUploadedPlan } from "@/server/services/document-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_MIME = new Set([
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
]);

const ALLOWED_EXT = [".pdf", ".docx", ".doc", ".txt", ".md"];

/**
 * The message the browser is allowed to see.
 *
 * "Unsupported file type" and the like are the athlete's problem to fix and
 * must survive intact; only an upstream provider failure gets rewritten, so the
 * operator's billing state never reaches a user's screen.
 */
function safeUploadMessage(err: unknown): string {
  const message = err instanceof Error ? err.message : "";
  if (isUpstreamClaudeError(message)) return classifyEngineError(message).detail;
  return message || "Failed to process plan";
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  // Before any credit is spent: the operator can switch the AI features off.
  const aiGate = await requireAiEnabled();
  if (aiGate) return aiGate.response;

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return errorJson("Expected multipart/form-data with a file field", 400);
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return errorJson("Missing 'file' field in form data", 400);
  }

  const lcName = (file.name || "").toLowerCase();
  if (!ALLOWED_MIME.has(file.type || "") && !ALLOWED_EXT.some((ext) => lcName.endsWith(ext))) {
    return errorJson("Unsupported file type. Allowed: PDF, Word, TXT, Markdown", 400);
  }

  if (file.size > 10 * 1024 * 1024) {
    return errorJson("File too large. Maximum size is 10MB.", 400);
  }

  const startDate = req.nextUrl.searchParams.get("start_date") || undefined;
  const buffer = Buffer.from(await file.arrayBuffer());
  const user = session.user;
  const contentType = file.type || "";
  const originalName = file.name || "unknown";

  // SSE mode: report the real stages while the plan is read and parsed. Both
  // gates above have already run, so an auth or AI-disabled failure is still a
  // real status code — never an error frame inside a 200, and never a 401 from
  // an AI fault (the axios interceptor signs the user out on any 401).
  if (req.nextUrl.searchParams.get("stream") === "true") {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        const send = (event: Record<string, unknown>) => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          } catch {
            // client disconnected — the import continues, nothing to notify
          }
        };
        try {
          const result = await processUploadedPlan(
            user,
            buffer,
            contentType,
            originalName,
            startDate,
            (p) => send({ type: "status", ...p }),
          );
          send({ type: "done", result });
        } catch (err) {
          console.error("[upload-plan] error:", err);
          send({ type: "error", message: safeUploadMessage(err) });
        } finally {
          try {
            controller.close();
          } catch {
            // already closed
          }
        }
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        // no-transform keeps proxies from buffering the frames into one chunk,
        // which would defeat the whole point.
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  try {
    const result = await processUploadedPlan(
      user,
      buffer,
      contentType,
      originalName,
      startDate,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[upload-plan] error:", err);
    const message = err instanceof Error ? err.message : "";
    // "Unsupported file type" and the like are the user's problem to fix and
    // must survive; only an upstream Anthropic failure gets rewritten.
    if (isUpstreamClaudeError(message)) {
      const failure = classifyEngineError(message);
      return errorJson(failure.detail, failure.status);
    }
    return errorJson(message || "Failed to process plan", 400);
  }
}
