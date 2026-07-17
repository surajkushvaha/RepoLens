import { clerkMiddleware } from "@clerk/nextjs/server";

// Next.js 16 renamed `middleware.ts` -> `proxy.ts`. clerkMiddleware() makes the
// auth state available across the app and serves Clerk's auto-proxy path.
export default clerkMiddleware();

export const config = {
  matcher: [
    // Skip Next.js internals and static files, unless referenced in a query
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for API routes and Clerk's proxy path
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
