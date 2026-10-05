import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  encodeShortSerial,
  reserveShortSerialRange,
  SHORT_SERIAL_CAPACITY,
} from "../src/lib/short-serials.js";

test("four-character serial encoding starts at A000 and wraps across the full namespace", () => {
  assert.equal(encodeShortSerial(0), "A000");
  assert.equal(encodeShortSerial(1), "A001");
  assert.equal(encodeShortSerial(35), "A00Z");
  assert.equal(encodeShortSerial(36), "A010");
  assert.equal(encodeShortSerial(SHORT_SERIAL_CAPACITY - 1), "9ZZZ");
  assert.equal(encodeShortSerial(SHORT_SERIAL_CAPACITY - 466560), "0000");
  for (const ordinal of [-1, SHORT_SERIAL_CAPACITY, 1.25, Number.MAX_SAFE_INTEGER]) {
    assert.throws(() => encodeShortSerial(ordinal), RangeError);
  }
});

function fakeAllocator(initialValue = 0, exists = true) {
  let nextValue = initialValue;
  return {
    get nextValue() { return nextValue; },
    async query(sql, values) {
      if (sql.startsWith("UPDATE boxsave.label_serial_allocator")) {
        const [quantity, capacity] = values;
        if (exists && nextValue <= capacity - quantity) {
          const start = nextValue;
          nextValue += quantity;
          return { rowCount: 1, rows: [{ start_value: String(start) }] };
        }
        return { rowCount: 0, rows: [] };
      }
      if (sql.startsWith("SELECT 1 FROM boxsave.label_serial_allocator")) {
        return { rowCount: exists ? 1 : 0, rows: exists ? [{ "?column?": 1 }] : [] };
      }
      throw new Error("Unexpected allocator SQL");
    },
  };
}

test("concurrent reservations are disjoint and contiguous", async () => {
  const client = fakeAllocator();
  const reservations = await Promise.all(Array.from({ length: 40 }, () => reserveShortSerialRange(client, 37)));
  const sorted = reservations.sort((a, b) => a.start - b.start);
  assert.deepEqual(sorted.map((range) => range.start), Array.from({ length: 40 }, (_, index) => index * 37));
  assert.ok(sorted.every((range) => range.quantity === 37));
  assert.equal(client.nextValue, 40 * 37);
});

test("exhaustion reserves no partial range and missing migration is distinguishable", async () => {
  const almostFull = fakeAllocator(SHORT_SERIAL_CAPACITY - 1);
  assert.equal(await reserveShortSerialRange(almostFull, 2), null);
  assert.equal(almostFull.nextValue, SHORT_SERIAL_CAPACITY - 1);
  const final = await reserveShortSerialRange(almostFull, 1);
  assert.deepEqual(final, { start: SHORT_SERIAL_CAPACITY - 1, quantity: 1 });
  assert.equal(await reserveShortSerialRange(almostFull, 1), null);
  assert.equal(almostFull.nextValue, SHORT_SERIAL_CAPACITY);
  await assert.rejects(reserveShortSerialRange(fakeAllocator(0, false), 1), /allocator is not installed/);
  await assert.rejects(reserveShortSerialRange(fakeAllocator(), 0), /between 1 and 5,000/);
});

test("migration backfills in stable order and only renames default box names", async () => {
  const sql = await readFile(new URL("../migrations/0004_short_label_serials.sql", import.meta.url), "utf8");
  assert.match(sql, /short_serial text/);
  assert.match(sql, /UNIQUE \(short_serial\)/);
  assert.match(sql, /CHECK \(short_serial ~ '\^\[0-9A-Z\]\{4\}\$'\)/);
  assert.match(sql, /row_number\(\) OVER \(ORDER BY created_at, id\)/);
  assert.match(sql, /b\.name IS NULL OR btrim\(b\.name\) = '' OR b\.name = 'Box ' \|\| b\.box_number::text/);
  assert.doesNotMatch(sql, /UPDATE boxsave\.labels[\s\S]{0,100}SET serial\s*=/i);
});

test("serial-name repair only replaces saved Box N defaults, preserving custom names", async () => {
  const sql = await readFile(new URL("../migrations/0005_restore_short_serial_box_names.sql", import.meta.url), "utf8");
  assert.match(sql, /SET name = l\.short_serial/);
  assert.match(sql, /b\.name IS NULL OR btrim\(b\.name\) = '' OR b\.name = 'Box ' \|\| b\.box_number::text/);
  assert.match(sql, /l\.short_serial IS NOT NULL/);
});
