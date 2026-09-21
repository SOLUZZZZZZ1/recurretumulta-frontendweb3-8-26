const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;

export const FACT_FIELDS = Object.freeze({
  organismo: ["Organismo", "text"], expediente_ref: ["Referencia del expediente", "text"],
  matricula: ["Matrícula", "text"], hecho_denunciado_literal: ["Hecho denunciado", "text"],
  lugar_infraccion: ["Lugar de la infracción", "text"], hora_infraccion: ["Hora", "text"],
  tipo_documento: ["Tipo de documento", "text"], fase_procedimental: ["Fase del procedimiento", "text"],
  norma_hint: ["Norma indicada", "text"], articulo_infringido_num: ["Artículo", "text"],
  apartado_infringido_num: ["Apartado", "text"], fecha_notificacion: ["Fecha de notificación", "date"],
  fecha_documento: ["Fecha del documento", "date"], fecha_infraccion: ["Fecha de la infracción", "date"],
  fecha_limite: ["Fecha límite", "date"], sancion_importe_eur: ["Sanción (€)", "number"],
  importe_reducido_eur: ["Importe reducido (€)", "number"], velocidad_medida_kmh: ["Velocidad medida (km/h)", "number"],
  velocidad_limite_kmh: ["Velocidad límite (km/h)", "number"], puntos_detraccion: ["Puntos", "integer"],
  plazo_pago_dias: ["Plazo de pago (días)", "integer"],
  ordenanza_aplicable: ["Ordenanza indicada", "text"],
  senalizacion_estacionamiento: ["Señalización del estacionamiento", "text"],
  horario_estacionamiento: ["Horario del estacionamiento", "text"],
  autorizacion_estacionamiento: ["Permiso o tique de estacionamiento", "text"],
  tipo_denunciante: ["Tipo de denunciante", "text"],
  prueba_estacionamiento: ["Prueba documental del estacionamiento", "text"],
  contradiccion_estacionamiento: ["Contradicción documentada", "text"],
  pago_multa_reducido: ["Multa pagada con reducción", "boolean"],
  fotografia_vehiculo_presente: ["Fotografía del vehículo en la documentación", "boolean"],
});

export const FACT_GROUPS = Object.freeze([
  { label: "Expediente y trámite", fields: ["organismo", "expediente_ref", "matricula", "hecho_denunciado_literal", "tipo_documento", "fase_procedimental"] },
  { label: "Lugar y fechas", fields: ["lugar_infraccion", "fecha_infraccion", "hora_infraccion", "fecha_documento", "fecha_notificacion", "fecha_limite"] },
  { label: "Norma y pruebas de estacionamiento", fields: ["norma_hint", "articulo_infringido_num", "apartado_infringido_num", "ordenanza_aplicable", "senalizacion_estacionamiento", "horario_estacionamiento", "autorizacion_estacionamiento", "tipo_denunciante", "fotografia_vehiculo_presente", "prueba_estacionamiento", "contradiccion_estacionamiento"] },
  { label: "Importes, pago y otros datos", fields: ["sancion_importe_eur", "importe_reducido_eur", "pago_multa_reducido", "puntos_detraccion", "plazo_pago_dias", "velocidad_medida_kmh", "velocidad_limite_kmh"] },
]);

export function missingFactGroups(record) {
  if (!record?.facts?.facts) return [];
  return FACT_GROUPS.map(group => ({ ...group, fields: group.fields.filter(key => !Object.hasOwn(record.facts.facts, key)) }))
    .filter(group => group.fields.length);
}

export class FactsReviewError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}
function assert(condition, message) { if (!condition) throw new FactsReviewError(message); }
function validId(value) { return typeof value === "string" && UUID.test(value); }
export function factLabel(field) { return FACT_FIELDS[field]?.[0] || field.replaceAll("_", " "); }
export function factValue(value) {
  if (value === null || value === undefined || value === "") return "Pendiente de confirmar";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  return ["string", "number"].includes(typeof value) ? String(value) : "Requiere revisión especializada";
}
export function verifyFacts(record, caseId) {
  assert(record && validId(record.id) && record.case_id === caseId && record.facts?.case_id === caseId,
    "Los hechos recibidos no corresponden a este expediente.");
  assert(HASH.test(record.payload_sha256) && record.facts.facts && typeof record.facts.facts === "object"
    && !Array.isArray(record.facts.facts) && Array.isArray(record.facts.source_document_ids),
    "No se pudo verificar la versión de hechos.");
  return record;
}
async function readResponse(response) {
  if (!response.ok) {
    const message = response.status === 409 ? "El expediente o su versión han cambiado. Recarga los hechos antes de continuar."
      : response.status === 401 ? "La sesión ha caducado. Vuelve a identificarte."
        : response.status === 403 ? "Tu sesión no tiene permiso para realizar esta revisión."
          : "No se pudo completar la operación. Recarga para comprobar el estado antes de volver a guardar.";
    throw new FactsReviewError(message, response.status);
  }
  return response.json();
}
export async function fetchFactsWorkspace({ authFetch, caseId, signal }) {
  assert(validId(caseId), "Identificador de expediente no válido.");
  const data = await readResponse(await authFetch(`/api/ops/core/cases/${caseId}/workspace`, { signal, cache: "no-store" }));
  assert(data.ok === true && data.case_id === caseId && data.case && typeof data.case === "object", "La respuesta no corresponde a este expediente.");
  const record = data.authority?.validated_facts?.latest_active;
  if (record) verifyFacts(record, caseId);
  return data;
}
export function reviewBlockReason(workspace, canSupervise, sessionId, authorizationVerified = false) {
  const record = workspace?.authority?.validated_facts?.latest_active;
  const meta = workspace?.case;
  if (!sessionId || !canSupervise) return "La corrección requiere una sesión individual de supervisión.";
  if (!record) return "Todavía no hay un borrador de hechos. Primero debe prepararse a partir de la lectura documental.";
  if (record.frozen || record.invalidated_at) return "Esta versión está cerrada y se muestra en consulta.";
  if (meta?.department !== "traffic" || meta?.case_type !== "fine") return "Este formulario está disponible para expedientes de multa.";
  if (meta?.payment_status !== "paid") return "La revisión requiere el pago del estudio confirmado.";
  if (meta?.authorized !== true || authorizationVerified !== true) return "Primero revisa y aprueba la autorización firmada en el apartado superior. Los hechos permanecen en consulta hasta entonces.";
  if (["submitted", "closed", "archived", "resolved", "estimado", "desestimado", "presentado_manual_ayuntamiento", "presentado_auto_dgt", "presentado_auto_registro", "submitting", "reanalysis_in_progress", "document_extraction_in_progress"].includes(meta?.status)) return "El estado del expediente no admite correcciones.";
  return "";
}
export function originalSources(workspace) {
  const ids = workspace?.authority?.validated_facts?.latest_active?.facts?.source_document_ids || [];
  return (workspace?.documents || []).filter(doc => doc.kind === "original" && validId(doc.id) && ids.includes(doc.id));
}
export function buildFactReviewBody({ record, field, value, documentId, page, evidence, reason, checked, operation = "correct" }) {
  assert(checked === true, "Confirma que has contrastado el dato con el documento original.");
  assert(["correct", "add"].includes(operation) && Object.hasOwn(FACT_FIELDS, field), "Campo u operación no admitidos.");
  assert(operation === "add" ? !Object.hasOwn(record.facts.facts, field) : Object.hasOwn(record.facts.facts, field),
    operation === "add" ? "El dato ya existe. Recarga y utiliza Revisar." : "Campo no editable en esta versión.");
  assert(validId(documentId) && record.facts.source_document_ids.includes(documentId), "Selecciona un documento de esta versión.");
  assert(/^\d+$/.test(String(page)) && Number(page) >= 1 && Number(page) <= 10000, "Indica la página del original (desde 1).");
  assert(typeof value === "string" && value.trim().length > 0, "Introduce el valor contrastado.");
  const kind = FACT_FIELDS[field][1];
  let typed = value.trim();
  if (kind === "number" || kind === "integer") {
    assert(/^\d+(?:[.,]\d+)?$/.test(typed), "Introduce un número no negativo.");
    typed = Number(typed.replace(",", "."));
    assert(Number.isFinite(typed) && typed <= (kind === "integer" ? 100000 : 100000000)
      && (kind !== "integer" || Number.isInteger(typed)), "Número fuera del intervalo permitido.");
  } else if (kind === "boolean") {
    assert(typed === "true" || typed === "false", "Selecciona explícitamente Sí o No según el original.");
    typed = typed === "true";
  } else if (kind === "date") {
    const parsed = new Date(`${typed}T00:00:00Z`);
    assert(/^\d{4}-\d{2}-\d{2}$/.test(typed) && typed.slice(0, 4) !== "0000"
      && Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === typed, "Introduce una fecha válida.");
  } else assert(typed.length <= 4000, "El valor supera los 4000 caracteres.");
  for (const [label, text] of [["fragmento del original", evidence], ["motivo", reason]]) {
    assert(typeof text === "string" && text.trim().length >= 3 && text.trim().length <= 2000, `Revisa el ${label}: entre 3 y 2000 caracteres.`);
  }
  assert(HASH.test(record.payload_sha256), "La versión de origen no es válida.");
  return { expected_payload_sha256: record.payload_sha256, reason: reason.trim(), changes: [{
    field, value: typed, document_id: documentId, page_index: Number(page) - 1, evidence: evidence.trim(),
    ...(operation === "add" ? { operation: "add" } : {}),
  }] };
}
export async function submitFactReview({ authFetch, caseId, record, body, signal }) {
  assert(validId(caseId), "Identificador de expediente no válido.");
  verifyFacts(record, caseId);
  const data = await readResponse(await authFetch(`/api/ops/core/cases/${caseId}/validated-facts/${record.id}/review`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal,
  }));
  assert(data.ok === true && data.case_id === caseId, "Respuesta de guardado no válida. Recarga para comprobar el estado.");
  const saved = verifyFacts(data.facts, caseId);
  assert(saved.id !== record.id && saved.supersedes_id === record.id && saved.frozen === false && !saved.invalidated_at,
    "No se pudo comprobar la nueva versión del borrador. Recarga los hechos.");
  assert(body.changes.every(change => {
    const fact = saved.facts.facts[change.field];
    return fact?.status === "validated" && fact.value === change.value && !fact.conflicts?.length &&
      fact.sources?.some(source => source.source_type === "operator_document_review" &&
        source.document_id === change.document_id && source.page_index === change.page_index && source.evidence === change.evidence);
  }), "La respuesta no acredita el dato guardado y su procedencia. Recarga los hechos antes de continuar.");
  return saved;
}
