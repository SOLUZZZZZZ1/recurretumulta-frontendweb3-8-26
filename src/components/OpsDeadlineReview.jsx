import React, { useEffect, useRef, useState } from "react";

const INPUT = "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900";
const PROCEDURAL = { pending: "Pendiente de contrastar", no_changes: "Revisado, sin incidencias que alteren el cómputo", has_changes: "Hay incidencias que requieren valoración" };
const EMPTY = { rule: false, calendar: false, from: "", to: "", holidays: "", source: "", territory: "", procedural: "pending", notes: "", attested: false };

export default function OpsDeadlineReview(props) {
  return <ReviewForm key={`${props.caseId}:${props.sessionId}:${props.canSupervise}:${props.review.source_sha256}:${props.review.latest_id}`} {...props} />;
}

function ReviewForm({ caseId, sessionId, canSupervise, authFetch, onReviewed, review }) {
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const controllerRef = useRef(null);
  const lock = useRef(false);
  useEffect(() => () => controllerRef.current?.abort(), []);
  const change = (field, value) => setForm(current => ({ ...current, [field]: value, attested: field === "attested" ? value : false }));
  const disabled = saving || uncertain || !sessionId || !canSupervise;

  async function save(event) {
    event.preventDefault();
    if (disabled || lock.current || !form.attested) return;
    const body = {
      expected_source_sha256: review.source_sha256, expected_review_id: review.latest_id,
      rule_checked: form.rule, procedural_status: form.procedural, notes: form.notes.trim(), attested: form.attested,
      calendar: form.calendar ? { from_date: form.from, to_date: form.to,
        holidays: form.holidays.split(/[\s,;]+/).filter(Boolean),
        source: form.source.trim(), territory: form.territory.trim() } : null,
    };
    lock.current = true; setSaving(true); setError("");
    const controller = new AbortController(); controllerRef.current = controller;
    try {
      const response = await authFetch(`/api/ops/cases/${encodeURIComponent(caseId)}/post-filing/reviews`, {
        method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal,
        body: JSON.stringify(body),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.detail === "string" ? data.detail : "Revisa las fechas y los datos del formulario.");
      if (data.case_id !== caseId || !data.ok || !data.post_filing?.review?.latest_id) throw new Error("No se pudo comprobar la revisión guardada.");
      if (!controller.signal.aborted) await onReviewed();
    } catch (err) {
      if (!controller.signal.aborted) {
        setError(err.message || "No se pudo comprobar el guardado.");
        setUncertain(true);
      }
    } finally {
      lock.current = false;
      if (!controller.signal.aborted) setSaving(false);
    }
  }

  return <div className="mt-5 border-t border-slate-200 pt-4">
    <h3 className="font-semibold text-slate-900">Revisión del cómputo</h3>
    <p className="mt-1 text-sm text-slate-600">Guarda lo que has comprobado y lo que falta. Cada revisión conserva el supervisor, la fecha y sus observaciones.</p>
    {(review.history || []).length ? <details className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
      <summary className="cursor-pointer font-semibold">Historial de revisiones ({review.history.length})</summary>
      {review.history.map(entry => <div key={entry.id} className="mt-3 border-t border-slate-200 pt-3">
        <p>{new Date(entry.reviewed_at).toLocaleString("es-ES")} · {entry.applies_to_current_source ? "Sobre los datos actuales" : "Sobre una versión anterior del expediente"}</p>
        <p className="break-all text-xs text-slate-500">Supervisor: {entry.actor}</p>
        <p className="mt-1">{PROCEDURAL[entry.procedural_status]}</p>
        <p className="mt-1 whitespace-pre-wrap break-words">{entry.notes}</p>
        {entry.calendar ? <p className="mt-1 whitespace-pre-wrap break-words text-xs">Calendario: {entry.calendar.territory} · {entry.calendar.from_date} a {entry.calendar.to_date}. Fuente: {entry.calendar.source}. Festivos: {entry.calendar.holidays.join(", ") || "Ninguno en la cobertura declarada"}.</p> : <p className="text-xs">Calendario pendiente.</p>}
      </div>)}
    </details> : null}
    {canSupervise && sessionId ? <form onSubmit={save} className="mt-4 space-y-4">
      <fieldset disabled={disabled} className="space-y-4 disabled:opacity-60">
        <legend className="sr-only">Nueva revisión de plazos</legend>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={form.rule} onChange={e => change("rule", e.target.checked)} className="mt-1"/>He contrastado la regla aplicable y la fecha que inicia el plazo con el expediente.</label>
        <label className="block text-sm font-medium">Resoluciones, notificaciones, suspensiones y ampliaciones
          <select className={INPUT} value={form.procedural} onChange={e => change("procedural", e.target.value)}>{Object.entries(PROCEDURAL).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
        </label>
        {form.procedural === "has_changes" ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Describe la incidencia abajo. Se guardará la revisión y el vencimiento quedará pendiente de valoración.</p> : null}
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={form.calendar} onChange={e => change("calendar", e.target.checked)} className="mt-1"/>He comprobado el calendario completo aplicable al vencimiento.</label>
        {form.calendar ? <div className="space-y-3 rounded-lg bg-slate-50 p-3">
          <p className="text-xs text-slate-600">Indica el ámbito y la fuente, incluidos los festivos que correspondan. La cobertura debe incluir la referencia y el siguiente día hábil. En este expediente ficticio, identifica expresamente cualquier calendario de prueba.</p>
          <label className="block text-sm">Ámbito territorial y órgano o registro<input className={INPUT} required minLength={3} maxLength={300} value={form.territory} onChange={e => change("territory", e.target.value)}/></label>
          <label className="block text-sm">Fuente del calendario y criterio de aplicación<textarea className={INPUT} required minLength={10} maxLength={1500} value={form.source} onChange={e => change("source", e.target.value)}/></label>
          <div className="grid gap-3 sm:grid-cols-2"><label className="block min-w-0 text-sm">Cobertura desde<input type="date" className={INPUT} required value={form.from} onChange={e => change("from", e.target.value)}/></label><label className="block min-w-0 text-sm">Cobertura hasta<input type="date" className={INPUT} required value={form.to} onChange={e => change("to", e.target.value)}/></label></div>
          <label className="block text-sm">Festivos dentro de la cobertura (AAAA-MM-DD, uno por línea)<textarea className={INPUT} maxLength={5000} rows={3} value={form.holidays} onChange={e => change("holidays", e.target.value)}/></label>
          <p className="text-xs text-slate-600">Sábados y domingos ya se consideran inhábiles. Deja la lista vacía solo si has comprobado que no hay otros días inhábiles en esa cobertura.</p>
        </div> : null}
        <label className="block text-sm font-medium">Documentos contrastados, resultado y cuestiones pendientes<textarea className={INPUT} rows={3} required minLength={10} maxLength={3000} value={form.notes} onChange={e => change("notes", e.target.value)}/></label>
        <label className="flex items-start gap-2 text-sm"><input type="checkbox" required checked={form.attested} onChange={e => change("attested", e.target.checked)} className="mt-1"/>Confirmo personalmente las comprobaciones y los extremos pendientes indicados.</label>
        <button type="submit" disabled={!form.attested || disabled} className="rounded-lg bg-blue-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">{saving ? "Guardando revisión…" : "Guardar revisión"}</button>
      </fieldset>
    </form> : <p className="mt-3 text-sm text-slate-600">Una sesión de supervisor puede registrar la revisión.</p>}
    {error ? <p role="alert" className="mt-3 text-sm text-rose-800">{error} Recarga el expediente para comprobar el estado antes de volver a guardar.</p> : null}
  </div>;
}
