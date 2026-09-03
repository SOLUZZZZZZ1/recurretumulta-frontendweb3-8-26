import { normalizeCaseId } from "./caseAccess.js";

export function vehicleCaseIdFromSearch(search = "") {
  const params = new URLSearchParams(String(search || ""));
  if (params.has("case_id") || params.has("id")) return "";
  const values = params.getAll("case");
  return values.length === 1 ? normalizeCaseId(values[0]) : "";
}

export function vehicleCheckoutSignal(search = "") {
  const values = new URLSearchParams(String(search || "")).getAll("checkout");
  if (values.length !== 1) return "";
  return values[0] === "returned" || values[0] === "cancelled"
    ? values[0]
    : "";
}

export function isVehiclePaymentConfirmed(payload) {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      payload.payment_status === "paid"
  );
}

export function isExpectedVehicleCaseStatus(payload, expectedCaseId) {
  const caseId = normalizeCaseId(expectedCaseId);
  return Boolean(
    caseId &&
      payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      payload.ok === true &&
      payload.case_id === caseId &&
      payload.department === "traffic" &&
      payload.case_type === "vehicle_removal" &&
      payload.privacy_projection === "rtm_public_status_v1_0"
  );
}

export function vehicleCaseAllowsMutation(payload, expectedCaseId) {
  if (!isExpectedVehicleCaseStatus(payload, expectedCaseId)) return false;
  if (payload.payment_status === "paid") return false;
  return !new Set([
    "vehicle_removal_paid",
    "vehicle_removal_assigned",
    "vehicle_removal_completed",
  ]).has(payload.status);
}

const VEHICLE_QUOTE_KEYS = Object.freeze([
  "amount_cents",
  "authorization_sha256",
  "authorization_text",
  "authorization_version",
  "case_id",
  "currency",
  "ok",
  "quote_version",
  "service_code",
]);
const VEHICLE_CHECKOUT_KEYS = Object.freeze(["case_id", "checkout_url", "ok"]);
const VEHICLE_AUTHORIZATION_VERSION = "rtm-core-vehicle-removal-v3";
const VEHICLE_AUTHORIZATION_SHA256 =
  "b8c54b902450421ba7b4754e50f79ffc6bb83aaf77de480989fe350adfaf621d";

export function canonicalVehicleAuthorizationSnapshot(payload) {
  if (
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    payload.authorization_version !== VEHICLE_AUTHORIZATION_VERSION ||
    payload.authorization_sha256 !== VEHICLE_AUTHORIZATION_SHA256
  ) {
    return null;
  }
  return Object.freeze({
    authorizationVersion: VEHICLE_AUTHORIZATION_VERSION,
    authorizationSha256: VEHICLE_AUTHORIZATION_SHA256,
  });
}

export function parseVehicleRemovalQuote(payload, expectedCaseId) {
  const caseId = normalizeCaseId(expectedCaseId);
  if (
    !caseId ||
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    JSON.stringify(Object.keys(payload).sort()) !==
      JSON.stringify([...VEHICLE_QUOTE_KEYS].sort()) ||
    payload.ok !== true ||
    payload.case_id !== caseId ||
    payload.service_code !== "vehicle_removal" ||
    !Number.isSafeInteger(payload.amount_cents) ||
    payload.amount_cents < 1 ||
    payload.amount_cents > 1_000_000 ||
    payload.currency !== "EUR" ||
    payload.quote_version !== "rtm_vehicle_removal_quote_v1" ||
    !canonicalVehicleAuthorizationSnapshot(payload) ||
    typeof payload.authorization_text !== "string" ||
    !payload.authorization_text.trim() ||
    payload.authorization_text.length > 2_000 ||
    /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(
      payload.authorization_text
    )
  ) {
    throw new TypeError("La cotización del servicio no es válida.");
  }
  return Object.freeze({
    caseId,
    amountCents: payload.amount_cents,
    currency: payload.currency,
    quoteVersion: payload.quote_version,
    authorizationVersion: payload.authorization_version,
    authorizationText: payload.authorization_text,
    authorizationSha256: payload.authorization_sha256,
  });
}

export async function verifyVehicleRemovalQuote(
  payload,
  expectedCaseId,
  cryptoImpl = globalThis.crypto
) {
  const quote = parseVehicleRemovalQuote(payload, expectedCaseId);
  if (typeof cryptoImpl?.subtle?.digest !== "function") {
    throw new TypeError("No se puede verificar la autorización del servicio.");
  }
  const digest = new Uint8Array(
    await cryptoImpl.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(quote.authorizationText)
    )
  );
  const digestHex = [...digest]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
  if (digestHex !== quote.authorizationSha256) {
    throw new TypeError("El texto de autorización no coincide con su versión.");
  }
  return quote;
}

export function sameVehicleRemovalQuote(left, right) {
  return Boolean(
    left &&
      right &&
      left.caseId === right.caseId &&
      left.amountCents === right.amountCents &&
      left.currency === right.currency &&
      left.quoteVersion === right.quoteVersion &&
      left.authorizationVersion === right.authorizationVersion &&
      left.authorizationText === right.authorizationText &&
      left.authorizationSha256 === right.authorizationSha256
  );
}

export function formatVehicleRemovalQuote(quote, locale = "es-ES") {
  if (!quote) return "";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: quote.currency,
  }).format(quote.amountCents / 100);
}

export function parseVehicleRemovalCheckout(payload, expectedCaseId) {
  const caseId = normalizeCaseId(expectedCaseId);
  if (
    !caseId ||
    !payload ||
    typeof payload !== "object" ||
    Array.isArray(payload) ||
    JSON.stringify(Object.keys(payload).sort()) !==
      JSON.stringify([...VEHICLE_CHECKOUT_KEYS].sort()) ||
    payload.ok !== true ||
    payload.case_id !== caseId ||
    typeof payload.checkout_url !== "string" ||
    !payload.checkout_url ||
    payload.checkout_url !== payload.checkout_url.trim() ||
    payload.checkout_url.length > 4096 ||
    /[\u0000-\u001f\u007f]/.test(payload.checkout_url)
  ) {
    throw new TypeError("La sesión de pago del vehículo no es válida.");
  }
  return Object.freeze({ caseId, checkoutUrl: payload.checkout_url });
}
