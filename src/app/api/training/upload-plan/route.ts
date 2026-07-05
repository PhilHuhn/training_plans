import { NextResponse, type NextRequest } from "next/server";
import { requireSession } from "@/server/auth/session";
import { errorJson } from "@/server/http";
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

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

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

  try {
    const result = await processUploadedPlan(
      session.user,
      buffer,
      file.type || "",
      file.name || "unknown",
      startDate,
    );
    return NextResponse.json(result, { status: 201 });
  } catch (err) {
    console.error("[upload-plan] error:", err);
    return errorJson(err instanceof Error ? err.message : "Failed to process plan", 400);
  }
}
