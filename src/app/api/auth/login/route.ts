import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/server/db";
import { users } from "@/server/db/schema";
import { verifyPassword } from "@/server/auth/password";
import { signToken } from "@/server/auth/jwt";
import { buildAuthCookie } from "@/server/auth/session";
import { errorJson, parseJson } from "@/server/http";

export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  const parsed = await parseJson(req, Body);
  if ("response" in parsed) return parsed.response;
  const { email, password } = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    return errorJson("Incorrect email or password", 401);
  }

  const accessToken = signToken(user.id);
  return NextResponse.json(
    { access_token: accessToken, token_type: "bearer" },
    { headers: { "Set-Cookie": buildAuthCookie(accessToken) } },
  );
}
