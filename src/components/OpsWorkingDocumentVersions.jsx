import React, { useCallback, useEffect, useRef, useState } from 'react';
import { fetchVersions, saveWorkingDocumentVersion, fetchSavedVersion, fetchSavedVersionPdf } from '../lib/opsWorkingDocumentVersions.js';

const BUTTON = 'rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50';

export default function OpsWorkingDocumentVersions({ authFetch, caseId, enabled, document, externalBusy }) {
  const [versions, setVersions] = useState(null);
  const [selected, setSelected] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [showAll, setShowAll] = useState(false);
  const lock = useRef(false), request = useRef(null), viewer = useRef(null), blob = useRef(''), timer = useRef(null);

  const closeViewer = useCallback(() => {
    clearTimeout(timer.current); timer.current = null;
    try { viewer.current?.close(); } catch { /* A closed viewer needs no work. */ }
    viewer.current = null;
    if (blob.current) URL.revokeObjectURL(blob.current);
    blob.current = '';
  }, []);

  const perform = useCallback(async work => {
    if (!enabled || lock.current) return;
    lock.current = true; setBusy(true); setError('');
    const controller = new AbortController(); request.current = controller;
    try { await work(controller.signal); }
    catch (err) { if (!controller.signal.aborted) {
      setSelected(null); closeViewer();
      if ([401, 403, 404, 409, 503].includes(err.status)) setVersions(null);
      setError(err.message || 'No se pudo confirmar la operación.');
    } }
    finally { if (!controller.signal.aborted) { lock.current = false; setBusy(false); } }
  }, [enabled, closeViewer]);

  const reload = useCallback(() => perform(async signal => {
    const result = await fetchVersions({ authFetch, caseId, signal });
    if (!signal.aborted) setVersions(result);
  }), [perform, authFetch, caseId]);

  useEffect(() => {
    if (enabled) reload();
    return () => { request.current?.abort(); lock.current = false; closeViewer(); };
  }, [enabled, reload, closeViewer]);

  const same = !!document && versions?.history[0]?.source_sha256 === document.source_sha256
    && versions?.history[0]?.current_authority === true;
  const disabled = busy || externalBusy;

  function save() {
    if (!document || !versions || disabled) return;
    perform(async signal => {
      const result = await saveWorkingDocumentVersion({ authFetch, caseId, document, versions, signal });
      if (!signal.aborted) {
        setVersions(result); setSelected(null);
        setNotice(`Borrador guardado: versión ${result.history[0].sequence}. Sigue pendiente de revisión y no se ha presentado.`);
      }
    });
  }

  function showText(entry) {
    if (disabled) return;
    perform(async signal => {
      const result = await fetchSavedVersion({ authFetch, caseId, entry, signal });
      if (!signal.aborted) setSelected(result);
    });
  }

  function openPdf(entry) {
    if (disabled || lock.current) return;
    closeViewer();
    try {
      viewer.current = window.open('about:blank', '_blank', 'popup');
      if (!viewer.current) throw new Error('Permite las ventanas emergentes de RTM para abrir el PDF.');
      viewer.current.opener = null;
      viewer.current.document.title = `RTM · borrador guardado v${entry.sequence}`;
      viewer.current.document.body.textContent = 'Comprobando el PDF almacenado…';
    } catch (err) { closeViewer(); setError(err.message); return; }
    perform(async signal => {
      try {
        const bytes = await fetchSavedVersionPdf({ authFetch, caseId, entry, signal });
        if (signal.aborted || !viewer.current || viewer.current.closed) return;
        blob.current = URL.createObjectURL(new Blob([bytes], { type: 'application/pdf' }));
        viewer.current.location.replace(blob.current);
        timer.current = setTimeout(closeViewer, 5 * 60 * 1000);
      } catch (err) { closeViewer(); throw err; }
    });
  }

  if (!enabled) return null;
  return <section className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4" aria-label="Versiones guardadas del borrador">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h3 className="font-semibold text-slate-900">Versiones guardadas</h3>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BUTTON} onClick={reload} disabled={disabled}>Actualizar versiones</button>
        <button type="button" className={BUTTON} onClick={save}
          disabled={disabled || !document || !versions?.can_save || same}>
          {same ? 'Esta propuesta ya está guardada' : 'Guardar esta propuesta'}
        </button>
      </div>
    </div>
    <p className="mt-2 text-sm text-slate-600">Ensayo: guardar conserva el texto y su PDF. No confirma datos, no aprueba el escrito y no lo presenta.</p>
    {busy ? <p role="status" className="mt-2 text-sm">Comprobando versión…</p> : null}
    {error ? <p role="alert" className="mt-2 text-sm text-rose-800">{error}</p> : null}
    {notice ? <p role="status" className="mt-2 text-sm text-emerald-800">{notice}</p> : null}
    {versions && !versions.history.length ? <p className="mt-3 text-sm">Todavía no hay una versión guardada en este expediente.</p> : null}
    {versions?.history.length ? <div className="mt-3 space-y-2">{versions.history.slice(0, showAll ? 200 : 3).map(entry => <div key={entry.id} className="rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold">Versión {entry.sequence} · borrador pendiente de revisión</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className={BUTTON} disabled={disabled} onClick={() => showText(entry)}>Ver texto guardado</button>
          <button type="button" className={BUTTON} disabled={disabled} onClick={() => openPdf(entry)}>Abrir PDF guardado</button>
        </div>
      </div>
      <p className="mt-1 text-xs text-slate-600">{new Date(entry.created_at).toLocaleString('es-ES')} · {entry.id}</p>
      {document && (entry.source_sha256 !== document.source_sha256 || !entry.current_authority)
        ? <p className="mt-1 text-xs text-amber-900">Versión histórica: la propuesta o la autorización actuales son distintas.</p> : null}
    </div>)}</div> : null}
    {versions?.history.length > 3 ? <button type="button" className="mt-2 text-sm font-semibold text-blue-800 underline" onClick={() => setShowAll(value => !value)}>{showAll ? 'Mostrar solo las últimas versiones' : 'Mostrar versiones anteriores'}</button> : null}
    {selected ? <details open className="mt-3 rounded-lg border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer font-semibold">Texto guardado · versión {selected.entry.sequence}</summary>
      <p className="mt-2 text-xs text-slate-600">Copia histórica exacta, pendiente de aprobación; no sustituye la propuesta actual.</p>
      <pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-7">{selected.snapshot.content}</pre>
    </details> : null}
  </section>;
}
