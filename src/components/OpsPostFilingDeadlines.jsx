import React from "react";
import OpsDeadlineReview from "./OpsDeadlineReview.jsx";

function dateLabel(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return "Pendiente";
  return value.split("-").reverse().join("/");
}

export default function OpsPostFilingDeadlines({ projection, loading, caseId, sessionId, canSupervise, authFetch, onReviewed }) {
  const clock = projection?.status === "presented_simulated" && projection.synthetic === true
    ? projection.calculation : null;
  return <section id="ops-post-filing-deadlines" aria-labelledby="post-filing-title" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="post-filing-title" className="text-lg font-semibold text-slate-900">Plazos tras la presentación</h2>
      {clock ? <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-900">Presentada · simulación</span> : null}
    </div>
    {loading ? <p role="status" className="mt-3 text-sm text-slate-600">Comprobando presentación…</p> : <>
      <p className="mt-3 text-sm text-slate-600">{projection?.detail || "El seguimiento necesita una presentación registrada y su justificante."}</p>
      {clock ? <>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-blue-50 p-4"><p className="text-xs font-semibold text-blue-800">Desde la presentación simulada</p>
            <p className="mt-1 text-3xl font-bold text-blue-950">{clock.elapsed_calendar_days} <span className="text-base font-medium">días naturales</span></p>
            <p className="mt-2 text-xs text-blue-800">Presentación: {dateLabel(clock.filing_date)}</p>
            <p className="mt-1 break-words text-xs text-blue-800">Registro: {projection.registration_number}</p></div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4"><p className="text-xs font-semibold text-amber-900">Fecha de referencia del cómputo</p>
            <p className="mt-1 text-2xl font-bold text-amber-950">{dateLabel(clock.reference_due_on)}</p>
            <p className="mt-2 text-sm text-amber-900">{clock.days_to_reference >= 0 ? `${clock.days_to_reference} días hasta la fecha de referencia` : `Fecha de referencia superada hace ${Math.abs(clock.days_to_reference)} días`}</p>
            <p className="mt-1 text-xs font-semibold text-amber-900">{clock.legal_due_on ? "Referencia inicial del cálculo" : "Vencimiento definitivo pendiente de revisión"}</p></div>
        </div>
        {clock.legal_due_on ? <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-950"><p className="text-sm font-semibold">Fecha calculada con datos revisados · simulación</p><p className="mt-1 text-2xl font-bold">{dateLabel(clock.legal_due_on)}</p><p className="mt-1 text-sm">{clock.days_to_legal_due >= 0 ? `${clock.days_to_legal_due} días hasta la fecha revisada` : `Fecha revisada superada hace ${Math.abs(clock.days_to_legal_due)} días`}</p><p className="mt-2 text-xs">Cualquier nueva documentación o incidencia requiere revisar de nuevo el cómputo.</p></div> : null}
        <dl className="mt-4 space-y-2 text-sm text-slate-700">
          <div><dt className="font-semibold">Trámite simulado</dt><dd>{clock.filing_kind === "traffic_allegations" ? "Alegaciones a una denuncia de tráfico" : "Recurso de reposición de tráfico"}</dd></div>
          <div><dt className="font-semibold">Regla aplicable</dt><dd>{clock.rule} · {clock.period}</dd></div>
          <div><dt className="font-semibold">{clock.anchor_label}</dt><dd>{dateLabel(clock.anchor_on)}</dd></div>
        </dl>
        <p className="mt-3 text-sm text-slate-700">{clock.explanation}</p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-amber-900">{(clock.review_reasons || []).map(reason => <li key={reason}>{reason}</li>)}</ul>
        <p className="mt-3 text-xs text-slate-600">Al llegar a la fecha se requiere revisión del expediente. RTM no declara automáticamente caducidad, silencio ni un resultado favorable.</p>
        <div className="mt-3 flex flex-wrap gap-3 text-xs font-medium text-blue-800"><a href={clock.legal_basis_url} target="_blank" rel="noreferrer">Consultar regla en el BOE</a><a href={clock.computation_basis_url} target="_blank" rel="noreferrer">Reglas de cómputo</a></div>
        <p className="mt-3 text-xs text-slate-500">Calculado al {dateLabel(clock.as_of)}. Se actualiza al recargar el expediente. La presentación simulada queda guardada.</p>
        {projection.review && caseId ? <OpsDeadlineReview review={projection.review} caseId={caseId} sessionId={sessionId} canSupervise={canSupervise} authFetch={authFetch} onReviewed={onReviewed}/> : null}
      </> : null}
    </>}
  </section>;
}
