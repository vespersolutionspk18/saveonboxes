import { z } from "zod";
import { requireAdmin, writeAdminAudit } from "@/lib/admin-helpers.js";
import { query, withTransaction } from "@/lib/db.js";
import { checkSameOrigin, errorResponse, fail, json, readJson } from "@/lib/http.js";

export const runtime = "nodejs";
const schema = z.object({ action: z.enum(["disable", "enable"]), reason: z.string().trim().min(10).max(1000) });

export async function PATCH(request, context) {
  const originFailure = checkSameOrigin(request);
  if (originFailure) return originFailure;
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  try {
    const { id } = await context.params;
    const body = schema.parse(await readJson(request, 8 * 1024));
    if (id === admin.id) return fail("You cannot disable your own super-admin account", 403, "self_disable_denied");
    const result = await withTransaction(async (client) => {
      const currentResult = await client.query("SELECT id, email, role, disabled_at FROM boxsave.users WHERE id = $1 FOR UPDATE", [id]);
      const current = currentResult.rows[0];
      if (!current) return { missing: true };
      if (current.role === "super_admin") return { forbidden: true };
      const before = { id: current.id, email: current.email, status: current.disabled_at ? "disabled" : "active" };
      const disabled = body.action === "disable";
      const updated = await client.query("UPDATE boxsave.users SET disabled_at = $2, updated_at = now() WHERE id = $1 " +
        "RETURNING id, disabled_at AS \"disabledAt\"", [id, disabled ? new Date() : null]);
      if (disabled) await client.query("UPDATE boxsave.sessions SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL", [id]);
      const after = { id, email: current.email, status: disabled ? "disabled" : "active", disabledAt: updated.rows[0].disabledAt };
      await writeAdminAudit(client, { actorId: admin.id, action: "customer_" + body.action, targetType: "customer",
        targetId: id, reason: body.reason, before, after });
      const audit = await client.query("SELECT id FROM boxsave.admin_audit_events WHERE target_type = 'customer' AND target_id = $1 " +
        "ORDER BY created_at DESC LIMIT 1", [id]);
      return { customer: after, auditEventId: audit.rows[0]?.id };
    });
    if (result.missing) return fail("Customer not found", 404, "customer_not_found");
    if (result.forbidden) return fail("Super-admin accounts are managed outside customer controls", 403, "role_change_denied");
    return json(result);
  } catch (error) {
    if (error?.name === "ZodError") return fail("Choose enable or disable and enter a support reason", 400, "invalid_status_action");
    return errorResponse(error);
  }
}
