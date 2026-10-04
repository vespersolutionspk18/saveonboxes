import assert from "node:assert/strict";
import dns from "node:dns";
import net from "node:net";
import { once } from "node:events";
import test from "node:test";
import { createResilientLookup, pgConfig } from "../src/lib/pg-config.js";

function callbackResult(lookup, hostname, options) {
  return new Promise((resolve) => lookup(hostname, options, (...args) => resolve(args)));
}

test("uses the operating-system DNS answer without fallback", async () => {
  let fallbackCalls = 0;
  const lookup = createResilientLookup({
    systemLookup: (_hostname, _options, callback) => callback(null, "192.0.2.10", 4),
    resolveRecords: async () => { fallbackCalls += 1; return []; },
  });
  assert.deepEqual(await callbackResult(lookup, "db.example", {}), [null, "192.0.2.10", 4]);
  assert.equal(fallbackCalls, 0);
});

test("falls back after ENOTFOUND and preserves all/family callback shapes", async () => {
  const fallbackRecords = [
    { address: "192.0.2.11", family: 4 },
    { address: "2001:db8::11", family: 6 },
  ];
  const lookup = createResilientLookup({
    systemLookup: (_hostname, _options, callback) => callback(Object.assign(new Error("missing"), { code: "ENOTFOUND" })),
    resolveRecords: async () => fallbackRecords,
  });
  assert.deepEqual(await callbackResult(lookup, "db.example", { all: true }), [null, fallbackRecords]);
  assert.deepEqual(await callbackResult(lookup, "db.example", { family: 6 }), [null, "2001:db8::11", 6]);
  assert.deepEqual(await callbackResult(lookup, "db.example", { all: true, family: 4 }), [null, [fallbackRecords[0]]]);
});

test("does not mask unrelated operating-system lookup errors", async () => {
  let fallbackCalls = 0;
  const original = Object.assign(new Error("denied"), { code: "EACCES" });
  const lookup = createResilientLookup({
    systemLookup: (_hostname, _options, callback) => callback(original),
    resolveRecords: async () => { fallbackCalls += 1; return []; },
  });
  const result = await callbackResult(lookup, "db.example", {});
  assert.equal(result[0], original);
  assert.equal(fallbackCalls, 0);
});

test("pg stream uses live DNS fallback while retaining normal socket behavior", async (context) => {
  const server = net.createServer((socket) => socket.end());
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const lookup = createResilientLookup({
    systemLookup: (_hostname, _options, callback) => callback(Object.assign(new Error("missing"), { code: "ENOTFOUND" })),
    resolveRecords: async () => [{ address: "127.0.0.1", family: 4 }],
  });
  const socket = pgConfig({}, { lookup }).stream();
  context.after(() => socket.destroy());
  socket.connect(server.address().port, "neon-test.invalid");
  await once(socket, "connect");
  assert.equal(socket.remoteAddress, "127.0.0.1");
  assert.equal(typeof dns.lookup, "function");
});
