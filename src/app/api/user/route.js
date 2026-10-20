import corsHeaders from "@/lib/cors";
import { getUserProfileResponse } from "@/lib/user-profile";

export const runtime = "nodejs";

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: corsHeaders,
  });
}

export async function GET(request) {
  return getUserProfileResponse(request);
}
