import { performance } from "node:perf_hooks";

const DEFAULT_ACQUISITION_ATTEMPTS = 2;
const DEFAULT_RETRY_DELAY_MS = 120;
const DEFAULT_IDLE_VALIDATION_MS = 30_000;
const lastReleasedAt = globalThis[Symbol.for("boxsave.pg.lastReleasedAt")] ||= new WeakMap();
const discardReasons = globalThis[Symbol.for("boxsave.pg.discardReasons")] ||= new WeakMap();

export function discardClient(client, error) {
  if (client && error) discardReasons.set(client, error);
}

function watchClient(client) {
  let error = null;
  let rejectFailure;
  const failure = new Promise((_, reject) => { rejectFailure = reject; });
  // A rejection is also observed by race(), but this keeps the promise safe if a
  // client reports an error before validation or work starts.
  failure.catch(() => {});
  const onError = (cause) => {
    if (error) return;
    error = cause;
    rejectFailure(cause);
  };
  const canObserve = typeof client.on === "function" && typeof client.removeListener === "function";
  if (canObserve) client.on("error", onError);
  return {
    get error() { return error; },
    async race(work) {
      const pending = Promise.resolve().then(work);
      return canObserve ? Promise.race([pending, failure]) : pending;
    },
    dispose() {
      if (canObserve) client.removeListener("error", onError);
    },
  };
}

function isQueryTimeout(error) {
  return error?.message === "Query read timeout";
}

export async function withAcquiredClient(pool, work, {
  attempts = DEFAULT_ACQUISITION_ATTEMPTS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  idleValidationMs = DEFAULT_IDLE_VALIDATION_MS,
  shouldRetryAcquire = () => true,
  onAcquireFailure = () => {},
  onValidationFailure = onAcquireFailure,
  raceClientErrors = true,
} = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    let client;
    try {
      client = await pool.connect();
    } catch (error) {
      lastError = error;
      onAcquireFailure(error, attempt);
      if (attempt === attempts || !shouldRetryAcquire(error, attempt)) throw error;
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      continue;
    }

    const monitor = watchClient(client);
    const previousRelease = lastReleasedAt.get(client);
    if (previousRelease !== undefined && performance.now() - previousRelease >= idleValidationMs) {
      try {
        await monitor.race(() => client.query("SELECT 1"));
        lastReleasedAt.delete(client);
      } catch (error) {
        lastError = monitor.error || error;
        monitor.dispose();
        lastReleasedAt.delete(client);
        client.release(lastError);
        onValidationFailure(lastError, attempt);
        if (attempt === attempts || !shouldRetryAcquire(lastError, attempt)) throw lastError;
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }
    }

    let workError;
    try {
      const pending = Promise.resolve().then(() => work(client));
      return raceClientErrors ? await monitor.race(() => pending) : await pending;
    } catch (error) {
      workError = error;
      throw error;
    } finally {
      const requestedDiscard = discardReasons.get(client);
      discardReasons.delete(client);
      const releaseError = monitor.error || requestedDiscard || (isQueryTimeout(workError) ? workError : null);
      monitor.dispose();
      if (releaseError || client._queryable === false) lastReleasedAt.delete(client);
      else lastReleasedAt.set(client, performance.now());
      client.release(releaseError || undefined);
    }
  }

  throw lastError || new Error("Could not acquire a database client");
}
