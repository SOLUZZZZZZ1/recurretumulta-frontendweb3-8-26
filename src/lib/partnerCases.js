import { normalizeCaseId } from "./caseAccess.js";

export const PARTNER_CASE_PAGE_LIMIT = 250;
export const PARTNER_CASE_RESPONSE_MAX_BYTES = 512 * 1024;
export const PARTNER_SEARCH_MAX_CHARS = 160;

const STATUS_PATTERN = /^[a-z][a-z0-9_-]{0,63}$/;
const CURSOR_PATTERN = /^[A-Za-z0-9_-]{16,256}$/;
const AUTHORIZATION_EVIDENCE_STATUSES = new Set([
  "verified",
  "pending_review",
  "rejected",
  "not_submitted",
]);
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;
const ENVELOPE_KEYS = ["items", "next_cursor", "ok", "partner_name"];

function boundedText(value, maxLength, { empty = true } = {}) {
  if (typeof value !== "string" || CONTROL_PATTERN.test(value)) return null;
  const clean = value.trim();
  if ((!empty && !clean) || clean.length > maxLength) return null;
  return clean;
}

function exactKeys(value, expected) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort())
  );
}

function projectPartnerCase(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const caseId = normalizeCaseId(item.case_id);
  const clientName = boundedText(item.client_name, 160);
  const clientEmail = boundedText(item.client_email, 254);
  const status = boundedText(item.status, 64, { empty: false });
  const paymentStatus = boundedText(item.payment_status, 64, { empty: false });
  const updatedAt = boundedText(item.updated_at, 64);
  const authorizationMode = boundedText(item.authorization_mode, 64);
  const authorizationEvidenceStatus = boundedText(
    item.authorization_evidence_status,
    32,
    { empty: false }
  );
  const docsTotal = item.docs_total;
  if (
    !caseId ||
    clientName == null ||
    clientEmail == null ||
    !status ||
    !STATUS_PATTERN.test(status) ||
    !paymentStatus ||
    !STATUS_PATTERN.test(paymentStatus) ||
    updatedAt == null ||
    authorizationMode == null ||
    typeof item.authorization_received !== "boolean" ||
    typeof item.authorization_document_uploaded !== "boolean" ||
    typeof item.authorization_verified !== "boolean" ||
    !AUTHORIZATION_EVIDENCE_STATUSES.has(authorizationEvidenceStatus) ||
    item.authorization_verified !== (authorizationEvidenceStatus === "verified") ||
    !Number.isSafeInteger(docsTotal) ||
    docsTotal < 0 ||
    docsTotal > 1_000_000
  ) {
    return null;
  }
  return {
    case_id: caseId,
    client_name: clientName,
    client_email: clientEmail,
    status,
    payment_status: paymentStatus,
    updated_at: updatedAt || null,
    authorization_mode: authorizationMode,
    authorization_received: item.authorization_received,
    authorization_document_uploaded: item.authorization_document_uploaded,
    authorization_verified: item.authorization_verified,
    authorization_evidence_status: authorizationEvidenceStatus,
    docs_total: docsTotal,
  };
}

export function parsePartnerCasesEnvelope(payload) {
  if (!exactKeys(payload, ENVELOPE_KEYS) || payload.ok !== true) {
    throw new TypeError("Respuesta partner no válida.");
  }
  const partnerName = boundedText(payload.partner_name, 160, { empty: false });
  if (
    !partnerName ||
    !Array.isArray(payload.items) ||
    payload.items.length > PARTNER_CASE_PAGE_LIMIT
  ) {
    throw new TypeError("Respuesta partner fuera de límites.");
  }
  const items = payload.items.map(projectPartnerCase);
  if (items.some((item) => !item)) {
    throw new TypeError("Expediente partner no válido.");
  }
  const cursor = payload.next_cursor;
  if (cursor !== null && (typeof cursor !== "string" || !CURSOR_PATTERN.test(cursor))) {
    throw new TypeError("Cursor partner no válido.");
  }
  return { partnerName, items, nextCursor: cursor };
}

export function normalizePartnerSearch(value) {
  const clean = boundedText(String(value || ""), PARTNER_SEARCH_MAX_CHARS);
  return clean == null ? "" : clean;
}
