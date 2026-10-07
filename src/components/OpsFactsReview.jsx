import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FACT_FIELDS, factLabel, factValue, fetchFactsWorkspace, reviewBlockReason,
  originalSources, buildFactReviewBody, submitFactReview, missingFactGroups,
  factsPreparationBlockReason, prepareReanalysisFacts, FactsReviewError,
} from "../lib/opsFactsReview.js";

const INPUT = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const BUTTON = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50";
const STATUS = { validated: "Confirmado", unresolved: "Pendiente", conflicted: "En conflicto", rejected: "Descartado" };
const EMPTY = { value: "", documentId: "", page: "", evidence: "", reason: "", checked: false };

// La clave descarta inmediatamente los datos al cambiar de expediente o sesión.
export default function OpsFactsReview(props) {
  return <FactsReviewPanel key={`${props.caseId}:${props.sessionId}:${props.canSupervise}:${props.authorizationVerified === true}`} {...props} />;
}

function FactsReviewPanel({ authFetch, caseId, sessionId, canSupervise, authorizationVerified = false, onReviewed, onEditingChange, externalBusy = false }) {
  const [workspace, setWorkspace] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [stale, setStale] = useState(false);
  const [field, setField] = useState("");
  const [additionalField, setAdditionalField] = useState("");
  const [form, setForm] = useState(EMPTY);
  const loadRef = useRef(null);
  const saveRef = useRef(null);
  const lockRef = useRef(false);
  const editorRef = useRef(null);
  const recoveryRef = useRef(false);
  const reviewedRef = useRef(onReviewed);
  useEffect(() => { reviewedRef.current = onReviewed; }, [onReviewed]);

  const reload = useCallback(async () => {
    if (lockRef.current) return;
    loadRef.current?.abort();
    const controller = new AbortController();
    loadRef.current = controller;
    setLoading(true); setError(""); setWorkspace(null); setField(""); setAdditionalField(""); setForm(EMPTY);
    try {
      const data = await fetchFactsWorkspace({ authFetch, caseId, signal: controller.signal });
      if (!controller.signal.aborted) {
        setWorkspace(data); setStale(false);
        if (recoveryRef.current && data.authority?.validated_facts?.latest_active) reviewedRef.current?.();
        recoveryRef.current = false;
      }
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message || "No se pudieron cargar los hechos.");
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [authFetch, caseId]);

  useEffect(() => {
    if (sessionId) reload();
    else setLoading(false);
    return () => { loadRef.current?.abort(); saveRef.current?.abort(); };
  }, [reload, sessionId]);
  useEffect(() => {
    if (field) editorRef.current?.focus();
  }, [field]);

  useEffect(() => {
    onEditingChange?.(!!field || saving);
    return () => onEditingChange?.(false);
  }, [field, saving, onEditingChange]);

  const record = workspace?.authority?.validated_facts?.latest_active;
  const blocked = reviewBlockReason(workspace, canSupervise, sessionId, authorizationVerified);
  const preparationBlocked = factsPreparationBlockReason(workspace, canSupervise, sessionId, authorizationVerified);
  const documents = originalSources(workspace);
  const disabled = loading || saving || externalBusy || stale || !!blocked || !documents.length;
  const entries = Object.entries(record?.facts?.facts || {});
  const pending = entries.filter(([, fact]) => fact.status !== "validated").length;
  const missingGroups = missingFactGroups(record);
  const adding = !!field && !Object.hasOwn(record?.facts?.facts || {}, field);


  async function prepare() {
    if (loading || saving || externalBusy || stale || preparationBlocked || lockRef.current) return;
    lockRef.current = true; setSaving(true); setError(""); setMessage("");
    const controller = new AbortController();
    saveRef.current = controller;
    try {
      const saved = await prepareReanalysisFacts({
        authFetch, workspace, caseId, canSupervise, sessionId, authorizationVerified, signal: controller.signal,
      });
      if (controller.signal.aborted) return;
      setWorkspace(current => ({ ...current, authority: { ...current.authority,
        validated_facts: { ...current.authority?.validated_facts, latest_active: saved } } }));
      setMessage("Hechos preparados. Contrasta los datos con el original antes de confirmarlos y continuar el estudio.");
      onReviewed?.();
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err instanceof FactsReviewError ? err.message : "No se pudo comprobar la preparación. Pulsa Recargar hechos antes de volver a intentarlo.");
        recoveryRef.current = true; setStale(true);
      }
    } finally {
      lockRef.current = false;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  function edit(name) {
    if (disabled) return;
    setField(name); setError(""); setMessage("");
    // No copiar una propuesta de IA al valor que debe contrastar la persona.
    setForm({ ...EMPTY, documentId: documents.length === 1 ? documents[0].id : "" });
  }
  function change(name, value) {
    setForm(current => ({ ...current, [name]: value, checked: name === "checked" ? value : false }));
  }
  async function save(event) {
    event.preventDefault();
    if (disabled || lockRef.current) return;
    let body;
    try { body = buildFactReviewBody({ record, field, ...form, operation: adding ? "add" : "correct" }); }
    catch (err) { setError(err.message); return; }
    lockRef.current = true; setSaving(true); setError(""); setMessage("");
    const controller = new AbortController();
    saveRef.current = controller;
    try {
      const saved = await submitFactReview({ authFetch, caseId, record, body, signal: controller.signal });
      if (controller.signal.aborted) return;
      setWorkspace(current => ({ ...current, authority: { ...current.authority,
        validated_facts: { ...current.authority.validated_facts, latest_active: saved } } }));
      setField(""); setAdditionalField(""); setForm(EMPTY);
      setMessage(`${adding ? "Dato incorporado" : "Corrección guardada"} en la versión ${saved.sequence}. El borrador sigue pendiente de revisión final.`);
      onReviewed?.();
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message || "No se pudo comprobar el guardado. Recarga los hechos.");
        // También para una respuesta perdida: comprobar antes de repetir la escritura.
        recoveryRef.current = true; setStale(true); setField(""); setForm(EMPTY);
      }
    } finally {
      lockRef.current = false;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  return <section id="ops-facts-review" aria-labelledby="facts-review-title" className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="facts-review-title" className="text-lg font-semibold text-slate-900">Hechos del expediente</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">Contrasta cada dato con el original. Puedes corregir los datos existentes o añadir los que falten; cada guardado conserva la versión anterior, el supervisor y el motivo.</p></div>
      <button type="button" className={BUTTON} onClick={reload} disabled={loading || saving || externalBusy || !sessionId}>Recargar hechos</button>
    </div>
    {error ? <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
    {message ? <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
    {loading ? <p role="status" className="mt-4 text-sm text-slate-600">Cargando hechos…</p> : null}
    {!loading && blocked ? <p className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{blocked}</p> : null}

    {!loading && workspace && !record ? <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
      <h3 className="font-semibold text-slate-900">Preparar los hechos de la lectura</h3>
      <p className="mt-2 text-sm text-slate-700">Utiliza la lectura ya guardada para crear el borrador de hechos. Después podrás contrastar y corregir cada dato con el original. Este paso no vuelve a ejecutar la IA ni genera el recurso.</p>
      {preparationBlocked ? <p className="mt-2 text-sm text-amber-900">{preparationBlocked}</p> : null}
      <button type="button" className={`${BUTTON} mt-3`} onClick={prepare}
        disabled={saving || externalBusy || stale || !!preparationBlocked}>
        {saving ? "Preparando hechos…" : "Preparar hechos para revisar"}
      </button>
    </div> : null}

    {record ? <>
      <div className="my-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-slate-100 px-3 py-1.5">Versión {record.sequence} · {record.frozen ? "Cerrada" : "Borrador"}</span>
        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-900">{pending} {pending === 1 ? "dato pendiente o por revisar" : "datos pendientes o por revisar"}</span>
      </div>
      <p className="mb-3 text-xs text-slate-600">El contador incluye los datos ya incorporados. Puede faltar información necesaria para preparar el recurso.</p>
      {!documents.length ? <p className="mb-3 text-sm text-amber-800">No hay documentos originales vinculados disponibles para respaldar una corrección.</p> : null}
      <div className="overflow-x-auto"><table className="w-full text-left text-sm">
        <caption className="sr-only">Datos del borrador y procedencia documental</caption>
        <thead className="bg-slate-50 text-xs text-slate-600"><tr><th scope="col" className="p-3">Dato</th><th scope="col" className="p-3">Valor y procedencia</th><th scope="col" className="p-3">Estado</th><th scope="col" className="p-3">Revisión</th></tr></thead>
        <tbody>{entries.map(([name, fact]) => <tr key={name} className="border-b border-slate-100 align-top">
          <th scope="row" className="p-3 font-medium text-slate-900">{factLabel(name)}</th>
          <td className="max-w-xl p-3"><div className="whitespace-pre-wrap break-words">{factValue(fact.value)}</div>
            {(fact.sources?.length || fact.notes?.length || fact.conflicts?.length) ? <details className="mt-2 text-xs text-slate-600"><summary className="cursor-pointer">Ver procedencia y observaciones</summary>
              {(fact.sources || []).map((source, index) => <p className="mt-2 whitespace-pre-wrap break-words" key={index}>
                {source.source_type === "operator_document_review" ? "Revisión humana" : "Lectura documental"} · {source.document_id}
                {Number.isInteger(source.page_index) ? ` · página ${source.page_index + 1}` : " · página sin confirmar"}
                {source.evidence ? ` — ${source.evidence}` : ""}</p>)}
              {[...(fact.conflicts || []), ...(fact.notes || [])].map((note, index) => <p key={index} className="mt-2 whitespace-pre-wrap break-words">{note}</p>)}
            </details> : null}</td>
          <td className={`p-3 font-medium ${fact.status === "validated" ? "text-emerald-800" : "text-amber-800"}`}>{STATUS[fact.status] || "Por revisar"}</td>
          <td className="p-3">{Object.hasOwn(FACT_FIELDS, name) ? <button type="button" className={BUTTON} disabled={disabled} aria-label={`Revisar ${factLabel(name)}`} onClick={() => edit(name)}>Revisar</button> : <span className="text-xs text-slate-500">Revisión especializada</span>}</td>
        </tr>)}</tbody>
      </table></div>
      {record.facts.conflicts?.length ? <p className="mt-3 text-sm text-amber-900">Conflictos del borrador: {record.facts.conflicts.join(" · ")}</p> : null}
      {missingGroups.length ? <details className="mt-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
        <summary className="cursor-pointer text-sm font-semibold text-blue-900">Añadir un dato que falta</summary>
        <p className="mt-2 max-w-3xl text-sm text-slate-700">Incorpora únicamente información que puedas contrastar en un original vinculado. Si no consta, déjala pendiente; no selecciones «No» por falta de información.</p>
        <div className="mt-3 flex flex-wrap items-end gap-3">
          <label className="min-w-0 flex-1 basis-64 text-sm font-medium">Dato a incorporar<select id="ops-additional-fact" className={INPUT} disabled={disabled || !!field} value={additionalField} onChange={e => setAdditionalField(e.target.value)}>
            <option value="">Selecciona el dato</option>{missingGroups.map(group => <optgroup key={group.label} label={group.label}>{group.fields.map(key => <option key={key} value={key}>{factLabel(key)}</option>)}</optgroup>)}
          </select></label>
          <button type="button" className={BUTTON} disabled={disabled || !!field || !additionalField} onClick={() => edit(additionalField)}>Incorporar este dato</button>
        </div>
        {field ? <p className="mt-2 text-xs text-slate-600">Guarda o cancela la edición abierta antes de incorporar otro dato.</p> : null}
      </details> : null}
    </> : null}
    {field ? <form onSubmit={save} className="mt-5 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
      <h3 ref={editorRef} tabIndex={-1} className="font-semibold text-slate-900">{adding ? "Incorporar" : "Revisar"}: {factLabel(field)}</h3>
      <fieldset disabled={disabled} className="mt-3 grid gap-4 md:grid-cols-2">
        <label className="text-sm font-medium">Valor contrastado{FACT_FIELDS[field][1] === "boolean" ? <select id="ops-fact-value" className={INPUT} value={form.value} required onChange={e => change("value", e.target.value)}><option value="">Selecciona según el documento</option><option value="true">Sí</option><option value="false">No</option></select> : <input id="ops-fact-value" className={INPUT} type={FACT_FIELDS[field][1] === "date" ? "date" : "text"} inputMode={["number", "integer"].includes(FACT_FIELDS[field][1]) ? "decimal" : undefined} value={form.value} maxLength={4000} required onChange={e => change("value", e.target.value)} />}
          {field === "pago_multa_reducido" ? <span className="mt-1 block text-xs font-normal text-slate-600">Se refiere al pago de la multa a la Administración. El pago del servicio de RTM es independiente.</span> : null}
        </label>
        <label className="text-sm font-medium">Documento original<select className={INPUT} value={form.documentId} required onChange={e => change("documentId", e.target.value)}><option value="">Selecciona el original</option>{documents.map((doc, index) => <option key={doc.id} value={doc.id}>Original {index + 1} · {doc.id}</option>)}</select></label>
        <label className="text-sm font-medium">Página del original<input className={INPUT} type="number" min="1" max="10000" step="1" required value={form.page} onChange={e => change("page", e.target.value)} /><span className="mt-1 block text-xs font-normal text-slate-600">La primera página es la 1. Una imagen individual cuenta como una página.</span></label>
        <label className="text-sm font-medium">Fragmento que respalda el dato<textarea className={INPUT} rows={2} minLength={3} maxLength={2000} required value={form.evidence} onChange={e => change("evidence", e.target.value)} /></label>
        <label className="text-sm font-medium md:col-span-2">{adding ? "Motivo de la incorporación" : "Motivo de la corrección"}<textarea className={INPUT} rows={2} minLength={3} maxLength={2000} required value={form.reason} onChange={e => change("reason", e.target.value)} /></label>
        <label className="flex items-start gap-2 text-sm md:col-span-2"><input className="mt-1" type="checkbox" checked={form.checked} required onChange={e => change("checked", e.target.checked)} />He contrastado este dato, su página y el fragmento con el documento original.</label>
        <div className="flex flex-wrap gap-2 md:col-span-2"><button type="submit" disabled={!form.checked || disabled} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Guardando…" : "Guardar nueva versión"}</button><button type="button" className={BUTTON} onClick={() => { setField(""); setForm(EMPTY); }}>Cancelar</button></div>
      </fieldset>
      <p className="mt-3 text-xs text-slate-600">Este paso actualiza los hechos y la guía de preparación. Los borradores preparados con una versión anterior deberán revisarse. El cierre de hechos, la aprobación del recurso y la presentación requieren sus revisiones posteriores.</p>
    </form> : null}
  </section>;
}
