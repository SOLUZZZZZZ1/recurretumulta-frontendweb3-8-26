import {UUID} from './paidCasework.js';

const HASH = /^[a-f0-9]{64}$/;
export const REJECTION_REASONS = Object.freeze({
  document_mismatch: 'No coincide con la autorización emitida',
  identity_mismatch: 'No coincide la identidad',
  signature_missing: 'Falta la firma',
  illegible: 'No se puede leer',
  suspected_tampering: 'Hay indicios de alteración',
});

export function authorizationRoot(caseId) {
  if (!UUID.test(caseId)) throw new Error('Expediente no válido.');
  return `/api/ops/cases/${caseId}`;
}

export function validateAuthorization(payload, caseId) {
  const status = payload?.authorization_evidence_status;
  if (payload?.id !== caseId || !UUID.test(caseId) ||
      !['not_submitted', 'pending_review', 'verified', 'rejected'].includes(status) ||
      payload.signed_authority_verified !== (status === 'verified')) {
    throw new Error('No se pudo verificar el estado de la autorización de este expediente.');
  }
  if (status === 'pending_review' &&
      (!UUID.test(payload.candidate_document_id || '') || !HASH.test(payload.candidate_attestation_sha256 || ''))) {
    throw new Error('Falta la referencia verificable del documento pendiente.');
  }
  return {status, documentId: payload.candidate_document_id || null,
    attestation: payload.candidate_attestation_sha256 || null};
}

export function buildAuthorizationDecision({candidate, reviewed, pdfHash, checks, decision, reason,
  reauthenticatedAt, now = Date.now()}) {
  if (candidate?.status !== 'pending_review' || !UUID.test(candidate.documentId || '') ||
      !HASH.test(candidate.attestation || '') || reviewed?.document_id !== candidate.documentId ||
      reviewed.read_confirmed !== true || !HASH.test(pdfHash || '') || reviewed.observed_sha256 !== pdfHash) {
    throw new Error('Abre y revisa todas las páginas del mismo documento antes de decidir.');
  }
  if (!Number.isFinite(reauthenticatedAt) || reauthenticatedAt > now || now - reauthenticatedAt >= 270000) {
    throw new Error('Confirma de nuevo tu identidad antes de guardar la revisión.');
  }
  const matches = checks?.generated_document_matches === true;
  const identity = checks?.identity_matches === true;
  const signature = checks?.signature_present === true;
  if (decision === 'approve' && !(matches && identity && signature)) {
    throw new Error('La aprobación requiere confirmar documento, identidad y firma.');
  }
  if (!['approve', 'reject'].includes(decision) ||
      (decision === 'reject' && !Object.hasOwn(REJECTION_REASONS, reason))) {
    throw new Error('Selecciona una decisión y, si rechazas, un motivo.');
  }
  return {decision, candidate_document_id: candidate.documentId,
    candidate_attestation_sha256: candidate.attestation, reviewed_entire_document: true,
    generated_document_matches: matches, identity_matches: identity, signature_present: signature,
    reason_code: decision === 'reject' ? reason : null};
}

export async function authorizationJson(authFetch, url, options = {}) {
  const response = await authFetch(url, options);
  const raw = await response.text();
  if (raw.length > 1000000) throw new Error('Respuesta demasiado grande.');
  let payload;
  try { payload = JSON.parse(raw); } catch { throw new Error('La operación no devolvió un resultado verificable.'); }
  if (!response.ok) {
    const messages = {401: 'La sesión no es válida; vuelve a entrar en OPS.',
      403: 'Confirma tu identidad y comprueba que eres el supervisor del ensayo.',
      409: 'El expediente o el documento ha cambiado. Actualiza antes de continuar.',
      422: 'La revisión está incompleta o el documento no se pudo verificar.'};
    throw new Error(messages[response.status] || 'La operación no se completó. Consulta su estado antes de repetirla.');
  }
  return payload;
}
