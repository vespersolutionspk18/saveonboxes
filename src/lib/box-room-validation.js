export async function invalidOwnedRoomId(query, ownerId, roomIds) {
  const checked = new Set();
  for (const roomId of roomIds) {
    if (!roomId || checked.has(roomId)) continue;
    checked.add(roomId);
    const result = await query("SELECT 1 FROM boxsave.rooms WHERE id = $1 AND owner_id = $2", [roomId, ownerId]);
    if (!result.rowCount) return roomId;
  }
  return null;
}
