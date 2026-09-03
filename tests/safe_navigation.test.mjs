import assert from "node:assert/strict";
import test from "node:test";

import {
  requireStripeCheckoutUrl,
  safeInternalPath,
  safeStripeCheckoutUrl,
} from "../src/lib/safeNavigation.js";

const ORIGIN = "https://staging.recurretumulta.eu";

test("internal navigation accepts only explicit same-origin paths", () => {
  assert.equal(
    safeInternalPath("/multas?case=123#documentos", { origin: ORIGIN }),
    "/multas?case=123#documentos"
  );
  assert.equal(
    safeInternalPath(`${ORIGIN}/deudas/documentos`, { origin: ORIGIN }),
    "/deudas/documentos"
  );
  assert.equal(
    safeInternalPath("/multas?from=server", {
      origin: ORIGIN,
      allowedPathnames: ["/multas"],
      pathOnly: true,
    }),
    "/multas"
  );
  assert.equal(
    safeInternalPath("/ops", {
      origin: ORIGIN,
      allowedPathnames: ["/multas"],
    }),
    null
  );
});

test("internal navigation rejects redirect parser tricks", () => {
  const rejected = [
    "https://evil.example/phish",
    "//evil.example/phish",
    "javascript:alert(1)",
    "data:text/html,pwned",
    "relative/path",
    " https://staging.recurretumulta.eu/multas",
    "https://staging.recurretumulta.eu@evil.example/multas",
    "/%2f%2fevil.example",
    "/safe%5c..%5cevil",
    "/safe%0d%0aLocation:https://evil.example",
    "/safe\\evil",
  ];

  for (const value of rejected) {
    assert.equal(safeInternalPath(value, { origin: ORIGIN }), null, value);
  }
});

test("checkout navigation accepts only Stripe's canonical HTTPS host", () => {
  const valid = "https://checkout.stripe.com/c/pay/cs_test_123?prefilled_email=x%40example.com";
  assert.equal(safeStripeCheckoutUrl(valid), valid);
  assert.equal(requireStripeCheckoutUrl(valid), valid);

  const rejected = [
    "http://checkout.stripe.com/c/pay/test",
    "//checkout.stripe.com/c/pay/test",
    "https://checkout.stripe.com.evil.example/c/pay/test",
    "https://checkout.stripe.com@evil.example/c/pay/test",
    "https://evil.example/?next=https://checkout.stripe.com",
    "https://checkout.stripe.com:444/c/pay/test",
    "https://user:secret@checkout.stripe.com/c/pay/test",
    "https://checkout.stripe.com\\@evil.example/c/pay/test",
    "https://checkout.stripe.com/%0d%0aLocation:https://evil.example",
  ];

  for (const value of rejected) {
    assert.equal(safeStripeCheckoutUrl(value), null, value);
    assert.throws(() => requireStripeCheckoutUrl(value), /no permitida/i, value);
  }
});
