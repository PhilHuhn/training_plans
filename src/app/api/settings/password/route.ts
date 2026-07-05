import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { requireSession } from "@/server/auth/session";
import { errorJson, parseJson } from "@/server/http";
import { hashPassword, verifyPassword } from "@/server/auth/password";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(8, "Password must be at least 8 characters"),
  confirm_password: z.string().min(1),
});

export async function PUT(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;
  const { current_password, new_password, confirm_password } = parsed.data;

  const ok = await verifyPassword(current_password, session.user.passwordHash);
  if (!ok) return errorJson("Current password is incorrect", 400);
  if (new_password !== confirm_password) return errorJson("Passwords do not match", 400);

  const passwordHash = await hashPassword(new_password);
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, session.user.id));

  return NextResponse.json({ message: "Password changed successfully" });
}
