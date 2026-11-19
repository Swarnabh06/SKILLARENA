import { getSessionCookie } from "better-auth/cookies";
import { NextResponse } from "next/server";
import { PROTECTED_PREFIXES } from "@/lib/auth/routes";

/**
 * Optimistic route protection: if there is no session cookie at all, send the
 * visitor to /login before rendering. This only checks that a cookie exists;
 * the real session and role checks happen in server guards (lib/auth/session.js)
 * and in every API route (lib/auth/guards.js).
 */
export function proxy(request) {
  const { pathname, search } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!isProtected) return NextResponse.next();

  if (!getSessionCookie(request)) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/achievements/:path*", "/applications/:path*", "/assessments/attempt/:path*", "/recruiter/:path*", "/admin/:path*", "/profile/:path*", "/settings/:path*", "/onboarding/:path*", "/continue/:path*"],
};
