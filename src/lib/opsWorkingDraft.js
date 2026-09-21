const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
export const WORKING_DRAFT_VERSION = "rtm_local_traffic_working_draft_v1";
export const PARKING_PREPARATION_VERSION = "rtm_traffic_parking_preparation_v1_0";
const PARKING_LINKS = {
  proof: "https://www.boe.es/buscar/act.php?id=BOE-A-2015-11722#a88",
  procedure: "https://www.boe.es/buscar/act.php?id=BOE-A-2015-11722#a93",
  parking: "https://www.boe.es/buscar/act.php?id=BOE-A-2003-23514#a94",
  access: "https://www.boe.es/buscar/act.php?id=BOE-A-2015-10565#a53",
};

export function parseParkingPreparation(guide, caseId) {
  if (guide == null) return null; // Compatible while the local backend restarts.
  const fail = () => { throw new Error("No se pudo comprobar la guía de estacionamiento. Recarga el borrador."); };
  if (guide.version !== PARKING_PREPARATION_VERSION || guide.case_id !== caseId ||
      guide.legal_review_pending !== true || guide.ready_to_submit !== false ||
      !["review_required", "unavailable"].includes(guide.status) ||
      !Array.isArray(guide.checks) || !Array.isArray(guide.references) ||
      typeof guide.message !== "string" || typeof guide.pending_text !== "string" ||
      guide.pending_text.length > 5500 || !/^\d{4}-\d{2}-\d{2}$/.test(guide.checked_on)) fail();
  if (guide.status === "unavailable") {
    if (guide.family !== null || guide.checks.length || guide.references.length || guide.pending_text || guide.reported_fact !== null) fail();
    return guide;
  }
  const validField = field => field && typeof field.key === "string" && typeof field.label === "string" &&
    (field.value === null || ["string", "number", "boolean"].includes(typeof field.value)) &&
    Array.isArray(field.sources) && (field.value === null ? field.sources.length === 0 : field.sources.length > 0) &&
    field.sources.every(source => UUID.test(source.document_id) && Number.isInteger(source.page_index) && source.page_index >= 0);
  const ids = ["procedure", "deadline", "location", "rule", "conditions", "evidence", "payment", "defense"];
  if (guide.family !== "estacionamiento" || !validField(guide.reported_fact) || guide.reported_fact.value === null ||
      !guide.pending_text || typeof guide.procedure_note !== "string" || typeof guide.payment_note !== "string" ||
      guide.checks.length !== ids.length || new Set(guide.checks.map(check => check.id)).size !== ids.length ||
      guide.references.length !== 4 || new Set(guide.references.map(ref => ref.id)).size !== 4) fail();
  for (const ref of guide.references) if (!Object.hasOwn(PARKING_LINKS, ref.id) || ref.url !== PARKING_LINKS[ref.id] || typeof ref.title !== "string") fail();
  for (const check of guide.checks) {
    if (!ids.includes(check.id) || typeof check.title !== "string" || typeof check.instruction !== "string" ||
        !Array.isArray(check.fields) || !check.fields.every(validField) ||
        !Array.isArray(check.reference_ids) || !check.reference_ids.every(id => Object.hasOwn(PARKING_LINKS, id))) fail();
  }
  return guide;
}

export function appendParkingChecks(current, guide) {
  if (guide?.status !== "review_required" || !guide.pending_text) throw new Error("La guía necesita hechos confirmados.");
  if (current.includes(guide.pending_text)) return current;
  const next = [current.trim(), guide.pending_text].filter(Boolean).join("\n\n");
  if (next.length > 6000) throw new Error("No caben todas las comprobaciones. Revisa las notas pendientes antes de añadirlas.");
  return next;
}

export function draftRoute(caseId) {
  if (!UUID.test(caseId)) throw new Error("Expediente no válido.");
  return `/api/ops/cases/${caseId}/working-draft`;
}

export function parseWorkingDraft(data, caseId) {
  const state = data?.working_draft;
  if (data?.ok !== true || data.case_id !== caseId || state?.case_id !== caseId ||
      state.version !== WORKING_DRAFT_VERSION || state.synthetic_only !== true ||
      !HASH.test(state.source_sha256) || !Array.isArray(state.blockers) ||
      !Array.isArray(state.history) || !Array.isArray(state.reviewed_facts) ||
      typeof state.can_prepare !== "boolean" || state.legal_review_pending !== true ||
      state.final_resource_generated !== false ||
      (state.latest_id !== null && !UUID.test(state.latest_id))) {
    throw new Error("No se pudo comprobar el estado del borrador.");
  }
  if ((state.can_prepare && state.blockers.length) ||
      (state.history[0]?.id || null) !== state.latest_id) throw new Error("Estado del borrador incoherente.");
  for (const entry of state.history) {
    if (!UUID.test(entry.id) || entry.case_id !== caseId || entry.status !== "working_draft" ||
        entry.synthetic_only !== true || typeof entry.content !== "string" ||
        !HASH.test(entry.pdf?.sha256) || !UUID.test(entry.pdf?.document_id) ||
        !Number.isInteger(entry.pdf?.size_bytes) || entry.pdf.size_bytes <= 0 || entry.pdf.size_bytes > 2097152) {
      throw new Error("No se pudo comprobar una versión del borrador.");
    }
  }
  parseParkingPreparation(state.preparation_guide, caseId);
  if (state.preparation_guide?.status === "review_required" && !state.can_prepare) throw new Error("La guía requiere revisar los hechos y la autorización.");
  return state;
}

export async function requestWorkingDraft({ authFetch, caseId, signal, body }) {
  const response = await authFetch(draftRoute(caseId), body ? {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal,
  } : { signal });
  const data = await response.json();
  if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Revisa los datos del borrador.");
  const state = parseWorkingDraft(data, caseId);
  if (body && (state.latest_id === body.expected_latest_id || state.source_sha256 !== body.expected_source_sha256 ||
      state.history[0]?.previous_id !== body.expected_latest_id)) throw new Error("No se pudo comprobar el guardado. Recarga antes de repetir.");
  return state;
}

export async function fetchWorkingDraftPdf({ authFetch, caseId, entry, signal }) {
  if (!UUID.test(entry?.id) || !HASH.test(entry.pdf?.sha256)) throw new Error("Versión del borrador no válida.");
  const response = await authFetch(`${draftRoute(caseId)}/${entry.id}/pdf`, { signal });
  if (!response.ok || response.headers.get("content-type")?.split(";")[0] !== "application/pdf") {
    throw new Error("No se puede abrir el PDF guardado. Recarga y comprueba su estado.");
  }
  const bytes = await response.arrayBuffer();
  const sha = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), n => n.toString(16).padStart(2, "0")).join("");
  if (bytes.byteLength !== entry.pdf.size_bytes || sha !== entry.pdf.sha256 ||
      response.headers.get("X-RTM-Document-SHA256") !== sha) throw new Error("El PDF recibido no coincide con la versión guardada.");
  return bytes;
}
