import { normalizeCaseId } from "./caseAccess.js";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[a-f0-9]{64}$/i;
const VERSION = "v1_dgt_homologado";
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;

const ISSUE_KEYS = [
  "authorization_document_binding",
  "authorization_pdf",
  "authority_id",
  "authority_material_sha256",
  "authority_version",
  "authorized",
  "case_id",
  "ok",
];
const PDF_KEYS = ["custody", "id", "mime", "sha256", "size_bytes"];
const BINDING_KEYS = [
  "authority_material_sha256",
  "document_nonce",
  "generated_document_id",
  "generated_document_sha256",
  "generated_document_version",
  "issuance_attestation_sha256",
];
const UPLOAD_KEYS = [
  "authorization_evidence",
  "authorized",
  "case_id",
  "ok",
  "signed_authority_verified",
];
const EVIDENCE_KEYS = [
  "candidate_attestation_sha256",
  "candidate_document",
  "status",
];

export function isAuthorizationVerified(status) {
  return Boolean(
    status?.authorization_evidence_status === "verified" &&
      status?.signed_authority_verified === true
  );
}

export function isVehicleRemovalCase(status) {
  const caseType = String(
    status?.case_type || status?.interested_data?.case_type || ""
  )
    .trim()
    .toLowerCase();
  const operationalStatus = String(status?.status || "").trim().toLowerCase();
  return (
    caseType === "vehicle_removal" ||
    operationalStatus.startsWith("vehicle_removal_")
  );
}

/**
 * The vehicle-removal v3 checkbox authorizes only preparation of the service;
 * it is never evidence of legal representation. Keep that distinction even
 * if a legacy backend projection also exposes `authorized: true`.
 */
export function isLegalRepresentationVerified(status) {
  return !isVehicleRemovalCase(status) && isAuthorizationVerified(status);
}

export function hasVehiclePreparationConsent(status) {
  return (
    isVehicleRemovalCase(status) &&
    status?.vehicle_preparation_consent === true
  );
}

export function isAuthorizationPendingReview(status) {
  return Boolean(
    status?.authorization_evidence_status === "pending_review" &&
      status?.signed_authority_verified === false
  );
}

function exactKeys(value, expected) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort())
  );
}

function isUuid(value) {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

function isSha(value) {
  return typeof value === "string" && SHA256_PATTERN.test(value);
}

function isBoundedText(value, maxLength = 80) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maxLength &&
    !CONTROL_PATTERN.test(value)
  );
}

function parsePdf(value) {
  if (
    !exactKeys(value, PDF_KEYS) ||
    !isUuid(value.id) ||
    !isSha(value.sha256) ||
    value.mime !== "application/pdf" ||
    !Number.isSafeInteger(value.size_bytes) ||
    value.size_bytes < 1 ||
    value.size_bytes > 10 * 1024 * 1024 ||
    !isBoundedText(value.custody)
  ) {
    throw new TypeError("Artefacto de autorización no válido.");
  }
  return {
    id: value.id.toLowerCase(),
    sha256: value.sha256.toLowerCase(),
    mime: value.mime,
    sizeBytes: value.size_bytes,
    custody: value.custody,
  };
}

export function parseAuthorizationIssueEnvelope(payload, expectedCaseId) {
  const caseId = normalizeCaseId(expectedCaseId);
  if (
    !caseId ||
    !exactKeys(payload, ISSUE_KEYS) ||
    payload.ok !== true ||
    payload.authorized !== true ||
    normalizeCaseId(payload.case_id) !== caseId ||
    !isUuid(payload.authority_id) ||
    payload.authority_version !== VERSION ||
    !isSha(payload.authority_material_sha256) ||
    !exactKeys(payload.authorization_document_binding, BINDING_KEYS)
  ) {
    throw new TypeError("Emisión de autorización no válida.");
  }
  const pdf = parsePdf(payload.authorization_pdf);
  const binding = payload.authorization_document_binding;
  if (
    !isSha(binding.authority_material_sha256) ||
    binding.authority_material_sha256.toLowerCase() !==
      payload.authority_material_sha256.toLowerCase() ||
    !isUuid(binding.generated_document_id) ||
    binding.generated_document_id.toLowerCase() !== pdf.id ||
    !isSha(binding.generated_document_sha256) ||
    binding.generated_document_sha256.toLowerCase() !== pdf.sha256 ||
    binding.generated_document_version !== VERSION ||
    !isUuid(binding.document_nonce) ||
    !isSha(binding.issuance_attestation_sha256)
  ) {
    throw new TypeError("La autorización no está ligada a su documento.");
  }
  return {
    pdf,
    binding: {
      authority_material_sha256: binding.authority_material_sha256.toLowerCase(),
      generated_document_id: binding.generated_document_id.toLowerCase(),
      generated_document_sha256: binding.generated_document_sha256.toLowerCase(),
      generated_document_version: binding.generated_document_version,
      document_nonce: binding.document_nonce.toLowerCase(),
      issuance_attestation_sha256: binding.issuance_attestation_sha256.toLowerCase(),
    },
  };
}

export function appendAuthorizationDocumentBinding(formData, binding) {
  if (!formData || typeof formData.append !== "function") {
    throw new TypeError("Formulario de autorización no válido.");
  }
  if (!exactKeys(binding, BINDING_KEYS)) {
    throw new TypeError("Falta la ligadura del documento generado.");
  }
  for (const field of BINDING_KEYS) formData.append(field, binding[field]);
  return formData;
}

export function parseAuthorizationCandidateEnvelope(payload, expectedCaseId) {
  const caseId = normalizeCaseId(expectedCaseId);
  if (
    !caseId ||
    !exactKeys(payload, UPLOAD_KEYS) ||
    payload.ok !== true ||
    payload.authorized !== true ||
    payload.signed_authority_verified !== false ||
    normalizeCaseId(payload.case_id) !== caseId ||
    !exactKeys(payload.authorization_evidence, EVIDENCE_KEYS) ||
    payload.authorization_evidence.status !== "pending_review" ||
    !isSha(payload.authorization_evidence.candidate_attestation_sha256)
  ) {
    throw new TypeError("Evidencia de autorización no válida.");
  }
  return {
    status: "pending_review",
    candidateDocument: parsePdf(payload.authorization_evidence.candidate_document),
  };
}
