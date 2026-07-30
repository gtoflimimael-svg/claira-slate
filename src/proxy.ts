import { NextResponse, type NextRequest } from "next/server";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { updateSession } from "@/lib/supabase/middleware";

const intlMiddleware = createIntlMiddleware(routing);

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // API routes and the OAuth/verification callback are never locale-prefixed
  // — skip the intl middleware entirely and only apply the Supabase session
  // logic, matching how these behaved before locale routing was introduced.
  if (pathname.startsWith("/api") || pathname.startsWith("/auth")) {
    return updateSession(request, NextResponse.next({ request }));
  }

  const intlResponse = intlMiddleware(request);

  // The intl middleware only redirects to normalize a locale prefix (e.g.
  // stripping a redundant "/en"); that always takes priority over auth.
  if (intlResponse.headers.get("location")) {
    return intlResponse;
  }

  return updateSession(request, intlResponse);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
