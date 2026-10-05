import { requireUser } from "@/lib/auth.js";
import { query } from "@/lib/db.js";
import { checkSameOrigin, errorResponse, fail, json } from "@/lib/http.js";
import { createItemImageHandlers } from "@/lib/item-image-service.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const handlers = createItemImageHandlers({ requireUser, query, checkSameOrigin, errorResponse, fail, json });

export const GET = handlers.GET;
export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
