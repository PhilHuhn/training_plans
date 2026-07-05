import { NextResponse } from "next/server";
import { clearAuthCookie } from "@/server/auth/session";

export const runtime = "nodejs";

export async function POST() {
  return new NextResponse(null, {
    status: 204,
    headers: { "Set-Cookie": clearAuthCookie() },
  });
}
