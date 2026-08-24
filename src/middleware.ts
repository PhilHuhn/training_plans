import { NextResponse, type NextRequest } from "next/server";

const APP_PATHS = ["/dashboard", "/training", "/activities", "/competitions", "/coach", "/club", "/settings", "/changelog", "/admin"];
const AUTH_PATHS = ["/login", "/register"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasToken = req.cookies.has("access_token");

  const isAppPath = APP_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"));
  if (isAppPath && !hasToken) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }

  if (AUTH_PATHS.includes(pathname) && hasToken) {
    const url = req.nextUrl.clone();
    url.pathname = "/training";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico).*)"],
};
