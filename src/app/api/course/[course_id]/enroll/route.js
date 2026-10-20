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

export async function POST(request, { params }) {
  const user = verifyJWT(request);

  if (
    !user ||
    typeof user.id !== "string" ||
    !ObjectId.isValid(user.id)
  ) {
    return errorResponse("Unauthorized", 401);
  }

  if (user.role !== "Student") {
    return errorResponse("Only Students can enroll", 403);
  }

  const { course_id } = await params;

  if (!ObjectId.isValid(course_id)) {
    return errorResponse("Invalid course ID", 400);
  }

  try {
    const client = await getClientPromise();
    const db = client.db("Online-Course-Service");
    const courses = db.collection("courses");

    const courseId = new ObjectId(course_id);
    const studentId = new ObjectId(user.id);

    // Check every enrollment rule in the same database update.
    const result = await courses.updateOne(
      {
        _id: courseId,
        status: "Open",
        enrolledStudentIds: { $ne: studentId },
        $expr: {
          $lt: [
            { $size: { $ifNull: ["$enrolledStudentIds", []] } },
            "$maxStudents",
          ],
        },
      },
      {
        $addToSet: { enrolledStudentIds: studentId },
        $set: { updatedAt: new Date() },
      },
    );

    if (result.modifiedCount === 1) {
      return successResponse(
        { message: "Enrolled successfully" },
        201,
      );
    }

    // The update failed. Read current state to explain why.
    const course = await courses.findOne({ _id: courseId });

    if (!course) {
      return errorResponse("Course not found", 404);
    }

    const enrolledIds = course.enrolledStudentIds ?? [];

    const alreadyEnrolled = enrolledIds.some(
      (id) => id.toString() === user.id,
    );

    if (alreadyEnrolled) {
      return errorResponse("You are already enrolled", 409);
    }

    if (course.status !== "Open") {
      return errorResponse("Course is not open for enrollment", 409);
    }

    if (enrolledIds.length >= course.maxStudents) {
      return errorResponse("Course is full", 409);
    }

    return errorResponse(
      "Course availability changed. Please try again.",
      409,
    );
  } catch (error) {
    printExceptionLog("Enroll in course", error);
    return errorResponse("Unable to enroll in course", 500);
  }
}