import { createHash } from "node:crypto";
import sharp from "sharp";

export const MAX_ITEM_IMAGE_BODY_BYTES = 4 * 1024 * 1024;
export const MAX_ITEM_IMAGE_BYTES = MAX_ITEM_IMAGE_BODY_BYTES - 64 * 1024;
export const MAX_ITEM_IMAGE_OUTPUT_BYTES = 4 * 1024 * 1024;
export const MAX_ITEM_IMAGE_PIXELS = 64_000_000;
export const MAX_ITEM_IMAGE_DIMENSION = 1600;
const ACCEPTED_FORMATS = new Set(["jpeg", "png", "webp"]);

function httpError(message, status, code) {
  return Object.assign(new Error(message), { status, code });
}

export async function processItemImage(input) {
  let pipeline;
  let metadata;
  try {
    // Sharp metadata reads the header without decompressing pixels. Inspect dimensions
    // first so oversize images receive a clear 413 before the bounded decode pipeline.
    metadata = await sharp(input, { limitInputPixels: false, failOn: "warning", animated: false }).metadata();
  } catch {
    throw httpError("Choose a valid JPEG, PNG or WebP image", 400, "invalid_image");
  }
  if (!ACCEPTED_FORMATS.has(metadata.format)) {
    throw httpError("Choose a JPEG, PNG or WebP image", 415, "unsupported_image_type");
  }
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > MAX_ITEM_IMAGE_PIXELS) {
    throw httpError("This image is too large to upload", 413, "image_dimensions_too_large");
  }

  let result;
  try {
    pipeline = sharp(input, { limitInputPixels: MAX_ITEM_IMAGE_PIXELS, failOn: "warning", animated: false });
    result = await pipeline.rotate()
      .resize({ width: MAX_ITEM_IMAGE_DIMENSION, height: MAX_ITEM_IMAGE_DIMENSION, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw httpError("This image could not be processed. Choose another image and try again.", 400, "image_processing_failed");
  }
  if (result.data.byteLength > MAX_ITEM_IMAGE_OUTPUT_BYTES) {
    throw httpError("This image is still too large after optimization. Choose a smaller image.", 413, "image_output_too_large");
  }
  const width = Number(result.info.width);
  const height = Number(result.info.height);
  if (!width || !height || width > MAX_ITEM_IMAGE_DIMENSION || height > MAX_ITEM_IMAGE_DIMENSION) {
    throw httpError("This image could not be safely resized", 400, "image_processing_failed");
  }
  return {
    imageData: result.data,
    contentType: "image/webp",
    width,
    height,
    byteSize: result.data.byteLength,
    sha256: createHash("sha256").update(result.data).digest("hex"),
  };
}

async function readBoundedFormData(request) {
  if (!/^multipart\/form-data\s*;/i.test(request.headers.get("content-type") || "")) {
    throw httpError("Upload an image file", 415, "multipart_required");
  }
  const contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > MAX_ITEM_IMAGE_BODY_BYTES) {
    throw httpError("Image uploads must be 4 MB or smaller", 413, "image_too_large");
  }
  if (!request.body) throw httpError("Choose an image to upload", 400, "image_required");

  const reader = request.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_ITEM_IMAGE_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        throw httpError("Image uploads must be 4 MB or smaller", 413, "image_too_large");
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  const headers = new Headers(request.headers);
  headers.delete("content-length");
  const boundedRequest = new Request(request.url, {
    method: "POST",
    headers,
    body: Buffer.concat(chunks, size),
    duplex: "half",
  });
  try {
    return await boundedRequest.formData();
  } catch {
    throw httpError("The image upload could not be read", 400, "invalid_multipart");
  }
}

export function createItemImageHandlers({ requireUser, query, checkSameOrigin, fail, json, errorResponse, transformImage = processItemImage }) {
  async function ownedItem(userId, itemId) {
    return query(`SELECT b.id AS "boxId" FROM boxsave.box_items i
      JOIN boxsave.boxes b ON b.id = i.box_id WHERE i.id = $1 AND b.owner_id = $2 LIMIT 1`, [itemId, userId]);
  }

  async function GET(request, context) {
    try {
      const user = await requireUser(request);
      if (user instanceof Response) return user;
      const { id } = await context.params;
      const result = await query(`SELECT im.image_data AS "imageData", im.content_type AS "contentType",
          im.byte_size AS "byteSize", im.width, im.height
        FROM boxsave.item_images im
        JOIN boxsave.box_items i ON i.id = im.item_id
        JOIN boxsave.boxes b ON b.id = i.box_id
        WHERE im.item_id = $1 AND ($2::boolean OR b.owner_id = $3) LIMIT 1`, [id, user.role === "super_admin", user.id]);
      const image = result.rows[0];
      if (!image) return fail("Inventory image not found", 404, "image_not_found");
      return new Response(new Uint8Array(image.imageData), {
        headers: {
          "content-type": image.contentType,
          "content-length": String(image.byteSize),
          "cache-control": "private, no-store",
          "x-content-type-options": "nosniff",
          "content-security-policy": "default-src 'none'; sandbox",
        },
      });
    } catch (error) {
      return errorResponse(error);
    }
  }

  async function POST(request, context) {
    const originFailure = checkSameOrigin(request);
    if (originFailure) return originFailure;
    try {
      const user = await requireUser(request);
      if (user instanceof Response) return user;
      const { id } = await context.params;
      const item = await ownedItem(user.id, id);
      if (!item.rowCount) return fail("Inventory item not found", 404, "item_not_found");
      const form = await readBoundedFormData(request);
      const file = form.get("image");
      if (!file || typeof file.arrayBuffer !== "function" || typeof file.size !== "number") {
        return fail("Choose an image to upload", 400, "image_required");
      }
      if (file.size < 1 || file.size > MAX_ITEM_IMAGE_BYTES) {
        return fail("Image uploads must be below 4 MB", 413, "image_too_large");
      }
      const image = await transformImage(Buffer.from(await file.arrayBuffer()));
      await query(`INSERT INTO boxsave.item_images(item_id, content_type, image_data, width, height, byte_size, sha256)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (item_id) DO UPDATE SET content_type = EXCLUDED.content_type,
          image_data = EXCLUDED.image_data, width = EXCLUDED.width, height = EXCLUDED.height,
          byte_size = EXCLUDED.byte_size, sha256 = EXCLUDED.sha256, updated_at = now()`,
      [id, image.contentType, image.imageData, image.width, image.height, image.byteSize, image.sha256]);
      await query("UPDATE boxsave.boxes SET updated_at = now() WHERE id = $1", [item.rows[0].boxId]);
      return json({ imageUrl: `/api/items/${encodeURIComponent(id)}/image`, contentType: image.contentType,
        width: image.width, height: image.height, bytes: image.byteSize }, { status: 201 });
    } catch (error) {
      return errorResponse(error);
    }
  }

  async function DELETE(request, context) {
    const originFailure = checkSameOrigin(request);
    if (originFailure) return originFailure;
    try {
      const user = await requireUser(request);
      if (user instanceof Response) return user;
      const { id } = await context.params;
      const item = await ownedItem(user.id, id);
      if (!item.rowCount) return fail("Inventory item not found", 404, "item_not_found");
      await query("DELETE FROM boxsave.item_images WHERE item_id = $1", [id]);
      await query("UPDATE boxsave.boxes SET updated_at = now() WHERE id = $1", [item.rows[0].boxId]);
      return json({ ok: true, imageUrl: null, hasImage: false });
    } catch (error) {
      return errorResponse(error);
    }
  }

  return { GET, POST, DELETE };
}
