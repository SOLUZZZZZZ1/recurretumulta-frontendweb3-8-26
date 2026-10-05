import OpsStudyReview from "./OpsStudyReview.jsx";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ACTIONS, STAGES, fetchStudy, buildStudyAction, submitStudyAction } from "../lib/opsCoreStudy.js";

const BUTTON = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50";
const CONFIRM = {
  freeze_facts: "He revisado los hechos de esta versión y sus documentos originales y confirmo su cierre.",
  resolve_family: "Confirmo que quiero clasificar el expediente a partir de los hechos cerrados.",
  lock_family: "He revisado la clasificación y sus evidencias y confirmo que corresponde al expediente.",
  build_preview: "Confirmo la preparación de una previa basada en estos hechos y esta clasificación.",
};

export default function OpsCoreStudy(props) {
  return <StudyPanel key={`${props.caseId}:${props.sessionId}:${props.canSupervise}:${props.factsRevision}`} {...props} />;
}
function StudyPanel({ authFetch, caseId, sessionId, canSupervise, editingFacts, onAdvanced, onBusyChange }) {
  const [study, setStudy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [reviewNotes, setReviewNotes] = useState("");
  const loadRef = useRef(null);
  const saveRef = useRef(null);
  const lockRef = useRef(false);
  const lastStateRef = useRef(null);
  const advancedRef = useRef(onAdvanced);
  advancedRef.current = onAdvanced;

  const reload = useCallback(async () => {
    if (lockRef.current) return;
    loadRef.current?.abort();
    const controller = new AbortController();
    loadRef.current = controller;
    setLoading(true); setStudy(null); setError(""); setMessage(""); setConfirmed(false); setReviewNotes("");
    try {
      if (!sessionId) throw new Error("Identifícate para consultar el estudio.");
      const result = await fetchStudy({ authFetch, caseId, signal: controller.signal });
      if (!controller.signal.aborted) {
        if (lastStateRef.current && lastStateRef.current !== result.state_sha256) advancedRef.current?.();
        lastStateRef.current = result.state_sha256;
        setStudy(result); setUncertain(false);
      }
    } catch (err) {
      if (!controller.signal.aborted) setError(err.message || "No se pudo cargar el estudio.");
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, [authFetch, caseId, sessionId]);
  useEffect(() => {
    reload();
    return () => { loadRef.current?.abort(); saveRef.current?.abort(); };
  }, [reload]);
  useEffect(() => { onBusyChange?.(saving); return () => onBusyChange?.(false); }, [saving, onBusyChange]);
  useEffect(() => { if (editingFacts) setConfirmed(false); }, [editingFacts]);

  const action = study?.next_action;
  const blocked = loading || saving || uncertain || editingFacts || !canSupervise || !sessionId || !action;
  async function perform(operation) {
    if (loading || saving || uncertain || editingFacts || !canSupervise || !sessionId || lockRef.current) return;
    lockRef.current = true; setSaving(true); setError(""); setMessage("");
    const controller = new AbortController();
    saveRef.current = controller;
    try {
      const saved = await operation(controller.signal);
      if (controller.signal.aborted) return;
      lastStateRef.current = saved.state_sha256;
      setStudy(saved); setConfirmed(false); setReviewNotes("");
      setMessage(ACTIONS[saved.completed_action] + ": guardado.");
      onAdvanced?.();
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message || "No se pudo comprobar el guardado. Recarga el estudio.");
        setUncertain(true); setConfirmed(false);
      }
    } finally { lockRef.current = false; if (!controller.signal.aborted) setSaving(false); }
  }
  async function advance(event) {
    event.preventDefault();
    if (blocked || lockRef.current) return;
    let body;
    try { body = buildStudyAction(study, { confirmed, reviewNotes }); }
    catch (err) { setError(err.message); return; }
    await perform(signal => submitStudyAction({ authFetch, caseId: caseId, study, body, signal }));
  }

  const family = study?.family?.resolution;
  const preview = study?.stage === "preview_available" ? study.preview.preview : null;
  return <section id="ops-core-study" aria-labelledby="core-study-title" className="mt-5 rounded-2xl border border-blue-200 bg-white p-5 shadow-xs">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="core-study-title" className="text-lg font-semibold text-slate-900">Estudio del expediente</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">Continúa desde los hechos revisados: cierre, clasificación y preparación de la previa. Cada paso conserva la versión y el supervisor que lo confirma.</p></div>
      <button type="button" className={BUTTON} onClick={reload} disabled={loading || saving || editingFacts || !sessionId}>Recargar estudio</button>
    </div>
    {error ? <p role="alert" className="mt-3 rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p> : null}
    {message ? <p role="status" className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{message}</p> : null}
    {loading ? <p role="status" className="mt-4 text-sm">Cargando estudio…</p> : null}
    {study ? <>
      <p className="mt-4 font-semibold">{STAGES[study.stage]}</p>
      {study.facts ? <p className="mt-1 text-sm text-slate-600">Hechos: versión {study.facts.sequence} · {study.facts.frozen ? "Cerrada" : "Borrador"} · {Object.keys(study.facts.facts.facts).length} datos incorporados.</p> : null}
      {study.blockers.length ? <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-amber-900">{study.blockers.map((item, i) => <li key={i}>{item}</li>)}</ul> : null}
      {family ? <div className="mt-4 rounded-xl bg-slate-50 p-4">
        <h3 className="font-semibold">Clasificación: {family.family || "Pendiente de resolver"}{study.family.locked ? " · Confirmada" : ""}</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{family.evidence.map((item, i) => <li key={i}>{item.description}</li>)}</ul>
        {[...family.conflicts, ...family.unresolved].map((item, i) => <p key={i} className="mt-2 text-sm text-amber-900">{item}</p>)}
      </div> : null}
      {preview ? <div className="mt-4 space-y-4 rounded-xl border border-slate-200 p-4">
        <h3 className="font-semibold">Previa del estudio · {({ draft: "Borrador por revisar", ops_review: "En revisión", approved: "Aprobada", frozen: "Cerrada" })[study.preview.status]}</h3>
        <p className="text-sm">{preview.problem_summary}</p>
        <p className="text-sm">{preview.primary_strategy}</p>
        <details><summary className="cursor-pointer text-sm font-semibold">Hechos utilizados</summary><ul className="mt-2 list-disc pl-5 text-sm">{preview.validated_facts_summary.map((item, i) => <li key={i}>{item}</li>)}</ul></details>
        {preview.missing_items.length ? <div><h4 className="text-sm font-semibold text-amber-900">Comprobaciones pendientes</h4>
          <ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{preview.missing_items.map((item, i) => <li key={i}>{item.description}{item.severity === "blocking" ? " · Necesaria antes de aprobar" : ""}</li>)}</ul></div> : null}
        {preview.deadlines.map((item, i) => <p key={i} className="text-sm">{item.label}: {item.calculation_status === "unresolved" ? "pendiente de comprobar" : item.calculation_status}</p>)}
        <details><summary className="cursor-pointer text-sm font-semibold">Observaciones del especialista</summary><ul className="mt-2 list-disc space-y-2 pl-5 text-sm">{preview.risks.map((item, i) => <li key={i} className="break-words">{item}</li>)}</ul></details>
        <p className="text-sm font-semibold text-slate-700">La aprobación del recurso y su presentación requieren sus revisiones posteriores.</p>
      </div> : null}
      {canSupervise ? <OpsStudyReview key={study.state_sha256} study={study} authFetch={authFetch} perform={perform}
        disabled={loading || saving || uncertain || editingFacts || !sessionId || !!study.blockers.length} /> : null}
      {!canSupervise ? <p className="mt-3 text-sm text-slate-600">La continuación requiere una sesión individual de supervisor.</p> : null}
      {editingFacts ? <p className="mt-3 text-sm text-amber-900">Guarda o cancela la edición de hechos antes de continuar el estudio.</p> : null}
      {action && canSupervise ? <form onSubmit={advance} className="mt-4 rounded-xl bg-blue-50 p-4">
        <fieldset disabled={blocked} className="space-y-3">
          {action === "freeze_facts" ? <>
            <p className="text-sm">Revisa la versión {study.facts.sequence} y la procedencia de sus datos en «Hechos del expediente». El cierre conserva esta versión; para corregirla después será necesario abrir una nueva revisión.</p>
            <label className="block text-sm font-medium">Resumen de la revisión documental
              <textarea className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-2" rows={2} minLength={3} maxLength={2000} required value={reviewNotes} onChange={e => { setReviewNotes(e.target.value); setConfirmed(false); }} />
            </label>
          </> : null}
          <label className="flex items-start gap-2 text-sm"><input type="checkbox" className="mt-1" checked={confirmed} required onChange={e => setConfirmed(e.target.checked)} />{CONFIRM[action]}</label>
          <button type="submit" className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={blocked || !confirmed}>{saving ? "Guardando…" : ACTIONS[action]}</button>
        </fieldset>
      </form> : null}
    </> : null}
  </section>;
}
