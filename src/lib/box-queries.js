export async function getBoxDetail(client, ownerId, boxId, includeArchived = false) {
  const { rows } = await client.query(`
    SELECT b.id, b.box_number AS "boxNumber", b.name, b.room_id AS "roomId",
      CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('id', r.id, 'name', r.name, 'color', r.color) END AS room,
      b.status, b.notes, b.fragile, b.open_early AS "openEarly", b.archived_at AS "archivedAt",
      b.created_at AS "createdAt", b.updated_at AS "updatedAt"
    FROM boxsave.boxes b LEFT JOIN boxsave.rooms r ON r.id = b.room_id
    WHERE b.owner_id = $1 AND b.id = $2 ${includeArchived ? "" : "AND b.archived_at IS NULL"} LIMIT 1`, [ownerId, boxId]);
  if (!rows[0]) return null;
  const itemResult = await client.query(`SELECT id, name, quantity, notes, sort_order AS "sortOrder",
      created_at AS "createdAt", updated_at AS "updatedAt"
    FROM boxsave.box_items WHERE box_id = $1 ORDER BY sort_order, created_at, id`, [boxId]);
  return { ...rows[0], items: itemResult.rows };
}

export const boxSummarySelect = `
  SELECT b.id, b.box_number AS "boxNumber", b.name, b.room_id AS "roomId",
    CASE WHEN r.id IS NULL THEN NULL ELSE jsonb_build_object('id', r.id, 'name', r.name, 'color', r.color) END AS room,
    b.status, b.notes, b.fragile, b.open_early AS "openEarly", b.archived_at AS "archivedAt",
    b.created_at AS "createdAt", b.updated_at AS "updatedAt",
    item_count.count AS "itemCount"
  FROM boxsave.boxes b LEFT JOIN boxsave.rooms r ON r.id = b.room_id
  LEFT JOIN LATERAL (SELECT count(*)::int AS count FROM boxsave.box_items i WHERE i.box_id = b.id) item_count ON true`;
