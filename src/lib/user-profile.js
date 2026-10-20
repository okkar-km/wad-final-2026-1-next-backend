import { ObjectId } from "mongodb";
import { verifyJWT } from "@/lib/auth";
import { getClientPromise } from "@/lib/mongodb";
import {
  errorResponse,
  successResponse,
  printExceptionLog,
} from "@/lib/utils";

export async function getUserProfileResponse(request, requestedUserId) {
  const session = verifyJWT(request);

  if (
    !session ||
    typeof session.id !== "string" ||
    !ObjectId.isValid(session.id)
  ) {
    return errorResponse("Unauthorized", 401);
  }

  if (requestedUserId !== undefined) {
    if (
      typeof requestedUserId !== "string" ||
      !ObjectId.isValid(requestedUserId)
    ) {
      return errorResponse("Invalid user ID", 400);
    }

    const requestedId = new ObjectId(requestedUserId);

    if (!requestedId.equals(session.id)) {
      return errorResponse("You can only view your own profile", 403);
    }
  }

  try {
    const client = await getClientPromise();
    const db = client.db("Online-Course-Service");

    const user = await db.collection("users").findOne(
      { _id: new ObjectId(session.id) },
      {
        projection: {
          username: 1,
          email: 1,
          role: 1,
        },
      },
    );

    if (!user) {
      return errorResponse("Unauthorized", 401);
    }

    const response = successResponse(
      {
        user: {
          id: user._id.toString(),
          username: user.username,
          email: user.email,
          role: user.role,
        },
      },
      200,
    );

    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch (error) {
    printExceptionLog("User profile", error);
    return errorResponse("Unable to retrieve user profile", 500);
  }
}
