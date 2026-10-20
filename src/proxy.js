import { NextResponse } from "next/server";
import { verifyJWT } from "./lib/auth";
import corsHeaders from "./lib/cors";
import { errorResponse } from "./lib/utils";
import {
  X_HEADER_USER_EMAIL,
  X_HEADER_USER_ID,
  X_HEADER_USER_NAME,
  X_HEADER_USER_ROLE,
} from "./lib/constant";

export function proxy(request) {
  // Browser preflight requests do not require authentication.
  if (request.method === "OPTIONS") {
    return new NextResponse(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  const user = verifyJWT(request);

  if (!user || typeof user.id !== "string" || !user.id) {
    return errorResponse("Unauthorized Request", 401);
  }

  if (!["Student", "Teacher"].includes(user.role)) {
    return errorResponse("User role is not permitted", 403);
  }

  // Overwrite incoming identity headers with verified JWT data.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(X_HEADER_USER_ID, user.id);
  requestHeaders.set(X_HEADER_USER_EMAIL, user.email);
  requestHeaders.set(X_HEADER_USER_NAME, user.username);
  requestHeaders.set(X_HEADER_USER_ROLE, user.role);

  return NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });
}

export const config = {
  matcher: ["/api/course/:path*", "/api/user/:path*"],
};