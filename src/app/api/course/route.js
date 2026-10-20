//src/app/api/course/route.js

import { ObjectId } from "mongodb";
import { verifyJWT } from "@/lib/auth";
import { getClientPromise } from "@/lib/mongodb";
import corsHeaders from "@/lib/cors";
import {
  errorResponse,
  successResponse,
  printExceptionLog,
} from "@/lib/utils";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function POST(request) {
  const user = verifyJWT(request);

  if (
    !user ||
    typeof user.id !== "string" ||
    !ObjectId.isValid(user.id)
  ) {
    return errorResponse("Unauthorized", 401);
  }

  if (user.role !== "Teacher") {
    return errorResponse("Only Teachers can create courses", 403);
  }

  let body;

  try {
    body = await request.json();
  } catch {
    return errorResponse("Request body must be valid JSON", 400);
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return errorResponse("Request body must be an object", 400);
  }

  const name =
    typeof body.name === "string" ? body.name.trim() : "";

  const { durationDays, topics, price, maxStudents } = body;
  const status = body.status ?? "Open";

  if (!name) {
    return errorResponse("Course name is required", 400);
  }

  if (!Number.isSafeInteger(durationDays) || durationDays < 1) {
    return errorResponse("Duration must be a positive integer", 400);
  }

  if (
    !Array.isArray(topics) ||
    topics.length === 0 ||
    topics.some(
      (topic) => typeof topic !== "string" || !topic.trim(),
    )
  ) {
    return errorResponse("Provide at least one non-empty topic", 400);
  }

  if (
    typeof price !== "number" ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    return errorResponse("Price must be a non-negative number", 400);
  }

  if (!Number.isSafeInteger(maxStudents) || maxStudents < 1) {
    return errorResponse(
      "Maximum students must be a positive integer",
      400,
    );
  }

  if (!["Open", "Close", "Cancel"].includes(status)) {
    return errorResponse("Status must be Open, Close, or Cancel", 400);
  }

  try {
    const client = await getClientPromise();
    const db = client.db("Online-Course-Service");

    const course = {
      name,
      durationDays,
      topics: topics.map((topic) => topic.trim()),
      price,
      maxStudents,
      status,

      // Ownership comes from the verified login, not request data.
      teacherId: new ObjectId(user.id),
      teacherName: user.username,

      enrolledStudentIds: [],
      createdAt: new Date(),
    };

    const result = await db.collection("courses").insertOne(course);

    return successResponse(
      {
        message: "Course created successfully",
        course: {
          ...course,
          _id: result.insertedId,
        },
      },
      201,
    );
  } catch (error) {
    printExceptionLog("Create course", error);
    return errorResponse("Unable to create course", 500);
  }
}

export async function GET(request) {
  const user = verifyJWT(request);

  if (
    !user ||
    typeof user.id !== "string" ||
    !ObjectId.isValid(user.id)
  ) {
    return errorResponse("Unauthorized", 401);
  }

  if (!["Teacher", "Student"].includes(user.role)) {
    return errorResponse("User role is not permitted", 403);
  }

  const search = request.nextUrl.searchParams.get("q")?.trim() || "";

  const enrolledOnly =
    request.nextUrl.searchParams.get("enrolled") === "true";

  if (enrolledOnly && user.role !== "Student") {
    return errorResponse("Only Students can view enrolled courses", 403);
  }

  const filter =
    user.role === "Teacher"
      ? { teacherId: new ObjectId(user.id) }
      : { status: { $ne: "Cancel" } };

  if (enrolledOnly) {
    // MongoDB matches courses whose array contains this Student's ID.
    filter.enrolledStudentIds = new ObjectId(user.id);
  }

  if (search) {
    // Treat search input as literal text, including special characters.
    const escapedSearch = search.replace(
      /[.*+?^${}()|[\]\\]/g,
      "\\$&",
    );

    filter.$or = [
      { name: { $regex: escapedSearch, $options: "i" } },
      { teacherName: { $regex: escapedSearch, $options: "i" } },
    ];
  }

  try {
    const client = await getClientPromise();
    const db = client.db("Online-Course-Service");

    const documents = await db
      .collection("courses")
      .find(filter)
      .sort({ createdAt: -1 })
      .toArray();

    const courses = documents.map((document) => {
      const { enrolledStudentIds = [], ...course } = document;
      const enrolledCount = enrolledStudentIds.length;

      return {
        ...course,
        enrolledCount,
        availableSeats: Math.max(
          0,
          course.maxStudents - enrolledCount,
        ),
      };
    });

    const response = successResponse({ courses }, 200);
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    printExceptionLog("List courses", error);
    return errorResponse("Unable to retrieve courses", 500);
  }
}