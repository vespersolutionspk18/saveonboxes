import assert from "node:assert/strict";
import test from "node:test";
import { safeNextPath, signInDestination } from "../src/app/components/customer/api.js";
import { safeRecoveryContinuation } from "../src/lib/auth-navigation.js";

const admin = { role: "super_admin" };
const customer = { role: "customer" };
const qrToken = "abcdefghijklmnopqrstuvwx12345678";
const qrUrl = `/q/${qrToken}?source=camera`;

test("plain login routes each account to its role's workspace", () => {
  assert.equal(signInDestination(admin), "/admin");
  assert.equal(signInDestination(customer), "/dashboard");
});

test("a plain or stale destination never overrides the admin landing page", () => {
  for (const next of ["/dashboard", "/dashboard/print", "/q/example?source=camera", "/admin/reports"]) {
    assert.equal(signInDestination(admin, next), "/admin");
  }
});

test("an explicit valid QR continuation resumes after login for either account role", () => {
  assert.equal(signInDestination(customer, qrUrl), qrUrl);
  assert.equal(signInDestination(admin, qrUrl), qrUrl);
  assert.equal(signInDestination(admin, `/q/${qrToken}`), `/q/${qrToken}`);
});

test("customers never enter the admin console through an old next link", () => {
  for (const next of ["/admin", "/admin?view=reports", "/admin/reports", "/admin#customers", "/dashboard/../admin", "/%61dmin", "/login", "/register"]) {
    assert.equal(signInDestination(customer, next), "/dashboard");
  }
});

test("customer box and QR continuations survive authentication", () => {
  for (const next of ["/dashboard/print", "/dashboard/boxes/example", qrUrl]) {
    assert.equal(signInDestination(customer, next), next);
  }
});

test("malformed QR continuations cannot override role landing pages", () => {
  for (const next of ["/q/example?source=camera", `/q/${qrToken}?source=evil`, `/q/${qrToken}?source=url&source=camera`, `/q/${qrToken}#admin`]) {
    assert.equal(signInDestination(customer, next), "/dashboard");
    assert.equal(signInDestination(admin, next), "/admin");
  }
});

test("untrusted redirect destinations remain inside the customer workspace", () => {
  for (const next of [null, 42, "https://example.com", "//example.com", "/\\example.com", "/\n/example.com", "/dashboard/../../admin", "javascript:alert(1)"]) {
    assert.equal(signInDestination(customer, next), "/dashboard");
  }
});

test("safe paths normalize dot segments without accepting another origin", () => {
  assert.equal(safeNextPath("/dashboard/../admin"), "/admin");
  assert.equal(safeNextPath("//example.com"), "/dashboard");
});

test("password recovery carries only a safe account or QR continuation", () => {
  assert.equal(safeRecoveryContinuation("/dashboard/boxes/example"), "/dashboard/boxes/example");
  assert.equal(safeRecoveryContinuation(qrUrl), qrUrl);
  for (const next of ["/admin", "https://example.com", "/q/example?source=camera", `/q/${qrToken}?source=evil`]) {
    assert.equal(safeRecoveryContinuation(next), null);
  }
});
