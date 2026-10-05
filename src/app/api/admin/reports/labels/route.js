import { requireAdmin, labelStatusSql } from "@/lib/admin-helpers.js";
import { query } from "@/lib/db.js";
import { errorResponse, fail, json } from "@/lib/http.js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function csvCell(value) {
  return '"' + String(value ?? "").replaceAll('"', '""') + '"';
}

function baseSql(scanDateSql = "") {
  return " FROM boxsave.labels l JOIN boxsave.label_batches lb ON lb.id = l.batch_id " +
    "LEFT JOIN boxsave.boxes b ON b.label_id = l.id LEFT JOIN boxsave.users u ON u.id = b.owner_id " +
    "LEFT JOIN LATERAL (SELECT count(*) FILTER (WHERE event_kind IN ('url_open','camera_scan'))::int AS scans, " +
    "min(created_at) FILTER (WHERE event_kind IN ('url_open','camera_scan')) AS first_scanned_at, " +
    "max(created_at) FILTER (WHERE event_kind IN ('url_open','camera_scan')) AS last_scanned_at " +
    "FROM boxsave.scan_events WHERE label_id = l.id AND event_kind IN ('url_open','camera_scan') " + scanDateSql + ") ev ON true ";
}

function parseFilters(params) {
  const clauses = [];
  const scanDateClauses = [];
  const values = [];
  const add = (value) => { values.push(value); return "$" + values.length; };
  const status = params.get("status");
  if (status && !["available", "claimed", "disabled"].includes(status)) throw Object.assign(new Error("Invalid label status"), { status: 400 });
  if (status) clauses.push(labelStatusSql + " = " + add(status));
  const batchId = params.get("batchId");
  if (batchId) {
    if (!/^[0-9a-f-]{36}$/i.test(batchId)) throw Object.assign(new Error("Invalid batch id"), { status: 400 });
    clauses.push("l.batch_id = " + add(batchId));
  }
  const from = params.get("from");
  if (from) {
    const date = new Date(from);
    if (Number.isNaN(date.valueOf())) throw Object.assign(new Error("Invalid start date"), { status: 400 });
    scanDateClauses.push("created_at >= " + add(date.toISOString()));
  }
  const to = params.get("to");
  if (to) {
    const date = new Date(to);
    if (Number.isNaN(date.valueOf())) throw Object.assign(new Error("Invalid end date"), { status: 400 });
    date.setUTCDate(date.getUTCDate() + 1);
    scanDateClauses.push("created_at < " + add(date.toISOString()));
  }
  const scanDateSql = scanDateClauses.length ? " AND " + scanDateClauses.join(" AND ") : "";
  if (scanDateClauses.length) {
    const correlatedDateSql = scanDateSql.replaceAll("created_at", "filter_ev.created_at");
    clauses.push("EXISTS (SELECT 1 FROM boxsave.scan_events filter_ev WHERE filter_ev.label_id = l.id " +
      "AND filter_ev.event_kind IN ('url_open','camera_scan')" + correlatedDateSql + ")");
  }
  const search = (params.get("query") || "").trim().slice(0, 120);
  if (search) {
    const pattern = add("%" + search.replace(/[\\%_]/g, "\\$&") + "%");
    clauses.push("(l.short_serial ILIKE " + pattern + " ESCAPE E'\\\\' OR l.serial ILIKE " + pattern + " ESCAPE E'\\\\' OR lb.name ILIKE " + pattern +
      " ESCAPE E'\\\\' OR u.email ILIKE " + pattern + " ESCAPE E'\\\\' OR b.box_number::text = " + add(search) + ")");
  }
  return { where: clauses.length ? "WHERE " + clauses.join(" AND ") : "", values, scanDateSql };
}

function selectedSql(scanDateSql) {
  return "SELECT l.id, l.short_serial AS serial, l.serial AS \"legacySerial\", l.batch_id AS \"batchId\", lb.name AS \"batchName\", " +
  labelStatusSql + " AS status, l.created_at AS \"createdAt\", l.disabled_at AS \"disabledAt\", " +
  "b.created_at AS \"claimedAt\", " +
  "CASE WHEN u.id IS NULL THEN NULL ELSE jsonb_build_object('id',u.id,'email',u.email) END AS owner, " +
  "CASE WHEN b.id IS NULL THEN NULL ELSE jsonb_build_object('id',b.id,'boxNumber',b.box_number,'name',COALESCE(NULLIF(btrim(b.name),''),l.short_serial,'Box '||b.box_number::text),'defaultName',COALESCE(l.short_serial,'Box '||b.box_number::text),'labelSerial',l.short_serial) END AS box, " +
  "coalesce(ev.scans,0)::int AS scans, ev.first_scanned_at AS \"firstScannedAt\", ev.last_scanned_at AS \"lastScannedAt\" " +
  baseSql(scanDateSql);
}

export async function GET(request) {
  const admin = await requireAdmin(request);
  if (admin instanceof Response) return admin;
  try {
    const params = new URL(request.url).searchParams;
    const filters = parseFilters(params);
    const stats = await query("SELECT count(*)::int AS total, count(*) FILTER (WHERE " + labelStatusSql + " = 'available')::int AS available, " +
      "count(*) FILTER (WHERE " + labelStatusSql + " = 'claimed')::int AS claimed, " +
      "count(*) FILTER (WHERE " + labelStatusSql + " = 'disabled')::int AS disabled, " +
      "count(*) FILTER (WHERE coalesce(ev.scans,0) > 0)::int AS scanned " + baseSql(filters.scanDateSql) + filters.where, filters.values);
    const total = stats.rows[0].total;
    const format = params.get("format");
    if (format === "csv") {
      if (total > 50000) return fail("Narrow the filters to export at most 50,000 labels at a time", 413, "report_too_large");
      const rows = await query(selectedSql(filters.scanDateSql) + filters.where + " ORDER BY l.created_at DESC, l.serial LIMIT 50000", filters.values);
      const headers = ["serial", "legacySerial", "status", "batchId", "batchName", "ownerEmail", "boxNumber", "scans", "firstScannedAt", "lastScannedAt", "claimedAt", "createdAt"];
      const lines = [headers.join(",")];
      for (const row of rows.rows) lines.push([
        row.serial, row.legacySerial, row.status, row.batchId, row.batchName, row.owner?.email, row.box?.boxNumber,
        row.scans, row.firstScannedAt, row.lastScannedAt, row.claimedAt, row.createdAt,
      ].map(csvCell).join(","));
      return new Response(lines.join("\r\n") + "\r\n", { status: 200, headers: {
        "content-type": "text/csv; charset=utf-8", "content-disposition": 'attachment; filename="boxsave-label-report.csv"',
        "cache-control": "no-store", "x-content-type-options": "nosniff",
      } });
    }
    const page = Math.max(1, Number.parseInt(params.get("page") || "1", 10) || 1);
    const pageSize = Math.max(1, Math.min(250, Number.parseInt(params.get("pageSize") || "50", 10) || 50));
    const result = await query(selectedSql(filters.scanDateSql) + filters.where + " ORDER BY l.created_at DESC, l.serial LIMIT $" +
      (filters.values.length + 1) + " OFFSET $" + (filters.values.length + 2),
    [...filters.values, pageSize, (page - 1) * pageSize]);
    return json({ labels: result.rows, page, pageSize, total,
      summary: { total, available: stats.rows[0].available, claimed: stats.rows[0].claimed,
        disabled: stats.rows[0].disabled, scanned: stats.rows[0].scanned } });
  } catch (error) {
    if (error?.status === 400) return fail(error.message, 400, "invalid_filter");
    return errorResponse(error);
  }
}
