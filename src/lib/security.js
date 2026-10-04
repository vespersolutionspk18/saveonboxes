import { createHash, randomBytes, randomUUID } from "node:crypto";
import { query } from "@/lib/db.js";

export function digest(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

export function newId() {
  return randomUUID();
}

export function newToken(bytes = 32) {
  return randomBytes(bytes).toString("base64url");
}

export async function consumeRateLimit(scope, subject, limit, windowMs, blockMs = windowMs) {
  const keyHash = digest(`${scope}:${subject}`);
  const { rows } = await query(`
    INSERT INTO boxsave.rate_limit_buckets(key_hash, hits, window_started_at, updated_at)
    VALUES ($1, 1, now(), now())
    ON CONFLICT (key_hash) DO UPDATE SET
      hits = CASE
        WHEN boxsave.rate_limit_buckets.blocked_until > now() THEN boxsave.rate_limit_buckets.hits + 1
        WHEN boxsave.rate_limit_buckets.window_started_at <= now() - ($3 * interval '1 millisecond') THEN 1
        ELSE boxsave.rate_limit_buckets.hits + 1 END,
      window_started_at = CASE
        WHEN boxsave.rate_limit_buckets.blocked_until > now() THEN boxsave.rate_limit_buckets.window_started_at
        WHEN boxsave.rate_limit_buckets.window_started_at <= now() - ($3 * interval '1 millisecond') THEN now()
        ELSE boxsave.rate_limit_buckets.window_started_at END,
      blocked_until = CASE
        WHEN boxsave.rate_limit_buckets.blocked_until > now() THEN boxsave.rate_limit_buckets.blocked_until
        WHEN boxsave.rate_limit_buckets.window_started_at <= now() - ($3 * interval '1 millisecond') THEN NULL
        WHEN boxsave.rate_limit_buckets.hits + 1 > $2 THEN now() + ($4 * interval '1 millisecond')
        ELSE NULL END,
      updated_at = now()
    RETURNING hits, blocked_until`, [keyHash, limit, windowMs, blockMs]);
  const row = rows[0];
  return { allowed: row.hits <= limit && (!row.blocked_until || new Date(row.blocked_until) <= new Date()), retryAt: row.blocked_until };
}
