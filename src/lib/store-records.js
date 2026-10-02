import { randomBytes } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

const recordsDirectory = path.join(process.cwd(), ".data");
const writeQueues = new Map();

export async function readRecords(filename) {
  try {
    const content = JSON.parse(await readFile(path.join(recordsDirectory, filename), "utf8"));
    return Array.isArray(content) ? content : Array.isArray(content.orders) ? content.orders : [];
  } catch (error) { if (error.code === "ENOENT") return []; throw error; }
}

export async function saveRecord(filename, values) {
  const reference = `SOB-${new Date().toISOString().slice(0, 10).replaceAll("-", "")}-${randomBytes(4).toString("hex").toUpperCase()}`;
  const createdAt = new Date().toISOString();
  const record = { ...values, reference, createdAt };
  const write = (writeQueues.get(filename) || Promise.resolve()).catch(() => {}).then(async () => {
    await mkdir(recordsDirectory, { recursive: true });
    const records = await readRecords(filename);
    const destination = path.join(recordsDirectory, filename);
    const temporary = path.join(recordsDirectory, `${filename}-${randomBytes(6).toString("hex")}.tmp`);
    await writeFile(temporary, JSON.stringify([...records, record], null, 2), { mode: 0o600 });
    await rename(temporary, destination);
  });
  writeQueues.set(filename, write);
  await write;
  return record;
}

export function cleanText(value, maximum = 5000) { return typeof value === "string" ? value.trim().slice(0, maximum) : ""; }
export function validEmail(value) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254; }
export function safeTrackingUrl(value) {
  try { const parsed = new URL(value); return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : null; } catch { return null; }
}
