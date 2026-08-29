import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse, type NextMiddleware } from "next/server";

const isPublicPage = createRouteMatcher(["/login(.*)", "/sign-up(.*)"]);
const isGuestCapableApi = createRouteMatcher([
  "/api/classroom-sessions/join",
  "/api/events(.*)",
  "/api/gameData(.*)",
  "/api/quiz(.*)",
]);
const isApiRoute = createRouteMatcher(["/api(.*)"]);
const isAdminRoute = createRouteMatcher(["/adminDashboard(.*)"]);

// !IMPORTANT, add this to your env:
// NEXT_PUBLIC_CLERK_SIGN_IN_URL=/login
// otherwise auth().protect() will default to Clerk's hosted login route.

// Keep in mind when you change roles, it won't appear until Clerk's session token refreshes.
// https://clerk.com/docs/guides/sessions/customize-session-tokens

const authenticatedProxy = clerkMiddleware(async (auth, req) => {
  if (isPublicPage(req) || isGuestCapableApi(req)) return NextResponse.next();

  const { userId, sessionClaims } = await auth();
  if (isApiRoute(req) && !userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const role = sessionClaims?.role;

  // Protect admin routes (can pass an error instead)
  if (isAdminRoute(req) && role !== "admin") {
    return NextResponse.redirect(new URL("/playerDashboard", req.url));
  }

  return NextResponse.next();
});

/**
 * Browser-test variant: Clerk still runs, but enforces nothing.
 *
 * Skipping clerkMiddleware entirely would leave `auth()` throwing inside every route handler, so
 * unauthenticated requests answered 500 instead of being refused — the e2e environment diverged
 * from production exactly where authorization lives, and no browser test could observe the real
 * behaviour. Running the middleware without the protection logic keeps `auth()` working and
 * resolving to an anonymous caller, so routes make their own authorization decisions as they do in
 * production.
 */
const bypassedProxy = clerkMiddleware(async () => NextResponse.next());

const proxy: NextMiddleware = (request, event) => {
  if (process.env.NODE_ENV !== "production" && process.env.KFI_E2E_BYPASS_CLERK === "1") {
    return bypassedProxy(request, event);
  }

  return authenticatedProxy(request, event);
};

export default proxy;

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes
    "/(api|trpc)(.*)",
  ],
};
