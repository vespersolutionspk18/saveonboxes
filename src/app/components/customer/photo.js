"use client";

// Client-side photo preparation shared by the inventory table. The server also
// resizes, but doing the heavy work here keeps uploads well under the 4 MB cap.

function withTimeout(promise, milliseconds, message, code) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = window.setTimeout(() => {
      const error = new Error(message);
      if (code) error.code = code;
      reject(error);
    }, milliseconds);
  });
  return Promise.race([promise, timeout]).finally(() => window.clearTimeout(timer));
}

async function decodePhotoWithImage(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  const pendingImage = new Promise((resolve, reject) => {
    image.onload = () => resolve({ source: image, width: image.naturalWidth, height: image.naturalHeight, release: () => URL.revokeObjectURL(url) });
    image.onerror = () => reject(new Error("This browser could not open the photo. Choose a JPG, PNG or WebP image."));
    image.src = url;
  });
  try {
    return await withTimeout(pendingImage, 12_000, "This photo took too long to open. Choose a smaller photo or try again.", "PHOTO_DECODE_TIMEOUT");
  } catch (error) {
    URL.revokeObjectURL(url);
    image.onload = null;
    image.onerror = null;
    throw error;
  }
}

async function decodePhoto(file) {
  if (typeof createImageBitmap === "function") {
    let pendingBitmap;
    try {
      pendingBitmap = createImageBitmap(file);
      const bitmap = await withTimeout(pendingBitmap, 12_000, "This photo took too long to open. Choose a smaller photo or try again.", "PHOTO_DECODE_TIMEOUT");
      return { source: bitmap, width: bitmap.width, height: bitmap.height, release: () => bitmap.close?.() };
    } catch (error) {
      pendingBitmap?.then((bitmap) => bitmap.close?.()).catch(() => {});
      if (error.code === "PHOTO_DECODE_TIMEOUT") throw error;
      // Some mobile browsers expose createImageBitmap but only decode a camera
      // format through HTMLImageElement. Try that bounded path before giving up.
    }
  }
  return decodePhotoWithImage(file);
}

export async function prepareItemPhoto(file) {
  const supportedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  const convertibleBrowserTypes = new Set(["image/heic", "image/heif", "image/avif", "image/gif", "image/bmp"]);
  const fileType = (file.type || "").toLowerCase();
  const extensionLooksLikePhoto = /\.(jpe?g|png|webp|heic|heif|avif|gif|bmp)$/i.test(file.name || "");
  if (!supportedTypes.has(fileType) && !convertibleBrowserTypes.has(fileType) && !((!fileType || fileType.startsWith("image/")) && extensionLooksLikePhoto)) {
    throw new Error("Choose a JPG, PNG or WebP photo. Your phone camera format can be converted if this browser supports it.");
  }
  if (file.size > 25 * 1024 * 1024) throw new Error("That photo is very large. Choose one under 25 MB.");

  let decoded;
  try {
    decoded = await decodePhoto(file);
  } catch (error) {
    throw new Error(error.message || "This photo could not be opened. Choose a JPG, PNG or WebP image.");
  }
  try {
    if (!decoded.width || !decoded.height || decoded.width * decoded.height > 30_000_000) {
      throw new Error("That image is too large to process. Choose a smaller photo.");
    }
    const scale = Math.min(1, 1600 / Math.max(decoded.width, decoded.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(decoded.width * scale));
    canvas.height = Math.max(1, Math.round(decoded.height * scale));
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("This browser could not prepare the photo. Try again with another image.");
    context.fillStyle = "#FFFFFF";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(decoded.source, 0, 0, canvas.width, canvas.height);

    for (const mimeType of ["image/webp", "image/jpeg"]) {
      for (const quality of [0.82, 0.68, 0.54, 0.4]) {
        const blob = await withTimeout(new Promise((resolve, reject) => {
          canvas.toBlob((encoded) => encoded ? resolve(encoded) : reject(new Error("This browser could not compress the photo. Choose another image.")), mimeType, quality);
        }), 10_000, "Photo preparation took too long. Choose a smaller photo or try again.");
        if (blob.size <= 3_500_000) {
          const extension = blob.type === "image/jpeg" ? "jpg" : blob.type === "image/png" ? "png" : "webp";
          return new File([blob], `box-item.${extension}`, { type: blob.type });
        }
      }
    }
    throw new Error("This photo is still too large after compression. Choose a smaller image.");
  } finally {
    decoded.release();
  }
}
