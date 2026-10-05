export async function getBoxDetail(client, ownerId, boxId, includeArchived = false) {
  const { rows } = await client.query(`
    SELECT b.id, b.box_number AS "boxNumber", CASE WHEN NULLIF(btrim(b.name), '') IS NULL OR b.name = 'Box ' || b.box_number::text
        THEN COALESCE(l.short_serial, 'Box ' || b.box_number::text) ELSE b.name END AS name,
      COALESCE(l.short_serial, 'Box ' || b.box_number::text) AS "defaultName", l.short_serial AS "labelSerial",
      b.room_id AS "roomId", b.origin_room_id AS "originRoomId",
      CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('id', r.id, 'name', r.name, 'color', r.color) END AS room,
      CASE WHEN ro.id IS NULL THEN NULL ELSE jsonb_build_object('id', ro.id, 'name', ro.name, 'color', ro.color) END AS "originRoom",
      b.status, b.notes, b.fragile, b.open_early AS "openEarly", b.archived_at AS "archivedAt",
      b.created_at AS "createdAt", b.updated_at AS "updatedAt"
    FROM boxsave.boxes b LEFT JOIN boxsave.labels l ON l.id = b.label_id LEFT JOIN boxsave.rooms r ON r.id = b.room_id
    LEFT JOIN boxsave.rooms ro ON ro.id = b.origin_room_id
    WHERE b.owner_id = $1 AND b.id = $2 ${includeArchived ? "" : "AND b.archived_at IS NULL"} LIMIT 1`, [ownerId, boxId]);
  if (!rows[0]) return null;
  const itemResult = await client.query(`SELECT i.id, i.name, i.quantity, i.notes, i.sort_order AS "sortOrder",
      i.created_at AS "createdAt", i.updated_at AS "updatedAt", (im.item_id IS NOT NULL) AS "hasImage",
      CASE WHEN im.item_id IS NULL THEN NULL ELSE '/api/items/' || i.id::text || '/image' END AS "imageUrl"
    FROM boxsave.box_items i LEFT JOIN boxsave.item_images im ON im.item_id = i.id
    WHERE i.box_id = $1 ORDER BY i.sort_order, i.created_at, i.id`, [boxId]);
  return { ...rows[0], items: itemResult.rows };
}

export const boxSummarySelect = `
  SELECT b.id, b.box_number AS "boxNumber", CASE WHEN NULLIF(btrim(b.name), '') IS NULL OR b.name = 'Box ' || b.box_number::text
      THEN COALESCE(l.short_serial, 'Box ' || b.box_number::text) ELSE b.name END AS name,
    COALESCE(l.short_serial, 'Box ' || b.box_number::text) AS "defaultName", l.short_serial AS "labelSerial",
    b.room_id AS "roomId", b.origin_room_id AS "originRoomId",
    CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('id', r.id, 'name', r.name, 'color', r.color) END AS room,
    CASE WHEN ro.id IS NULL THEN NULL ELSE jsonb_build_object('id', ro.id, 'name', ro.name, 'color', ro.color) END AS "originRoom",
    b.status, b.notes, b.fragile, b.open_early AS "openEarly", b.archived_at AS "archivedAt",
    b.created_at AS "createdAt", b.updated_at AS "updatedAt",
    item_count.count AS "itemCount"
  FROM boxsave.boxes b LEFT JOIN boxsave.labels l ON l.id = b.label_id LEFT JOIN boxsave.rooms r ON r.id = b.room_id
  LEFT JOIN boxsave.rooms ro ON ro.id = b.origin_room_id
  LEFT JOIN LATERAL (SELECT count(*)::int AS count FROM boxsave.box_items i WHERE i.box_id = b.id) item_count ON true`;
