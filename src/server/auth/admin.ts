import "server-only";
import type { NextRequest, NextResponse } from "next/server";
import { isPlatformAdmin, parseAdminEmails } from "@/lib/admin";
import { env } from "@/server/env";
import { errorJson } from "@/server/http";
import type { User } from "@/server/db/schema";
import { requireSession } from "./session";

// Parsed once at module load — the env value cannot change without a redeploy.
const ADMIN_EMAILS = parseAdminEmails(env.ADMIN_EMAILS);

/** Whether this user operates the platform (not to be confused with a club coach). */
export function isAdmin(user: Pick<User, "email" | "isAdmin">): boolean {
  return isPlatformAdmin({ email: user.email, isAdmin: user.isAdmin }, ADMIN_EMAILS);
}

/**
 * requireSession + platform-admin check. Every /api/admin route starts with
 * this; the middleware only checks for a cookie, so this is the real gate.
 */
export async function requireAdmin(
  req?: NextRequest | Request,
): Promise<{ user: User } | { response: NextResponse }> {
  const session = await requireSession(req);
  if ("response" in session) return session;
  if (!isAdmin(session.user)) {
    return { response: errorJson("Not authorized", 403) };
  }
  return { user: session.user };
}
