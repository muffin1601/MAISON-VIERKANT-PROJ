import { withAuth } from "next-auth/middleware";
import { NextResponse } from "next/server";

/**
 * Edge guard for the admin console. Verifies a valid JWT and that the user is not a plain
 * customer. Fine-grained, per-page permission checks happen server-side in the admin layout
 * and in each Server Action (defense in depth).
 */
export default withAuth(
  function middleware(req) {
    const role = req.nextauth.token?.role;
    if (role === "CUSTOMER") {
      return NextResponse.redirect(new URL("/", req.url));
    }
    return NextResponse.next();
  },
  {
    pages: { signIn: "/login" },
    callbacks: {
      authorized: ({ token }) => !!token,
    },
  },
);

export const config = {
  matcher: ["/admin/:path*"],
};
