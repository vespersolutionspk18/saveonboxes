import pg from "pg";
import { pgConfig } from "@/lib/pg-config.js";

const { Pool } = pg;

function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!globalThis.__boxsavePool) {
    globalThis.__boxsavePool = new Pool(pgConfig({
      connectionString: process.env.DATABASE_URL,
      max: Number.parseInt(process.env.PGPOOL_MAX || "5", 10),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      allowExitOnIdle: false,
      application_name: "boxsave-nextjs",
    }));
    globalThis.__boxsavePool.on("error", () => {
      // Do not log connection details: Neon errors may contain host or query data.
    });
  }
  return globalThis.__boxsavePool;
}

export function query(text, values) {
  return getPool().query(text, values);
}

export async function withTransaction(work) {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await work(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { /* retain original error */ }
    throw error;
  } finally {
    client.release();
  }
}

export async function closePool() {
  if (globalThis.__boxsavePool) {
    await globalThis.__boxsavePool.end();
    delete globalThis.__boxsavePool;
  }
}
