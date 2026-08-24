/**
 * Pure platform-admin predicate. Kept out of @/server/auth/admin so it can be
 * unit-tested without booting the env schema (which requires DATABASE_URL).
 */

/** Parse the ADMIN_EMAILS env value into a normalized lookup set. */
export function parseAdminEmails(csv: string | undefined | null): Set<string> {
  return new Set(
    (csv ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean),
  );
}

/**
 * A user is a platform admin if the DB flag is set OR their email is listed in
 * ADMIN_EMAILS. The env path is the bootstrap — it grants the first admin with
 * no SQL — and stays available if the flag is ever cleared by mistake.
 */
export function isPlatformAdmin(
  user: { email: string; isAdmin: boolean },
  adminEmails: Set<string>,
): boolean {
  if (user.isAdmin) return true;
  return adminEmails.has(user.email.trim().toLowerCase());
}
