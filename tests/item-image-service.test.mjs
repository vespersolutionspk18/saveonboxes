import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import {
  createItemImageHandlers,
  MAX_ITEM_IMAGE_BODY_BYTES,
  MAX_ITEM_IMAGE_PIXELS,
  processItemImage,
} from "../src/lib/item-image-service.js";

const itemId = "6a0789de-84f8-4f6e-9e58-15e8607e6be3";
const ownerId = "7c3d45ef-4d5a-4e22-ae94-3fe315ae42ee";
const otherId = "9c5cb0d3-31ea-4d86-b350-ef20d43ab68f";

function responseJson(data, init = {}) {
  const headers = new Headers(init.headers);
  headers.set("content-type", "application/json");
  return new Response(JSON.stringify(data), { ...init, headers });
}

function makeHarness({ user = { id: ownerId, role: "customer" }, itemOwner = ownerId } = {}) {
  let stored = null;
  const calls = [];
  const handlers = createItemImageHandlers({
    requireUser: async () => user || responseJson({ error: { code: "unauthenticated" } }, { status: 401 }),
    checkSameOrigin: () => null,
    fail: (message, status, code) => responseJson({ error: { message, code } }, { status }),
    json: responseJson,
    errorResponse: (error) => responseJson({ error: { message: error.message, code: error.code } }, { status: error.status || 500 }),
    query: async (sql, values = []) => {
      calls.push(sql);
      if (sql.includes("SELECT b.id AS \"boxId\" FROM boxsave.box_items")) {
        return itemOwner === values[1] ? { rowCount: 1, rows: [{ boxId: "box-1" }] } : { rowCount: 0, rows: [] };
      }
      if (sql.includes("FROM boxsave.item_images im")) {
        const canRead = user?.role === "super_admin" || itemOwner === user?.id;
        return stored && canRead ? { rowCount: 1, rows: [{ ...stored }] } : { rowCount: 0, rows: [] };
      }
      if (sql.includes("INSERT INTO boxsave.item_images")) {
        stored = { imageData: values[2], contentType: values[1], byteSize: values[5], width: values[3], height: values[4] };
        return { rowCount: 1, rows: [] };
      }
      if (sql.startsWith("DELETE FROM boxsave.item_images")) {
        stored = null;
        return { rowCount: 1, rows: [] };
      }
      return { rowCount: 1, rows: [] };
    },
  });
  return { handlers, calls, getStored: () => stored };
}

function uploadRequest(data, type = "image/png") {
  const form = new FormData();
  form.set("image", new Blob([data], { type }), "photo.png");
  return new Request(`http://localhost/api/items/${itemId}/image`, { method: "POST", body: form });
}

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

test("image processing converts accepted raster input to bounded, metadata-free WebP", async () => {
  const png = await sharp({ create: { width: 2000, height: 1000, channels: 4, background: "#e86a24" } }).png().toBuffer();
  const image = await processItemImage(png);
  const metadata = await sharp(image.imageData).metadata();
  assert.equal(image.contentType, "image/webp");
  assert.equal(metadata.format, "webp");
  assert.equal(image.width, 1600);
  assert.equal(image.height, 800);
  assert.ok(image.byteSize > 0 && image.byteSize <= 4 * 1024 * 1024);
  assert.equal(metadata.exif, undefined);
});

test("image processing rejects unsupported bytes before storage", async () => {
  await assert.rejects(() => processItemImage(Buffer.from("not an image")), { status: 400, code: "invalid_image" });
  const harness = makeHarness();
  const response = await harness.handlers.POST(uploadRequest(Buffer.from("not an image")), { params: Promise.resolve({ id: itemId }) });
  assert.equal(response.status, 400);
  assert.equal(harness.calls.some((sql) => sql.includes("INSERT INTO boxsave.item_images")), false);
});

test("unauthenticated upload is rejected before database access", async () => {
  const harness = makeHarness({ user: null });
  const response = await harness.handlers.POST(uploadRequest(Buffer.from("x")), { params: Promise.resolve({ id: itemId }) });
  assert.equal(response.status, 401);
  assert.equal(harness.calls.length, 0);
});

test("another customer's item cannot be uploaded to or read", async () => {
  const harness = makeHarness({ itemOwner: otherId });
  const upload = await harness.handlers.POST(uploadRequest(Buffer.from("x")), { params: Promise.resolve({ id: itemId }) });
  assert.equal(upload.status, 404);
  assert.equal(harness.getStored(), null);
  assert.equal(harness.calls.some((sql) => sql.includes("INSERT INTO boxsave.item_images")), false);

  const read = await harness.handlers.GET(new Request(`http://localhost/api/items/${itemId}/image`), { params: Promise.resolve({ id: itemId }) });
  assert.equal(read.status, 404);
});

test("super-admins can read an item photo for support without gaining mutation access", async () => {
  const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: "#203040" } }).png().toBuffer();
  const adminRead = makeHarness({ user: { id: "admin-id", role: "super_admin" }, itemOwner: ownerId });
  const insert = await adminRead.handlers.POST(uploadRequest(png), { params: Promise.resolve({ id: itemId }) });
  assert.equal(insert.status, 404, "super-admin may read, but may not mutate a customer's photo");

  const userUpload = makeHarness();
  const upload = await userUpload.handlers.POST(uploadRequest(png), { params: Promise.resolve({ id: itemId }) });
  assert.equal(upload.status, 201);
  // The service is exercised with the image already persisted by the item owner.
  const ownerResult = await userUpload.handlers.GET(new Request(`http://localhost/api/items/${itemId}/image`), { params: Promise.resolve({ id: itemId }) });
  assert.equal(ownerResult.status, 200);
  const saved = Buffer.from(await ownerResult.arrayBuffer());
  // Supply the stored row directly via an isolated query stub for the support-read case.
  const adminHandlers = createItemImageHandlers({
    requireUser: async () => ({ id: "admin-id", role: "super_admin" }),
    checkSameOrigin: () => null,
    fail: (message, status, code) => responseJson({ error: { message, code } }, { status }),
    json: responseJson,
    errorResponse: (error) => responseJson({ error: { message: error.message } }, { status: error.status || 500 }),
    query: async (_sql, values) => {
      assert.deepEqual(values, [itemId, true, "admin-id"]);
      return { rowCount: 1, rows: [{ imageData: saved, contentType: "image/webp", byteSize: saved.length, width: 2, height: 2 }] };
    },
  });
  const read = await adminHandlers.GET(new Request(`http://localhost/api/items/${itemId}/image`), { params: Promise.resolve({ id: itemId }) });
  assert.equal(read.status, 200);
  assert.equal(read.headers.get("cache-control"), "private, no-store");
  assert.equal(read.headers.get("content-type"), "image/webp");
});

test("the owner can replace and remove the single stored photo", async () => {
  const png = await sharp({ create: { width: 3, height: 2, channels: 3, background: "#203040" } }).png().toBuffer();
  const harness = makeHarness();
  const upload = await harness.handlers.POST(uploadRequest(png), { params: Promise.resolve({ id: itemId }) });
  assert.equal(upload.status, 201);
  assert.ok(harness.getStored());
  const removal = await harness.handlers.DELETE(new Request(`http://localhost/api/items/${itemId}/image`, { method: "DELETE" }), { params: Promise.resolve({ id: itemId }) });
  assert.equal(removal.status, 200);
  assert.deepEqual(await removal.json(), { ok: true, imageUrl: null, hasImage: false });
  assert.equal(harness.getStored(), null);

  const foreign = makeHarness({ itemOwner: otherId });
  const denied = await foreign.handlers.DELETE(new Request(`http://localhost/api/items/${itemId}/image`, { method: "DELETE" }), { params: Promise.resolve({ id: itemId }) });
  assert.equal(denied.status, 404);
  assert.equal(foreign.calls.some((sql) => sql.startsWith("DELETE FROM boxsave.item_images")), false);
});

test("oversized multipart uploads are rejected before form parsing and storage", async () => {
  const harness = makeHarness();
  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(MAX_ITEM_IMAGE_BODY_BYTES));
      controller.enqueue(new Uint8Array(1));
      controller.close();
    },
  });
  const request = new Request(`http://localhost/api/items/${itemId}/image`, {
    method: "POST",
    headers: { "content-type": "multipart/form-data; boundary=test" },
    body: stream,
    duplex: "half",
  });
  const response = await harness.handlers.POST(request, { params: Promise.resolve({ id: itemId }) });
  assert.equal(response.status, 413);
  assert.equal(harness.calls.length, 1, "ownership is checked before the bounded multipart read");
  assert.equal(harness.calls.some((sql) => sql.includes("INSERT INTO boxsave.item_images")), false);
});

test("pixel limit is enforced before decoding large images", async () => {
  const image = await sharp({ create: { width: 2, height: 2, channels: 3, background: "white" } }).png().toBuffer();
  image.writeUInt32BE(8001, 16);
  image.writeUInt32BE(8000, 20);
  image.writeUInt32BE(crc32(image.subarray(12, 29)), 29);
  await assert.rejects(() => processItemImage(image), { status: 413, code: "image_dimensions_too_large" });
  assert.equal(8001 * 8000, MAX_ITEM_IMAGE_PIXELS + 8_000);
});
