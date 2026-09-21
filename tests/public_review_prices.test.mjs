import assert from "node:assert/strict";
import test from "node:test";
import {
  fetchPublicReviewPrices,
  formatPublicReviewPrice,
  illustrativeFineAppealBalance,
  parsePublicReviewPrices,
} from "../src/lib/publicReviewPrices.js";

function catalog() {
  return {
    version: "rtm_public_review_prices_v1",
    catalog_version: "rtm_service_catalog_v1_2",
    prices: [
      { service: "traffic", amount_cents: 1000, currency: "EUR" },
      { service: "debt", amount_cents: 1000, currency: "EUR" },
      { service: "administration", amount_cents: 2500, currency: "EUR" },
      { service: "claims", amount_cents: 1000, currency: "EUR" },
    ],
    final_services: [
      { service: "traffic_fine_appeal", amount_cents: 3900, currency: "EUR", review_credit_applies: true },
    ],
  };
}

test("public catalogue displays the server amounts and tolerates row ordering", () => {
  const payload = catalog();
  payload.prices[0].amount_cents = 1234;
  payload.prices.reverse();
  const parsed = parsePublicReviewPrices(payload);
  assert.match(formatPublicReviewPrice(parsed.reviewPrices.traffic), /^12,34\s€$/);
  assert.match(formatPublicReviewPrice(parsed.reviewPrices.administration), /^25,00\s€$/);
  assert.match(formatPublicReviewPrice(parsed.reviewPrices.claims), /^10,00\s€$/);
  assert.equal(parsed.reviewPrices.traffic.amountCents, 1234);
});

test("fine appeal total includes one review credit only as an illustrative balance", () => {
  const parsed = parsePublicReviewPrices(catalog());
  assert.match(formatPublicReviewPrice(parsed.fineAppealOffer), /^39,00\s€$/);
  assert.match(formatPublicReviewPrice(illustrativeFineAppealBalance(parsed)), /^29,00\s€$/);
  const updated = catalog();
  updated.prices[0].amount_cents = 1200;
  updated.final_services[0].amount_cents = 4200;
  const next = parsePublicReviewPrices(updated);
  assert.match(formatPublicReviewPrice(next.fineAppealOffer), /^42,00\s€$/);
  assert.match(formatPublicReviewPrice(illustrativeFineAppealBalance(next)), /^30,00\s€$/);
  assert.equal(Object.hasOwn(next.fineAppealOffer, "checkoutUrl"), false);
  assert.equal(Object.hasOwn(next.fineAppealOffer, "paid"), false);
});

test("final service must match the agreed credit contract and cannot yield a negative balance", () => {
  for (const change of [
    (payload) => { delete payload.final_services; },
    (payload) => { payload.final_services = []; },
    (payload) => { payload.final_services = {}; },
    (payload) => { payload.final_services.push({ ...payload.final_services[0] }); },
    (payload) => { payload.final_services[0] = null; },
    (payload) => { payload.final_services[0].service = "unapproved"; },
    (payload) => { payload.final_services[0].review_credit_applies = false; },
    (payload) => { payload.final_services[0].review_credit_applies = "true"; },
    (payload) => { payload.final_services[0].amount_cents = 999; },
    (payload) => { payload.final_services[0].amount_cents = "3900"; },
    (payload) => { payload.final_services[0].amount_cents = 1_000_001; },
    (payload) => { payload.final_services[0].currency = "USD"; },
    (payload) => { payload.final_services[0].checkout_url = "https://example.com"; },
  ]) {
    const payload = catalog();
    change(payload);
    assert.throws(() => parsePublicReviewPrices(payload), /no disponibles/);
  }
});

test("catalogue rejects incompatible versions, extra fields and incomplete services", () => {
  for (const change of [
    (payload) => { payload.version = "untrusted"; },
    (payload) => { payload.catalog_version = "untrusted"; },
    (payload) => { payload.quote = {}; },
    (payload) => { delete payload.prices; },
    (payload) => { payload.prices = {}; },
    (payload) => { payload.prices.pop(); },
    (payload) => { payload.prices.push({ ...payload.prices[0] }); },
    (payload) => { payload.prices[0].service = "claims"; },
    (payload) => { payload.prices[0].service = "unknown"; },
    (payload) => { payload.prices[0].service = "__proto__"; },
    (payload) => { payload.prices[0].checkout_url = "https://example.com"; },
    (payload) => { payload.prices[0] = null; },
  ]) {
    const payload = catalog();
    change(payload);
    assert.throws(() => parsePublicReviewPrices(payload), /no disponibles/);
  }
  for (const payload of [null, [], "catalog", {}]) {
    assert.throws(() => parsePublicReviewPrices(payload), /no disponibles/);
  }
});

test("catalogue rejects malformed amounts and unsupported currency without fallback", () => {
  for (const amount of [0, -1, 1.5, "1000", null, NaN, Infinity, 1_000_001]) {
    const payload = catalog();
    payload.prices[0].amount_cents = amount;
    assert.throws(() => parsePublicReviewPrices(payload), /no disponibles/);
  }
  const payload = catalog();
  payload.prices[0].currency = "USD";
  assert.throws(() => parsePublicReviewPrices(payload), /no disponibles/);
});

test("public read uses the same-origin API without cookies, tokens or redirects", async () => {
  const controller = new AbortController();
  const calls = [];
  const parsed = await fetchPublicReviewPrices({
    signal: controller.signal,
    fetchImpl: async (...args) => {
      calls.push(args);
      return new Response(JSON.stringify(catalog()), { status: 200 });
    },
  });
  assert.equal(parsed.reviewPrices.debt.amountCents, 1000);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "/api/public/review-prices");
  assert.deepEqual(calls[0][1], {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "omit",
    redirect: "error",
    cache: "no-store",
    signal: controller.signal,
  });
});

test("HTTP and invalid JSON failures remain failures and a fresh request can recover", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls++;
    if (calls === 1) return new Response("Unavailable", { status: 503 });
    if (calls === 2) return new Response("<html>proxy fallback</html>", { status: 200 });
    return new Response(JSON.stringify(catalog()), { status: 200 });
  };
  await assert.rejects(fetchPublicReviewPrices({ fetchImpl }), /no disponibles/);
  await assert.rejects(fetchPublicReviewPrices({ fetchImpl }), SyntaxError);
  assert.equal((await fetchPublicReviewPrices({ fetchImpl })).reviewPrices.claims.amountCents, 1000);
  assert.equal(calls, 3);
});

test("aborted requests propagate cancellation instead of supplying prices", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(fetchPublicReviewPrices({
    signal: controller.signal,
    fetchImpl: async (_url, { signal }) => {
      signal.throwIfAborted();
      return new Response(JSON.stringify(catalog()));
    },
  }), { name: "AbortError" });
});
