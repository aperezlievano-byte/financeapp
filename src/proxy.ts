import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Redirige a /login toda peticion sin la cookie pfa_at. Todavia no valida el
// token contra Supabase -- eso llega en el paso 3 (src/lib/auth/guard.ts).
// /login, /api/*, /_next/* y los estaticos quedan fuera via el matcher.

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/login") {
    return NextResponse.next();
  }

  if (!request.cookies.has("pfa_at")) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
