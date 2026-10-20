//src/app/api/course/[course_id]/route.js

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

export async function GET(request, { params }) {
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

  // Dynamic route parameters must be awaited.
  const { course_id } = await params;

  if (!ObjectId.isValid(course_id)) {
    return errorResponse("Invalid course ID", 400);
  }

  try {
    const client = await getClientPromise();
    const db = client.db("Online-Course-Service");

    const filter = {
      _id: new ObjectId(course_id),
    };

    if (user.role === "Teacher") {
      filter.teacherId = new ObjectId(user.id);
    } else {
      filter.status = { $ne: "Cancel" };
    }

    const course = await db.collection("courses").findOne(filter);

    if (!course) {
      return errorResponse("Course not found", 404);
    }

    // Keep enrollment IDs out of the public course information.
    const { enrolledStudentIds = [], ...courseInformation } = course;

    const enrolledCount = enrolledStudentIds.length;
    const availableSeats = Math.max(
      0,
      course.maxStudents - enrolledCount,
    );

    const details = {
      ...courseInformation,
      enrolledCount,
      availableSeats,
    };

    if (user.role === "Teacher") {
      const students = await db
        .collection("users")
        .find(
          { _id: { $in: enrolledStudentIds } },
          {
            projection: {
              username: 1,
              email: 1,
            },
          },
        )
        .sort({ username: 1 })
        .toArray();

      details.enrolledStudents = students.map((student) => ({
        id: student._id.toString(),
        username: student.username,
        email: student.email,
      }));
    } else {
      const isEnrolled = enrolledStudentIds.some(
        (studentId) => studentId.toString() === user.id,
      );

      details.isEnrolled = isEnrolled;
      details.canEnroll =
        course.status === "Open" &&
        availableSeats > 0 &&
        !isEnrolled;
    }

    const response = successResponse({ course: details }, 200);
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    printExceptionLog("Course details", error);
    return errorResponse("Unable to retrieve course details", 500);
  }
}

export async function PUT(request, { params }) {
  const user = verifyJWT(request);

  if (
    !user ||
    typeof user.id !== "string" ||
    !ObjectId.isValid(user.id)
  ) {
    return errorResponse("Unauthorized", 401);
  }

  if (user.role !== "Teacher") {
    return errorResponse("Only Teachers can update courses", 403);
  }

  const { course_id } = await params;

  if (!ObjectId.isValid(course_id)) {
    return errorResponse("Invalid course ID", 400);
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

  const { durationDays, topics, price, maxStudents, status } = body;

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
    const courses = db.collection("courses");

    const ownerFilter = {
      _id: new ObjectId(course_id),
      teacherId: new ObjectId(user.id),
    };

    const result = await courses.updateOne(
      {
        ...ownerFilter,

        // Check enrollment count as part of the update itself.
        $expr: {
          $lte: [
            { $size: { $ifNull: ["$enrolledStudentIds", []] } },
            maxStudents,
          ],
        },
      },
      {
        // Only these fields may be changed.
        $set: {
          name,
          durationDays,
          topics: topics.map((topic) => topic.trim()),
          price,
          maxStudents,
          status,
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      const ownedCourse = await courses.findOne(ownerFilter, {
        projection: { _id: 1 },
      });

      if (!ownedCourse) {
        return errorResponse("Course not found", 404);
      }

      return errorResponse(
        "Maximum students cannot be lower than current enrollment",
        409,
      );
    }

    return successResponse(
      { message: "Course updated successfully" },
      200,
    );
  } catch (error) {
    printExceptionLog("Update course", error);
    return errorResponse("Unable to update course", 500);
  }
}

export async function DELETE(request, { params }) {
  const user = verifyJWT(request);

  if (
    !user ||
    typeof user.id !== "string" ||
    !ObjectId.isValid(user.id)
  ) {
    return errorResponse("Unauthorized", 401);
  }

  if (user.role !== "Teacher") {
    return errorResponse("Only Teachers can delete courses", 403);
  }

  const { course_id } = await params;

  if (!ObjectId.isValid(course_id)) {
    return errorResponse("Invalid course ID", 400);
  }

  try {
    const client = await getClientPromise();
    const db = client.db("Online-Course-Service");
    const courses = db.collection("courses");

    const ownerFilter = {
      _id: new ObjectId(course_id),
      teacherId: new ObjectId(user.id),
    };

    // Ownership and empty enrollment are checked during deletion.
    const result = await courses.deleteOne({
      ...ownerFilter,
      enrolledStudentIds: { $size: 0 },
    });

    if (result.deletedCount === 0) {
      const ownedCourse = await courses.findOne(ownerFilter, {
        projection: { _id: 1 },
      });

      if (!ownedCourse) {
        return errorResponse("Course not found", 404);
      }

      return errorResponse(
        "Cannot delete a course with enrolled Students",
        409,
      );
    }

    return successResponse(
      { message: "Course deleted successfully" },
      200,
    );
  } catch (error) {
    printExceptionLog("Delete course", error);
    return errorResponse("Unable to delete course", 500);
  }
}