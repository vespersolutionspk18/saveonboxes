import pg from "pg";
import { performance } from "node:perf_hooks";
import { pgConfig } from "@/lib/pg-config.js";
import { discardClient, withAcquiredClient } from "@/lib/db-client.js";

const { Pool } = pg;

const TRANSIENT_CONNECTION_CODES = new Set([
  "ENOTFOUND", "EAI_AGAIN", "ECONNRESET", "ECONNREFUSED", "ECONNABORTED", "ETIMEDOUT", "EPIPE", "EHOSTUNREACH", "ENETUNREACH",
  "57P01", "57P02", "57P03",
]);

function safeErrorName(error) {
  const name = typeof error?.name === "string" ? error.name : "Error";
  return /^[A-Za-z][A-Za-z0-9]{0,39}$/.test(name) ? name : "Error";
}

function safeErrorCode(error) {
  return typeof error?.code === "string" && /^[A-Z0-9_-]{1,32}$/.test(error.code) ? error.code : undefined;
}

function safeErrorMessage(error) {
  const code = safeErrorCode(error);
  const message = typeof error?.message === "string" ? error.message : "";
  if (code && !TRANSIENT_CONNECTION_CODES.has(code) && !code.startsWith("08")) {
    return `Database error ${code}`;
  }
  if (!code && !/connection|connect|timeout|timed out|socket|network|dns|terminated/i.test(message)) {
    return "Database operation failed";
  }
  return message
    .replace(/(?:postgres(?:ql)?|https?):\/\/[^\s]+/gi, "[connection URI redacted]")
    .replace(/\b(?:[a-z0-9-]+\.)*(?:neon\.tech|neon\.one)\b/gi, "[database host redacted]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}(?::\d+)?\b/g, "[address redacted]")
    .replace(/\[[0-9a-f:]{2,}\](?::\d+)?/gi, "[address redacted]")
    .replace(/Key \(([^)]{1,100})\)=\([^)]{0,200}\)/gi, "Key ($1)=([value redacted])")
    .replace(/invalid input syntax for type [^:]+:\s*.+/gi, "invalid input syntax for database value")
    .replace(/\s+/g, " ")
    .slice(0, 180) || "Database operation failed";
}

function startTiming() {
  return { monotonicMs: performance.now(), wallMs: Date.now(), startedAt: new Date().toISOString() };
}

function reportFailure(error, stage, timing, attempt) {
  const finishedAt = Date.now();
  const details = {
    stage,
    name: safeErrorName(error),
    code: safeErrorCode(error),
    message: safeErrorMessage(error),
    startedAt: timing.startedAt,
    finishedAt: new Date(finishedAt).toISOString(),
    elapsedMs: Math.max(0, Math.round(performance.now() - timing.monotonicMs)),
    wallElapsedMs: Math.max(0, finishedAt - timing.wallMs),
  };
  if (attempt) details.attempt = attempt;
  console.error("[boxsave/db] Database operation failed", details);
}

function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!globalThis.__boxsavePool) {
    globalThis.__boxsavePool = new Pool(pgConfig({
      connectionString: process.env.DATABASE_URL,
      max: Number.parseInt(process.env.PGPOOL_MAX || "5", 10),
      idleTimeoutMillis: 300_000,
      connectionTimeoutMillis: 20_000,
      query_timeout: 30_000,
      keepAlive: true,
      keepAliveInitialDelayMillis: 10_000,
      allowExitOnIdle: false,
      application_name: "boxsave-nextjs",
    }));
    globalThis.__boxsavePool.on("error", (error) => {
      reportFailure(error, "pool.idle_client", startTiming());
    });
  }
  return globalThis.__boxsavePool;
}

export function query(text, values) {
  const timing = startTiming();
  return withAcquiredClient(getPool(), async (client) => {
    try {
      return await client.query(text, values);
    } catch (error) {
      reportFailure(error, "query.execute", timing);
      throw error;
    }
  }, {
    shouldRetryAcquire: (error) => {
      const code = safeErrorCode(error);
      return !code || TRANSIENT_CONNECTION_CODES.has(code) || code.startsWith("08") || code.startsWith("57");
    },
    onAcquireFailure: (error, attempt) => reportFailure(error, "query.acquire", timing, attempt),
    onValidationFailure: (error, attempt) => reportFailure(error, "query.validate_idle_client", timing, attempt),
  });
}

export async function withTransaction(work) {
  const timing = startTiming();
  return withAcquiredClient(getPool(), async (client) => {
    try {
      await client.query("BEGIN");
      const result = await work(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      reportFailure(error, "transaction.execute", timing);
      if (error?.message !== "Query read timeout") {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          reportFailure(rollbackError, "transaction.rollback", timing);
          discardClient(client, rollbackError);
        }
      }
      throw error;
    }
  }, {
    raceClientErrors: false,
    shouldRetryAcquire: (error) => {
      const code = safeErrorCode(error);
      return !code || TRANSIENT_CONNECTION_CODES.has(code) || code.startsWith("08") || code.startsWith("57");
    },
    onAcquireFailure: (error, attempt) => reportFailure(error, "transaction.acquire", timing, attempt),
    onValidationFailure: (error, attempt) => reportFailure(error, "transaction.validate_idle_client", timing, attempt),
  });
}

export async function closePool() {
  if (globalThis.__boxsavePool) {
    await globalThis.__boxsavePool.end();
    delete globalThis.__boxsavePool;
  }
}
