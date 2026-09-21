import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { appendParkingChecks, fetchWorkingDraftPdf, requestWorkingDraft } from "../lib/opsWorkingDraft.js";

const INPUT = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const BUTTON = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50";
const EMPTY = { grounds: "", request_text: "", pending_notes: "", change_reason: "", draft_acknowledged: false };

export default function OpsWorkingDraft(props) {
  return <DraftPanel key={`${props.caseId}:${props.sessionId}:${props.canSupervise}:${props.factsRevision}:${props.authorizationVerified}`} {...props}/>;
}

function DraftPanel({ authFetch, caseId, sessionId, canSupervise }) {
  const [state, setState] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const loadRef = useRef(null), saveRef = useRef(null), viewRef = useRef(null), lockRef = useRef(false);
  const viewerRef = useRef(null), blobRef = useRef(""), timerRef = useRef(null);
  const dispose = useCallback(() => {
    clearTimeout(timerRef.current); timerRef.current = null;
    try { viewerRef.current?.close(); } catch { /* closed by user */ }
    viewerRef.current = null;
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    blobRef.current = "";
  }, []);

  const reload = useCallback(async () => {
    if (lockRef.current) return;
    loadRef.current?.abort(); viewRef.current?.abort(); dispose();
    const controller = new AbortController(); loadRef.current = controller;
    setLoading(true); setError(""); setMessage(""); setState(null); setForm(EMPTY);
    try {
      const loaded = await requestWorkingDraft({ authFetch, caseId, signal: controller.signal });
      if (!controller.signal.aborted) { setState(loaded); setUncertain(false); }
    } catch (err) { if (!controller.signal.aborted) setError(err.message); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [authFetch, caseId, dispose]);

  useEffect(() => {
    if (sessionId && canSupervise) reload(); else setLoading(false);
    return () => { loadRef.current?.abort(); saveRef.current?.abort(); viewRef.current?.abort(); dispose(); };
  }, [reload, sessionId, canSupervise, dispose]);

  const disabled = loading || busy || uncertain || !state?.can_prepare || !canSupervise || !sessionId;
  const latest = state?.history[0];
  function change(key, value) {
    setForm(current => ({ ...current, [key]: value, draft_acknowledged: key === "draft_acknowledged" ? value : false }));
  }

  async function save(event) {
    event.preventDefault();
    if (disabled || lockRef.current || !form.draft_acknowledged) return;
    lockRef.current = true; setBusy(true); setError(""); setMessage(""); dispose();
    const controller = new AbortController(); saveRef.current = controller;
    try {
      const next = await requestWorkingDraft({ authFetch, caseId, signal: controller.signal,
        body: { ...form, expected_source_sha256: state.source_sha256, expected_latest_id: state.latest_id } });
      if (controller.signal.aborted) return;
      setState(next); setForm(EMPTY);
      setMessage(`Versión ${next.history[0].sequence} guardada con su PDF. Sigue pendiente de revisión jurídica.`);
    } catch (err) {
      if (!controller.signal.aborted) { setError(err.message); setUncertain(true); setForm(EMPTY); }
    } finally { lockRef.current = false; if (!controller.signal.aborted) setBusy(false); }
  }

  async function openPdf(entry) {
    if (busy || loading || lockRef.current) return;
    viewRef.current?.abort(); dispose(); setError("");
    let viewer;
    try {
      viewer = window.open("about:blank", "_blank", "popup");
      if (!viewer) throw new Error("Permite las ventanas emergentes de RTM para abrir el PDF.");
      viewer.opener = null; viewer.document.title = "RTM · borrador de prueba";
      viewer.document.body.textContent = "Comprobando la versión del borrador…";
      viewerRef.current = viewer;
    } catch (err) { try { viewer?.close(); } catch {} setError(err.message); return; }
    const controller = new AbortController(); viewRef.current = controller;
    lockRef.current = true; setBusy(true);
    try {
      const bytes = await fetchWorkingDraftPdf({ authFetch, caseId, entry, signal: controller.signal });
      if (controller.signal.aborted || viewer.closed) return;
      blobRef.current = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      viewer.location.replace(blobRef.current);
      timerRef.current = setTimeout(dispose, 5 * 60 * 1000);
    } catch (err) { dispose(); if (!controller.signal.aborted) setError(err.message); }
    finally { lockRef.current = false; if (!controller.signal.aborted) setBusy(false); }
  }

  return <section id="ops-working-draft" aria-labelledby="working-draft-title" className="mt-5 rounded-2xl border border-blue-200 bg-white p-5 shadow-sm">
    <div className="flex flex-wrap items-start justify-between gap-3"><div>
      <h2 id="working-draft-title" className="text-lg font-semibold text-slate-900">Borrador de trabajo del recurso</h2>
      <p className="mt-1 max-w-3xl text-sm text-slate-600">Prueba local: prepara el escrito con los datos confirmados y completa los motivos y la petición. Cada guardado conserva una versión y su PDF.</p>
    </div><button type="button" className={BUTTON} disabled={loading || busy || !sessionId || !canSupervise} onClick={reload}>Recargar borrador</button></div>
    <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Pendiente de revisión jurídica. Este borrador no está aprobado para presentar. La guía ayuda a preparar las comprobaciones; los motivos y la petición requieren revisión del supervisor.</p>
    {loading ? <p role="status" className="mt-3 text-sm">Cargando preparación del borrador…</p> : null}
    {!canSupervise ? <p className="mt-3 text-sm">Se requiere una sesión individual de supervisor.</p> : null}
    {error ? <p role="alert" className="mt-3 whitespace-pre-wrap text-sm text-rose-800">{error}{uncertain ? " Recarga para comprobar el resultado antes de repetir el guardado." : ""}</p> : null}
    {message ? <p role="status" className="mt-3 text-sm text-emerald-800">{message}</p> : null}
    {state?.blockers.length ? <div className="mt-4 rounded-lg bg-slate-50 p-4 text-sm"><h3 className="font-semibold">Antes de preparar el borrador</h3><ul className="mt-2 list-disc space-y-1 pl-5">{state.blockers.map(item => <li key={item}>{item}</li>)}</ul><a href="#ops-facts-review" className="mt-3 inline-block font-semibold text-blue-800">Ir a la revisión de hechos</a></div> : null}
    {state?.can_prepare ? <>
      <dl className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-4 text-sm sm:grid-cols-2">{state.reviewed_facts.map(item => <div key={item.key} className="min-w-0"><dt className="font-semibold">{item.label}</dt><dd className="break-words whitespace-pre-wrap">{typeof item.value === "boolean" ? (item.value ? "Sí" : "No") : String(item.value)}</dd></div>)}</dl>
      <p className="mt-2 text-xs text-slate-600">Datos de la versión {state.facts_sequence}. Se incorporan automáticamente al escrito y se corrigen en «Hechos del expediente».</p>
      <ParkingPreparation guide={state.preparation_guide} disabled={disabled} onAdd={() => {
        try {
          const pending = appendParkingChecks(form.pending_notes, state.preparation_guide);
          change("pending_notes", pending); setError("");
          setMessage("Comprobaciones añadidas a las notas del borrador. Revísalas y guarda una versión para conservarlas.");
        } catch (err) { setError(err.message); }
      }} />
      <form onSubmit={save} className="mt-4"><fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
        <legend className="sr-only">Preparar una versión del borrador</legend>
        {latest ? <button type="button" className={BUTTON} onClick={() => { setForm({ ...EMPTY, grounds: latest.grounds, request_text: latest.request_text, pending_notes: latest.pending_notes }); setMessage("Texto de la última versión cargado. Revísalo y explica los cambios antes de guardar."); }}>Partir del texto de la última versión</button> : null}
        <label className="block text-sm font-medium">Motivos propuestos<textarea className={INPUT} rows={5} maxLength={20000} value={form.grounds} onChange={e => change("grounds", e.target.value)} placeholder="Explica los motivos y qué documentos los respaldan. Deja pendiente lo que aún no esté contrastado."/></label>
        <label className="block text-sm font-medium">Petición propuesta<textarea className={INPUT} rows={3} maxLength={6000} value={form.request_text} onChange={e => change("request_text", e.target.value)} placeholder="Concreta qué se solicita al organismo y por qué trámite."/></label>
        <label className="block text-sm font-medium">Documentos o comprobaciones pendientes<textarea className={INPUT} rows={3} maxLength={6000} value={form.pending_notes} onChange={e => change("pending_notes", e.target.value)}/></label>
        <label className="block text-sm font-medium">Motivo de esta versión<textarea className={INPUT} rows={2} required minLength={10} maxLength={2000} value={form.change_reason} onChange={e => change("change_reason", e.target.value)} placeholder="Indica qué estás preparando o qué has cambiado."/></label>
        <p className="text-xs text-slate-600">Puedes guardar el trabajo incompleto. Los apartados vacíos figurarán como pendientes en el PDF. Los textos propuestos necesitan revisión jurídica.</p>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" required checked={form.draft_acknowledged} onChange={e => change("draft_acknowledged", e.target.checked)}/>Confirmo que guardo un borrador de trabajo pendiente de revisión jurídica.</label>
        <button type="submit" disabled={disabled || !form.draft_acknowledged} className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{busy ? "Preparando…" : latest ? "Guardar nueva versión y PDF" : "Preparar primer borrador y PDF"}</button>
      </fieldset></form>
    </> : null}
    {latest ? <div className="mt-5 border-t border-slate-200 pt-4"><h3 className="font-semibold text-slate-900">Último borrador guardado · versión {latest.sequence}</h3>
      <p className={`mt-2 text-sm ${latest.current_source ? "text-slate-600" : "font-semibold text-amber-900"}`}>{latest.current_source ? "Preparado con los datos actuales. Revisión jurídica pendiente." : "Versión anterior: el expediente o sus requisitos han cambiado. Revisa los datos y prepara otra versión."}</p>
      <button type="button" className={`${BUTTON} mt-3`} disabled={loading || busy || uncertain} onClick={() => openPdf(latest)}>Abrir PDF del borrador guardado</button>
      <details className="mt-3 rounded-lg bg-slate-50 p-3"><summary className="cursor-pointer text-sm font-semibold">Leer el texto guardado</summary><pre className="mt-3 whitespace-pre-wrap break-words font-sans text-sm leading-6">{latest.content}</pre></details>
      <details className="mt-3 rounded-lg border border-slate-200 p-3"><summary className="cursor-pointer text-sm font-semibold">Historial de borradores ({state.history.length})</summary>{state.history.map(entry => <div key={entry.id} className="mt-3 border-t border-slate-200 pt-3 text-sm"><p className="font-semibold">Versión {entry.sequence} · {new Date(entry.created_at).toLocaleString("es-ES")}</p><p className="mt-1 whitespace-pre-wrap break-words">{entry.change_reason}</p><p className="mt-1 break-all text-xs text-slate-500">Supervisor: {entry.actor} · Hechos: versión {entry.facts_sequence}</p><button type="button" className={`${BUTTON} mt-2`} disabled={loading || busy || uncertain} onClick={() => openPdf(entry)}>Abrir PDF de la versión {entry.sequence}</button></div>)}</details>
    </div> : null}
    <Link className="mt-4 inline-block text-sm font-semibold text-blue-800" to={`/ops/manual?caseId=${encodeURIComponent(caseId)}#recurso`}>Ayuda para preparar el recurso</Link>
  </section>;
}

function ParkingPreparation({ guide, disabled, onAdd }) {
  if (!guide) return <p className="mt-4 text-sm text-slate-600">La guía de estacionamiento estará disponible al actualizar el servidor local y recargar el borrador.</p>;
  if (guide.status !== "review_required") return <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm">{guide.message}</p>;
  return <section aria-labelledby="parking-preparation-title" className="mt-5 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
    <h3 id="parking-preparation-title" className="font-semibold text-slate-900">Guía de estacionamiento</h3>
    <p className="mt-1 text-sm text-slate-700">Ocho comprobaciones antes de redactar los motivos. Los datos mostrados proceden de hechos confirmados; cada conclusión jurídica sigue pendiente de revisión.</p>
    <p className="mt-3 whitespace-pre-wrap rounded-lg bg-white p-3 text-sm"><strong>Hecho de partida: </strong>{String(guide.reported_fact.value)}</p>
    <div className="mt-3 space-y-2 text-sm font-medium text-amber-900"><p>{guide.procedure_note}</p><p>{guide.payment_note}</p></div>
    <ol className="mt-4 grid list-none gap-3 md:grid-cols-2">{guide.checks.map((check, index) => <li key={check.id} className="min-w-0 rounded-lg border border-slate-200 bg-white p-3">
      <h4 className="text-sm font-semibold">{index + 1}. {check.title}</h4>
      <p className="mt-1 text-sm leading-6 text-slate-700">{check.instruction}</p>
      <details className="mt-2 text-sm"><summary className="cursor-pointer text-blue-900">Datos disponibles ({check.fields.filter(field => field.value !== null).length}/{check.fields.length})</summary>
        <dl className="mt-2 space-y-2">{check.fields.map(field => <div key={field.key}><dt className="font-medium">{field.label}</dt><dd className="break-words whitespace-pre-wrap text-slate-600">{field.value === null ? "Pendiente de incorporar y contrastar." : typeof field.value === "boolean" ? (field.value ? "Sí" : "No") : String(field.value)}{field.sources.length ? <span className="block text-xs">Procedencia documental: página {Array.from(new Set(field.sources.map(source => source.page_index + 1))).join(", ")}. Consulta el original en la revisión de hechos.</span> : null}</dd></div>)}</dl>
      </details>
    </li>)}</ol>
    <button type="button" disabled={disabled} className={`${BUTTON} mt-4`} onClick={onAdd}>Añadir comprobaciones al borrador</button>
    <p className="mt-2 text-xs text-slate-600">Se añaden a «Documentos o comprobaciones pendientes». El texto que ya hayas escrito se conserva.</p>
    <details className="mt-4 text-sm"><summary className="cursor-pointer font-semibold text-blue-900">Fuentes oficiales y alcance de la guía</summary>
      <p className="mt-2 text-slate-600">Fuentes consultadas el {guide.checked_on.split("-").reverse().join("/")}. Comprueba la redacción aplicable a los hechos y la ordenanza local. El texto consolidado puede mostrar reformas todavía no vigentes en esa fecha.</p>
      <ul className="mt-2 space-y-2">{guide.references.map(ref => <li key={ref.id}><a href={ref.url} target="_blank" rel="noopener noreferrer" className="text-blue-900 underline">{ref.title}</a></li>)}</ul>
    </details>
  </section>;
}
