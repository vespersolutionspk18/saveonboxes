import assert from "node:assert/strict";
import test from "node:test";
import { buildLabelUrl, normalizeAppOrigin, resolveAppOrigin } from "../src/lib/app-origin.js";

test("accepts local HTTP origins in production mode and valid HTTPS origins", () => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = "production";
  try {
    assert.equal(normalizeAppOrigin("http://localhost:3000"), "http://localhost:3000");
    assert.equal(normalizeAppOrigin("https://app.example.test/"), "https://app.example.test");
  } finally {
    if (previous === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previous;
  }
});

test("uses the request origin only when APP_ORIGIN is unset", () => {
  assert.equal(resolveAppOrigin({ requestOrigin: "http://localhost:3000" }), "http://localhost:3000");
  assert.equal(resolveAppOrigin({ configuredOrigin: "https://canonical.example.test", requestOrigin: "http://localhost:3000" }), "https://canonical.example.test");
  assert.equal(resolveAppOrigin({ configuredOrigin: "ftp://invalid.example.test", requestOrigin: "http://localhost:3000" }), null);
});

test("rejects credentials, paths, queries, fragments, and unsafe schemes", () => {
  for (const value of [
    "https://user:pass@example.test",
    "https://example.test/path",
    "https://example.test?next=/",
    "https://example.test/#fragment",
    "javascript:alert(1)",
    "ftp://example.test",
  ]) assert.equal(normalizeAppOrigin(value), null, value);
});

test("constructs label URLs from the validated application origin", () => {
  assert.equal(buildLabelUrl("a_b-C123", "http://localhost:3000/"), "http://localhost:3000/q/a_b-C123");
  assert.throws(() => buildLabelUrl("token", "https://example.test/path"), /origin/);
  assert.throws(() => buildLabelUrl("../outside", "https://example.test"), /token/);
});
