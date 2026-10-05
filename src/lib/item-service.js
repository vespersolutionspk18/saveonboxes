export async function addBoxItem(client, { ownerId, boxId, itemId, name, quantity, notes }) {
  const box = await client.query("SELECT id FROM boxsave.boxes WHERE id = $1 AND owner_id = $2 AND archived_at IS NULL FOR UPDATE", [boxId, ownerId]);
  if (!box.rowCount) return { missingBox: true };

  const existing = await client.query(`SELECT i.id, i.box_id AS "boxId", i.name, i.quantity, i.notes, i.sort_order AS "sortOrder",
      i.created_at AS "createdAt", i.updated_at AS "updatedAt", (im.item_id IS NOT NULL) AS "hasImage",
      CASE WHEN im.item_id IS NULL THEN NULL ELSE '/api/items/' || i.id::text || '/image' END AS "imageUrl"
    FROM boxsave.box_items i LEFT JOIN boxsave.item_images im ON im.item_id = i.id WHERE i.id = $1 LIMIT 1`, [itemId]);
  if (existing.rowCount) {
    const { boxId: existingBoxId, ...item } = existing.rows[0];
    if (existingBoxId !== boxId) return { conflict: true };
    return { item, created: false };
  }

  const nextOrder = await client.query("SELECT COALESCE(MAX(sort_order), -1) + 1 AS sort_order FROM boxsave.box_items WHERE box_id = $1", [boxId]);
  const inserted = await client.query(`INSERT INTO boxsave.box_items(id, box_id, name, quantity, notes, sort_order)
    VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING
    RETURNING id, name, quantity, notes, sort_order AS "sortOrder", created_at AS "createdAt", updated_at AS "updatedAt"`,
  [itemId, boxId, name, quantity, notes, nextOrder.rows[0].sort_order]);
  if (!inserted.rowCount) return { conflict: true };
  await client.query("UPDATE boxsave.boxes SET updated_at = now() WHERE id = $1", [boxId]);
  return { item: { ...inserted.rows[0], hasImage: false, imageUrl: null }, created: true };
}
