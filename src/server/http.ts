import "server-only";
import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

/** Standardized error response (matches FastAPI's `{detail: string}` shape). */
export function errorJson(detail: string, status: number, init?: ResponseInit): NextResponse {
  return NextResponse.json({ detail }, { status, ...init });
}

/** Parse JSON body against a Zod schema, returning either the data or an error response. */
export async function parseJson<T>(
  req: Request,
  schema: ZodSchema<T>,
): Promise<{ data: T } | { response: NextResponse }> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return { response: errorJson("Invalid JSON body", 400) };
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    const message = formatZodError(result.error);
    return { response: errorJson(message, 422) };
  }
  return { data: result.data };
}

export function formatZodError(err: ZodError): string {
  return err.issues
    .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
    .join("; ");
}
