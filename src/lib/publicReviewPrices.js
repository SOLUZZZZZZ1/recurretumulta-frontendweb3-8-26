const SERVICES = new Set(["traffic", "debt", "administration", "claims"]);

function hasExactKeys(value, keys) {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      Object.keys(value).length === keys.length &&
      keys.every((key) => Object.hasOwn(value, key))
  );
}

function validAmount(amount) {
  return Number.isSafeInteger(amount) && amount >= 1 && amount <= 1_000_000;
}

export function parsePublicReviewPrices(payload) {
  const invalid = () => new Error("Tarifas de revisión no disponibles.");
  if (
    !hasExactKeys(payload, ["version", "catalog_version", "prices", "final_services"]) ||
    payload.version !== "rtm_public_review_prices_v1" ||
    payload.catalog_version !== "rtm_service_catalog_v1_2" ||
    !Array.isArray(payload.prices) ||
    payload.prices.length !== SERVICES.size ||
    !Array.isArray(payload.final_services) ||
    payload.final_services.length !== 1
  ) {
    throw invalid();
  }

  const prices = {};
  for (const price of payload.prices) {
    if (
      !hasExactKeys(price, ["service", "amount_cents", "currency"]) ||
      !SERVICES.has(price.service) ||
      Object.hasOwn(prices, price.service) ||
      !validAmount(price.amount_cents) ||
      price.currency !== "EUR"
    ) {
      throw invalid();
    }
    prices[price.service] = Object.freeze({
      amountCents: price.amount_cents,
      currency: price.currency,
    });
  }
  const offer = payload.final_services[0];
  if (
    !hasExactKeys(offer, ["service", "amount_cents", "currency", "review_credit_applies"]) ||
    offer.service !== "traffic_fine_appeal" ||
    !validAmount(offer.amount_cents) ||
    offer.currency !== "EUR" ||
    offer.review_credit_applies !== true ||
    offer.amount_cents < prices.traffic.amountCents
  ) {
    throw invalid();
  }
  return Object.freeze({
    reviewPrices: Object.freeze(prices),
    fineAppealOffer: Object.freeze({
      amountCents: offer.amount_cents,
      currency: offer.currency,
      reviewCreditApplies: offer.review_credit_applies,
    }),
  });
}

// Public explanation only: payment eligibility and the payable balance remain
// server decisions based on the case and confirmed payment evidence.
export function illustrativeFineAppealBalance(catalog) {
  return {
    amountCents: catalog.fineAppealOffer.amountCents - catalog.reviewPrices.traffic.amountCents,
    currency: catalog.fineAppealOffer.currency,
  };
}

export async function fetchPublicReviewPrices({ signal, fetchImpl = fetch } = {}) {
  const response = await fetchImpl("/api/public/review-prices", {
    method: "GET",
    headers: { Accept: "application/json" },
    credentials: "omit",
    redirect: "error",
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error("Tarifas de revisión no disponibles.");
  return parsePublicReviewPrices(await response.json());
}

export function formatPublicReviewPrice(price) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: price.currency,
  }).format(price.amountCents / 100);
}
