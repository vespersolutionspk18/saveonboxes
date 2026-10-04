import assert from "node:assert/strict";
import test from "node:test";
import { checkSameOrigin } from "../src/lib/http.js";
import { getRequestOrigin } from "../src/lib/app-origin.js";

test("accepts localhost and canonical same-origin requests with canonical APP_ORIGIN set", () => {
  const previous = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://saveonboxes.vercel.app";
  try {
    const local = checkSameOrigin(new Request("http://localhost:3000/api/auth/login", {
      method: "POST", headers: { origin: "http://localhost:3000" },
    }));
    const canonical = checkSameOrigin(new Request("http://localhost:3000/api/auth/login", {
      method: "POST", headers: { origin: "https://saveonboxes.vercel.app" },
    }));
    assert.equal(local, null);
    assert.equal(canonical, null);
  } finally {
    if (previous === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previous;
  }
});

test("rejects unrelated and malformed origins while preserving missing-Origin behavior", () => {
  const previous = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://saveonboxes.vercel.app";
  try {
    const request = (origin) => new Request("http://localhost:3000/api/auth/register", {
      method: "POST", headers: origin === undefined ? {} : { origin },
    });
    assert.equal(checkSameOrigin(request("https://evil.example"))?.status, 403);
    assert.equal(checkSameOrigin(request("https://saveonboxes.vercel.app/path"))?.status, 403);
    assert.equal(checkSameOrigin(request("https://saveonboxes.vercel.app/"))?.status, 403);
    assert.equal(checkSameOrigin(request("null"))?.status, 403);
    assert.equal(checkSameOrigin(request(undefined)), null);
  } finally {
    if (previous === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previous;
  }
});

test("uses the validated Host with the request protocol for wildcard-bound Next URLs", () => {
  const previous = process.env.APP_ORIGIN;
  process.env.APP_ORIGIN = "https://saveonboxes.vercel.app";
  try {
    const local = new Request("http://0.0.0.0:3000/api/auth/login", {
      method: "POST", headers: { host: "localhost:3000", origin: "http://localhost:3000" },
    });
    assert.equal(getRequestOrigin(local), "http://localhost:3000");
    assert.equal(checkSameOrigin(local), null);

    const evil = new Request("http://0.0.0.0:3000/api/auth/login", {
      method: "POST", headers: { host: "localhost:3000", origin: "https://evil.example" },
    });
    assert.equal(checkSameOrigin(evil)?.status, 403);

    const malformedHost = new Request("http://0.0.0.0:3000/api/auth/login", {
      method: "POST", headers: { host: "localhost:3000/path", origin: "https://saveonboxes.vercel.app" },
    });
    assert.equal(getRequestOrigin(malformedHost), null);
    assert.equal(checkSameOrigin(malformedHost)?.status, 403);

    const withoutHost = new Request("http://0.0.0.0:3000/api/auth/login", {
      method: "POST", headers: { origin: "http://0.0.0.0:3000" },
    });
    assert.equal(getRequestOrigin(withoutHost), "http://0.0.0.0:3000");
    assert.equal(checkSameOrigin(withoutHost), null);
  } finally {
    if (previous === undefined) delete process.env.APP_ORIGIN;
    else process.env.APP_ORIGIN = previous;
  }
});
