import "server-only";
import { eq } from "drizzle-orm";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/server/db";
import { users, type User } from "@/server/db/schema";
import { TOKEN_TTL_SECONDS, verifyToken } from "./jwt";

export const ACCESS_COOKIE = "access_token";

function readBearer(req: NextRequest | Request): string | null {
  const auth = req.headers.get("authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

async function readCookie(req?: NextRequest | Request): Promise<string | null> {
  if (req && "cookies" in req && typeof (req as NextRequest).cookies?.get === "function") {
    return (req as NextRequest).cookies.get(ACCESS_COOKIE)?.value ?? null;
  }
  const jar = await cookies();
  return jar.get(ACCESS_COOKIE)?.value ?? null;
}

/** Read the current user from a request. Returns null if not authenticated. */
export async function getSession(req?: NextRequest | Request): Promise<User | null> {
  const token = (req && readBearer(req)) ?? (await readCookie(req));
  if (!token) return null;

  const payload = verifyToken(token);
  if (!payload?.sub) return null;

  const userId = Number(payload.sub);
  if (!Number.isInteger(userId)) return null;

  const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  return rows[0] ?? null;
}

/**
 * Like getSession but returns a 401 NextResponse if unauthenticated.
 *
 * The 401 response *also clears the access_token cookie* — defensive cleanup
 * for the case where a stale or expired token (e.g. signed under a previous
 * SECRET_KEY) is sitting in the browser. Without this, middleware would let
 * the user past the page-level cookie check, the API would 401, and the
 * client-side redirect to /login would bounce back to the protected page
 * because the cookie was still present. Clearing it server-side breaks the
 * loop in one round-trip.
 */
export async function requireSession(
  req?: NextRequest | Request,
): Promise<{ user: User } | { response: NextResponse }> {
  const user = await getSession(req);
  if (!user) {
    return {
      response: NextResponse.json(
        { detail: "Not authenticated" },
        { status: 401, headers: { "Set-Cookie": clearAuthCookie() } },
      ),
    };
  }
  return { user };
}

/** Build a Set-Cookie header value for the access token. */
export function buildAuthCookie(token: string): string {
  const isProd = process.env.NODE_ENV === "production";
  return [
    `${ACCESS_COOKIE}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    isProd ? "Secure" : "",
    `Max-Age=${TOKEN_TTL_SECONDS}`,
  ]
    .filter(Boolean)
    .join("; ");
}

export function clearAuthCookie(): string {
  return `${ACCESS_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}
