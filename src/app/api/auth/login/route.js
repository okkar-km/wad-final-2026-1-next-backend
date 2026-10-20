//src/app/api/auth/login/route.js

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import {
  errorResponse,
  successResponse,
  printExceptionLog,
} from "@/lib/utils";

export const runtime = "nodejs";

// Handle browser preflight requests from the React frontend.
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON", 400);
  }

  const email =
    typeof body?.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

  const password =
    typeof body?.password === "string" ? body.password : "";

  if (!email || !password) {
    return errorResponse("Email and password are required", 400);
  }

  try {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET is not configured");
    }

    const client = await getClientPromise();
    const db = client.db("Online-Course-Service");

    const user = await db.collection("users").findOne({ email });

    if (!user) {
      return errorResponse("Invalid email or password", 401);
    }

    const passwordMatches = await bcrypt.compare(
      password,
      user.password,
    );

    if (!passwordMatches) {
      return errorResponse("Invalid email or password", 401);
    }

    if (!["Student", "Teacher"].includes(user.role)) {
      return errorResponse("User role is not permitted", 403);
    }

    // Explicitly select safe fields; never return the password hash.
    const authenticatedUser = {
      id: user._id.toString(),
      username: user.username,
      email: user.email,
      role: user.role,
    };

    const token = jwt.sign(authenticatedUser, secret, {
      expiresIn: "1d",
    });

    const response = successResponse(
      {
        message: "Login successful",
        user: authenticatedUser,
      },
      200,
    );

    const isProduction = process.env.NODE_ENV === "production";

    response.cookies.set("token", token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? "none" : "lax",
      path: "/",
      maxAge: 60 * 60 * 24,
    });

    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    printExceptionLog("Login", error);
    return errorResponse("Unable to log in. Please try again.", 500);
  }
}