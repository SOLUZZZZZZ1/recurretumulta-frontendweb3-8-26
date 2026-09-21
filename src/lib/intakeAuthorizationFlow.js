import { normalizeCaseId } from "./caseAccess.js";

export const LOCAL_RTM_AUTHORIZATION_KIND = "rtm_generic_local";
export const LOCAL_RTM_AUTHORIZATION_VERSION = "rtm_generic_authorization_v1";
const LOCAL_CONSUMER_FAMILIES = new Set(["bancos", "energia", "telecomunicaciones", "seguros"]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256 = /^[0-9a-f]{64}$/i;
const LOCAL_BINDING_FIELDS = [
  "generated_document_id", "generated_document_sha256", "generated_document_version",
  "document_nonce", "issuance_attestation_sha256",
];
const isUuid = (value) => typeof value === "string" && UUID.test(value);
const isSha = (value) => typeof value === "string" && SHA256.test(value);

function exactKeys(value, expected) {
  return value && typeof value === "object" && !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...expected].sort());
}

export function intakeAuthorizationFlow({ department, caseType, family, localProfile = false }) {
  if (department === "traffic" && caseType === "vehicle_removal") return "vehicle_removal";
  if (department === "traffic" && caseType === "fine") return "dgt";
  if (localProfile === true && department === "claims" && caseType === "consumer" && LOCAL_CONSUMER_FAMILIES.has(family)) {
    return LOCAL_RTM_AUTHORIZATION_KIND;
  }
  return "unavailable";
}

export function localSyntheticIdentityError({ dni, email }) {
  if (dni !== "RTMTEST001") return "En esta prueba local utiliza el documento ficticio RTMTEST001.";
  if (!/^[^\s@]+@example\.com$/i.test(String(email || "").trim())) {
    return "En esta prueba local utiliza un email ficticio terminado en @example.com.";
  }
  return "";
}

export function authorizationRoutes(caseId, flow) {
  const id = normalizeCaseId(caseId);
  if (!id) throw new TypeError("Referencia de expediente no válida.");
  const base = `/cases/${id}`;
  if (flow === LOCAL_RTM_AUTHORIZATION_KIND) return {
    issue: `${base}/rtm-authorization`,
    pdf: `${base}/rtm-authorization-pdf`,
    candidate: `${base}/rtm-authorization-signed`,
    issueBody: { consent: true },
  };
  if (flow === "dgt") return {
    issue: `${base}/authorize`,
    pdf: `${base}/authorization-pdf`,
    candidate: `${base}/upload-authorization-signed`,
    issueBody: { authority_version: "v1_dgt_homologado", consent: true, representation_confirmed: true },
  };
  throw new TypeError("La autorización de este servicio todavía no está disponible en este entorno.");
}

function validLocalBinding(binding, caseId) {
  return exactKeys(binding, ["case_id", "authorization_kind", ...LOCAL_BINDING_FIELDS]) &&
    normalizeCaseId(binding.case_id) === caseId &&
    binding.authorization_kind === LOCAL_RTM_AUTHORIZATION_KIND &&
    isUuid(binding.generated_document_id) &&
    isSha(binding.generated_document_sha256) &&
    binding.generated_document_version === LOCAL_RTM_AUTHORIZATION_VERSION &&
    isUuid(binding.document_nonce) &&
    isSha(binding.issuance_attestation_sha256);
}

export function parseLocalAuthorizationIssue(payload, expectedCaseId) {
  const id = normalizeCaseId(expectedCaseId);
  if (!id || !exactKeys(payload, ["ok", "case_id", "authorized", "signed_authority_verified", "authorization_kind", "authorization_evidence_status", "authorization_document_binding"]) ||
      payload.ok !== true || normalizeCaseId(payload.case_id) !== id || payload.authorized !== false || payload.signed_authority_verified !== false ||
      payload.authorization_kind !== LOCAL_RTM_AUTHORIZATION_KIND || payload.authorization_evidence_status !== "document_issued" ||
      !validLocalBinding(payload.authorization_document_binding, id)) {
    throw new TypeError("La emisión de prueba no contiene una referencia válida a su PDF local.");
  }
  return { binding: Object.freeze({ ...payload.authorization_document_binding }) };
}

export function appendLocalAuthorizationBinding(formData, binding, expectedCaseId) {
  const id = normalizeCaseId(expectedCaseId);
  if (!id || !validLocalBinding(binding, id) || typeof formData?.append !== "function") {
    throw new TypeError("Falta la referencia del documento local generado.");
  }
  for (const field of LOCAL_BINDING_FIELDS) formData.append(field, binding[field]);
  return formData;
}

export function parseLocalAuthorizationCandidate(payload, expectedCaseId) {
  const id = normalizeCaseId(expectedCaseId);
  if (!id || !exactKeys(payload, ["ok", "case_id", "authorized", "signed_authority_verified", "authorization_kind", "authorization_evidence_status", "document_id", "document_sha256"]) ||
      payload.ok !== true || normalizeCaseId(payload.case_id) !== id || payload.authorized !== false ||
      payload.signed_authority_verified !== false || payload.authorization_kind !== LOCAL_RTM_AUTHORIZATION_KIND ||
      payload.authorization_evidence_status !== "pending_review" || !isUuid(payload.document_id) || !isSha(payload.document_sha256)) {
    throw new TypeError("El servidor no confirmó el candidato local pendiente de revisión.");
  }
  return { status: "pending_review", documentId: payload.document_id };
}

/** Keep the created draft before any authorization work. A failed issue or
 * download retries this same case and never posts a second intake. */
export async function continueIntakeAuthorization({ draft, createDraft, persistDraft, issueAuthorization, openAuthorization }) {
  let current = draft;
  if (!current) {
    current = await createDraft();
    persistDraft(current);
  }
  if (current.blockedMessage) throw new Error(current.blockedMessage);
  if (current.authorizationFlow === "vehicle_removal") return current;
  if (!current.authorizationBinding) {
    const issued = await issueAuthorization(current);
    if (!issued?.binding) throw new TypeError("No se ha confirmado el documento de autorización.");
    current = { ...current, authorizationBinding: issued.binding };
    persistDraft(current);
  }
  await openAuthorization(current);
  return current;
}
