import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isPublicRoute = createRouteMatcher(["/login(.*)", "/api/quiz(.*)", "/sign-up(.*)"]);
const isAdminRoute = createRouteMatcher(["/adminDashboard(.*)"]);

// !IMPORTANT, add this to your env:
// NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
//otherwise auth.protect() will default to clerks hosted login route.

//Keep in mind when you change roles, it wont appear until clerks session token refreshes.
//https://clerk.com/docs/guides/sessions/customize-session-tokens

export default clerkMiddleware(async (auth, req) => {
  if (isPublicRoute(req)) return NextResponse.next();
  const { sessionClaims } = await auth.protect();
  const role = sessionClaims?.role;

  // Protect admin routes (can pass a error instead)
  if (isAdminRoute(req) && role !== "admin") {
    return NextResponse.redirect(new URL("/playerDashboard", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
