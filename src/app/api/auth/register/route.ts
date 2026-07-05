import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { hashPassword } from "@/server/auth/password";
import { signToken } from "@/server/auth/jwt";
import { buildAuthCookie } from "@/server/auth/session";
import { errorJson, parseJson } from "@/server/http";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

export async function POST(req: Request) {
  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;
  const { email, name, password } = parsed.data;

  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (existing.length > 0) {
    return errorJson("Email already registered", 400);
  }

  const passwordHash = await hashPassword(password);
  const [created] = await db
    .insert(users)
    .values({ email, name, passwordHash })
    .returning({ id: users.id });

  const accessToken = signToken(created.id);
  return NextResponse.json(
    { access_token: accessToken, token_type: "bearer" },
    { status: 201, headers: { "Set-Cookie": buildAuthCookie(accessToken) } },
  );
}
