import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  refreshSession,
  resolveSession,
  SESSION_COOKIE_OPTIONS,
} from "./lib/auth/guard";

// Redirige a /login toda peticion sin sesion valida. /login, /api/*, /_next/*
// y los estaticos quedan fuera via el matcher. Sin cookie -> redirige sin
// llamar a Supabase; con token invalido o Supabase inalcanzable, igual.

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    return NextResponse.next();
  }

  const accessToken = request.cookies.get(ACCESS_COOKIE)?.value;

  if (!accessToken) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const session = await resolveSession(accessToken);

  if (session) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-user-id", session.userId);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (refreshToken) {
    const refreshed = await refreshSession(refreshToken);

    if (refreshed) {
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-user-id", refreshed.userId);
      const response = NextResponse.next({
        request: { headers: requestHeaders },
      });
      response.cookies.set(
        ACCESS_COOKIE,
        refreshed.accessToken,
        SESSION_COOKIE_OPTIONS,
      );
      response.cookies.set(
        REFRESH_COOKIE,
        refreshed.refreshToken,
        SESSION_COOKIE_OPTIONS,
      );
      return response;
    }
  }

  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  return response;
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
