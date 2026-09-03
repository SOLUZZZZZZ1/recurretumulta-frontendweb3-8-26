import assert from "node:assert/strict";
import test from "node:test";

import {
  canonicalVehicleAuthorizationSnapshot,
  formatVehicleRemovalQuote,
  isExpectedVehicleCaseStatus,
  isVehiclePaymentConfirmed,
  parseVehicleRemovalQuote,
  parseVehicleRemovalCheckout,
  sameVehicleRemovalQuote,
  verifyVehicleRemovalQuote,
  vehicleCaseAllowsMutation,
  vehicleCaseIdFromSearch,
  vehicleCheckoutSignal,
} from "../src/lib/vehicleRemovalAccess.js";

const CASE_ID = "11111111-1111-1111-1111-111111111111";

test("vehicle entry accepts exactly one canonical case query", () => {
  assert.equal(vehicleCaseIdFromSearch(`?case=${CASE_ID}`), CASE_ID);
  for (const search of [
    "",
    `?case_id=${CASE_ID}`,
    `?id=${CASE_ID}`,
    `?case=${CASE_ID}&case=${CASE_ID}`,
    `?case=${CASE_ID}&case_id=${CASE_ID}`,
    "?case=not-a-uuid",
  ]) {
    assert.equal(vehicleCaseIdFromSearch(search), "", search);
  }
});

test("checkout query is an untrusted signal with a strict shape", () => {
  assert.equal(vehicleCheckoutSignal("?checkout=returned"), "returned");
  assert.equal(vehicleCheckoutSignal("?checkout=cancelled"), "cancelled");
  assert.equal(vehicleCheckoutSignal("?checkout=returned&checkout=returned"), "");
  assert.equal(vehicleCheckoutSignal("?success=1"), "");
  assert.equal(vehicleCheckoutSignal("?checkout=paid"), "");
});

test("only the exact authoritative paid state confirms vehicle payment", () => {
  assert.equal(isVehiclePaymentConfirmed({ payment_status: "paid" }), true);
  for (const payload of [
    null,
    {},
    [],
    { payment_status: "pending" },
    { payment_status: "PAID" },
    { paid: true },
  ]) {
    assert.equal(isVehiclePaymentConfirmed(payload), false);
  }
});

test("vehicle status is bound to the expected case and service before mutation", () => {
  const status = {
    ok: true,
    case_id: CASE_ID,
    department: "traffic",
    case_type: "vehicle_removal",
    privacy_projection: "rtm_public_status_v1_0",
    status: "authorization_received",
    payment_status: "unpaid",
  };
  assert.equal(isExpectedVehicleCaseStatus(status, CASE_ID), true);
  assert.equal(vehicleCaseAllowsMutation(status, CASE_ID), true);

  for (const changed of [
    { case_id: "22222222-2222-2222-2222-222222222222" },
    { department: "debt" },
    { case_type: "fine" },
    { privacy_projection: "legacy" },
    { ok: false },
  ]) {
    const payload = { ...status, ...changed };
    assert.equal(isExpectedVehicleCaseStatus(payload, CASE_ID), false);
    assert.equal(vehicleCaseAllowsMutation(payload, CASE_ID), false);
  }

  for (const changed of [
    { payment_status: "paid" },
    { status: "vehicle_removal_paid" },
    { status: "vehicle_removal_assigned" },
    { status: "vehicle_removal_completed" },
  ]) {
    assert.equal(vehicleCaseAllowsMutation({ ...status, ...changed }, CASE_ID), false);
  }
});

test("vehicle quote is exact, case-bound and cryptographically binds its text", async () => {
  const payload = {
    ok: true,
    case_id: CASE_ID,
    service_code: "vehicle_removal",
    amount_cents: 3900,
    currency: "EUR",
    quote_version: "rtm_vehicle_removal_quote_v1",
    authorization_version: "rtm-core-vehicle-removal-v3",
    authorization_text:
      "Solicito expresamente a RTM que prepare la gestión administrativa de baja o retirada de este vehículo para el expediente indicado. La solicitud seguirá sujeta a revisión humana y no ejecuta por sí sola la baja, retirada ni transmisión del vehículo.",
    authorization_sha256:
      "b8c54b902450421ba7b4754e50f79ffc6bb83aaf77de480989fe350adfaf621d",
  };
  const quote = await verifyVehicleRemovalQuote(payload, CASE_ID);
  assert.match(formatVehicleRemovalQuote(quote), /39/);
  assert.equal(sameVehicleRemovalQuote(quote, { ...quote }), true);
  assert.equal(sameVehicleRemovalQuote(quote, { ...quote, amountCents: 4000 }), false);

  for (const changed of [
    { case_id: "22222222-2222-4222-8222-222222222222" },
    { service_code: "fine_review" },
    { amount_cents: 0 },
    { amount_cents: 39.5 },
    { currency: "USD" },
    { quote_version: "legacy" },
    { authorization_version: "rtm-core-vehicle-removal-v2" },
    { authorization_sha256: "0".repeat(64) },
    { token: "secret" },
  ]) {
    assert.throws(() => parseVehicleRemovalQuote({ ...payload, ...changed }, CASE_ID));
  }
  await assert.rejects(
    verifyVehicleRemovalQuote(
      { ...payload, authorization_text: `${payload.authorization_text}!` },
      CASE_ID
    ),
    /no coincide/i
  );
});

test("vehicle checkout response is exact and bound to the active case", () => {
  const payload = {
    ok: true,
    case_id: CASE_ID,
    checkout_url: "https://checkout.stripe.com/c/pay/cs_test_vehicle",
  };
  assert.deepEqual(parseVehicleRemovalCheckout(payload, CASE_ID), {
    caseId: CASE_ID,
    checkoutUrl: payload.checkout_url,
  });
  for (const changed of [
    { case_id: "22222222-2222-4222-8222-222222222222" },
    { ok: false },
    { url: payload.checkout_url },
    { checkout_url: " https://checkout.stripe.com/c/pay/cs_test_vehicle" },
    { extra: true },
  ]) {
    assert.throws(
      () => parseVehicleRemovalCheckout({ ...payload, ...changed }, CASE_ID),
      /sesión de pago/
    );
  }
});

test("OPS accepts only the canonical vehicle consent snapshot", () => {
  assert.deepEqual(
    canonicalVehicleAuthorizationSnapshot({
      authorization_version: "rtm-core-vehicle-removal-v3",
      authorization_sha256:
        "b8c54b902450421ba7b4754e50f79ffc6bb83aaf77de480989fe350adfaf621d",
    }),
    {
      authorizationVersion: "rtm-core-vehicle-removal-v3",
      authorizationSha256:
        "b8c54b902450421ba7b4754e50f79ffc6bb83aaf77de480989fe350adfaf621d",
    }
  );
  for (const value of [
    null,
    [],
    { authorization_version: "rtm-core-vehicle-removal-v2", authorization_sha256: "b8c54b902450421ba7b4754e50f79ffc6bb83aaf77de480989fe350adfaf621d" },
    { authorization_version: "rtm-core-vehicle-removal-v3", authorization_sha256: "0".repeat(64) },
  ]) {
    assert.equal(canonicalVehicleAuthorizationSnapshot(value), null);
  }
});
