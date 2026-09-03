import assert from "node:assert/strict";
import test from "node:test";

import {
  formatReviewQuote,
  parseReviewCheckoutContext,
  parseReviewCheckoutEnvelope,
  sameReviewQuote,
} from "../src/lib/reviewCheckout.js";

const CASE_ID = "123e4567-e89b-42d3-a456-426614174000";

function context(overrides = {}) {
  return {
    ok: true,
    case_id: CASE_ID,
    signed_authority_verified: true,
    readiness: {
      authority: "rtm_review_readiness",
      version: "rtm_review_readiness_v1_0",
      case_id: CASE_ID,
      ready: true,
      quote: {
        authority: "rtm_service_catalog",
        version: "rtm_service_catalog_v1_2",
        department: "traffic",
        case_type: "fine",
        service_code: "traffic",
        payment_stage: "review",
        billing_code: "REVIEW_BASIC",
        amount_cents: 1000,
        currency: "EUR",
        stripe_price_env: "STRIPE_PRICE_ID_REVIEW_BASIC",
        label: "Revisión inicial de tráfico",
      },
      blocking_issues: [],
      warnings: [],
      received_document_kinds: ["authorization_signed", "main_document"],
    },
    ...overrides,
  };
}

test("review context accepts only the exact case-bound authoritative quote", () => {
  const parsed = parseReviewCheckoutContext(context(), CASE_ID);
  assert.equal(parsed.ready, true);
  assert.equal(parsed.quote.amountCents, 1000);
  assert.match(formatReviewQuote(parsed.quote), /10,00\s*€/);
  assert.equal(sameReviewQuote(parsed.quote, { ...parsed.quote }), true);

  assert.throws(
    () => parseReviewCheckoutContext({ ...context(), price: 1 }, CASE_ID),
    /cotización/
  );
  assert.throws(
    () =>
      parseReviewCheckoutContext(
        { ...context(), case_id: "00000000-0000-4000-8000-000000000000" },
        CASE_ID
      ),
    /cotización/
  );
});

test("a ready quote requires verified signed authority and no blockers", () => {
  assert.throws(
    () =>
      parseReviewCheckoutContext(
        { ...context(), signed_authority_verified: false },
        CASE_ID
      ),
    /cotización/
  );
  const blocked = context();
  blocked.readiness = {
    ...blocked.readiness,
    blocking_issues: [
      {
        code: "main_document",
        message: "Falta el documento principal",
        area: "documents",
        blocking: true,
      },
    ],
  };
  assert.throws(() => parseReviewCheckoutContext(blocked, CASE_ID), /cotización/);
});

test("review quote rejects tier/environment contradictions and unsafe labels", () => {
  for (const quotePatch of [
    { amount_cents: 0 },
    { amount_cents: 10.5 },
    { currency: "USD" },
    { billing_code: "ADMIN_REVIEW" },
    { stripe_price_env: "STRIPE_PRICE_ID_ADMIN" },
    { label: "Precio\u0000hostil" },
  ]) {
    const payload = context();
    payload.readiness = {
      ...payload.readiness,
      quote: { ...payload.readiness.quote, ...quotePatch },
    };
    assert.throws(() => parseReviewCheckoutContext(payload, CASE_ID), /cotización/);
  }
});

test("checkout must echo every authoritative price discriminator", () => {
  const quote = parseReviewCheckoutContext(context(), CASE_ID).quote;
  const checkout = {
    ok: true,
    url: "https://checkout.stripe.com/c/pay/cs_test_123",
    billing_code: quote.billingCode,
    payment_stage: quote.paymentStage,
    service_code: quote.serviceCode,
    amount_cents: quote.amountCents,
    currency: quote.currency,
    authority_version: quote.version,
  };
  assert.equal(parseReviewCheckoutEnvelope(checkout, quote).alreadyPaid, false);
  for (const patch of [
    { amount_cents: quote.amountCents + 1 },
    { currency: "USD" },
    { billing_code: "ADMIN_REVIEW" },
    { authority_version: "legacy" },
    { extra: true },
  ]) {
    assert.throws(
      () => parseReviewCheckoutEnvelope({ ...checkout, ...patch }, quote),
      /sesión de pago/
    );
  }
});

test("already-paid response is exact and still bound to the shown quote", () => {
  const quote = parseReviewCheckoutContext(context(), CASE_ID).quote;
  const paid = {
    ok: true,
    already_paid: true,
    redirect: `/resumen?case=${CASE_ID}`,
    billing_code: quote.billingCode,
    amount_cents: quote.amountCents,
    currency: quote.currency,
  };
  assert.deepEqual(parseReviewCheckoutEnvelope(paid, quote), {
    alreadyPaid: true,
    redirect: paid.redirect,
  });
  assert.throws(
    () => parseReviewCheckoutEnvelope({ ...paid, amount_cents: 2500 }, quote),
    /confirmación de pago/
  );
});
