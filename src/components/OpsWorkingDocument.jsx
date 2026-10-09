import React, { useCallback, useEffect, useRef, useState } from "react";
import OpsWorkingDocumentVersions from "./OpsWorkingDocumentVersions.jsx";
import { factValue } from "../lib/opsFactsReview.js";
import { fetchWorkingDocument, fetchWorkingDocumentPdf } from "../lib/opsWorkingDocument.js";

const BUTTON = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50";
const LABELS = { reviewed: "Revisado documentalmente", verified: "Comprobado documentalmente", candidate: "Propuesta sin confirmar", declared: "Dato aportado",
  missing: "Pendiente", conflict: "Discrepancia", excluded: "Lectura descartada" };

export default function OpsWorkingDocument(props) {
  return <DocumentPanel key={`${props.caseId}:${props.sessionId}:${props.canSupervise}:${props.revision}:${props.authorizationVerified}`} {...props} />;
}

function DocumentPanel({ authFetch, caseId, sessionId, canSupervise, authorizationVerified,
  onDocument, externalBusy = false }) {
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(false);
  const [viewing, setViewing] = useState(false);
  const [error, setError] = useState("");
  const loadRef = useRef(null), viewRef = useRef(null), lockRef = useRef(false);
  const viewerRef = useRef(null), blobRef = useRef(""), timerRef = useRef(null);
  const callbackRef = useRef(onDocument);
  callbackRef.current = onDocument;
  const enabled = !!sessionId && canSupervise && authorizationVerified === true;

  const closePdf = useCallback(() => {
    clearTimeout(timerRef.current); timerRef.current = null;
    try { viewerRef.current?.close(); } catch { /* Already closed. */ }
    viewerRef.current = null;
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    blobRef.current = "";
  }, []);

  const reload = useCallback(async () => {
    if (!enabled || lockRef.current) return;
    loadRef.current?.abort(); viewRef.current?.abort(); closePdf();
    const controller = new AbortController(); loadRef.current = controller;
    setLoading(true); setError(""); setDocument(null); callbackRef.current?.(null);
    try {
      const result = await fetchWorkingDocument({ authFetch, caseId, signal: controller.signal });
      if (!controller.signal.aborted) { setDocument(result); callbackRef.current?.(result); }
    } catch (err) { if (!controller.signal.aborted) setError(err.message || "No se pudo consultar el escrito."); }
    finally { if (!controller.signal.aborted) setLoading(false); }
  }, [authFetch, caseId, enabled, closePdf]);

  useEffect(() => {
    if (enabled) reload();
    else callbackRef.current?.(null);
    return () => {
      loadRef.current?.abort(); viewRef.current?.abort(); closePdf(); callbackRef.current?.(null);
    };
  }, [enabled, reload, closePdf]);

  async function openPdf() {
    if (!document || !enabled || loading || externalBusy || lockRef.current) return;
    closePdf(); setError("");
    let viewer;
    try {
      viewer = window.open("about:blank", "_blank", "popup");
      if (!viewer) throw new Error("Permite las ventanas emergentes de RTM para abrir el PDF.");
      viewer.opener = null;
      viewer.document.title = "RTM · escrito para revisar";
      viewer.document.body.textContent = "Comprobando el PDF de la propuesta visible…";
      viewerRef.current = viewer;
    } catch (err) { try { viewer?.close(); } catch { /* No window remains. */ } setError(err.message); return; }
    const controller = new AbortController(); viewRef.current = controller;
    lockRef.current = true; setViewing(true);
    try {
      const bytes = await fetchWorkingDocumentPdf({ authFetch, caseId, document, signal: controller.signal });
      if (controller.signal.aborted || viewer.closed) return;
      blobRef.current = URL.createObjectURL(new Blob([bytes], { type: "application/pdf" }));
      viewer.location.replace(blobRef.current);
      timerRef.current = setTimeout(closePdf, 5 * 60 * 1000);
    } catch (err) { closePdf(); if (!controller.signal.aborted) setError(err.message); }
    finally { lockRef.current = false; if (!controller.signal.aborted) setViewing(false); }
  }

  const issues = document?.issues.filter(issue => issue.severity !== "info") || [];
  const confirmed = document?.fields.filter(field => ["reviewed", "verified"].includes(field.status)).length || 0;
  const candidates = document?.fields.filter(field => field.status === "candidate").length || 0;
  return <section id="ops-working-document" aria-labelledby="working-document-title" className="mt-5 rounded-2xl border border-blue-300 bg-white p-5 shadow-xs">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div><h2 id="working-document-title" className="text-xl font-semibold text-slate-900">Escrito para revisar</h2>
        <p className="mt-1 max-w-3xl text-sm text-slate-600">El escrito reúne los datos ya aportados y la lectura disponible. Empieza por su contenido y revisa las diferencias que se señalan.</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" className={BUTTON} onClick={reload} disabled={!enabled || loading || viewing || externalBusy}>{loading ? "Preparando vista…" : "Actualizar escrito"}</button>
        {document ? <button type="button" className={BUTTON} onClick={openPdf} disabled={loading || viewing || externalBusy}>{viewing ? "Comprobando PDF…" : "Abrir PDF"}</button> : null}
      </div>
    </div>
    {!enabled ? <p className="mt-3 text-sm text-slate-600">{!sessionId ? "Identifícate para consultar el escrito." : !canSupervise ? "La propuesta requiere una sesión individual de supervisor." : "La autorización firmada debe estar verificada para consultar el escrito."}</p> : null}
    {error ? <p role="alert" className="mt-3 text-sm text-rose-800">{error}</p> : null}
    {loading ? <p role="status" className="mt-4 text-sm text-slate-600">Preparando la vista a partir de la información ya guardada…</p> : null}
    {document ? <>
      <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold">
        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-amber-900">Borrador pendiente de revisión</span>
        <span className="rounded-full bg-slate-100 px-3 py-1.5 text-slate-700">{confirmed} datos confirmados · {candidates} propuestas</span>
      </div>
      {issues.length ? <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
        <h3 className="font-semibold text-amber-950">Diferencias y datos pendientes</h3>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-sm text-amber-950">{issues.map((issue, index) => <li key={`${issue.code}:${index}`}>{issue.message}</li>)}</ul>
      </div> : null}
      <article className="mt-4 rounded-xl border border-slate-200 bg-white px-5 py-6 sm:px-8" aria-label={document.title}>
        <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-7 text-slate-900">{document.content}</pre>
      </article>
      <p className="mt-3 text-xs text-slate-600">Esta vista y su PDF son una propuesta de trabajo. Las copias conservadas se consultan en «Versiones guardadas». Guardar no aprueba el escrito ni su presentación.</p>
      <details className="mt-4 rounded-xl border border-slate-200 p-4">
        <summary className="cursor-pointer font-semibold text-blue-900">Ver los datos utilizados y su procedencia</summary>
        <div className="mt-3 space-y-3">{document.fields.map(field => <div key={field.key} className="border-t border-slate-100 pt-3 text-sm">
          <div className="flex flex-wrap justify-between gap-2"><h4 className="font-semibold text-slate-900">{field.label}</h4><span className={["reviewed", "verified"].includes(field.status) ? "text-emerald-800" : "text-amber-900"}>{LABELS[field.status]}</span></div>
          <p className="mt-1 whitespace-pre-wrap break-words">{factValue(field.value)}</p>
          {field.matches.length ? <p className="mt-1 text-xs text-slate-600">Coincide con otro dato disponible. Esta concordancia no confirma por sí sola el contenido.</p> : null}
          {field.sources.map((source, index) => <p key={index} className="mt-1 whitespace-pre-wrap break-words text-xs text-slate-600">
            {source.document_id ? `Documento ${source.document_id}` : "Fuente sin documento vinculado"}
            {Number.isInteger(source.page_index) ? ` · página ${source.page_index + 1}` : " · página pendiente"}
            {source.evidence_kind === "document_excerpt" ? ` — ${source.evidence}` : ""}
          </p>)}
        </div>)}</div>
      </details>
      <a href="#ops-facts-review" className="mt-4 inline-block text-sm font-semibold text-blue-800 underline">Corregir diferencias o completar datos</a>
    </> : null}
    <OpsWorkingDocumentVersions authFetch={authFetch} caseId={caseId} enabled={enabled}
      document={document} externalBusy={externalBusy || loading || viewing} />
  </section>;
}
