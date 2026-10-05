import React, { useEffect, useRef, useState } from "react";
import { factLabel, factValue } from "../lib/opsFactsReview.js";
import { buildStudyAction, buildCheckReviewBody, buildDocumentMetadata,
  submitStudyAction, submitCheckReview, submitStudyDocument } from "../lib/opsCoreStudy.js";

const INPUT = "mt-1 w-full rounded-lg border border-slate-300 bg-white p-2 text-sm";
const BUTTON = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold disabled:opacity-50";
const SAVE = "rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50";

export default function OpsStudyReview({ study, disabled, authFetch, perform }) {
  const formRef = useRef(null);
  const [mode, setMode] = useState("");
  useEffect(() => { if (mode) { formRef.current?.scrollIntoView({ block: "center" }); formRef.current?.focus(); } }, [mode]);
  const [reason, setReason] = useState("");
  const [file, setFile] = useState(null);
  const [checked, setChecked] = useState(false);
  const [result, setResult] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  useEffect(() => { if (disabled) setChecked(false); }, [disabled]);
  function start(next) {
    setMode(next); setReason(""); setFile(null); setChecked(false);
    setResult(""); setNotes(""); setError("");
  }
  function change(setter, value) { setter(value); setChecked(false); setError(""); }
  async function save(event) {
    event.preventDefault();
    if (disabled) return;
    setError("");
    try {
      if (mode === "document") {
        const body = buildDocumentMetadata(study, { reason, confirmed: checked });
        if (!file) throw new Error("Selecciona el documento PDF.");
        await perform(signal => submitStudyDocument({ authFetch, study, body, file, signal }));
      } else if (mode === "reopen") {
        const body = buildStudyAction(study, { requestedAction: "reopen_facts", reason, confirmed: checked });
        await perform(signal => submitStudyAction({ authFetch, caseId: study.case_id, study, body, signal }));
      } else {
        const body = buildCheckReviewBody(study, { checkId: mode, result, notes, confirmed: checked });
        await perform(signal => submitCheckReview({ authFetch, study, body, signal }));
      }
    } catch (err) { setError(err.message); }
  }
  const review = study.parking_review;
  const activeCheck = review?.checks.find(c => c.id === mode);
  const confirmLabel = mode === "document"
    ? "Confirmo la incorporación del PDF y la apertura de una nueva revisión de hechos."
    : mode === "reopen"
      ? "Confirmo la apertura de una nueva revisión; la clasificación y la previa actuales quedarán sustituidas."
      : "He contrastado los datos y sus documentos, y confirmo el resultado y las observaciones de esta comprobación.";
  return <div className="mt-5 space-y-4">
    {review ? <section aria-label="Revisión de las comprobaciones" className="rounded-xl border border-blue-200 p-4">
      <h3 className="font-semibold">Revisar las comprobaciones</h3>
      <p className="mt-1 text-sm">{review.reviewed_count} de {review.checks.length} revisadas. Cada guardado conserva una nueva versión de la previa y la identidad del supervisor.</p>
      {review.reviewed_count === review.checks.length ? <p className="mt-2 text-sm font-semibold">Comprobaciones revisadas. La redacción de los motivos, la petición y la aprobación final siguen pendientes.</p> : null}
      <div className="mt-3 space-y-3">{review.checks.map(check => <article key={check.id} className="rounded-lg border border-slate-200 p-3">
        <h4 className="font-semibold">{check.title} · {check.review?.result === "reviewed" ? "Revisada" : check.review?.result === "needs_information" ? "Falta información" : "Pendiente"}</h4>
        <p className="mt-1 text-sm text-slate-700">{check.instruction}</p>
        <dl className="mt-2 space-y-1 text-sm">{check.fields.map(field => <div key={field.key}>
          <dt className="inline font-medium">{field.label}: </dt>
          <dd className="inline whitespace-pre-wrap break-words">{field.value === null ? "Falta incorporar y contrastar" : factValue(field.value)}
            {field.sources.map((source, i) => <span key={i} className="ml-1 text-xs text-slate-600">· Original {source.document_id} · página {source.page_index + 1}</span>)}
          </dd>
        </div>)}</dl>
        {check.review ? <div className="mt-2 text-sm">
          <p className="whitespace-pre-wrap break-words">{check.review.notes}</p>
          <p className="mt-1 text-xs text-slate-600">Revisión guardada: {check.review.reviewed_at} · {check.review.actor}</p>
        </div> : null}
        {check.missing_fact_keys.length ? <p className="mt-2 text-sm text-amber-900">Datos pendientes: {check.missing_fact_keys.map(factLabel).join(", ")}.</p> : null}
        <button type="button" className={BUTTON + " mt-3"} disabled={disabled || !!mode} onClick={() => start(check.id)}>Revisar: {check.title}</button>
      </article>)}</div>
      <p className="mt-3 text-sm text-slate-600">La revisión documenta el criterio del supervisor. La presencia de datos no confirma por sí sola el plazo, los motivos ni la procedencia del escrito.</p>
    </section> : null}
    {(study.can_add_document || study.can_reopen_facts) ? <section aria-label="Ampliar la documentación" className="rounded-xl border border-slate-200 p-4">
      <h3 className="font-semibold">Completar o corregir los hechos</h3>
      <p className="mt-1 text-sm text-slate-700">La versión actual se conserva en el historial. Una nueva revisión deja sin vigencia su clasificación y previa; después habrá que cerrar y clasificar los nuevos hechos.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {study.can_add_document ? <button type="button" className={BUTTON} disabled={disabled || !!mode} onClick={() => start("document")}>Incorporar documento adicional</button> : null}
        {study.can_reopen_facts ? <button type="button" className={BUTTON} disabled={disabled || !!mode} onClick={() => start("reopen")}>Abrir nueva revisión de hechos</button> : null}
      </div>
    </section> : null}
    {mode ? <form ref={formRef} tabIndex={-1} aria-label="Formulario de revisión" onSubmit={save} className="rounded-xl border border-blue-300 bg-blue-50 p-4">
      <h3 className="font-semibold">{mode === "document" ? "Incorporar documento y abrir revisión" : mode === "reopen" ? "Abrir nueva revisión de hechos" : "Revisar: " + activeCheck?.title}</h3>
      <fieldset disabled={disabled} className="mt-3 space-y-3">
        {mode === "document" ? <label className="block text-sm font-medium">Documento PDF (máximo 4 MB)
          <input className={INPUT} type="file" accept=".pdf,application/pdf" required onChange={event => change(setFile, event.target.files?.[0] || null)} />
          <span className="mt-1 block font-normal">El original anterior se conserva. El nuevo documento necesitará su propia revisión antes de confirmar datos.</span>
        </label> : null}
        {["document", "reopen"].includes(mode) ? <label className="block text-sm font-medium">Motivo de la nueva revisión
          <textarea className={INPUT} rows={3} required minLength={10} maxLength={2000} value={reason} onChange={e => change(setReason, e.target.value)} />
        </label> : <>
          <label className="block text-sm font-medium">Resultado de la comprobación
            <select className={INPUT} required value={result} onChange={e => change(setResult, e.target.value)}>
              <option value="">Selecciona el resultado</option>
              <option value="needs_information">Falta información o requiere corrección</option>
              <option value="reviewed" disabled={!activeCheck?.can_mark_reviewed}>Revisada con respaldo documental</option>
            </select>
          </label>
          <label className="block text-sm font-medium">Evidencia revisada y conclusión
            <textarea className={INPUT} rows={4} required minLength={10} maxLength={2000} value={notes} onChange={e => change(setNotes, e.target.value)} />
          </label>
        </>}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={checked} required onChange={e => setChecked(e.target.checked)} />{confirmLabel}</label>
        <div className="flex flex-wrap gap-2"><button type="submit" className={SAVE} disabled={!checked || disabled}>{mode === "document" ? "Incorporar PDF y abrir revisión" : mode === "reopen" ? "Abrir nueva revisión" : "Guardar revisión de la comprobación"}</button>
          <button type="button" className={BUTTON} onClick={() => start("")}>Cancelar</button></div>
      </fieldset>
      {error ? <p role="alert" className="mt-3 text-sm text-rose-800">{error}</p> : null}
    </form> : null}
  </div>;
}
