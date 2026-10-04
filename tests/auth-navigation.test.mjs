import assert from "node:assert/strict";
import test from "node:test";
import { safeNextPath, signInDestination } from "../src/app/components/customer/api.js";

const admin = { role: "super_admin" };
const customer = { role: "customer" };

test("plain login routes each account to its role's workspace", () => {
  assert.equal(signInDestination(admin), "/admin");
  assert.equal(signInDestination(customer), "/dashboard");
});

test("a stale customer or scan destination never overrides the admin landing page", () => {
  for (const next of ["/dashboard", "/dashboard/print", "/q/example?source=camera", "/admin/reports"]) {
    assert.equal(signInDestination(admin, next), "/admin");
  }
});

test("customers never enter the admin console through an old next link", () => {
  for (const next of ["/admin", "/admin?view=reports", "/admin/reports", "/admin#customers", "/dashboard/../admin", "/%61dmin", "/login", "/register"]) {
    assert.equal(signInDestination(customer, next), "/dashboard");
  }
});

test("customer box and QR continuations survive authentication", () => {
  for (const next of ["/dashboard/print", "/dashboard/boxes/example", "/q/example?source=camera"]) {
    assert.equal(signInDestination(customer, next), next);
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
