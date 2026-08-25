import { NextResponse } from "next/server";
import { APP_VERSION, GIT_COMMIT, shortCommit } from "@/lib/version";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "turbine-turmweg",
    // Same build identity the sidebar shows, so "is my deploy live?" can be
    // answered with a curl instead of a login.
    version: APP_VERSION,
    commit: shortCommit(GIT_COMMIT),
    timestamp: new Date().toISOString(),
  });
}
