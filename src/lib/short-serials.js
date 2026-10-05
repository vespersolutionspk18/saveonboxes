export const SHORT_SERIAL_ALPHABET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
export const SHORT_SERIAL_CAPACITY = 36 ** 4;
const START_OFFSET = 10 * (36 ** 3); // Start at A000 while preserving a bijection over all 36^4 values.
const MAX_BATCH_QUANTITY = 5000;

export function encodeShortSerial(ordinal) {
  if (!Number.isSafeInteger(ordinal) || ordinal < 0 || ordinal >= SHORT_SERIAL_CAPACITY) {
    throw new RangeError("Short serial ordinal is outside the available namespace");
  }
  let value = (ordinal + START_OFFSET) % SHORT_SERIAL_CAPACITY;
  const chars = new Array(4);
  for (let index = 3; index >= 0; index -= 1) {
    chars[index] = SHORT_SERIAL_ALPHABET[value % 36];
    value = Math.floor(value / 36);
  }
  return chars.join("");
}

export async function reserveShortSerialRange(client, quantity) {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_BATCH_QUANTITY) {
    throw new RangeError("Short serial reservation quantity must be between 1 and 5,000");
  }
  const reservation = await client.query(`UPDATE boxsave.label_serial_allocator
    SET next_value = next_value + $1::bigint
    WHERE singleton IS TRUE AND next_value <= $2::bigint - $1::bigint
    RETURNING next_value - $1::bigint AS start_value`, [quantity, SHORT_SERIAL_CAPACITY]);
  if (reservation.rowCount) {
    const start = Number(reservation.rows[0].start_value);
    if (!Number.isSafeInteger(start) || start < 0 || start + quantity > SHORT_SERIAL_CAPACITY) {
      throw new Error("Short serial allocator returned an invalid range");
    }
    return { start, quantity };
  }

  const allocator = await client.query("SELECT 1 FROM boxsave.label_serial_allocator WHERE singleton IS TRUE");
  if (!allocator.rowCount) throw new Error("Short serial allocator is not installed");
  return null;
}
