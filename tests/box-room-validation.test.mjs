import assert from "node:assert/strict";
import test from "node:test";
import { invalidOwnedRoomId } from "../src/lib/box-room-validation.js";

const ownerId = "owner-1";
const destinationId = "room-destination";
const originId = "room-origin";

test("destination and origin rooms may both be cleared or owned by the box owner", async () => {
  const query = async (_sql, [roomId, owner]) => ({ rowCount: owner === ownerId && [destinationId, originId].includes(roomId) ? 1 : 0 });
  assert.equal(await invalidOwnedRoomId(query, ownerId, [destinationId, originId]), null);
  assert.equal(await invalidOwnedRoomId(query, ownerId, [null, null]), null);
});

test("a foreign destination or origin room is rejected", async () => {
  const query = async (_sql, [roomId, owner]) => ({ rowCount: owner === ownerId && roomId === destinationId ? 1 : 0 });
  assert.equal(await invalidOwnedRoomId(query, ownerId, [destinationId, "foreign-room"]), "foreign-room");
  assert.equal(await invalidOwnedRoomId(query, ownerId, ["foreign-room", destinationId]), "foreign-room");
});

test("duplicate room IDs are validated once", async () => {
  let count = 0;
  const query = async () => { count += 1; return { rowCount: 1 }; };
  assert.equal(await invalidOwnedRoomId(query, ownerId, [destinationId, destinationId]), null);
  assert.equal(count, 1);
});
