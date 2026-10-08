import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  FACT_FIELDS, factLabel, factValue, fetchFactsWorkspace, reviewBlockReason,
  originalSources, buildFactReviewBody, submitFactReview, missingFactGroups,
  prepareFactReviewProposal, buildFactReviewBatchBody,
  factsPreparationBlockReason, prepareReanalysisFacts, FactsReviewError,
} from "../lib/opsFactsReview.js";

const INPUT = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const BUTTON = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50";
const STATUS = { validated: "Confirmado", unresolved: "Pendiente", conflicted: "En conflicto", rejected: "Descartado" };
const EMPTY = { value: "", documentId: "", page: "", evidence: "", reason: "", checked: false, exclude: false };

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
  const [proposals, setProposals] = useState([]);
  const [batchChecked, setBatchChecked] = useState(false);
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
    setLoading(true); setError(""); setWorkspace(null); setField(""); setAdditionalField(""); setForm(EMPTY); setProposals([]); setBatchChecked(false);
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
    onEditingChange?.(!!field || !!proposals.length || saving);
    return () => onEditingChange?.(false);
  }, [field, proposals.length, saving, onEditingChange]);

  const record = workspace?.authority?.validated_facts?.latest_active;
  const blocked = reviewBlockReason(workspace, canSupervise, sessionId, authorizationVerified);
  const preparationBlocked = factsPreparationBlockReason(workspace, canSupervise, sessionId, authorizationVerified);
  const documents = originalSources(workspace);
  const disabled = loading || saving || externalBusy || stale || !!blocked || !documents.length;
  const entries = Object.entries(record?.facts?.facts || {});
  const pending = entries.filter(([, fact]) => fact.status !== "validated").length;
  const missingGroups = missingFactGroups(record);
  const adding = !!field && !Object.hasOwn(record?.facts?.facts || {}, field);
  const excluding = !!field && !adding && form.exclude;
  const canExclude = !!field && !adding && ["unresolved", "conflicted"].includes(record?.facts?.facts?.[field]?.status);


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
    setField(name); setError(""); setMessage(""); setBatchChecked(false);
    // Solo recuperar valores preparados en este formulario, nunca lecturas de IA.
    const prepared = proposals.find(item => item.field === name);
    setForm(prepared ? { ...EMPTY, ...prepared, checked: false } :
      { ...EMPTY, documentId: documents.length === 1 ? documents[0].id : "" });
  }
  function change(name, value) {
    setForm(current => ({ ...current, ...(name === "exclude" ? { value: "", evidence: "", reason: "" } : {}), [name]: value, checked: name === "checked" ? value : false }));
  }
  function currentProposal() {
    return { ...form, field, checked: false, sourceHash: record.payload_sha256,
      operation: adding ? "add" : excluding ? "exclude" : "correct" };
  }
  function stageCurrent() {
    if (disabled || lockRef.current) return;
    try {
      const proposal = currentProposal();
      proposal.previewValue = prepareFactReviewProposal({ ...proposal, record }).changes[0].value;
      const next = proposals.filter(item => item.field !== field);
      if (next.length >= 50) throw new FactsReviewError("La revisión conjunta admite hasta 50 datos.");
      setProposals([...next, proposal]); setBatchChecked(false);
      setField(""); setAdditionalField(""); setForm(EMPTY); setError("");
      setMessage("Dato preparado para revisión conjunta. Todavía no se ha guardado ni confirmado.");
    } catch (err) { setError(err.message); }
  }
  function removeProposal(name) {
    if (disabled || field) return;
    setProposals(current => current.filter(item => item.field !== name)); setBatchChecked(false);
  }
  async function save(event) {
    event.preventDefault();
    if (disabled || lockRef.current || proposals.length) return;
    let body;
    try { body = buildFactReviewBody({ record, field, ...form, operation: adding ? "add" : excluding ? "exclude" : "correct" }); }
    catch (err) { setError(err.message); return; }
    await persist(body, adding ? "Dato incorporado" : excluding ? "Lectura descartada" : "Corrección guardada");
  }
  async function saveBatch(event) {
    event.preventDefault();
    if (disabled || field || lockRef.current) return;
    let body;
    try { body = buildFactReviewBatchBody({ record, proposals, checked: batchChecked }); }
    catch (err) { setError(err.message); return; }
    await persist(body, "Revisión conjunta guardada");
  }
  async function persist(body, label) {
    lockRef.current = true; setSaving(true); setError(""); setMessage("");
    const controller = new AbortController();
    saveRef.current = controller;
    try {
      const saved = await submitFactReview({ authFetch, caseId, record, body, signal: controller.signal });
      if (controller.signal.aborted) return;
      setWorkspace(current => ({ ...current, authority: { ...current.authority,
        validated_facts: { ...current.authority.validated_facts, latest_active: saved } } }));
      setField(""); setAdditionalField(""); setForm(EMPTY); setProposals([]); setBatchChecked(false);
      setMessage(`${label} en la versión ${saved.sequence}. El borrador sigue pendiente de revisión final.`);
      onReviewed?.();
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message || "No se pudo comprobar el guardado. Recarga los hechos.");
        // También para una respuesta perdida: comprobar antes de repetir la escritura.
        recoveryRef.current = true; setStale(true); setField(""); setForm(EMPTY); setBatchChecked(false);
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
      <button type="button" className={BUTTON} onClick={reload} disabled={loading || saving || externalBusy || !sessionId || (!stale && (!!field || !!proposals.length))}>Recargar hechos</button>
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
          <td className="p-3">{Object.hasOwn(FACT_FIELDS, name) ? <button type="button" className={BUTTON} disabled={disabled || !!field} aria-label={`Revisar ${factLabel(name)}`} onClick={() => edit(name)}>Revisar</button> : <span className="text-xs text-slate-500">Revisión especializada</span>}</td>
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
    {proposals.length ? <form onSubmit={saveBatch} aria-label="Revisión conjunta de hechos" className="mt-5 rounded-xl border border-blue-300 bg-blue-50/40 p-4">
      <h3 className="font-semibold text-slate-900">Revisión conjunta · {proposals.length} datos preparados</h3>
      <p className="mt-2 text-sm text-slate-700">Contrasta cada valor, página y fragmento con el original. Esta preparación solo permanece en esta pestaña; se guardará en una nueva versión cuando confirmes la revisión.</p>
      <div className="mt-3 space-y-3">{proposals.map(item => <article key={item.field} className="rounded-lg border border-slate-200 bg-white p-3">
        <h4 className="font-semibold">{factLabel(item.field)} · {item.operation === "exclude" ? "Descartar lectura" : item.operation === "add" ? "Añadir dato" : "Corregir dato"}</h4>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.operation === "exclude" ? "Seguirá sin conocerse; no se asigna otro valor." : factValue(item.previewValue)}</p>
        <p className="mt-2 text-xs font-medium text-slate-600">Original {documents.findIndex(doc => doc.id === item.documentId) + 1} · página {item.page}</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm">{item.evidence}</p>
        <p className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-600">Motivo: {item.reason}</p>
        <div className="mt-2 flex gap-2">
          <button type="button" className={BUTTON} disabled={disabled || !!field} onClick={() => edit(item.field)} aria-label={`Editar propuesta ${factLabel(item.field)}`}>Editar</button>
          <button type="button" className={BUTTON} disabled={disabled || !!field} onClick={() => removeProposal(item.field)} aria-label={`Retirar propuesta ${factLabel(item.field)}`}>Retirar de la preparación</button>
        </div>
      </article>)}</div>
      <fieldset disabled={disabled || !!field} className="mt-4 space-y-3">
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={batchChecked} onChange={event => setBatchChecked(event.target.checked)} />
          He contrastado todos los datos preparados, sus páginas y fragmentos con los originales y confirmo esta revisión conjunta.</label>
        <button type="submit" disabled={disabled || !!field || !batchChecked} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Guardando…" : "Guardar revisión conjunta"}</button>
      </fieldset>
      {field ? <p className="mt-2 text-sm text-amber-900">Añade el dato abierto a la preparación o cancela su edición antes de confirmar el conjunto.</p> : null}
    </form> : null}
    {field ? <form onSubmit={save} className="mt-5 rounded-xl border border-blue-200 bg-blue-50/50 p-4">
      <h3 ref={editorRef} tabIndex={-1} className="font-semibold text-slate-900">{adding ? "Incorporar" : "Revisar"}: {factLabel(field)}</h3>
      <fieldset disabled={disabled} className="mt-3 grid gap-4 md:grid-cols-2">
        {canExclude ? <label className="flex items-start gap-2 text-sm md:col-span-2"><input className="mt-1" type="checkbox" checked={form.exclude} onChange={e => change("exclude", e.target.checked)} />Descartar esta lectura porque no consta en el original revisado. Se conservará en la versión anterior.</label> : null}
        {!excluding ? <label className="text-sm font-medium">Valor contrastado{FACT_FIELDS[field][1] === "boolean" ? <select id="ops-fact-value" className={INPUT} value={form.value} required onChange={e => change("value", e.target.value)}><option value="">Selecciona según el documento</option><option value="true">Sí</option><option value="false">No</option></select> : <input id="ops-fact-value" className={INPUT} type={FACT_FIELDS[field][1] === "date" ? "date" : "text"} inputMode={["number", "integer"].includes(FACT_FIELDS[field][1]) ? "decimal" : undefined} value={form.value} maxLength={4000} required onChange={e => change("value", e.target.value)} />}
          {field === "pago_multa_reducido" ? <span className="mt-1 block text-xs font-normal text-slate-600">Se refiere al pago de la multa a la Administración. El pago del servicio de RTM es independiente.</span> : null}
        </label> : <p className="text-sm text-slate-700 md:col-span-2">El dato seguirá sin conocerse. Documenta qué has comprobado y por qué descartas esta lectura; no se sustituirá por un cero, una fecha ni un «No».</p>}
        <label className="text-sm font-medium">Documento original<select className={INPUT} value={form.documentId} required onChange={e => change("documentId", e.target.value)}><option value="">Selecciona el original</option>{documents.map((doc, index) => <option key={doc.id} value={doc.id}>Original {index + 1} · {doc.id}</option>)}</select></label>
        <label className="text-sm font-medium">Página del original<input className={INPUT} type="number" min="1" max="10000" step="1" required value={form.page} onChange={e => change("page", e.target.value)} /><span className="mt-1 block text-xs font-normal text-slate-600">La primera página es la 1. Una imagen individual cuenta como una página.</span></label>
        <label className="text-sm font-medium">{excluding ? "Comprobación del original que justifica el descarte" : "Fragmento que respalda el dato"}<textarea className={INPUT} rows={2} minLength={3} maxLength={2000} required value={form.evidence} onChange={e => change("evidence", e.target.value)} /></label>
        <label className="text-sm font-medium md:col-span-2">{adding ? "Motivo de la incorporación" : excluding ? "Motivo del descarte" : "Motivo de la corrección"}<textarea className={INPUT} rows={2} minLength={3} maxLength={2000} required value={form.reason} onChange={e => change("reason", e.target.value)} /></label>
        <label className="flex items-start gap-2 text-sm md:col-span-2"><input className="mt-1" type="checkbox" checked={form.checked} required onChange={e => change("checked", e.target.checked)} />{excluding ? "He revisado el original y confirmo que esta lectura no consta; he indicado la página, la comprobación y el motivo." : "He contrastado este dato, su página y el fragmento con el documento original."}</label>
        <div className="flex flex-wrap gap-2 md:col-span-2"><button type="button" className={BUTTON} onClick={stageCurrent}>Añadir a revisión conjunta</button><button type="submit" disabled={!form.checked || disabled || !!proposals.length} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Guardando…" : "Guardar nueva versión"}</button><button type="button" className={BUTTON} onClick={() => { setField(""); setForm(EMPTY); }}>Cancelar</button></div>
      </fieldset>
      {proposals.length ? <p className="mt-2 text-sm text-slate-700">Añade este dato a la revisión conjunta para guardar toda la preparación a la vez.</p> : null}
      <p className="mt-3 text-xs text-slate-600">Este paso actualiza los hechos y la guía de preparación. Los borradores preparados con una versión anterior deberán revisarse. El cierre de hechos, la aprobación del recurso y la presentación requieren sus revisiones posteriores.</p>
    </form> : null}
  </section>;
}
