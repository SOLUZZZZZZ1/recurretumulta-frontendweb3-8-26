const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
const STATUSES = new Set(["reviewed", "verified", "candidate", "declared", "missing", "conflict", "excluded"]);
const KINDS = new Set(["driver_identification", "traffic_review", "undetermined"]);
const scalar = value => value === null || typeof value === "string" || typeof value === "boolean"
  || (typeof value === "number" && Number.isFinite(value));
const text = value => typeof value === "string";
function assert(condition, message = "No se pudo comprobar el borrador recibido. Actualiza el escrito.") {
  if (!condition) throw new Error(message);
}

export function workingDocumentRoute(caseId) {
  assert(UUID.test(caseId), "Identificador de expediente no válido.");
  return `/api/ops/core/cases/${caseId}/study/working-document`;
}

export function verifyWorkingDocument(data, caseId) {
  assert(UUID.test(caseId) && data?.ok === true && data.case_id === caseId);
  assert(data.version === "rtm_working_document_v1" && HASH.test(data.source_sha256)
    && data.status === "working_draft" && data.final_resource_generated === false
    && data.persisted === false && data.can_save === false && data.latest_id === null
    && Array.isArray(data.history) && data.history.length === 0);
  assert((data.facts_id === null && data.facts_payload_sha256 === null)
    || (UUID.test(data.facts_id) && HASH.test(data.facts_payload_sha256)));
  assert(KINDS.has(data.document_kind) && text(data.title) && text(data.content)
    && data.title.length <= 1000 && data.content.length > 0 && data.content.length <= 200000);
  assert(Array.isArray(data.fields) && data.fields.length <= 100
    && new Set(data.fields.map(item => item?.key)).size === data.fields.length);
  for (const field of data.fields) {
    assert(field && text(field.key) && text(field.label) && scalar(field.value) && STATUSES.has(field.status)
      && Array.isArray(field.sources) && Array.isArray(field.matches));
    assert(field.sources.every(source => source && (source.document_id === null || UUID.test(source.document_id))
      && (source.page_index === null || (Number.isInteger(source.page_index) && source.page_index >= 0))
      && (source.evidence === null || text(source.evidence))
      && (source.evidence_kind === null || source.evidence_kind === "document_excerpt")
      && (source.evidence_kind !== "document_excerpt" || text(source.evidence))));
    assert(field.matches.every(match => match && ["client_declaration", "reviewed_fact"].includes(match.source)
      && scalar(match.value) && match.rule === "normalized_exact_v1"));
  }
  assert(Array.isArray(data.issues) && data.issues.every(issue => issue && text(issue.code)
    && ["blocking", "review", "info"].includes(issue.severity) && text(issue.message)
    && Array.isArray(issue.field_keys) && issue.field_keys.every(text)));
  return data;
}

async function ensureResponse(response) {
  if (response.ok) return response;
  const messages = {
    401: "La sesión ha caducado. Vuelve a identificarte para ver el escrito.",
    403: "El escrito requiere una sesión individual de supervisor.",
    404: "La propuesta de escrito aún no está disponible en este servidor.",
    409: "El expediente o la lectura han cambiado. Actualiza el escrito para comprobar el paso pendiente.",
  };
  throw new Error(messages[response.status] || "No se pudo obtener el escrito. Puedes volver a consultarlo.");
}

export async function fetchWorkingDocument({ authFetch, caseId, signal }) {
  const response = await ensureResponse(await authFetch(workingDocumentRoute(caseId), {
    method: "GET", cache: "no-store", signal,
  }));
  return verifyWorkingDocument(await response.json(), caseId);
}

export async function fetchWorkingDocumentPdf({ authFetch, caseId, document, signal }) {
  verifyWorkingDocument(document, caseId);
  const response = await ensureResponse(await authFetch(
    `${workingDocumentRoute(caseId)}/pdf?source_sha256=${document.source_sha256}`,
    { method: "GET", cache: "no-store", signal },
  ));
  assert(response.headers.get("content-type")?.split(";")[0] === "application/pdf"
    && response.headers.get("X-RTM-Source-SHA256") === document.source_sha256,
  "El PDF no corresponde a la propuesta visible. Actualiza el escrito.");
  const expectedHash = response.headers.get("X-RTM-Document-SHA256");
  assert(HASH.test(expectedHash), "No se pudo comprobar la huella del PDF.");
  const bytes = await response.arrayBuffer();
  assert(!signal?.aborted && bytes.byteLength > 5 && bytes.byteLength <= 2 * 1024 * 1024
    && new TextDecoder("ascii").decode(bytes.slice(0, 5)) === "%PDF-", "El PDF recibido no es válido.");
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    item => item.toString(16).padStart(2, "0")).join("");
  assert(hash === expectedHash, "El PDF recibido no coincide con su huella. Vuelve a consultarlo.");
  return bytes;
}
