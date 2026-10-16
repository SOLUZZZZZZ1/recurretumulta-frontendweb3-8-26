import React, { useEffect, useRef, useState } from 'react';
import { loadCaseDraft, loadCaseVersions, readCaseVersion, saveCaseVersion, selectCaseVersion } from '../lib/opsCaseWorkingDocument.js';

const BUTTON = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50';
const show = value => typeof value === 'string' && value.trim() ? value : 'No consta';

// A case/session change destroys all text, files, pending requests and historical views.
export default function OpsCaseWorkingDocument(props) {
  if (!props.enabled || !props.sessionId) return null;
  return <CaseDocumentPanel key={`${props.caseId}:${props.sessionId}`} {...props} />;
}

function Sources({ snapshot }) {
  const { sources, used_document_ids: used } = snapshot;
  const identity = sources.roles.interested.value, contact = sources.roles.contact.value;
  return <details className="mt-3 rounded-lg border p-3" data-draft-sources>
    <summary className="cursor-pointer font-semibold">Datos y fuentes conservados en esta versión</summary>
    <dl className="mt-3 grid gap-2 text-sm">
      <div><dt className="font-semibold">Interesado · formulario</dt><dd>{show(identity.full_name)} · {show(identity.dni_nie)} · {show(identity.address)}</dd></div>
      <div><dt className="font-semibold">Contacto · datos de contacto guardados</dt><dd>{show(contact.name)} · {show(contact.email)} · {show(contact.phone)}</dd></div>
      {Object.entries({ driver: 'Conductor', owner: 'Titular', representative: 'Representante' }).map(([key, label]) =>
        <div key={key}><dt className="font-semibold">{label}</dt><dd>Identidad no disponible: {sources.roles[key].reason}</dd></div>)}
      <div><dt className="font-semibold">Relato aportado</dt><dd className="whitespace-pre-wrap">{show(sources.customer_comment)}</dd></div>
    </dl>
    <p className="mt-3 text-sm">Las referencias siguientes conservan metadatos y hashes. No acreditan una lectura del contenido ni una identidad documental.</p>
    <ul className="mt-2 space-y-2 text-xs">{sources.documents.filter(doc => used.includes(doc.id)).map(doc =>
      <li key={doc.id} className="break-all">{doc.kind} · {doc.id} · {doc.size_bytes} bytes · SHA-256 {doc.sha256}</li>)}</ul>
    {!used.length ? <p>No se seleccionaron referencias documentales.</p> : null}
    <p className="mt-2 break-all text-xs">Fuentes SHA-256: {snapshot.source_sha256}</p>
  </details>;
}

function CaseDocumentPanel({ authFetch, caseId }) {
  const [versions, setVersions] = useState(null), [editorSource, setEditorSource] = useState(null);
  const [basedOn, setBasedOn] = useState(null), [viewed, setViewed] = useState(null);
  const [content, setContent] = useState(''), [reason, setReason] = useState(''), [used, setUsed] = useState([]);
  const [ack, setAck] = useState(false), [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [conflict, setConflict] = useState(false), [fileEpoch, setFileEpoch] = useState(0);
  const request = useRef(null), locked = useRef(false), alive = useRef(true);

  function useForEditing(snapshot, id) {
    setEditorSource(snapshot); setContent(snapshot.content); setUsed(snapshot.used_document_ids);
    setBasedOn(id); setReason(''); setAck(false); setFile(null); setFileEpoch(value => value + 1);
  }
  async function perform(work) {
    if (locked.current) return;
    locked.current = true; setBusy(true); setError('');
    const controller = new AbortController(); request.current = controller;
    try { await work(controller.signal); }
    catch (err) { if (alive.current && !controller.signal.aborted) {
      setError(err.message || 'No se pudo confirmar la operación.');
      if (err.status === 409) setConflict(true);
      if ([401, 403, 404, 503].includes(err.status)) {
        setVersions(null); setViewed(null); setEditorSource(null); setContent(''); setFile(null);
      }
    } }
    finally { if (alive.current && !controller.signal.aborted) { locked.current = false; setBusy(false); } }
  }
  useEffect(() => {
    alive.current = true;
    perform(async signal => {
      const history = await loadCaseVersions({ authFetch, caseId, signal });
      const entry = history.history.find(item => item.id === history.selected_id);
      const saved = entry ? await readCaseVersion({ authFetch, caseId, entry, signal }) : null;
      const snapshot = saved?.snapshot ?? await loadCaseDraft({ authFetch, caseId, signal });
      if (!signal.aborted) { setVersions(history); setViewed(saved); useForEditing(snapshot, saved?.entry.id ?? null); }
    });
    return () => { alive.current = false; request.current?.abort(); locked.current = false; };
    // This component is keyed by case/session; authenticated fetch is stable for that session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authFetch, caseId]);

  function reload() {
    perform(async signal => {
      const result = await loadCaseVersions({ authFetch, caseId, signal });
      if (!signal.aborted) { setVersions(result); setConflict(false); setNotice('Historial actualizado. El texto en edición y sus fuentes se han conservado; revisa la versión de origen antes de guardar.'); }
    });
  }
  function prepareCurrent() {
    perform(async signal => {
      const snapshot = await loadCaseDraft({ authFetch, caseId, signal });
      if (!signal.aborted) { useForEditing(snapshot, null); setNotice('Edición preparada con los datos actuales. Las versiones guardadas permanecen intactas.'); }
    });
  }
  function view(entry, edit = false) {
    perform(async signal => {
      const result = await readCaseVersion({ authFetch, caseId, entry, signal });
      if (!signal.aborted) { setViewed(result); if (edit) useForEditing(result.snapshot, entry.id); }
    });
  }
  function select(entry) {
    perform(async signal => {
      const result = await selectCaseVersion({ authFetch, caseId, entry, versions, signal });
      if (!signal.aborted) { setVersions(result); setNotice(`Seleccionada la versión ${entry.sequence}. No está aprobada ni presentada.`); }
    });
  }
  function save(correction = false) {
    if (!editorSource || !versions || conflict) return;
    perform(async signal => {
      const body = { operation: 'case_draft', expected_source_sha256: editorSource.source_sha256,
        expected_latest_id: versions.latest_id, expected_selection_revision: versions.selection_revision,
        based_on_id: basedOn, content, used_document_ids: used, change_reason: reason, draft_acknowledged: ack };
      const history = await saveCaseVersion({ authFetch, caseId, body, file: correction ? file : null, signal });
      if (signal.aborted) return;
      setVersions(history); setNotice(`Guardada y seleccionada la versión ${history.history[0].sequence}. Originales conservados.`);
      const result = await readCaseVersion({ authFetch, caseId, entry: history.history[0], signal });
      if (!signal.aborted) { setViewed(result); useForEditing(result.snapshot, result.entry.id); }
    });
  }
  const canSave = !busy && !conflict && versions?.can_save && editorSource && ack && reason.trim().length >= 5;
  const selected = versions?.history.find(entry => entry.id === versions.selected_id);
  return <section id="ops-case-working-document" aria-label="Borrador vinculado al expediente" className="mt-5 rounded-2xl border border-blue-300 bg-white p-5">
    <h2 className="text-xl font-bold">Borrador vinculado al expediente</h2>
    <p className="mt-2 text-sm">Guardar y seleccionar conserva una versión de trabajo. No aprueba, firma, autoriza representación, paga ni presenta. La consulta permanece dentro de OPS, sin exportación documental.</p>
    <p className="mt-2 text-sm" data-draft-selected>Versión seleccionada: {selected ? `${selected.sequence} · ${selected.id}` : 'Ninguna'}</p>
    <button type="button" className={`${BUTTON} mt-3`} onClick={reload} disabled={busy}>Actualizar historial de borradores</button>
    <button type="button" className={`${BUTTON} mt-3 ml-2`} onClick={prepareCurrent} disabled={busy}>Preparar otra edición desde los datos actuales</button>
    {busy ? <p role="status">Comprobando borrador…</p> : null}
    {error ? <p role="alert" className="mt-3 text-red-800">{error}</p> : null}
    {notice ? <p role="status" className="mt-3 text-emerald-800">{notice}</p> : null}
    {editorSource ? <div className="mt-4 grid gap-3">
      <p className="text-sm">Origen de la edición: {basedOn || 'datos actuales del expediente'}. Las fuentes quedan congeladas al guardar.</p>
      <label className="grid gap-2 font-semibold">Texto del borrador
        <textarea data-draft-editor rows={16} maxLength={65536} value={content} disabled={busy}
          onChange={event => setContent(event.target.value)} className="w-full rounded-lg border p-3 font-normal" />
      </label>
      <fieldset className="rounded-lg border p-3"><legend>Referencias documentales utilizadas</legend>
        {editorSource.sources.documents.map(doc => <label key={doc.id} className="my-2 flex gap-2 text-sm">
          <input type="checkbox" checked={used.includes(doc.id)} disabled={busy} onChange={event => setUsed(old => event.target.checked ? [...old, doc.id] : old.filter(id => id !== doc.id))} />
          {doc.kind} · {doc.id} (metadatos, contenido no leído)
        </label>)}
      </fieldset>
      <label className="grid gap-2">Motivo y procedencia del cambio
        <input data-draft-reason value={reason} maxLength={1000} disabled={busy} onChange={event => setReason(event.target.value)} className="rounded-lg border p-2" />
      </label>
      <label className="flex items-start gap-2"><input data-draft-ack type="checkbox" checked={ack} disabled={busy} onChange={event => setAck(event.target.checked)} />Conservo un borrador pendiente de revisión; esta operación no implica aprobación.</label>
      <button type="button" data-draft-save className={BUTTON} disabled={!canSave || !content.trim()} onClick={() => save()}>Guardar y seleccionar una nueva versión</button>
      <details className="rounded-lg border p-3" data-draft-import>
        <summary className="cursor-pointer font-semibold">Incorporar una corrección externa</summary>
        <p className="mt-2 text-sm">Archivo .txt UTF-8, hasta 64 KiB, preparado fuera de OPS. Sus tres primeras líneas deben ser las siguientes (la tercera queda vacía); después escribe el contenido corregido. No se exporta el borrador.</p>
        <pre className="my-2 whitespace-pre-wrap break-all text-xs">{`RTM-CASE: ${caseId}\nRTM-VERSION: ${basedOn || '[elige una versión guardada para editar]'}\n\n`}</pre>
        <input key={fileEpoch} data-draft-file type="file" accept=".txt,text/plain" disabled={busy || !basedOn} onChange={event => setFile(event.target.files?.[0] || null)} />
        <button type="button" data-draft-correction className={`${BUTTON} mt-3`} disabled={!canSave || !basedOn || !file} onClick={() => save(true)}>Guardar corrección como nueva versión seleccionada</button>
      </details>
    </div> : null}
    <div className="mt-5 space-y-3" aria-label="Historial del borrador">
      <h3 className="font-bold">Historial · {versions?.history.length ?? 'lectura pendiente'}</h3>
      {versions?.history.map(entry => <article key={entry.id} data-draft-version={entry.id} className="rounded-lg border p-3">
        <p className="font-semibold">Versión {entry.sequence}{entry.id === versions.selected_id ? ' · seleccionada' : ''}{entry.id === viewed?.entry.id ? ' · en consulta' : ''}</p>
        <p className="text-sm">{new Date(entry.created_at).toLocaleString('es-ES')} · {entry.created_by}</p>
        <p className="text-sm">{entry.provenance === 'external_correction' ? 'Corrección externa' : 'Edición en OPS'}: {entry.change_reason}</p>
        <p className="break-all text-xs">ID {entry.id} · Anterior: {entry.previous_id || 'ninguna'} · Basada en: {entry.based_on_id || 'datos del expediente'}</p>
        <p className="break-all text-xs">Contenido SHA-256: {entry.content_sha256}</p>
        {entry.correction ? <p className="break-all text-xs">Archivo: {entry.correction.filename} · SHA-256 {entry.correction.sha256}</p> : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <button className={BUTTON} type="button" disabled={busy} onClick={() => view(entry)}>Consultar versión {entry.sequence}</button>
          <button className={BUTTON} type="button" disabled={busy} onClick={() => view(entry, true)}>Editar desde versión {entry.sequence}</button>
          <button className={BUTTON} type="button" disabled={busy || conflict || entry.id === versions.selected_id} onClick={() => select(entry)}>Seleccionar versión {entry.sequence}</button>
        </div>
      </article>)}
    </div>
    {viewed ? <div className="mt-5 rounded-xl border border-blue-200 p-4" data-draft-view={viewed.entry.id}>
      <h3 className="font-bold">En consulta: versión {viewed.entry.sequence}</h3>
      <p className="text-sm">Texto exacto verificado. Consultar esta copia no cambia la versión seleccionada. PDF y corrección comprobados en custodia, sin descarga.</p>
      <pre data-draft-content className="mt-3 whitespace-pre-wrap break-words font-sans text-sm">{viewed.snapshot.content}</pre>
      <Sources snapshot={viewed.snapshot} />
    </div> : null}
  </section>;
}
