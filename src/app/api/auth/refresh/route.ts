import { NextResponse, type NextRequest } from "next/server";
import { signToken } from "@/server/auth/jwt";
import { buildAuthCookie, requireSession } from "@/server/auth/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if ("response" in session) return session.response;

  const accessToken = signToken(session.user.id);
  return NextResponse.json(
    { access_token: accessToken, token_type: "bearer" },
    { headers: { "Set-Cookie": buildAuthCookie(accessToken) } },
  );
}
