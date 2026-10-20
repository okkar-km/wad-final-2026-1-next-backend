import corsHeaders from "@/lib/cors";
import { getUserProfileResponse } from "@/lib/user-profile";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request, { params }) {
  const { user_id } = await params;

  return getUserProfileResponse(request, user_id);
}
