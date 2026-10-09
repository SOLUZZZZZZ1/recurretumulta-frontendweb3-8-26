import { workingDocumentRoute, verifyWorkingDocument } from './opsWorkingDocument.js';

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const HASH = /^[a-f0-9]{64}$/;
const VERSION = 'rtm_working_document_versions_v1';
function assert(ok, message = 'No se pudo verificar la versión guardada.') {
  if (!ok) throw new Error(message);
}
const digest = async bytes => Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', bytes)),
  value => value.toString(16).padStart(2, '0')).join('');
export const versionsRoute = caseId => `${workingDocumentRoute(caseId)}/versions`;

export function verifyVersionEntry(entry, caseId) {
  assert(UUID.test(caseId) && entry && UUID.test(entry.id) && entry.case_id === caseId && entry.format === VERSION);
  assert(Number.isInteger(entry.sequence) && entry.sequence > 0 && entry.sequence <= 200
    && entry.status === 'working_draft' && entry.synthetic_only === true && entry.final_resource_generated === false);
  assert(entry.previous_id === null || UUID.test(entry.previous_id));
  assert(entry.previous_material_sha256 === null || HASH.test(entry.previous_material_sha256));
  assert(['source_sha256', 'snapshot_sha256', 'content_sha256', 'authority_sha256'].every(key => HASH.test(entry[key])));
  assert(typeof entry.title === 'string' && typeof entry.created_at === 'string'
    && Number.isFinite(Date.parse(entry.created_at)));
  assert(entry.pdf && UUID.test(entry.pdf.document_id) && HASH.test(entry.pdf.sha256)
    && Number.isInteger(entry.pdf.size_bytes) && entry.pdf.size_bytes > 5 && entry.pdf.size_bytes <= 2 * 1024 * 1024);
  return entry;
}

export function verifyVersions(data, caseId) {
  assert(data?.ok === true && data.version === VERSION && data.case_id === caseId
    && data.synthetic_only === true && data.final_resource_generated === false && typeof data.can_save === 'boolean');
  assert(Array.isArray(data.history) && data.history.length <= 200);
  const ids = new Set();
  for (let i = 0; i < data.history.length; i++) {
    const entry = verifyVersionEntry(data.history[i], caseId);
    assert(!ids.has(entry.id) && entry.persisted === true && typeof entry.current_authority === 'boolean');
    assert(entry.sequence === data.history.length - i);
    assert(entry.previous_id === (data.history[i + 1]?.id ?? null));
    ids.add(entry.id);
  }
  assert(data.latest_id === (data.history[0]?.id ?? null));
  return data;
}

async function checked(response) {
  if (response.ok) return response;
  const error = new Error({
    401: 'La sesión ha caducado. Identifícate de nuevo.',
    403: 'Las versiones requieren una sesión individual de supervisor.',
    404: 'El guardado de versiones no está disponible en este expediente o servidor.',
    409: 'El escrito, el historial o su autorización han cambiado. Actualiza antes de continuar.',
    503: 'El guardado requiere el ensayo aislado y su almacenamiento disponible.',
  }[response.status] || 'No se pudo confirmar la operación. Actualiza las versiones antes de repetirla.');
  error.status = response.status;
  throw error;
}

export async function fetchVersions({ authFetch, caseId, signal }) {
  const response = await checked(await authFetch(versionsRoute(caseId), { method: 'GET', cache: 'no-store', signal }));
  return verifyVersions(await response.json(), caseId);
}

export async function saveWorkingDocumentVersion({ authFetch, caseId, document, versions, signal }) {
  verifyWorkingDocument(document, caseId); verifyVersions(versions, caseId);
  assert(versions.can_save, 'El guardado no está disponible en este ensayo.');
  const response = await checked(await authFetch(versionsRoute(caseId), {
    method: 'POST', cache: 'no-store', signal, headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expected_source_sha256: document.source_sha256, expected_latest_id: versions.latest_id }),
  }));
  const result = verifyVersions(await response.json(), caseId);
  assert(result.saved_id === result.latest_id && typeof result.reused === 'boolean'
    && result.history[0]?.source_sha256 === document.source_sha256
    && result.history[0]?.current_authority === true,
    'No se pudo confirmar que se guardara la propuesta visible. Actualiza las versiones.');
  return result;
}

export async function fetchSavedVersion({ authFetch, caseId, entry, signal }) {
  verifyVersionEntry(entry, caseId);
  const response = await checked(await authFetch(`${versionsRoute(caseId)}/${entry.id}`,
    { method: 'GET', cache: 'no-store', signal }));
  const result = await response.json();
  assert(result?.ok === true && result.version === VERSION && result.case_id === caseId
    && result.persisted === true && result.final_resource_generated === false);
  verifyVersionEntry(result.entry, caseId); verifyWorkingDocument(result.snapshot, caseId);
  assert(result.entry.id === entry.id && result.entry.source_sha256 === entry.source_sha256
    && result.entry.content_sha256 === entry.content_sha256
    && result.snapshot.source_sha256 === entry.source_sha256);
  assert(await digest(new TextEncoder().encode(result.snapshot.content)) === entry.content_sha256);
  assert(!signal?.aborted, 'Consulta cancelada.');
  return result;
}

export async function fetchSavedVersionPdf({ authFetch, caseId, entry, signal }) {
  verifyVersionEntry(entry, caseId);
  const response = await checked(await authFetch(`${versionsRoute(caseId)}/${entry.id}/pdf`,
    { method: 'GET', cache: 'no-store', signal }));
  assert(response.headers.get('content-type')?.split(';')[0] === 'application/pdf'
    && response.headers.get('X-RTM-Version-ID') === entry.id
    && response.headers.get('X-RTM-Source-SHA256') === entry.source_sha256
    && response.headers.get('X-RTM-Document-SHA256') === entry.pdf.sha256);
  const bytes = await response.arrayBuffer();
  assert(!signal?.aborted && bytes.byteLength === entry.pdf.size_bytes
    && new TextDecoder('ascii').decode(bytes.slice(0, 5)) === '%PDF-');
  assert(await digest(bytes) === entry.pdf.sha256, 'El PDF recibido no coincide con la versión guardada.');
  return bytes;
}
