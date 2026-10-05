import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { discardClient, withAcquiredClient } from "../src/lib/db-client.js";

test("a pool acquisition failure gets one bounded retry before work starts", async () => {
  let connections = 0;
  let workCalls = 0;
  let releases = 0;
  const failures = [];
  const pool = {
    async connect() {
      connections += 1;
      if (connections === 1) throw Object.assign(new Error("DNS failed"), { code: "ENOTFOUND" });
      return { release() { releases += 1; } };
    },
  };
  const result = await withAcquiredClient(pool, async () => { workCalls += 1; return "done"; }, {
    retryDelayMs: 0,
    onAcquireFailure: (error, attempt) => failures.push([error.code, attempt]),
  });
  assert.equal(result, "done");
  assert.equal(connections, 2);
  assert.equal(workCalls, 1);
  assert.equal(releases, 1);
  assert.deepEqual(failures, [["ENOTFOUND", 1]]);
});

test("work is never retried after a client has been acquired", async () => {
  let connections = 0;
  let workCalls = 0;
  let releases = 0;
  const operationError = Object.assign(new Error("statement failed"), { code: "40001" });
  const pool = { async connect() { connections += 1; return { release() { releases += 1; } }; } };
  await assert.rejects(() => withAcquiredClient(pool, async () => {
    workCalls += 1;
    throw operationError;
  }, { retryDelayMs: 0 }), operationError);
  assert.equal(connections, 1);
  assert.equal(workCalls, 1);
  assert.equal(releases, 1);
});

test("acquisition failures exhaust the bound without executing work", async () => {
  let connections = 0;
  let workCalls = 0;
  const pool = { async connect() { connections += 1; throw new Error("No client"); } };
  await assert.rejects(() => withAcquiredClient(pool, async () => { workCalls += 1; }, { retryDelayMs: 0, attempts: 2 }), /No client/);
  assert.equal(connections, 2);
  assert.equal(workCalls, 0);
});

test("checked-out connection errors reject promptly, discard the client, and never replay work", async () => {
  const client = new EventEmitter();
  let releasedWith;
  client.release = (error) => { releasedWith = error; };
  const connectionError = Object.assign(new Error("socket reset"), { code: "ECONNRESET" });
  let workCalls = 0;
  const operation = withAcquiredClient({ async connect() { return client; } }, async () => {
    workCalls += 1;
    return new Promise(() => {});
  }, { attempts: 2, retryDelayMs: 0 });

  setImmediate(() => client.emit("error", connectionError));
  await assert.rejects(operation, (error) => error === connectionError);
  assert.equal(workCalls, 1);
  assert.equal(releasedWith, connectionError);
  assert.equal(client.listenerCount("error"), 0);
});

test("a stale idle client is pinged before work and a failed ping retries before business SQL", async () => {
  const makeClient = (pingFailure = null) => {
    const client = new EventEmitter();
    client._queryable = true;
    client.pings = 0;
    client.releases = [];
    client.query = async (sql) => {
      assert.equal(sql, "SELECT 1");
      client.pings += 1;
      if (pingFailure) throw pingFailure;
      return { rows: [{ value: 1 }] };
    };
    client.release = (error) => client.releases.push(error);
    return client;
  };
  const stale = makeClient(Object.assign(new Error("stale socket"), { code: "ECONNRESET" }));
  const fresh = makeClient();
  const clients = [stale, stale, fresh];
  const pool = { async connect() { return clients.shift(); } };
  let workCalls = 0;

  await withAcquiredClient(pool, async () => { workCalls += 1; }, { idleValidationMs: 0, retryDelayMs: 0 });
  await withAcquiredClient(pool, async (client) => {
    workCalls += 1;
    assert.equal(client, fresh);
  }, { idleValidationMs: 0, retryDelayMs: 0 });

  assert.equal(stale.pings, 1);
  assert.equal(fresh.pings, 0);
  assert.equal(stale.releases.length, 2);
  assert.equal(stale.releases[0], undefined);
  assert.equal(stale.releases[1]?.code, "ECONNRESET");
  assert.deepEqual(fresh.releases, [undefined]);
  assert.equal(workCalls, 2);
});

test("a query read timeout discards its client without retrying the statement", async () => {
  const client = new EventEmitter();
  let releasedWith;
  client.release = (error) => { releasedWith = error; };
  const timeout = new Error("Query read timeout");
  let workCalls = 0;
  await assert.rejects(() => withAcquiredClient({ async connect() { return client; } }, async () => {
    workCalls += 1;
    throw timeout;
  }), timeout);
  assert.equal(workCalls, 1);
  assert.equal(releasedWith, timeout);
});

test("a failed rollback discards the client while preserving the original transaction error", async () => {
  const client = new EventEmitter();
  let releasedWith;
  client.release = (error) => { releasedWith = error; };
  const original = Object.assign(new Error("transaction statement failed"), { code: "23505" });
  const rollbackError = new Error("Query read timeout");

  await assert.rejects(() => withAcquiredClient({ async connect() { return client; } }, async (acquired) => {
    try {
      throw original;
    } catch (error) {
      discardClient(acquired, rollbackError);
      throw error;
    }
  }), (error) => error === original);
  assert.equal(releasedWith, rollbackError);
});
