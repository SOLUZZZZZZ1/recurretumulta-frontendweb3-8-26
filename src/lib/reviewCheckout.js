import { normalizeCaseId } from "./caseAccess.js";

const CONTEXT_KEYS = Object.freeze([
  "case_id",
  "ok",
  "readiness",
  "signed_authority_verified",
]);
const READINESS_KEYS = Object.freeze([
  "authority",
  "blocking_issues",
  "case_id",
  "quote",
  "ready",
  "received_document_kinds",
  "version",
  "warnings",
]);
const QUOTE_KEYS = Object.freeze([
  "amount_cents",
  "authority",
  "billing_code",
  "case_type",
  "currency",
  "department",
  "label",
  "payment_stage",
  "service_code",
  "stripe_price_env",
  "version",
]);
const ISSUE_KEYS = Object.freeze(["area", "blocking", "code", "message"]);
const CHECKOUT_KEYS = Object.freeze([
  "amount_cents",
  "authority_version",
  "billing_code",
  "currency",
  "ok",
  "payment_stage",
  "service_code",
  "url",
]);
const ALREADY_PAID_KEYS = Object.freeze([
  "already_paid",
  "amount_cents",
  "billing_code",
  "currency",
  "ok",
  "redirect",
]);
const DEPARTMENTS = new Set([
  "traffic",
  "debt",
  "administration",
  "travel",
  "claims",
  "other",
]);
const ISSUE_AREAS = new Set([
  "data",
  "identity",
  "authorization",
  "documents",
  "service",
]);
const CONTROL = /[\u0000-\u001f\u007f]/;
const CODE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,95}$/;

function isRecord(value) {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function hasExactKeys(value, expected) {
  return (
    isRecord(value) &&
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...expected].sort())
  );
}

function isBoundedText(value, { min = 0, max = 500 } = {}) {
  return (
    typeof value === "string" &&
    value === value.trim() &&
    value.length >= min &&
    value.length <= max &&
    !CONTROL.test(value)
  );
}

function issueIsValid(issue, expectedBlocking) {
  return Boolean(
    hasExactKeys(issue, ISSUE_KEYS) &&
      CODE.test(issue.code) &&
      isBoundedText(issue.message, { min: 1, max: 500 }) &&
      ISSUE_AREAS.has(issue.area) &&
      issue.blocking === expectedBlocking
  );
}

function quoteIsValid(quote) {
  if (!hasExactKeys(quote, QUOTE_KEYS)) return false;
  if (
    quote.authority !== "rtm_service_catalog" ||
    quote.version !== "rtm_service_catalog_v1_2" ||
    !DEPARTMENTS.has(quote.department) ||
    !isBoundedText(quote.case_type, { max: 96 }) ||
    (quote.case_type && !CODE.test(quote.case_type)) ||
    !CODE.test(quote.service_code) ||
    quote.payment_stage !== "review" ||
    !Number.isSafeInteger(quote.amount_cents) ||
    quote.amount_cents < 1 ||
    quote.amount_cents > 1_000_000 ||
    quote.currency !== "EUR" ||
    !isBoundedText(quote.label, { min: 1, max: 200 })
  ) {
    return false;
  }

  if (quote.billing_code === "ADMIN_REVIEW") {
    return (
      quote.department === "administration" &&
      quote.stripe_price_env === "STRIPE_PRICE_ID_ADMIN"
    );
  }
  return (
    quote.billing_code === "REVIEW_BASIC" &&
    quote.department !== "administration" &&
    quote.stripe_price_env === "STRIPE_PRICE_ID_REVIEW_BASIC"
  );
}

export function parseReviewCheckoutContext(payload, expectedCaseId) {
  const caseId = normalizeCaseId(expectedCaseId);
  const readiness = payload?.readiness;
  const quote = readiness?.quote;
  if (
    !caseId ||
    !hasExactKeys(payload, CONTEXT_KEYS) ||
    payload.ok !== true ||
    payload.case_id !== caseId ||
    typeof payload.signed_authority_verified !== "boolean" ||
    !hasExactKeys(readiness, READINESS_KEYS) ||
    readiness.authority !== "rtm_review_readiness" ||
    readiness.version !== "rtm_review_readiness_v1_0" ||
    readiness.case_id !== caseId ||
    typeof readiness.ready !== "boolean" ||
    !quoteIsValid(quote) ||
    !Array.isArray(readiness.blocking_issues) ||
    !readiness.blocking_issues.every((issue) => issueIsValid(issue, true)) ||
    !Array.isArray(readiness.warnings) ||
    !readiness.warnings.every((issue) => issueIsValid(issue, false)) ||
    !Array.isArray(readiness.received_document_kinds) ||
    !readiness.received_document_kinds.every(
      (kind) => typeof kind === "string" && CODE.test(kind)
    ) ||
    (readiness.ready &&
      (!payload.signed_authority_verified ||
        readiness.blocking_issues.length !== 0))
  ) {
    throw new TypeError("La cotización de revisión no es válida.");
  }

  return Object.freeze({
    caseId,
    signedAuthorityVerified: payload.signed_authority_verified,
    ready: readiness.ready,
    quote: Object.freeze({
      authority: quote.authority,
      version: quote.version,
      department: quote.department,
      caseType: quote.case_type,
      serviceCode: quote.service_code,
      paymentStage: quote.payment_stage,
      billingCode: quote.billing_code,
      amountCents: quote.amount_cents,
      currency: quote.currency,
      label: quote.label,
    }),
  });
}

export function sameReviewQuote(left, right) {
  return Boolean(
    left &&
      right &&
      left.authority === right.authority &&
      left.version === right.version &&
      left.department === right.department &&
      left.caseType === right.caseType &&
      left.serviceCode === right.serviceCode &&
      left.paymentStage === right.paymentStage &&
      left.billingCode === right.billingCode &&
      left.amountCents === right.amountCents &&
      left.currency === right.currency &&
      left.label === right.label
  );
}

export function formatReviewQuote(quote, locale = "es-ES") {
  if (!quote) return "";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: quote.currency,
  }).format(quote.amountCents / 100);
}

export function parseReviewCheckoutEnvelope(payload, expectedQuote) {
  if (!expectedQuote) {
    throw new TypeError("Falta la cotización autoritativa de revisión.");
  }

  if (payload?.already_paid === true) {
    if (
      !hasExactKeys(payload, ALREADY_PAID_KEYS) ||
      payload.ok !== true ||
      payload.billing_code !== expectedQuote.billingCode ||
      payload.amount_cents !== expectedQuote.amountCents ||
      payload.currency !== expectedQuote.currency ||
      !isBoundedText(payload.redirect, { min: 1, max: 2048 })
    ) {
      throw new TypeError("La confirmación de pago no coincide con la cotización.");
    }
    return Object.freeze({ alreadyPaid: true, redirect: payload.redirect });
  }

  if (
    !hasExactKeys(payload, CHECKOUT_KEYS) ||
    payload.ok !== true ||
    payload.billing_code !== expectedQuote.billingCode ||
    payload.payment_stage !== expectedQuote.paymentStage ||
    payload.service_code !== expectedQuote.serviceCode ||
    payload.amount_cents !== expectedQuote.amountCents ||
    payload.currency !== expectedQuote.currency ||
    payload.authority_version !== expectedQuote.version ||
    !isBoundedText(payload.url, { min: 1, max: 4096 })
  ) {
    throw new TypeError("La sesión de pago no coincide con la cotización.");
  }
  return Object.freeze({ alreadyPaid: false, url: payload.url });
}
