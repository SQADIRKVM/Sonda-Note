import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "sondanote_token";

/**
 * Route gate.
 *
 * Checks only for the presence of a session cookie — the API verifies the
 * token's signature on every request, so a forged cookie gets past this
 * redirect and then fails with a 401 at the data layer. Middleware is for
 * navigation, not authorisation.
 */
export function middleware(request: NextRequest) {
  const hasSession = Boolean(request.cookies.get(SESSION_COOKIE)?.value);
  const path = request.nextUrl.pathname;

  const isAuthRoute = path.startsWith("/login");
  const isPublic = isAuthRoute || path === "/";

  if (!hasSession && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", path);
    return NextResponse.redirect(url);
  }

  if (hasSession && isAuthRoute) {
    const url = request.nextUrl.clone();
    url.pathname = "/meetings";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|webp)$).*)"],
};
