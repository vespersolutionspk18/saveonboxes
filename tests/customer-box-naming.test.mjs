import assert from "node:assert/strict";
import test from "node:test";
import { boxDisplayName, boxNumber, boxStickerSerial, defaultBoxName } from "../src/app/components/customer/api.js";

test("a new label uses its short serial as its primary default name", () => {
  const box = { boxNumber: 8, labelSerial: "A4K9", defaultName: "A4K9", name: "A4K9" };
  assert.equal(defaultBoxName(box), "A4K9");
  assert.equal(boxDisplayName(box), "A4K9");
  assert.equal(boxStickerSerial(box), "");
});

test("a custom box name stays primary and the sticker serial becomes secondary", () => {
  const box = { boxNumber: 8, labelSerial: "A4K9", defaultName: "A4K9", name: "Kitchen linens" };
  assert.equal(boxDisplayName(box), "Kitchen linens");
  assert.equal(boxStickerSerial(box), "A4K9");
});

test("clearing a custom name falls back to the separate default name", () => {
  const box = { boxNumber: 8, labelSerial: "A4K9", defaultName: "A4K9", name: null };
  assert.equal(boxDisplayName(box), "A4K9");
  assert.equal(boxStickerSerial(box), "");
  assert.equal(boxDisplayName({ ...box, name: "   " }), "A4K9");
});

test("legacy generated Box N name falls back to its printed QR serial", () => {
  const box = { boxNumber: 3, labelSerial: "A00S", defaultName: "A00S", name: "Box 3" };
  assert.equal(boxDisplayName(box), "A00S");
  assert.equal(boxStickerSerial(box), "");
});

test("legacy boxes without sticker serials keep their Box N fallback", () => {
  assert.equal(boxDisplayName({ boxNumber: 8, name: null }), "Box 8");
  assert.equal(boxDisplayName({ boxNumber: 8, defaultName: "Box 8", name: null }), "Box 8");
  assert.equal(boxStickerSerial({ boxNumber: 8, name: "Kitchen" }), "");
  assert.equal(boxNumber({ boxNumber: 8 }), "Box 8");
});
