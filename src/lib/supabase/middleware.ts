import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "@/i18n/routing";

const AUTH_ROUTES = ["/login", "/signup", "/forgot-password"];
const LOCALE_PREFIX_RE = new RegExp(`^/(${routing.locales.join("|")})(?=/|$)`);

// Splits a locale-prefixed pathname (e.g. "/fr/app") into the prefix ("/fr")
// and the locale-agnostic path ("/app"), so auth route matching stays the
// same regardless of which locale the request came in on.
function splitLocale(pathname: string): { prefix: string; rest: string } {
  const match = pathname.match(LOCALE_PREFIX_RE);
  if (!match) return { prefix: "", rest: pathname };
  const rest = pathname.slice(match[0].length) || "/";
  return { prefix: match[0], rest };
}

export async function updateSession(request: NextRequest, baseResponse: NextResponse) {
  const { prefix, rest } = splitLocale(request.nextUrl.pathname);
  const isAppRoute = rest.startsWith("/app");
  const isAuthRoute = AUTH_ROUTES.includes(rest);

  // Only routes that care about auth state need to talk to Supabase — every
  // other request (marketing pages, tools, etc.) skips it entirely so the
  // rest of the site keeps working even before Supabase is configured.
  if (!isAppRoute && !isAuthRoute) {
    return baseResponse;
  }

  let response = baseResponse;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          baseResponse.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  // Do not run other code between createServerClient and getUser — it
  // refreshes the session token and writes the new cookie onto the response.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isAppRoute && !user) {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}/login`;
    url.searchParams.set("redirect", `${prefix}${rest}`);
    return NextResponse.redirect(url);
  }

  if (isAuthRoute && user) {
    const url = request.nextUrl.clone();
    url.pathname = `${prefix}/app`;
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
