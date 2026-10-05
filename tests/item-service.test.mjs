import assert from "node:assert/strict";
import test from "node:test";
import { addBoxItem } from "../src/lib/item-service.js";

function fakeClient() {
  const boxes = new Map([
    ["box-a", { ownerId: "user-a", archived: false }],
    ["box-b", { ownerId: "user-a", archived: false }],
  ]);
  const items = new Map();
  let boxUpdates = 0;
  const client = {
    items,
    get boxUpdates() { return boxUpdates; },
    async query(sql, values) {
      if (sql.includes("FROM boxsave.boxes WHERE id = $1 AND owner_id = $2") && sql.includes("FOR UPDATE")) {
        const box = boxes.get(values[0]);
        return { rowCount: box?.ownerId === values[1] && !box.archived ? 1 : 0, rows: box ? [{ id: values[0] }] : [] };
      }
      if (sql.includes("FROM boxsave.box_items i LEFT JOIN boxsave.item_images") && sql.includes("WHERE i.id = $1")) {
        const item = items.get(values[0]);
        return { rowCount: item ? 1 : 0, rows: item ? [{ ...item, hasImage: false, imageUrl: null }] : [] };
      }
      if (sql.startsWith("SELECT COALESCE(MAX(sort_order)")) {
        const orders = [...items.values()].filter((item) => item.boxId === values[0]).map((item) => item.sortOrder);
        return { rowCount: 1, rows: [{ sort_order: orders.length ? Math.max(...orders) + 1 : 0 }] };
      }
      if (sql.includes("INSERT INTO boxsave.box_items")) {
        const [id, boxId, name, quantity, notes, sortOrder] = values;
        if (items.has(id)) return { rowCount: 0, rows: [] };
        const item = { id, boxId, name, quantity, notes, sortOrder, createdAt: "created", updatedAt: "updated" };
        items.set(id, item);
        const { boxId: ignored, ...row } = item;
        return { rowCount: 1, rows: [row] };
      }
      if (sql.startsWith("UPDATE boxsave.boxes SET updated_at")) {
        boxUpdates += 1;
        return { rowCount: 1, rows: [] };
      }
      throw new Error("Unexpected item service SQL");
    },
  };
  return client;
}

test("an add-item retry with the same client mutation ID returns the existing row once", async () => {
  const client = fakeClient();
  const request = { ownerId: "user-a", boxId: "box-a", itemId: "item-key", name: "Kettle", quantity: 1, notes: null };
  const first = await addBoxItem(client, request);
  const retry = await addBoxItem(client, { ...request, name: "A changed retry body" });
  assert.equal(first.created, true);
  assert.equal(first.item.sortOrder, 0);
  assert.equal(retry.created, false);
  assert.equal(retry.item.id, first.item.id);
  assert.equal(retry.item.name, "Kettle");
  assert.equal(client.items.size, 1);
  assert.equal(client.boxUpdates, 1);
});

test("an idempotency key cannot attach one item to a different box", async () => {
  const client = fakeClient();
  const first = await addBoxItem(client, { ownerId: "user-a", boxId: "box-a", itemId: "shared-key", name: "Lamp", quantity: 1, notes: null });
  const conflict = await addBoxItem(client, { ownerId: "user-a", boxId: "box-b", itemId: "shared-key", name: "Lamp", quantity: 1, notes: null });
  assert.equal(first.created, true);
  assert.deepEqual(conflict, { conflict: true });
  assert.equal(client.items.size, 1);
});

test("item creation locks and verifies the owner box before touching its contents", async () => {
  const client = fakeClient();
  const result = await addBoxItem(client, { ownerId: "someone-else", boxId: "box-a", itemId: "x", name: "Box contents", quantity: 1, notes: null });
  assert.deepEqual(result, { missingBox: true });
  assert.equal(client.items.size, 0);
  assert.equal(client.boxUpdates, 0);
});
