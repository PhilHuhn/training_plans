import { NextResponse, type NextRequest } from "next/server";
import { eq, ne, and } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
import { errorJson, parseJson } from "@/server/http";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email().optional(),
});

export async function PUT(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;
  const { name, email } = parsed.data;

  const update: Record<string, unknown> = { updatedAt: new Date() };
  if (name) update.name = name;
  if (email && email !== session.user.email) {
    const taken = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.email, email), ne(users.id, session.user.id)))
      .limit(1);
    if (taken.length > 0) return errorJson("Email already in use", 400);
    update.email = email;
  }

  const [updated] = await db
    .update(users)
    .set(update)
    .where(eq(users.id, session.user.id))
    .returning({ name: users.name, email: users.email });

  return NextResponse.json({
    message: "Account updated",
    name: updated.name,
    email: updated.email,
  });
}
