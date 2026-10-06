import { CASE_ACCESS_HEADER, getCaseAccessToken, normalizeCaseId } from "./caseAccess.js";

export const REHEARSAL_BASE = "/api/ops/rehearsal/radar";
export const REHEARSAL_VERSION = "rtm_staging_radar_20261005_v1";
const CASE_ACTIONS = new Set(["authorize", "authorization-pdf", "upload-authorization-signed", "append-documents", "candidate-fixture"]);

export function rehearsalRequest(path, options = {}, tokenForCase = getCaseAccessToken) {
  if (path === "/cases/intake-draft" && options.method === "POST") {
    return { url: REHEARSAL_BASE + "/intake-draft", options };
  }
  const match = /^\/cases\/([0-9a-f-]+)\/([a-z-]+)$/.exec(path);
  const id = normalizeCaseId(match?.[1]);
  const action = match?.[2];
  const method = String(options.method || "GET").toUpperCase();
  if (!id || !CASE_ACTIONS.has(action) ||
      method !== (["authorization-pdf", "candidate-fixture"].includes(action) ? "GET" : "POST")) {
    throw new TypeError("La operación no pertenece al ensayo de radar.");
  }
  const token = tokenForCase(id);
  if (!token) throw new TypeError("Falta el acceso al expediente de ensayo.");
  const headers = new Headers(options.headers || {});
  headers.set(CASE_ACCESS_HEADER, token);
  return { url: `${REHEARSAL_BASE}/cases/${id}/${action}`, options: { ...options, headers } };
}

export async function rehearsalJson(response) {
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(typeof data?.detail === "string" ? data.detail : data?.detail?.message || "No se pudo completar el paso del ensayo.");
  if (!data || data.ok !== true) throw new Error("El servidor no confirmó el paso del ensayo.");
  return data;
}

export function parseRehearsalProgress(data, expectedCaseId = null) {
  const raw = data?.progress;
  const caseId = normalizeCaseId(raw?.case_id) || null;
  const status = raw?.authorization_evidence_status;
  if (data?.version !== REHEARSAL_VERSION || data?.synthetic_only !== true ||
      !raw || !["intake", "renewal", "review"].includes(raw.step) ||
      typeof raw.main_document_received !== "boolean" ||
      !["missing", "not_submitted", "pending_review", "verified", "rejected"].includes(status) ||
      (raw.case_id !== null && !caseId) ||
      (expectedCaseId && (!normalizeCaseId(expectedCaseId) || caseId !== normalizeCaseId(expectedCaseId))) ||
      data.existing_case_id !== raw.case_id ||
      (raw.step === "intake" ? raw.main_document_received : (!caseId || !raw.main_document_received)) ||
      (raw.step === "review" && !["pending_review", "verified"].includes(status))) {
    throw new TypeError("No se ha podido verificar el siguiente paso del ensayo.");
  }
  return { caseId, step: raw.step, mainDocumentReceived: raw.main_document_received, authorizationStatus: status };
}
