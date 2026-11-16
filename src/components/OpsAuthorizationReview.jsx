import React, {useEffect, useRef, useState} from 'react';
import OpsDocumentViewer from './OpsDocumentViewer.jsx';
import {authorizationRoot, authorizationJson, validateAuthorization, buildAuthorizationDecision,
  REJECTION_REASONS} from '../lib/authorizationReview.js';

const EMPTY_CHECKS = {generated_document_matches: false, identity_matches: false, signature_present: false};

export default function OpsAuthorizationReview({caseId, sessionId, authFetch, canReview, onSaved}) {
  const [candidate, setCandidate] = useState(null), [error, setError] = useState('');
  const [busy, setBusy] = useState(true), [notice, setNotice] = useState('');
  const [viewer, setViewer] = useState(false), [pdfHash, setPdfHash] = useState('');
  const [reviewed, setReviewed] = useState(null), [checks, setChecks] = useState(EMPTY_CHECKS);
  const [password, setPassword] = useState(''), [reauthenticatedAt, setReauthenticatedAt] = useState(null);
  const [reason, setReason] = useState(''), [uncertain, setUncertain] = useState(false);
  const active = useRef(false), lock = useRef(false), controller = useRef(null);

  function clearReview() {
    setViewer(false); setPdfHash(''); setReviewed(null); setChecks(EMPTY_CHECKS);
    setPassword(''); setReauthenticatedAt(null); setReason('');
  }
  async function load(signal) {
    const state = validateAuthorization(await authorizationJson(authFetch, authorizationRoot(caseId), {signal}), caseId);
    if (active.current && !signal.aborted) {setCandidate(state); setUncertain(false); clearReview();}
    return state;
  }
  async function task(fn) {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    const ctl = new AbortController(); controller.current = ctl;
    try { await fn(ctl.signal); }
    catch (e) {if (active.current && !ctl.signal.aborted) setError(e.message || 'Resultado no confirmado.');}
    finally {lock.current = false; if (active.current) setBusy(false);}
  }
  useEffect(() => {
    active.current = true;
    const ctl = new AbortController();
    setBusy(true); setError('');
    load(ctl.signal).catch(e => {
      if (active.current && !ctl.signal.aborted) setError(e.message);
    }).finally(() => {
      if (active.current && !ctl.signal.aborted) setBusy(false);
    });
    return () => {active.current = false; ctl.abort(); controller.current?.abort();};
  }, [caseId, sessionId, authFetch]);

  async function openCandidate(signal) {
    clearReview(); setNotice('');
    const current = await load(signal);
    if (current.status !== 'pending_review') return;
    const response = await authFetch(`${authorizationRoot(caseId)}/authorization-signature-candidate/${current.documentId}`, {signal});
    if (!response.ok || response.headers.get('content-type')?.split(';')[0] !== 'application/pdf') {
      throw new Error('No se pudo abrir la autorización pendiente con su comprobación de integridad.');
    }
    const blob = await response.blob();
    if (!blob.size || blob.size > 10 * 1024 * 1024) throw new Error('El documento no tiene un tamaño válido.');
    const digest = await crypto.subtle.digest('SHA-256', await blob.arrayBuffer());
    const hash = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, '0')).join('');
    if (active.current && !signal.aborted) {setPdfHash(hash); setViewer(true);}
  }
  function confirmRead(value) {
    if (value.document_id !== candidate?.documentId || value.observed_sha256 !== pdfHash || value.read_confirmed !== true) {
      setReviewed(null); setError('El documento mostrado no coincide con el candidato pendiente. Vuelve a abrirlo.'); return;
    }
    setReviewed(value); setViewer(false);
  }
  async function reauthenticate(event) {
    event.preventDefault();
    const submitted = password; setPassword(''); setReauthenticatedAt(null);
    await task(async signal => {
      const result = await authorizationJson(authFetch, '/api/ops/auth/reauthenticate', {method: 'POST', signal,
        headers: {'Content-Type': 'application/json'}, body: JSON.stringify({password: submitted})});
      if (result.ok !== true || result.status !== 'reauthenticated' || result.session_id !== sessionId) {
        throw new Error('No se confirmó la identidad de esta sesión.');
      }
      if (active.current && !signal.aborted) setReauthenticatedAt(Date.now());
    });
  }
  async function decide(decision, signal) {
    const payload = buildAuthorizationDecision({candidate, reviewed, pdfHash, checks, decision, reason, reauthenticatedAt});
    setUncertain(true); setNotice('');
    const result = await authorizationJson(authFetch, `${authorizationRoot(caseId)}/authorization-signature-review`, {
      method: 'POST', signal, headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)});
    const expected = decision === 'approve' ? 'verified' : 'rejected';
    if (result.ok !== true || result.case_id !== caseId || result.candidate_document_id !== candidate.documentId ||
        result.authorization_evidence_status !== expected) throw new Error('Consulta el estado: no se pudo confirmar la decisión guardada.');
    const state = await load(signal);
    if (state.status !== expected) {setUncertain(true); throw new Error('La decisión todavía no aparece al consultar el expediente.');}
    if (active.current && !signal.aborted) {
      setNotice(decision === 'approve' ? 'Autorización revisada y confirmada. El cliente puede continuar su ensayo.' : 'Rechazo guardado. El cliente debe aportar otra autorización.');
      onSaved?.();
    }
  }
  const approvedChecks = Object.values(checks).every(Boolean);
  return <section aria-label="Revisión de la autorización de prueba">
    <h2>Revisar la autorización del ensayo</h2>
    <p>Solo documentos ficticios. Recibir un archivo no confirma su firma ni la identidad.</p>
    {error && <p role="alert">{error}</p>}{notice && <p role="status">{notice}</p>}
    {busy && <p role="status">Comprobando la autorización…</p>}
    <button disabled={busy} onClick={() => void task(load)}>Actualizar estado de la autorización</button>
    {candidate && <p>Estado: {{pending_review: 'Pendiente de revisión', verified: 'Revisión confirmada',
      rejected: 'Rechazada', not_submitted: 'Sin autorización verificable'}[candidate.status]}</p>}
    {uncertain && <p role="alert">El resultado está pendiente de confirmar. Actualiza el estado antes de tomar otra decisión.</p>}
    {candidate?.status === 'pending_review' && canReview && <>
      <button disabled={busy || uncertain} onClick={() => void task(openCandidate)}>Abrir autorización pendiente</button>
      {viewer && <OpsDocumentViewer caseId={caseId} document={{id: candidate.documentId}}
        authFetch={authFetch} onReviewed={confirmRead} onClose={() => setViewer(false)}/>}
      {reviewed && <><p>Documento completo revisado y vinculado a esta decisión.</p>
        <fieldset disabled={busy || uncertain}>
          {Object.entries({generated_document_matches: 'Coincide con la autorización emitida para este ensayo.',
            identity_matches: 'Coincide con la identidad ficticia del ensayo.',
            signature_present: 'He comprobado la firma de prueba en el documento.'}).map(([key, label]) =>
            <label key={key}><input type="checkbox" checked={checks[key]} onChange={e => setChecks(c => ({...c, [key]: e.target.checked}))}/>{label}</label>)}
        </fieldset>
        <form onSubmit={reauthenticate}>
          <label>Confirma tu contraseña de operador<input type="password" autoComplete="current-password" required maxLength={256}
            disabled={busy || uncertain} value={password} onChange={e => setPassword(e.target.value)}/></label>
          <button disabled={busy || uncertain || !password}>Confirmar mi identidad para esta revisión</button>
        </form>
        {reauthenticatedAt !== null && <p>Identidad confirmada recientemente. El servidor comprueba su vigencia al guardar.</p>}
        <button disabled={busy || uncertain || !approvedChecks || reauthenticatedAt === null} onClick={() => void task(signal => decide('approve', signal))}>Aprobar autorización de prueba</button>
        <label>Motivo para rechazar<select disabled={busy || uncertain} value={reason} onChange={e => setReason(e.target.value)}>
          <option value="">Selecciona el motivo</option>{Object.entries(REJECTION_REASONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></label>
        <button disabled={busy || uncertain || !reason || reauthenticatedAt === null} onClick={() => void task(signal => decide('reject', signal))}>Rechazar autorización de prueba</button>
      </>}
    </>}
  </section>;
}
