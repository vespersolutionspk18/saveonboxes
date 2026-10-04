import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { pgConfig } from "../src/lib/pg-config.js";

const { Client } = pg;
const here = path.dirname(fileURLToPath(import.meta.url));
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");

const client = new Client(pgConfig({ connectionString: process.env.DATABASE_URL, application_name: "boxsave-migrations" }));
await client.connect();
try {
  await client.query("CREATE SCHEMA IF NOT EXISTS boxsave");
  await client.query(`CREATE TABLE IF NOT EXISTS boxsave.schema_migrations (
    version text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now()
  )`);
  await client.query("SELECT pg_advisory_lock(hashtext('boxsave:migrations:v1'))");
  const directory = path.join(here, "..", "migrations");
  const files = (await readdir(directory)).filter((file) => file.endsWith(".sql")).sort();
  for (const file of files) {
    const sql = await readFile(path.join(directory, file), "utf8");
    const version = file.replace(/\.sql$/, "");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const existing = await client.query("SELECT checksum FROM boxsave.schema_migrations WHERE version = $1", [version]);
    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum) throw new Error(`Applied migration checksum changed: ${version}`);
      continue;
    }
    await client.query("BEGIN");
    try {
      await client.query(sql);
      await client.query("INSERT INTO boxsave.schema_migrations(version, checksum) VALUES ($1, $2)", [version, checksum]);
      await client.query("COMMIT");
      process.stdout.write(`Applied ${version}\n`);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  try { await client.query("SELECT pg_advisory_unlock(hashtext('boxsave:migrations:v1'))"); } catch { /* connection may have failed */ }
  await client.end();
}
