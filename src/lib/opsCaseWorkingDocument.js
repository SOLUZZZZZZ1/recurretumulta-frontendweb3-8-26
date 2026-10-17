import { versionsRoute, verifyVersionEntry } from './opsWorkingDocumentVersions.js';
import { workingDocumentRoute } from './opsWorkingDocument.js';

export const CASE_DOCUMENT = 'rtm_case_working_document_v1';
export const CASE_VERSIONS = 'rtm_working_document_versions_v2';
export const MAX_TEXT_BYTES = 64 * 1024;
const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
const assert = (ok, message = 'La lectura del borrador está incompleta o no es verificable.') => {
  if (!ok) throw new Error(message);
};
export const contentHash = async text => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',
  new TextEncoder().encode(text))), b => b.toString(16).padStart(2, '0')).join('');

export function verifyCaseDocument(data, caseId) {
  assert(UUID.test(caseId) && data?.ok === true && data.case_id === caseId && data.version === CASE_DOCUMENT
    && data.status === 'working_draft' && data.final_resource_generated === false
    && data.operator_export_allowed === false && data.synthetic_only === true
    && typeof data.content === 'string' && new TextEncoder().encode(data.content).length <= MAX_TEXT_BYTES
    && HASH.test(data.source_sha256));
  const sources = data.sources;
  assert(sources?.case_id === caseId && sources.data_status === 'complete'
    && sources.document_reading === 'not_performed' && Array.isArray(sources.documents)
    && Object.hasOwn(sources, 'customer_comment') && Object.hasOwn(sources, 'public_service_family'));
  for (const role of ['interested', 'contact', 'driver', 'owner', 'representative']) {
    const item = sources.roles?.[role];
    assert(item && ['declared', 'not_available'].includes(item.status) && Object.hasOwn(item, 'value'));
  }
  for (const [role, keys] of Object.entries({ interested: ['full_name', 'dni_nie', 'address', 'address_parts'],
    contact: ['name', 'email', 'phone', 'preferred_contact'] })) {
    const value = sources.roles[role].value;
    assert(sources.roles[role].status === 'declared' && value && keys.every(key => Object.hasOwn(value, key)));
    assert(keys.filter(key => key !== 'address_parts').every(key => value[key] === null || typeof value[key] === 'string'));
  }
  const parts = sources.roles.interested.value.address_parts;
  assert(parts && !Array.isArray(parts) && ['street', 'street_number', 'floor', 'door', 'postal_code', 'city', 'province']
    .every(key => Object.hasOwn(parts, key) && (parts[key] === null || typeof parts[key] === 'string')));
  assert(['driver', 'owner', 'representative'].every(role => sources.roles[role].status === 'not_available'
    && sources.roles[role].value === null && typeof sources.roles[role].reason === 'string'));
  assert(['customer_comment', 'public_service_family'].every(key => sources[key] === null || typeof sources[key] === 'string'));
  const ids = new Set();
  for (const doc of sources.documents) {
    assert(UUID.test(doc.id) && !ids.has(doc.id) && HASH.test(doc.sha256) && doc.operator_export_allowed === false
      && doc.reading_status === 'not_read' && typeof doc.kind === 'string' && typeof doc.mime === 'string'
      && Number.isInteger(doc.size_bytes) && doc.size_bytes > 0);
    ids.add(doc.id);
  }
  assert(Array.isArray(data.used_document_ids) && new Set(data.used_document_ids).size === data.used_document_ids.length
    && data.used_document_ids.every(id => ids.has(id)));
  return data;
}

export function verifyCaseVersions(data, caseId) {
  assert(UUID.test(caseId) && data?.ok === true && data.case_id === caseId && data.version === CASE_VERSIONS
    && data.synthetic_only === true && data.final_resource_generated === false
    && data.operator_export_allowed === false && typeof data.can_save === 'boolean'
    && Array.isArray(data.history) && data.history.length <= 200);
  const ids = new Set();
  data.history.forEach((entry, i) => {
    verifyVersionEntry(entry, caseId);
    assert(entry.format === CASE_VERSIONS && entry.operator_export_allowed === false && entry.persisted === true
      && !ids.has(entry.id) && entry.sequence === data.history.length - i
      && entry.previous_id === (data.history[i + 1]?.id ?? null)
      && ['operator_edit', 'external_correction'].includes(entry.provenance)
      && /^operator:[a-f0-9-]{36}$/.test(entry.created_by) && typeof entry.change_reason === 'string');
    if (entry.based_on_id !== null) assert(data.history.slice(i + 1).some(e => e.id === entry.based_on_id));
    if (entry.provenance === 'external_correction') assert(UUID.test(entry.correction?.document_id)
      && HASH.test(entry.correction.sha256) && entry.correction.mime === 'text/plain'
      && Number.isInteger(entry.correction.size_bytes) && entry.correction.size_bytes <= MAX_TEXT_BYTES);
    ids.add(entry.id);
  });
  assert(data.latest_id === (data.history[0]?.id ?? null)
    && (data.selected_id === null || ids.has(data.selected_id))
    && (data.selection_revision === null || UUID.test(data.selection_revision))
    && (data.selected_id === null) === (data.selection_revision === null));
  return data;
}

async function checked(response) {
  if (response.ok) return response;
  const error = new Error({
    401: 'La sesión ha terminado. Identifícate de nuevo.',
    403: 'Esta operación requiere una sesión individual autorizada; no permite exportar documentos.',
    404: 'No se encuentra esta versión en el expediente.',
    409: 'Las fuentes, la versión o la selección han cambiado, o no se puede verificar su integridad. Tu texto no se ha sobrescrito. Actualiza el historial antes de continuar.',
    413: 'El borrador o el archivo supera el tamaño permitido (64 KiB).',
    415: 'La corrección debe ser un archivo .txt UTF-8.',
    422: 'Revisa el texto, la procedencia y las cabeceras de expediente y versión del archivo.',
    503: 'El perfil local o su custodia no están disponibles.',
  }[response.status] || 'No se pudo confirmar el resultado. Consulta el historial antes de repetir la operación.');
  error.status = response.status;
  throw error;
}

export async function loadCaseDraft({ authFetch, caseId, signal }) {
  const response = await checked(await authFetch(`${workingDocumentRoute(caseId)}?mode=case_preparation`, { cache: 'no-store', signal }));
  return verifyCaseDocument(await response.json(), caseId);
}
export async function loadCaseVersions({ authFetch, caseId, signal }) {
  const response = await checked(await authFetch(versionsRoute(caseId), { cache: 'no-store', signal }));
  return verifyCaseVersions(await response.json(), caseId);
}
export async function readCaseVersion({ authFetch, caseId, entry, signal }) {
  verifyVersionEntry(entry, caseId);
  const response = await checked(await authFetch(`${versionsRoute(caseId)}/${entry.id}`, { cache: 'no-store', signal }));
  const result = await response.json();
  assert(result?.ok === true && result.version === CASE_VERSIONS && result.case_id === caseId
    && result.persisted === true && result.custody_verified === true && result.operator_export_allowed === false);
  verifyVersionEntry(result.entry, caseId);
  verifyCaseDocument(result.snapshot, caseId);
  assert(result.entry.id === entry.id && result.entry.content_sha256 === entry.content_sha256
    && result.entry.snapshot_sha256 === entry.snapshot_sha256 && result.entry.source_sha256 === entry.source_sha256
    && result.snapshot.source_sha256 === entry.source_sha256
    && await contentHash(result.snapshot.content) === entry.content_sha256 && !signal?.aborted);
  return result;
}
export async function saveCaseVersion({ authFetch, caseId, body, file, signal }) {
  let sent = false;
  try {
    let payload, headers = {};
    if (file) {
      assert(file.size > 0 && file.size <= MAX_TEXT_BYTES && /\.txt$/i.test(file.name), 'Usa un archivo .txt UTF-8 de hasta 64 KiB.');
      const { content, ...metadata } = body;
      payload = new FormData(); payload.append('metadata', JSON.stringify(metadata)); payload.append('file', file);
    } else { payload = JSON.stringify(body); headers = { 'Content-Type': 'application/json' }; }
    sent = true;
    const response = await checked(await authFetch(`${versionsRoute(caseId)}${file ? '/correction' : ''}`,
      { method: 'POST', cache: 'no-store', signal, headers, body: payload }));
    const result = verifyCaseVersions(await response.json(), caseId);
    assert(UUID.test(result.saved_id) && result.history[0]?.id === result.saved_id
      && result.saved_id === result.latest_id && result.selected_id === result.saved_id);
    return result;
  } catch (error) {
    // A transport/5xx/invalid success response cannot tell us whether the write committed.
    error.writeOutcome = !sent ? 'not_sent'
      : [401, 403, 404, 409, 413, 415, 422].includes(error.status) ? 'rejected' : 'unknown';
    throw error;
  }
}

// Kept only in the mounted case/session, never persisted or used for automatic retries.
export async function describeCaseSave(body, file) {
  if (file) assert(file.size > 0 && file.size <= MAX_TEXT_BYTES && /\.txt$/i.test(file.name),
    'Usa un archivo .txt UTF-8 de hasta 64 KiB.');
  const bytes = file ? await file.arrayBuffer() : null;
  return { body: structuredClone(body), content_sha256: file ? null : await contentHash(body.content),
    correction_sha256: bytes ? Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
      b => b.toString(16).padStart(2, '0')).join('') : null, correction_size_bytes: file?.size ?? null };
}

export function matchesCaseSave(entry, operation) {
  const { body } = operation;
  return entry.previous_id === body.expected_latest_id && entry.based_on_id === body.based_on_id
    && entry.source_sha256 === body.expected_source_sha256 && entry.change_reason === body.change_reason
    && (operation.correction_sha256
      ? entry.provenance === 'external_correction' && entry.correction?.sha256 === operation.correction_sha256
        && entry.correction.size_bytes === operation.correction_size_bytes
      : entry.provenance === 'operator_edit' && entry.content_sha256 === operation.content_sha256);
}

export function verifyCaseSaveRead(result, operation) {
  assert(matchesCaseSave(result.entry, operation)
    && result.snapshot.source_sha256 === operation.body.expected_source_sha256
    && (operation.correction_sha256 || result.snapshot.content === operation.body.content)
    && JSON.stringify([...result.snapshot.used_document_ids].sort())
      === JSON.stringify([...operation.body.used_document_ids].sort()),
  'La versión leída no coincide con la operación pendiente. El guardado sigue bloqueado; conserva el texto y consulta el historial.');
  return result;
}
export async function selectCaseVersion({ authFetch, caseId, entry, versions, signal }) {
  const response = await checked(await authFetch(`${versionsRoute(caseId)}/selection`, {
    method: 'POST', cache: 'no-store', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ version_id: entry.id, expected_latest_id: versions.latest_id,
      expected_selection_revision: versions.selection_revision }),
  }));
  const result = verifyCaseVersions(await response.json(), caseId);
  assert(result.selected_id === entry.id);
  return result;
}
