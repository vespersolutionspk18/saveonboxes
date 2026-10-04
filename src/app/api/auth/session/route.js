import { getCurrentUser } from "@/lib/auth.js";
import { errorResponse, json } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    return json({ user: await getCurrentUser(request) });
  } catch (error) {
    return errorResponse(error);
  }
}
