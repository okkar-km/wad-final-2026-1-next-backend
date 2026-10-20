//src/app/api/auth/logout/route.js

import corsHeaders from "@/lib/cors";
import { successResponse } from "@/lib/utils";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST() {
  const response = successResponse(
    { message: "Logout successful" },
    200,
  );

  const isProduction = process.env.NODE_ENV === "production";

  response.cookies.set("token", "", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });

  response.headers.set("Cache-Control", "no-store");

  return response;
}