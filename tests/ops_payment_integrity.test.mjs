import assert from "node:assert/strict";
import test from "node:test";

import {
  derivePaymentDisplay,
  isPaidStatus,
} from "../src/lib/opsPayment.js";


test("a confirmed payment survives a missing CORE workspace", () => {
  const state = derivePaymentDisplay(
    {
      payment_status: "paid",
      paid_at: "2026-08-27T16:26:13Z",
      product_code: "REVIEW_BASIC",
    },
    {}
  );

  assert.deepEqual(
    { known: state.known, paid: state.paid, label: state.label },
    { known: true, paid: true, label: "Pago confirmado" }
  );
});

test("an authoritative billing record wins over stale workspace data", () => {
  const state = derivePaymentDisplay(
    { payment_status: null, paid_at: null },
    { payment_status: "paid" }
  );

  assert.equal(state.known, true);
  assert.equal(state.paid, false);
  assert.equal(state.label, "No consta pago");
});

test("a missing billing response and missing workspace never imply unpaid", () => {
  const state = derivePaymentDisplay(null, {});

  assert.equal(state.known, false);
  assert.equal(state.paid, false);
  assert.equal(state.label, "Estado de pago no disponible");
  assert.equal(state.tone, "danger");
});

test("paid status normalization accepts the supported provider states", () => {
  for (const value of ["paid", "PAID", "succeeded", "complete", "completed"]) {
    assert.equal(isPaidStatus(value), true, value);
  }
  for (const value of [null, "", "pending", "failed"]) {
    assert.equal(isPaidStatus(value), false, String(value));
  }
});
