import { normalizeCaseId } from "./caseAccess.js";

export const OPS_REAUTHENTICATE_ROUTE = "/api/ops/auth/reauthenticate";
export const AUTHORIZATION_VIEW_WINDOW_MS = 14 * 60 * 1000;

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_JSON_BYTES = 65_536;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;

const DOCUMENT_KEYS = Object.freeze([
  "created_at",
  "custody",
  "id",
  "kind",
  "mime",
  "operator_export_allowed",
  "sha256",
  "size_bytes",
]);
const EVENT_KEYS = Object.freeze(["created_at", "payload", "type"]);
const ENVELOPE_KEYS = Object.freeze([
  "material",
  "material_sha256",
  "signature_sha256",
]);
const MATERIAL_KEYS = Object.freeze([
  "authority_id",
  "authority_material_sha256",
  "authority_version",
  "candidate_document_id",
  "candidate_document_sha256",
  "case_id",
  "document_nonce",
  "format",
  "issuance_attestation_sha256",
  "issued_document_id",
  "issued_document_sha256",
  "issued_document_version",
  "mime",
  "review_status",
  "size_bytes",
  "uploaded_at",
]);
const REVIEW_CHECK_KEYS = Object.freeze([
  "generatedDocumentMatches",
  "identityMatches",
  "reviewedEntireDocument",
  "signaturePresent",
]);
const REAUTH_RESPONSE_KEYS = Object.freeze([
  "ok",
  "reauthenticated_at",
  "request_id",
  "session_id",
  "status",
]);
const REVIEW_RESPONSE_KEYS = Object.freeze([
  "authorization_evidence_status",
  "candidate_document_id",
  "case_id",
  "ok",
  "signed_authority_verified",
]);
const REJECTION_REASONS = new Set([
  "document_mismatch",
  "identity_mismatch",
  "signature_missing",
  "illegible",
  "suspected_tampering",
]);

export class OpsAuthorizationReviewError extends Error {
  constructor(code, message, status = null) {
    super(message);
    this.name = "OpsAuthorizationReviewError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, message, status = null) {
  throw new OpsAuthorizationReviewError(code, message, status);
}

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactKeys(value, expected) {
  if (!isPlainObject(value)) return false;
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  return actual.length === wanted.length && actual.every((key, index) => key === wanted[index]);
}

function requireUuid(value, message) {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    fail("authorization_review.contract_invalid", message);
  }
  return value;
}

function requireSha256(value, message) {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    fail("authorization_review.contract_invalid", message);
  }
  return value;
}

function requireTimestamp(value, message) {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !ISO_TIMESTAMP_PATTERN.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    fail("authorization_review.contract_invalid", message);
  }
  return value;
}

function normalizedExpectedCaseId(value) {
  const caseId = normalizeCaseId(value);
  if (!caseId) {
    fail(
      "authorization_review.case_invalid",
      "El expediente de revisión no es válido."
    );
  }
  return caseId;
}

function parseCandidateDocument(value) {
  if (
    !exactKeys(value, DOCUMENT_KEYS) ||
    value.kind !== "authorization_signed_candidate" ||
    value.mime !== "application/pdf" ||
    value.custody !== "rtm_internal_only" ||
    value.operator_export_allowed !== false ||
    !Number.isSafeInteger(value.size_bytes) ||
    value.size_bytes < 1 ||
    value.size_bytes > MAX_PDF_BYTES
  ) {
    fail(
      "authorization_review.document_invalid",
      "El candidato de autorización no cumple el contrato de custodia."
    );
  }
  return Object.freeze({
    id: requireUuid(value.id, "El identificador del candidato no es válido."),
    sha256: requireSha256(value.sha256, "La huella del candidato no es válida."),
    sizeBytes: value.size_bytes,
    createdAt: requireTimestamp(
      value.created_at,
      "La fecha del candidato no es válida."
    ),
  });
}

function parseCandidateEvent(value, expectedCaseId) {
  if (
    !exactKeys(value, EVENT_KEYS) ||
    value.type !== "authorization_signature_candidate_uploaded" ||
    !exactKeys(value.payload, ENVELOPE_KEYS) ||
    !exactKeys(value.payload.material, MATERIAL_KEYS)
  ) {
    fail(
      "authorization_review.attestation_invalid",
      "La atestación del candidato no cumple el contrato esperado."
    );
  }

  const material = value.payload.material;
  if (
    material.format !== "rtm_authorization_signature_candidate_v1" ||
    material.authority_version !== "v1_dgt_homologado" ||
    material.issued_document_version !== "v1_dgt_homologado" ||
    material.mime !== "application/pdf" ||
    material.review_status !== "pending_review" ||
    normalizeCaseId(material.case_id) !== expectedCaseId ||
    !Number.isSafeInteger(material.size_bytes) ||
    material.size_bytes < 1 ||
    material.size_bytes > MAX_PDF_BYTES
  ) {
    fail(
      "authorization_review.attestation_invalid",
      "La atestación no corresponde a una autorización pendiente de este expediente."
    );
  }

  const parsedMaterial = Object.freeze({
    ...material,
    authority_id: requireUuid(
      material.authority_id,
      "La autoridad del candidato no es válida."
    ),
    authority_material_sha256: requireSha256(
      material.authority_material_sha256,
      "La huella de autoridad del candidato no es válida."
    ),
    issued_document_id: requireUuid(
      material.issued_document_id,
      "El documento emitido del candidato no es válido."
    ),
    issued_document_sha256: requireSha256(
      material.issued_document_sha256,
      "La huella del documento emitido no es válida."
    ),
    document_nonce: requireUuid(
      material.document_nonce,
      "El nonce del candidato no es válido."
    ),
    issuance_attestation_sha256: requireSha256(
      material.issuance_attestation_sha256,
      "La huella de emisión del candidato no es válida."
    ),
    candidate_document_id: requireUuid(
      material.candidate_document_id,
      "El documento candidato no es válido."
    ),
    candidate_document_sha256: requireSha256(
      material.candidate_document_sha256,
      "La huella del documento candidato no es válida."
    ),
    uploaded_at: requireTimestamp(
      material.uploaded_at,
      "La fecha de subida del candidato no es válida."
    ),
  });

  const eventCreatedAt = requireTimestamp(
    value.created_at,
    "La fecha de atestación del candidato no es válida."
  );
  if (Math.abs(Date.parse(eventCreatedAt) - Date.parse(parsedMaterial.uploaded_at)) > 300_000) {
    fail(
      "authorization_review.attestation_invalid",
      "La atestación y la subida del candidato no son coherentes."
    );
  }

  return Object.freeze({
    material: parsedMaterial,
    materialSha256: requireSha256(
      value.payload.material_sha256,
      "La huella de atestación del candidato no es válida."
    ),
    signatureSha256: requireSha256(
      value.payload.signature_sha256,
      "La firma de atestación del candidato no es válida."
    ),
    eventCreatedAt,
  });
}

function candidateKey(candidate) {
  return `${candidate.documentId}:${candidate.attestationSha256}`;
}

/**
 * Joins the protected document projection with its server-signed upload event.
 * Missing, duplicated or contradictory evidence blocks review.
 */
export function resolvePendingAuthorizationCandidates({
  caseId,
  documents,
  events,
} = {}) {
  const expectedCaseId = normalizedExpectedCaseId(caseId);
  if (!Array.isArray(documents) || !Array.isArray(events)) {
    fail(
      "authorization_review.projection_invalid",
      "No se pudo comprobar la evidencia completa del candidato."
    );
  }

  const candidateDocuments = documents
    .filter((item) => item?.kind === "authorization_signed_candidate")
    .map(parseCandidateDocument);
  if (!candidateDocuments.length) return Object.freeze([]);

  const candidateEvents = events
    .filter((item) => item?.type === "authorization_signature_candidate_uploaded")
    .map((item) => parseCandidateEvent(item, expectedCaseId));
  const byDocumentId = new Map();
  for (const event of candidateEvents) {
    const id = event.material.candidate_document_id;
    if (byDocumentId.has(id)) {
      fail(
        "authorization_review.attestation_ambiguous",
        "Hay más de una atestación para el mismo candidato."
      );
    }
    byDocumentId.set(id, event);
  }

  const result = candidateDocuments.map((document) => {
    const event = byDocumentId.get(document.id);
    if (!event) {
      fail(
        "authorization_review.attestation_missing",
        "No aparece la atestación exacta del candidato en el historial disponible."
      );
    }
    if (
      event.material.candidate_document_sha256 !== document.sha256 ||
      event.material.size_bytes !== document.sizeBytes
    ) {
      fail(
        "authorization_review.binding_mismatch",
        "El documento candidato y su atestación no coinciden."
      );
    }
    const candidate = {
      caseId: expectedCaseId,
      documentId: document.id,
      documentSha256: document.sha256,
      sizeBytes: document.sizeBytes,
      createdAt: document.createdAt,
      uploadedAt: event.material.uploaded_at,
      eventCreatedAt: event.eventCreatedAt,
      attestationSha256: event.materialSha256,
      signatureSha256: event.signatureSha256,
      material: event.material,
    };
    return Object.freeze({ ...candidate, key: candidateKey(candidate) });
  });

  result.sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  return Object.freeze(result);
}

function canonicalJson(value) {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(canonicalJson).join(",")}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  fail(
    "authorization_review.canonicalization_failed",
    "La atestación no se puede verificar de forma canónica."
  );
}

async function sha256Hex(value, cryptoImpl = globalThis.crypto) {
  if (!cryptoImpl?.subtle?.digest) {
    fail(
      "authorization_review.crypto_unavailable",
      "El navegador no permite verificar la huella del documento."
    );
  }
  const bytes =
    typeof value === "string"
      ? new TextEncoder().encode(value)
      : value instanceof Uint8Array
        ? value
        : new Uint8Array(value);
  const digest = await cryptoImpl.subtle.digest(
    "SHA-256",
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength)
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyAuthorizationCandidateAttestation(
  candidate,
  cryptoImpl = globalThis.crypto
) {
  if (!candidate || typeof candidate !== "object" || !isPlainObject(candidate.material)) {
    fail(
      "authorization_review.candidate_invalid",
      "El candidato seleccionado no es válido."
    );
  }
  const digest = await sha256Hex(canonicalJson(candidate.material), cryptoImpl);
  if (digest !== candidate.attestationSha256) {
    fail(
      "authorization_review.attestation_digest_mismatch",
      "La huella canónica de la atestación no coincide."
    );
  }
  return true;
}

async function readBytesLimited(response, maxBytes) {
  const rawLength = response.headers?.get?.("content-length");
  if (rawLength) {
    const announced = Number(rawLength);
    if (!Number.isSafeInteger(announced) || announced < 0 || announced > maxBytes) {
      fail(
        "authorization_review.response_too_large",
        "La respuesta supera el tamaño permitido."
      );
    }
  }

  if (response.body?.getReader) {
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
        total += chunk.byteLength;
        if (total > maxBytes) {
          await reader.cancel().catch(() => {});
          fail(
            "authorization_review.response_too_large",
            "La respuesta supera el tamaño permitido."
          );
        }
        chunks.push(chunk);
      }
    } finally {
      reader.releaseLock?.();
    }
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      result.set(chunk, offset);
      offset += chunk.byteLength;
    }
    return result;
  }

  const result = new Uint8Array(await response.arrayBuffer());
  if (result.byteLength > maxBytes) {
    fail(
      "authorization_review.response_too_large",
      "La respuesta supera el tamaño permitido."
    );
  }
  return result;
}

function safeServerMessage(payload, fallback) {
  const detail = payload?.detail;
  if (
    typeof detail === "string" &&
    detail.length > 0 &&
    detail.length <= 500 &&
    !CONTROL_PATTERN.test(detail)
  ) {
    return detail;
  }
  return fallback;
}

async function readJsonResponse(response, operation) {
  if (!response || typeof response.ok !== "boolean") {
    fail(
      `authorization_review.${operation}_response_invalid`,
      "El servidor no respondió con un contrato válido."
    );
  }
  const bytes = await readBytesLimited(response, MAX_JSON_BYTES);
  let payload;
  try {
    payload = bytes.byteLength
      ? JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes))
      : {};
  } catch {
    fail(
      `authorization_review.${operation}_response_invalid`,
      "El servidor devolvió una respuesta no válida.",
      response.status ?? null
    );
  }
  if (!response.ok) {
    fail(
      `authorization_review.${operation}_rejected`,
      safeServerMessage(payload, "El servidor rechazó la operación de revisión."),
      response.status ?? null
    );
  }
  return payload;
}

function candidateViewRoute(candidate) {
  return `/api/ops/cases/${encodeURIComponent(candidate.caseId)}/authorization-signature-candidate/${encodeURIComponent(candidate.documentId)}`;
}

export async function fetchVerifiedAuthorizationCandidatePdf({
  authFetch,
  candidate,
  signal = null,
  cryptoImpl = globalThis.crypto,
} = {}) {
  if (typeof authFetch !== "function") {
    fail(
      "authorization_review.transport_required",
      "No hay transporte autenticado disponible."
    );
  }
  await verifyAuthorizationCandidateAttestation(candidate, cryptoImpl);

  let response;
  const requestedAt = Date.now();
  try {
    response = await authFetch(candidateViewRoute(candidate), {
      method: "GET",
      headers: { Accept: "application/pdf" },
      signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      fail("authorization_review.request_aborted", "Operación cancelada.");
    }
    if (error instanceof OpsAuthorizationReviewError) throw error;
    fail(
      "authorization_review.view_transport_failed",
      "No se pudo abrir el candidato de autorización."
    );
  }

  if (!response?.ok) {
    await readJsonResponse(response, "view");
  }
  const contentType = String(response.headers?.get?.("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  const cacheControl = String(response.headers?.get?.("cache-control") || "").toLowerCase();
  const disposition = String(response.headers?.get?.("content-disposition") || "");
  if (
    response.status !== 200 ||
    contentType !== "application/pdf" ||
    !cacheControl.includes("no-store") ||
    String(response.headers?.get?.("x-content-type-options") || "").toLowerCase() !==
      "nosniff" ||
    disposition !==
      `inline; filename="authorization_candidate_${candidate.documentId}.pdf"`
  ) {
    fail(
      "authorization_review.pdf_contract_invalid",
      "El visor recibió un documento con cabeceras no válidas."
    );
  }

  const bytes = await readBytesLimited(response, MAX_PDF_BYTES);
  if (
    bytes.byteLength !== candidate.sizeBytes ||
    new TextDecoder("ascii").decode(bytes.subarray(0, 5)) !== "%PDF-"
  ) {
    fail(
      "authorization_review.pdf_contract_invalid",
      "El PDF recibido no coincide con el candidato custodiado."
    );
  }
  const digest = await sha256Hex(bytes, cryptoImpl);
  if (digest !== candidate.documentSha256) {
    fail(
      "authorization_review.pdf_digest_mismatch",
      "La huella del PDF recibido no coincide con la atestación."
    );
  }
  return Object.freeze({ bytes, mime: "application/pdf", fetchedAt: requestedAt });
}

export function isAuthorizationViewFresh(
  receipt,
  candidate,
  now = Date.now()
) {
  if (
    !receipt ||
    !candidate ||
    receipt.candidateKey !== candidate.key ||
    !Number.isFinite(receipt.viewedAt) ||
    !Number.isFinite(now)
  ) {
    return false;
  }
  const age = now - receipt.viewedAt;
  return age >= 0 && age < AUTHORIZATION_VIEW_WINDOW_MS;
}

export function buildAuthorizationReviewBody({
  decision,
  candidate,
  checks,
  reasonCode = null,
} = {}) {
  if (
    !candidate ||
    !UUID_PATTERN.test(String(candidate.documentId || "")) ||
    !SHA256_PATTERN.test(String(candidate.attestationSha256 || "")) ||
    !exactKeys(checks, REVIEW_CHECK_KEYS) ||
    checks.reviewedEntireDocument !== true ||
    typeof checks.generatedDocumentMatches !== "boolean" ||
    typeof checks.identityMatches !== "boolean" ||
    typeof checks.signaturePresent !== "boolean"
  ) {
    fail(
      "authorization_review.checklist_incomplete",
      "Completa la revisión exacta antes de decidir."
    );
  }

  if (decision === "approve") {
    if (
      checks.generatedDocumentMatches !== true ||
      checks.identityMatches !== true ||
      checks.signaturePresent !== true ||
      reasonCode !== null
    ) {
      fail(
        "authorization_review.approval_invalid",
        "La aprobación exige documento, identidad y firma verificados."
      );
    }
  } else if (decision === "reject") {
    if (!REJECTION_REASONS.has(reasonCode)) {
      fail(
        "authorization_review.rejection_reason_required",
        "Selecciona un motivo estructurado de rechazo."
      );
    }
  } else {
    fail(
      "authorization_review.decision_invalid",
      "La decisión de revisión no es válida."
    );
  }

  return Object.freeze({
    decision,
    candidate_document_id: candidate.documentId,
    candidate_attestation_sha256: candidate.attestationSha256,
    reviewed_entire_document: true,
    generated_document_matches: checks.generatedDocumentMatches,
    identity_matches: checks.identityMatches,
    signature_present: checks.signaturePresent,
    reason_code: decision === "approve" ? null : reasonCode,
  });
}

function requirePassword(value) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 256 ||
    value.includes("\0")
  ) {
    fail(
      "authorization_review.password_invalid",
      "La contraseña de reautenticación no es válida."
    );
  }
  return value;
}

export async function reauthenticateAuthorizationReviewer({
  authFetch,
  password,
  expectedSessionId,
  signal = null,
} = {}) {
  if (typeof authFetch !== "function") {
    fail(
      "authorization_review.transport_required",
      "No hay transporte autenticado disponible."
    );
  }
  const sessionId = requireUuid(
    String(expectedSessionId || ""),
    "La sesión de revisión no es válida."
  );
  let response;
  try {
    response = await authFetch(OPS_REAUTHENTICATE_ROUTE, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: requirePassword(password) }),
      signal,
    });
  } catch (error) {
    if (signal?.aborted) {
      fail("authorization_review.request_aborted", "Operación cancelada.");
    }
    if (error instanceof OpsAuthorizationReviewError) throw error;
    fail(
      "authorization_review.reauthentication_transport_failed",
      "No se pudo reautenticar al supervisor."
    );
  }
  const payload = await readJsonResponse(response, "reauthentication");
  if (
    !exactKeys(payload, REAUTH_RESPONSE_KEYS) ||
    payload.ok !== true ||
    payload.status !== "reauthenticated" ||
    payload.session_id !== sessionId ||
    typeof payload.request_id !== "string" ||
    payload.request_id.length < 1 ||
    payload.request_id.length > 120 ||
    CONTROL_PATTERN.test(payload.request_id)
  ) {
    fail(
      "authorization_review.reauthentication_contract_invalid",
      "El servidor no confirmó la misma sesión supervisora."
    );
  }
  return Object.freeze({
    sessionId,
    reauthenticatedAt: requireTimestamp(
      payload.reauthenticated_at,
      "La fecha de reautenticación no es válida."
    ),
    requestId: payload.request_id,
  });
}

export async function submitAuthorizationReview({
  authFetch,
  caseId,
  candidate,
  decision,
  checks,
  reasonCode = null,
  signal = null,
} = {}) {
  if (typeof authFetch !== "function") {
    fail(
      "authorization_review.transport_required",
      "No hay transporte autenticado disponible."
    );
  }
  const expectedCaseId = normalizedExpectedCaseId(caseId);
  if (candidate?.caseId !== expectedCaseId) {
    fail(
      "authorization_review.case_mismatch",
      "El candidato ya no corresponde al expediente activo."
    );
  }
  const body = buildAuthorizationReviewBody({
    decision,
    candidate,
    checks,
    reasonCode,
  });
  let response;
  try {
    response = await authFetch(
      `/api/ops/cases/${encodeURIComponent(expectedCaseId)}/authorization-signature-review`,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal,
      }
    );
  } catch (error) {
    if (signal?.aborted) {
      fail("authorization_review.request_aborted", "Operación cancelada.");
    }
    if (error instanceof OpsAuthorizationReviewError) throw error;
    fail(
      "authorization_review.review_transport_failed",
      "No se pudo registrar la decisión de revisión."
    );
  }
  const payload = await readJsonResponse(response, "review");
  const expectedStatus = decision === "approve" ? "verified" : "rejected";
  const expectedVerified = decision === "approve";
  if (
    !exactKeys(payload, REVIEW_RESPONSE_KEYS) ||
    payload.ok !== true ||
    normalizeCaseId(payload.case_id) !== expectedCaseId ||
    payload.candidate_document_id !== candidate.documentId ||
    payload.authorization_evidence_status !== expectedStatus ||
    payload.signed_authority_verified !== expectedVerified
  ) {
    fail(
      "authorization_review.review_contract_invalid",
      "El servidor no confirmó exactamente la decisión registrada."
    );
  }
  return Object.freeze({
    decision,
    caseId: expectedCaseId,
    candidateDocumentId: candidate.documentId,
    authorizationEvidenceStatus: expectedStatus,
    signedAuthorityVerified: expectedVerified,
  });
}
