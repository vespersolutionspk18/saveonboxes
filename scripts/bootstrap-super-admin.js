import { randomUUID } from "node:crypto";
import pg from "pg";
import { pgConfig } from "../src/lib/pg-config.js";
import { hashPassword } from "../src/lib/password.js";
import { normalizeEmail, normalizePhone } from "../src/lib/identity.js";

const { Client } = pg;
const email = normalizeEmail(process.env.BOOTSTRAP_ADMIN_EMAIL);
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || "";
const phone = normalizePhone(process.env.BOOTSTRAP_ADMIN_PHONE);
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
if (!email || !password || !phone || password.length < 12 || password.length > 256) {
  throw new Error("Set BOOTSTRAP_ADMIN_EMAIL, BOOTSTRAP_ADMIN_PASSWORD (12+ characters), and BOOTSTRAP_ADMIN_PHONE for this one-time command.");
}

const client = new Client(pgConfig({ connectionString: process.env.DATABASE_URL, application_name: "boxsave-admin-bootstrap" }));
await client.connect();
try {
  await client.query("BEGIN");
  await client.query("SELECT pg_advisory_xact_lock(hashtext('boxsave:bootstrap-super-admin:v1'))");
  const existing = await client.query("SELECT 1 FROM boxsave.users WHERE role = 'super_admin' LIMIT 1");
  if (existing.rowCount) throw new Error("A super-admin already exists; bootstrap is one-time and will not modify accounts.");
  const passwordHash = await hashPassword(password);
  await client.query(`INSERT INTO boxsave.users(id, email, password_hash, phone, role)
    VALUES ($1, $2, $3, $4, 'super_admin')`, [randomUUID(), email, passwordHash, phone]);
  await client.query("COMMIT");
  process.stdout.write("Initial super-admin provisioned. Remove bootstrap environment values from the shell.\n");
} catch (error) {
  await client.query("ROLLBACK");
  throw error;
} finally {
  await client.end();
}
