import { randomUUID } from "node:crypto";
import { z } from "zod";
import { requireUser } from "@/lib/auth.js";
import { withTransaction } from "@/lib/db.js";
import { addBoxItem } from "@/lib/item-service.js";
import { checkSameOrigin, errorResponse, fail, json, readJson } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const schema = z.object({
  name: z.string().trim().min(1).max(240),
  quantity: z.number().int().min(1).max(10000).default(1),
  notes: z.string().max(2000).nullable().optional(),
  clientMutationId: z.string().uuid().optional(),
});

export async function POST(request, context) {
  const originFailure = checkSameOrigin(request);
  if (originFailure) return originFailure;
  try {
    const user = await requireUser(request);
    if (user instanceof Response) return user;
    const { id: rawBoxId } = await context.params;
    const parsedBoxId = z.string().uuid().safeParse(rawBoxId);
    if (!parsedBoxId.success) return fail("Box not found", 404, "box_not_found");
    const boxId = parsedBoxId.data.toLowerCase();
    const body = schema.parse(await readJson(request, 8 * 1024));
    const itemId = body.clientMutationId?.toLowerCase() || randomUUID();
    const result = await withTransaction((client) => addBoxItem(client, { ownerId: user.id, boxId, itemId,
      name: body.name, quantity: body.quantity, notes: body.notes?.trim() || null }));
    if (result.missingBox) return fail("Box not found", 404, "box_not_found");
    if (result.conflict) return fail("This add-item request ID is already used by another item", 409, "item_request_conflict");
    return json({ item: result.item, created: result.created }, { status: result.created ? 201 : 200 });
  } catch (error) {
    if (error?.name === "ZodError") return fail("Enter an item name and valid quantity", 400, "invalid_item");
    return errorResponse(error);
  }
}
