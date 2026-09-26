import { verifyFacts } from "./opsFactsReview.js";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
export const ACTIONS = Object.freeze({
  freeze_facts: "Cerrar hechos revisados", resolve_family: "Clasificar el expediente",
  lock_family: "Confirmar clasificación", build_preview: "Preparar previa del estudio",
});
export const STAGES = Object.freeze({
  facts_missing: "Hechos pendientes", facts_review: "Revisión de hechos",
  authority_conflict: "Versiones que requieren revisión", family_pending: "Clasificación pendiente",
  family_review: "Clasificación por revisar", specialist_missing: "Especialista pendiente",
  family_confirmation: "Confirmación de clasificación", preview_pending: "Previa pendiente",
  preview_available: "Previa del estudio disponible",
});
function assert(value, message = "No se pudo verificar el estudio. Recarga antes de continuar.") {
  if (!value) throw new Error(message);
}
function strings(value) { return Array.isArray(value) && value.every(item => typeof item === "string"); }
function record(value, caseId) {
  assert(value && UUID.test(value.id) && value.case_id === caseId && HASH.test(value.payload_sha256));
}
export function verifyStudy(data, caseId) {
  assert(UUID.test(caseId) && data?.ok === true && data.case_id === caseId && data.study_version === "rtm_ops_study_v1");
  assert(HASH.test(data.state_sha256) && Object.hasOwn(STAGES, data.stage) && strings(data.blockers));
  assert(data.next_action === null || Object.hasOwn(ACTIONS, data.next_action));
  assert(!data.blockers.length || data.next_action === null);
  if (data.facts) {
    verifyFacts(data.facts, caseId);
    assert(!data.facts.invalidated_at && data.facts.frozen === data.facts.facts.frozen);
    assert(data.facts.facts.source_document_ids.every(id => UUID.test(id)));
  }
  if (data.family) {
    record(data.family, caseId);
    const resolution = data.family.resolution;
    assert(resolution?.case_id === caseId && typeof data.family.locked === "boolean");
    assert(typeof resolution.family === "string" || resolution.family === null);
    assert(["resolved", "unresolved", "conflicted"].includes(resolution.status));
    assert(strings(resolution.conflicts) && strings(resolution.unresolved));
    assert(Array.isArray(resolution.evidence) && resolution.evidence.every(item => typeof item.description === "string"));
    if (data.stage !== "authority_conflict") assert(data.family.validated_facts_id === data.facts?.id && data.facts.frozen);
  }
  if (data.preview) {
    record(data.preview, caseId);
    const preview = data.preview.preview;
    assert(preview?.case_id === caseId && typeof preview.problem_summary === "string" && typeof preview.primary_strategy === "string");
    assert(["draft", "ops_review", "approved", "frozen", "changes_required", "invalidated"].includes(data.preview.status));
    assert(strings(preview.validated_facts_summary) && strings(preview.risks));
    assert(Array.isArray(preview.missing_items) && preview.missing_items.every(item => typeof item.description === "string"));
    assert(Array.isArray(preview.deadlines) && preview.deadlines.every(item => typeof item.label === "string" && typeof item.calculation_status === "string"));
    if (data.stage === "preview_available") assert(data.preview.validated_facts_id === data.facts?.id
      && data.preview.family_resolution_id === data.family?.id && data.family.locked);
  }
  const stages = { freeze_facts: "facts_review", resolve_family: "family_pending",
    lock_family: "family_confirmation", build_preview: "preview_pending" };
  if (data.next_action) {
    assert(data.stage === stages[data.next_action] && data.facts);
    assert(data.next_action === "freeze_facts" ? !data.facts.frozen : data.facts.frozen);
  }
  return data;
}
async function read(response) {
  if (!response.ok) {
    const message = response.status === 401 ? "La sesión ha caducado. Vuelve a identificarte."
      : response.status === 403 ? "Este paso requiere una sesión individual de supervisor."
      : response.status === 409 ? "El expediente ha cambiado o el paso está bloqueado. Recarga el estudio."
      : "No se pudo comprobar la operación. Recarga el estudio antes de continuar.";
    throw new Error(message);
  }
  return response.json();
}
export async function fetchStudy({ authFetch, caseId, signal }) {
  assert(UUID.test(caseId));
  return verifyStudy(await read(await authFetch(`/api/ops/core/cases/${caseId}/study`,
    { signal, cache: "no-store" })), caseId);
}
export function buildStudyAction(study, { confirmed, reviewNotes = "" }) {
  verifyStudy(study, study.case_id);
  assert(study.next_action && !study.blockers.length, "No hay un paso disponible en este estado.");
  assert(confirmed === true, "Confirma personalmente el paso antes de continuar.");
  const body = { action: study.next_action, expected_state_sha256: study.state_sha256, confirmed: true };
  if (body.action === "freeze_facts") {
    assert(reviewNotes.trim().length >= 3 && reviewNotes.trim().length <= 2000, "Describe la revisión documental realizada (entre 3 y 2000 caracteres).");
    assert(study.facts.facts.source_document_ids.length);
    body.document_review = { version: "rtm_document_review_attestation_v1_0",
      documents_reviewed: true, facts_reviewed: true,
      source_document_ids: [...study.facts.facts.source_document_ids],
      facts_payload_sha256: study.facts.payload_sha256, review_notes: reviewNotes.trim() };
  }
  return body;
}
export async function submitStudyAction({ authFetch, caseId, study, body, signal }) {
  verifyStudy(study, caseId);
  assert(body.action === study.next_action && body.expected_state_sha256 === study.state_sha256 && body.confirmed === true);
  const saved = verifyStudy(await read(await authFetch(`/api/ops/core/cases/${caseId}/study/actions`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal,
  })), caseId);
  assert(saved.completed_action === body.action && saved.previous_state_sha256 === study.state_sha256
    && saved.state_sha256 !== study.state_sha256, "No se pudo comprobar el paso guardado. Recarga el estudio.");
  assert(saved.facts?.id === study.facts.id);
  if (body.action === "freeze_facts") assert(saved.facts.frozen === true);
  if (body.action === "resolve_family") assert(saved.family && saved.family.validated_facts_id === study.facts.id);
  if (body.action === "lock_family") assert(saved.family?.id === study.family.id && saved.family.locked === true);
  if (body.action === "build_preview") assert(saved.preview?.status === "draft"
    && saved.preview.validated_facts_id === study.facts.id && saved.preview.family_resolution_id === study.family.id);
  return saved;
}
