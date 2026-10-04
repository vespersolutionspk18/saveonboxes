import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

export function tokenHash(token) {
  return createHash("sha256").update(token).digest("hex");
}

function encryptionKey() {
  const value = process.env.QR_TOKEN_ENCRYPTION_KEY || "";
  const key = Buffer.from(value, "base64");
  if (key.length !== 32) throw new Error("QR token encryption key is not configured");
  return key;
}

export function tokenEncryptionReady() {
  try { encryptionKey(); return true; } catch { return false; }
}

export function encryptToken(token) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptToken(value) {
  const [ivText, tagText, ciphertextText] = value.split(".");
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(ivText, "base64url"));
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextText, "base64url")), decipher.final()]).toString("utf8");
}

export function isLabelToken(value) {
  return typeof value === "string" && /^[A-Za-z0-9_-]{24,64}$/.test(value);
}
