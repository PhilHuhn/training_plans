import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(
      new URL("/settings?error=missing_parameters", request.url)
    );
  }

  // Redirect to settings with the code and state as query params
  // The frontend will handle the token exchange
  return NextResponse.redirect(
    new URL(
      `/settings?strava_code=${code}&strava_state=${state}`,
      request.url
    )
  );
}
