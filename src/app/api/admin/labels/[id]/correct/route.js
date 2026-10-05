import { randomUUID } from "node:crypto";
import { z } from "zod";
import { allocateBoxNumber, createBox } from "@/lib/auth.js";
import { requireAdmin, writeAdminAudit } from "@/lib/admin-helpers.js";
import { query, withTransaction } from "@/lib/db.js";
import { checkSameOrigin, errorResponse, fail, json, readJson } from "@/lib/http.js";

export const runtime = "nodejs";
const schema = z.object({
  action: z.enum(["assign", "disable", "enable"]),
  userId: z.string().uuid().optional(),
  reason: z.string().trim().min(10).max(1000),
}).superRefine((value, ctx) => {
  if (value.action === "assign" && !value.userId) ctx.addIssue({ code: "custom", path: ["userId"], message: "Choose a customer" });
});

export async function POST(request, context) {
  const originFailure = checkSameOrigin(request);
  if (originFailure) return originFailure;
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  try {
    const params = await context.params;
    const labelId = params.id;
    const body = schema.parse(await readJson(request, 8 * 1024));
    const result = await withTransaction(async (client) => {
      const labelResult = await client.query("SELECT l.id, l.serial, l.batch_id, l.disabled_at, " +
        "b.id AS box_id, b.owner_id AS owner_id, b.box_number AS box_number, b.room_id AS room_id, " +
        "b.origin_room_id AS origin_room_id, b.name AS box_name, r.name AS room_name, r.color AS room_color, " +
        "ro.name AS origin_room_name, ro.color AS origin_room_color, " +
        "(SELECT count(*)::int FROM boxsave.box_items i WHERE i.box_id = b.id) AS item_count, u.email AS owner_email " +
        "FROM boxsave.labels l LEFT JOIN boxsave.boxes b ON b.label_id = l.id " +
        "LEFT JOIN boxsave.rooms r ON r.id = b.room_id LEFT JOIN boxsave.rooms ro ON ro.id = b.origin_room_id " +
        "LEFT JOIN boxsave.users u ON u.id = b.owner_id " +
        "WHERE l.id = $1 FOR UPDATE OF l", [labelId]);
      const label = labelResult.rows[0];
      if (!label) return { missingLabel: true };
      const before = { serial: label.serial, disabled: Boolean(label.disabled_at), ownerId: label.owner_id,
        ownerEmail: label.owner_email, boxId: label.box_id, boxNumber: label.box_number,
        roomId: label.room_id, roomName: label.room_name, originRoomId: label.origin_room_id,
        originRoomName: label.origin_room_name, itemCount: label.item_count };
      let boxId = label.box_id;
      let ownerId = label.owner_id;
      let boxNumber = label.box_number;
      let roomId = label.room_id;
      let originRoomId = label.origin_room_id;
      let disabledAt = label.disabled_at;
      let operation;

      if (body.action === "assign") {
        const targetResult = await client.query("SELECT id, email, role, disabled_at FROM boxsave.users WHERE id = $1 FOR UPDATE", [body.userId]);
        const target = targetResult.rows[0];
        if (!target || target.disabled_at || target.role !== "customer") return { invalidCustomer: true };
        if (!boxId) {
          const box = await createBox(client, { ownerId: target.id, labelId: label.id });
          boxId = box.id;
          ownerId = target.id;
          boxNumber = box.box_number;
          roomId = null;
          operation = "label_assigned";
        } else if (ownerId !== target.id) {
          const nextNumber = await allocateBoxNumber(client, target.id);
          const mapRoom = async (roomName, roomColor) => {
            if (!roomName) return null;
            const existingRoom = await client.query("SELECT id FROM boxsave.rooms WHERE owner_id = $1 AND lower(name) = lower($2) LIMIT 1", [target.id, roomName]);
            if (existingRoom.rowCount) return existingRoom.rows[0].id;
            const room = await client.query("INSERT INTO boxsave.rooms(id, owner_id, name, color) VALUES ($1, $2, $3, $4) RETURNING id",
              [randomUUID(), target.id, roomName, roomColor]);
            return room.rows[0].id;
          };
          const newRoomId = await mapRoom(label.room_name, label.room_color);
          const newOriginRoomId = await mapRoom(label.origin_room_name, label.origin_room_color);
          const displayName = label.box_name === `Box ${label.box_number}` ? `Box ${nextNumber}` : label.box_name;
          await client.query("UPDATE boxsave.boxes SET owner_id = $2, box_number = $3, name = $4, room_id = $5, origin_room_id = $6, updated_at = now() WHERE id = $1",
            [boxId, target.id, nextNumber, displayName, newRoomId, newOriginRoomId]);
          ownerId = target.id;
          boxNumber = nextNumber;
          roomId = newRoomId;
          originRoomId = newOriginRoomId;
          operation = "label_owner_corrected";
        } else {
          operation = "label_assignment_confirmed";
        }
      } else {
        const shouldDisable = body.action === "disable";
        const currentDisabled = Boolean(label.disabled_at);
        if (currentDisabled !== shouldDisable) {
          const updated = await client.query("UPDATE boxsave.labels SET disabled_at = $2 WHERE id = $1 RETURNING disabled_at",
            [label.id, shouldDisable ? new Date() : null]);
          disabledAt = updated.rows[0].disabled_at;
        }
        operation = "label_" + body.action + "d";
      }
      const after = { serial: label.serial, disabled: Boolean(disabledAt), ownerId, boxId, boxNumber, roomId, originRoomId,
        itemCount: label.item_count || 0 };
      await writeAdminAudit(client, { actorId: admin.id, action: operation, targetType: "label",
        targetId: label.id, reason: body.reason, before, after });
      const audit = await client.query("SELECT id FROM boxsave.admin_audit_events WHERE target_type = 'label' AND target_id = $1 " +
        "ORDER BY created_at DESC LIMIT 1", [label.id]);
      return { auditEventId: audit.rows[0]?.id, labelId: label.id, boxId, ownerId };
    });
    if (result.missingLabel) return fail("Label not found", 404, "label_not_found");
    if (result.invalidCustomer) return fail("Choose an active customer account", 400, "invalid_customer");
    const label = await query("SELECT l.id, l.serial, l.batch_id AS \"batchId\", l.disabled_at AS \"disabledAt\", " +
      "b.id AS \"boxId\", b.owner_id AS \"ownerId\", b.box_number AS \"boxNumber\", " +
      "b.room_id AS \"roomId\", r.name AS \"roomName\", b.origin_room_id AS \"originRoomId\", ro.name AS \"originRoomName\" " +
      "FROM boxsave.labels l LEFT JOIN boxsave.boxes b ON b.label_id = l.id " +
      "LEFT JOIN boxsave.rooms r ON r.id = b.room_id LEFT JOIN boxsave.rooms ro ON ro.id = b.origin_room_id WHERE l.id = $1", [result.labelId]);
    return json({ label: label.rows[0], boxId: result.boxId, ownerId: result.ownerId, auditEventId: result.auditEventId });
  } catch (error) {
    if (error?.name === "ZodError") return fail("Choose an action, provide a support reason, and select a customer when assigning", 400, "invalid_correction");
    return errorResponse(error);
  }
}
