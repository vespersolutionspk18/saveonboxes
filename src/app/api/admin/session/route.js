import { requireAdmin } from "@/lib/admin-helpers.js";
import { json } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  return json({ admin });
}
