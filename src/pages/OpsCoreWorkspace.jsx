import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  OPS_CORE_CLIENT_VERSION,
  downloadOpsDocument,
  executeCoreWorkspaceAction,
  getOperatorToken,
  loadCoreWorkspace,
} from "../lib/opsCoreApi.js";

const STAGE_COPY = {
  intake_incomplete: ["Entrada incompleta", "Faltan elementos mínimos antes del estudio."],
  study_payment_pending: ["Pago del estudio pendiente", "El backend ya ha validado la entrada y debe cobrar la tarifa autoritativa."],
  authorization_required: ["Autorización pendiente", "El expediente no puede entrar en revisión jurídica sin autorización."],
  reanalysis_required: ["Reanalysis pendiente", "Todavía no existe una extracción compatible con RTM CORE."],
  validated_facts_pending: ["Hechos pendientes", "Reanalysis está disponible, pero aún no se ha creado una versión de hechos."],
  validated_facts_review: ["Revisión de hechos", "OPS debe comprobar procedencia, confianza, conflictos y campos no resueltos."],
  family_resolution_pending: ["Familia pendiente", "Los hechos están congelados y CORE puede resolver la familia."],
  family_operator_review: ["Conflicto de familia", "La clasificación no puede cerrarse sin revisión de operador."],
  family_lock_pending: ["Bloqueo de familia pendiente", "La familia está resuelta, pero aún no es autoridad definitiva."],
  legal_preview_pending: ["Previa Jurídica pendiente", "Debe ejecutarse el especialista exacto de la familia bloqueada."],
  legal_preview_draft: ["Previa en borrador", "La estrategia está estructurada y debe enviarse a revisión OPS."],
  legal_preview_ops_review: ["Previa en revisión OPS", "Corresponde aprobarla o solicitar una nueva versión."],
  legal_preview_freeze_pending: ["Freeze pendiente", "La previa aprobada todavía no puede alimentar Generate."],
  generate_pending: ["Generate pendiente", "La previa está congelada y puede transformarse en DOCX y PDF."],
  resource_approval_pending: ["Documento final pendiente de aprobación", "OPS debe abrir y revisar el recurso antes de habilitar la presentación."],
  presentation_ready: ["Listo para presentación", "El documento final está aprobado; la presentación y el justificante permanecen separados."],
  submitted_followup: ["Presentado · seguimiento", "El expediente no puede regresar a Generate ni a aprobación de presentación."],
  case_closed: ["Expediente cerrado", "Solo procede consultar el histórico y la documentación."],
  operator_review: ["Revisión de operador", "La cadena requiere una comprobación manual antes de continuar."],
};

const STATUS_TONES = {
  validated: "success",
  resolved: "success",
  approved: "success",
  frozen: "success",
  final_ready: "success",
  ready_to_submit: "success",
  submitted: "success",
  conflicted: "danger",
  invalidated: "danger",
  changes_required: "danger",
  unresolved: "warn",
  operator_review: "warn",
  ops_review: "info",
  draft: "info",
};

const CHAIN_STEPS = [
  ["documents", "Documentos"],
  ["facts", "Hechos"],
  ["family", "Familia"],
  ["preview", "Previa"],
  ["generate", "Generate"],
  ["submission", "Presentación"],
];

function cx(...values) {
  return values.filter(Boolean).join(" ");
}

function formatDate(value) {
  if (!value) return "—";
  try {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString("es-ES");
  } catch {
    return String(value);
  }
}

function formatConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "—";
  return `${Math.round((number <= 1 ? number : number / 100) * 100)}%`;
}

function displayValue(value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (Array.isArray(value)) return value.map(displayValue).join(", ");
  if (typeof value === "object") {
    try {
      return JSON.stringify(value, null, 2);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function shortId(value) {
  const text = String(value || "");
  return text.length > 18 ? `${text.slice(0, 8)}…${text.slice(-6)}` : text || "—";
}

function toneForStatus(status) {
  return STATUS_TONES[String(status || "").toLowerCase()] || "default";
}

function Pill({ children, tone = "default" }) {
  const tones = {
    default: "border-slate-200 bg-slate-100 text-slate-700",
    success: "border-emerald-200 bg-emerald-100 text-emerald-800",
    warn: "border-amber-200 bg-amber-100 text-amber-800",
    danger: "border-rose-200 bg-rose-100 text-rose-800",
    info: "border-blue-200 bg-blue-100 text-blue-800",
    dark: "border-slate-700 bg-slate-800 text-white",
  };
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold", tones[tone] || tones.default)}>
      {children}
    </span>
  );
}

function Section({ id, title, subtitle, right, children, className = "" }) {
  return (
    <section id={id} className={cx("scroll-mt-24 rounded-3xl border border-slate-200 bg-white shadow-sm", className)}>
      <header className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          {subtitle ? <p className="mt-1 text-xs leading-5 text-slate-500">{subtitle}</p> : null}
        </div>
        {right}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function EmptyState({ children }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}

function KeyValueGrid({ items }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {items.map(([label, value, tone]) => (
        <div key={label} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-slate-400">{label}</div>
          <div className="mt-2 break-words text-sm font-semibold text-slate-900">
            {tone ? <Pill tone={tone}>{displayValue(value)}</Pill> : displayValue(value)}
          </div>
        </div>
      ))}
    </div>
  );
}

function ListBlock({ title, values, tone = "default" }) {
  const rows = Array.isArray(values) ? values.filter(Boolean) : [];
  if (!rows.length) return null;
  const borders = {
    default: "border-slate-200 bg-slate-50 text-slate-700",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    danger: "border-rose-200 bg-rose-50 text-rose-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-900",
    info: "border-blue-200 bg-blue-50 text-blue-900",
  };
  return (
    <div className={cx("rounded-2xl border p-4", borders[tone] || borders.default)}>
      <div className="text-xs font-semibold uppercase tracking-wide opacity-75">{title}</div>
      <ul className="mt-2 space-y-2 text-sm leading-6">
        {rows.map((value, index) => <li key={`${title}-${index}`}>• {displayValue(value)}</li>)}
      </ul>
    </div>
  );
}

function VersionHistory({ title, records, statusGetter }) {
  const rows = Array.isArray(records) ? records : [];
  if (!rows.length) return null;
  return (
    <details className="mt-4 rounded-2xl border border-slate-200 bg-slate-50">
      <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">
        {title} · {rows.length} versión{rows.length === 1 ? "" : "es"}
      </summary>
      <div className="space-y-2 border-t border-slate-200 p-4">
        {rows.map((record, index) => {
          const status = statusGetter?.(record) || record?.status || (record?.frozen ? "frozen" : record?.locked ? "locked" : "draft");
          return (
            <div key={record?.id || index} className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs md:flex-row md:items-center md:justify-between">
              <div>
                <div className="font-semibold text-slate-900">v{record?.sequence || rows.length - index} · {shortId(record?.id)}</div>
                <div className="mt-1 text-slate-500">Creada: {formatDate(record?.created_at)}</div>
              </div>
              <Pill tone={toneForStatus(status)}>{status || "sin estado"}</Pill>
            </div>
          );
        })}
      </div>
    </details>
  );
}

function Chain({ workspace }) {
  const authority = workspace?.authority || {};
  const facts = authority?.validated_facts?.latest_active;
  const family = authority?.family_resolution?.latest_active;
  const preview = authority?.legal_preview?.latest_active;
  const resource = authority?.generated_resource?.latest_active;
  const caseStatus = String(workspace?.case?.status || "").toLowerCase();

  const done = {
    documents: Boolean(workspace?.documents?.length),
    facts: Boolean(facts?.frozen),
    family: Boolean(family?.locked),
    preview: preview?.status === "frozen",
    generate: resource?.status === "final_ready",
    submission: caseStatus === "submitted" || caseStatus.startsWith("presentado"),
  };

  return (
    <div className="grid gap-2 sm:grid-cols-3 xl:grid-cols-6">
      {CHAIN_STEPS.map(([key, label], index) => (
        <div key={key} className={cx(
          "rounded-2xl border px-3 py-3 text-center",
          done[key] ? "border-emerald-200 bg-emerald-50" : "border-slate-200 bg-white",
        )}>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">{index + 1}</div>
          <div className="mt-1 text-sm font-semibold text-slate-900">{done[key] ? "✓ " : ""}{label}</div>
        </div>
      ))}
    </div>
  );
}

function ReadinessSection({ readiness }) {
  const issues = Array.isArray(readiness?.issues) ? readiness.issues : [];
  const quote = readiness?.quote || readiness?.review_quote || {};
  return (
    <Section
      id="readiness"
      title="Entrada y pago del estudio"
      subtitle="El precio y la aptitud del expediente los decide el backend, no el navegador."
      right={<Pill tone={readiness?.ready ? "success" : "warn"}>{readiness?.ready ? "Entrada completa" : "Pendiente"}</Pill>}
    >
      <KeyValueGrid items={[
        ["Servicio", quote?.department || readiness?.department || "—"],
        ["Tarifa", quote?.amount_eur != null ? `${quote.amount_eur} €` : readiness?.amount_eur != null ? `${readiness.amount_eur} €` : "—"],
        ["Código de precio", quote?.code || readiness?.quote_code || "—"],
      ]} />
      {issues.length ? (
        <div className="mt-4 space-y-2">
          {issues.map((issue, index) => (
            <div key={issue?.code || index} className={cx(
              "rounded-2xl border px-4 py-3 text-sm",
              issue?.blocking || issue?.severity === "blocking"
                ? "border-rose-200 bg-rose-50 text-rose-900"
                : "border-amber-200 bg-amber-50 text-amber-900",
            )}>
              <div className="font-semibold">{issue?.code || "Comprobación"}</div>
              <div className="mt-1">{issue?.message || issue?.description || displayValue(issue)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
          No hay incidencias documentales de entrada registradas por el CORE.
        </div>
      )}
    </Section>
  );
}

function DocumentsSection({ documents, onDownload, downloadingId }) {
  const rows = Array.isArray(documents) ? documents : [];
  return (
    <Section
      id="documents"
      title="Documentos del expediente"
      subtitle="La descarga permanece protegida por token OPS; no se expone la ubicación de almacenamiento."
      right={<Pill tone={rows.length ? "info" : "warn"}>{rows.length} documento{rows.length === 1 ? "" : "s"}</Pill>}
    >
      {!rows.length ? <EmptyState>No hay documentos vinculados.</EmptyState> : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {rows.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-200 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-slate-900">{item.kind || "documento"}</div>
                  <div className="mt-1 text-xs text-slate-500">{item.mime || "tipo no indicado"}</div>
                </div>
                <Pill tone="default">{Math.max(0, Math.round((item.size_bytes || 0) / 1024))} KB</Pill>
              </div>
              <div className="mt-3 text-xs text-slate-500">{formatDate(item.created_at)}</div>
              <button
                type="button"
                onClick={() => onDownload(item)}
                disabled={downloadingId === item.id}
                className="mt-3 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50"
              >
                {downloadingId === item.id ? "Descargando…" : "Descargar"}
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function ReanalysisInspection({ inspection }) {
  const result = inspection?.result || inspection;
  const snapshot = result?.facts;
  const factMap = snapshot?.facts || {};
  const entries = Object.entries(factMap);
  if (!inspection) return null;

  return (
    <Section
      id="reanalysis-inspection"
      title="Vista previa de Reanalysis → Hechos"
      subtitle="Esta vista no persiste ni congela nada. Sirve para revisar qué campos cruzarían el puente conservador."
      right={<Pill tone="info">Sin persistir</Pill>}
    >
      <div className="grid gap-3 lg:grid-cols-3">
        <ListBlock title="Aceptados" values={result?.accepted_fields} tone="success" />
        <ListBlock title="No resueltos" values={result?.unresolved_fields} tone="warn" />
        <ListBlock title="Conflictivos" values={result?.conflicted_fields} tone="danger" />
      </div>
      <div className="mt-4 space-y-3">
        {entries.map(([key, fact]) => (
          <div key={key} className="rounded-2xl border border-slate-200 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-mono text-sm font-semibold text-slate-900">{key}</div>
              <div className="flex gap-2">
                <Pill tone={toneForStatus(fact?.status)}>{fact?.status}</Pill>
                <Pill>{formatConfidence(fact?.confidence)}</Pill>
              </div>
            </div>
            <pre className="mt-3 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-3 text-xs text-slate-100">{displayValue(fact?.value)}</pre>
            <ListBlock title="Notas" values={fact?.notes} tone="warn" />
          </div>
        ))}
      </div>
    </Section>
  );
}

function ReanalysisSection({ reanalysis }) {
  const available = Boolean(reanalysis?.available);
  return (
    <Section
      id="reanalysis"
      title="Puente Reanalysis → ValidatedFacts"
      subtitle="La familia legacy, el OCR crudo y las estrategias anteriores no cruzan este límite."
      right={<Pill tone={available ? "success" : reanalysis?.status === "blocked" ? "danger" : "warn"}>{available ? "Disponible" : reanalysis?.status || "No disponible"}</Pill>}
    >
      <KeyValueGrid items={[
        ["Adaptador", reanalysis?.adapter_version || "—"],
        ["Campos aceptables", reanalysis?.accepted_fields?.length || 0],
        ["Campos no resueltos", reanalysis?.unresolved_fields?.length || 0, reanalysis?.unresolved_fields?.length ? "warn" : "success"],
        ["Conflictos", reanalysis?.conflicted_fields?.length || 0, reanalysis?.conflicted_fields?.length ? "danger" : "success"],
        ["Campos legacy ignorados", reanalysis?.ignored_fields?.length || 0],
        ["Estado", available ? "Preparado para revisión" : reanalysis?.detail || "Sin extracción compatible"],
      ]} />
      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <ListBlock title="Aceptados" values={reanalysis?.accepted_fields} tone="success" />
        <ListBlock title="No resueltos" values={reanalysis?.unresolved_fields} tone="warn" />
        <ListBlock title="Conflictivos" values={reanalysis?.conflicted_fields} tone="danger" />
      </div>
      <ListBlock title="Advertencias" values={reanalysis?.warnings} tone="warn" />
    </Section>
  );
}

function FactsSection({ authority }) {
  const latest = authority?.latest_active;
  const snapshot = latest?.facts;
  const entries = Object.entries(snapshot?.facts || {});
  return (
    <Section
      id="facts"
      title="Hechos validados"
      subtitle="Cada campo conserva estado, confianza, documentos, página, método y evidencia."
      right={latest ? <Pill tone={latest?.frozen ? "success" : "info"}>{latest?.frozen ? "Congelados" : "Borrador"}</Pill> : <Pill tone="warn">Sin versión</Pill>}
    >
      {!latest ? <EmptyState>Todavía no existe una versión de hechos.</EmptyState> : (
        <>
          <KeyValueGrid items={[
            ["Versión", snapshot?.version || "—"],
            ["Extractor", snapshot?.extractor_version || "—"],
            ["Secuencia", latest?.sequence || "—"],
            ["Creada por", latest?.created_by || "—"],
            ["Freeze", latest?.frozen_at ? formatDate(latest.frozen_at) : "Pendiente", latest?.frozen ? "success" : "warn"],
            ["Huella", shortId(latest?.payload_sha256)],
          ]} />
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <ListBlock title="Campos no resueltos" values={snapshot?.unresolved} tone="warn" />
            <ListBlock title="Conflictos globales" values={snapshot?.conflicts} tone="danger" />
            <ListBlock title="Documentos de origen" values={snapshot?.source_document_ids} tone="info" />
          </div>
          <div className="mt-5 space-y-3">
            {entries.map(([key, fact]) => (
              <details key={key} className="rounded-2xl border border-slate-200 bg-white" open={fact?.status !== "validated"}>
                <summary className="cursor-pointer list-none px-4 py-4">
                  <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-mono text-sm font-semibold text-slate-950">{key}</div>
                      <div className="mt-1 max-w-4xl break-words text-sm text-slate-700">{displayValue(fact?.value)}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Pill tone={toneForStatus(fact?.status)}>{fact?.status || "—"}</Pill>
                      <Pill>{formatConfidence(fact?.confidence)}</Pill>
                    </div>
                  </div>
                </summary>
                <div className="border-t border-slate-100 p-4">
                  <ListBlock title="Conflictos" values={fact?.conflicts} tone="danger" />
                  <ListBlock title="Notas" values={fact?.notes} tone="warn" />
                  <div className="mt-3 space-y-2">
                    {(fact?.sources || []).map((source, index) => (
                      <div key={`${source?.document_id}-${index}`} className="rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-950">
                        <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                          <div><b>Documento:</b> {source?.document_id}</div>
                          <div><b>Página:</b> {source?.page_index != null ? source.page_index + 1 : "—"}</div>
                          <div><b>Método:</b> {source?.extraction_method || "—"}</div>
                          <div><b>Confianza:</b> {formatConfidence(source?.confidence)}</div>
                        </div>
                        {source?.evidence ? <div className="mt-2 whitespace-pre-wrap rounded-lg bg-white/70 p-2"><b>Evidencia:</b> {source.evidence}</div> : null}
                      </div>
                    ))}
                  </div>
                </div>
              </details>
            ))}
          </div>
          <VersionHistory title="Historial de hechos" records={authority?.versions} statusGetter={(record) => record?.invalidated_at ? "invalidated" : record?.frozen ? "frozen" : "draft"} />
        </>
      )}
    </Section>
  );
}

function FamilySection({ authority }) {
  const latest = authority?.latest_active;
  const resolution = latest?.resolution;
  return (
    <Section
      id="family"
      title="Resolución única de familia"
      subtitle="Solo CORE decide la familia; el panel no ofrece selectores ni sobreescrituras."
      right={latest ? <Pill tone={latest?.locked ? "success" : toneForStatus(resolution?.status)}>{latest?.locked ? "Bloqueada" : resolution?.status}</Pill> : <Pill tone="warn">Sin resolución</Pill>}
    >
      {!latest ? <EmptyState>La familia todavía no ha sido resuelta.</EmptyState> : (
        <>
          <KeyValueGrid items={[
            ["Familia", resolution?.family || "—", resolution?.family ? "info" : "warn"],
            ["Especialista", resolution?.specialist || "—"],
            ["Confianza", formatConfidence(resolution?.confidence)],
            ["Estado", resolution?.status || "—", toneForStatus(resolution?.status)],
            ["Bloqueada por", latest?.locked_by || "Pendiente"],
            ["Huella", shortId(latest?.payload_sha256)],
          ]} />
          <div className="mt-4 space-y-3">
            {(resolution?.evidence || []).map((evidence, index) => (
              <div key={evidence?.code || index} className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="font-semibold text-blue-950">{evidence?.code || "Evidencia"}</div>
                  <Pill tone="info">{formatConfidence(evidence?.confidence)}</Pill>
                </div>
                <div className="mt-2 text-sm leading-6 text-blue-950">{evidence?.description}</div>
                <div className="mt-2 text-xs text-blue-800"><b>Hechos:</b> {(evidence?.source_fact_keys || []).join(", ") || "—"}</div>
                <div className="mt-1 text-xs text-blue-800"><b>Documentos:</b> {(evidence?.source_document_ids || []).join(", ") || "—"}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <ListBlock title="Campos pendientes" values={resolution?.unresolved} tone="warn" />
            <ListBlock title="Conflictos de clasificación" values={(resolution?.conflicts || []).map((item) => item?.description || displayValue(item))} tone="danger" />
          </div>
          <VersionHistory title="Historial de familia" records={authority?.versions} statusGetter={(record) => record?.invalidated_at ? "invalidated" : record?.locked ? "resolved" : record?.resolution?.status} />
        </>
      )}
    </Section>
  );
}

function PreviewSection({ authority }) {
  const latest = authority?.latest_active;
  const preview = latest?.preview;
  return (
    <Section
      id="preview"
      title="Previa Jurídica"
      subtitle="La previa explica hechos, enfoque, argumentos, peticiones, riesgos, documentos y plazos antes de Generate."
      right={latest ? <Pill tone={toneForStatus(latest?.status)}>{latest?.status}</Pill> : <Pill tone="warn">Sin previa</Pill>}
    >
      {!latest ? <EmptyState>El especialista todavía no ha creado una Previa Jurídica.</EmptyState> : (
        <>
          <KeyValueGrid items={[
            ["Familia", preview?.family || "—"],
            ["Especialista", preview?.specialist || "—"],
            ["Tipo de escrito", preview?.document_type || "—"],
            ["Destino", preview?.destination || "—"],
            ["Aprobada por", preview?.approved_by || "Pendiente"],
            ["Freeze", preview?.frozen_at ? formatDate(preview.frozen_at) : "Pendiente", preview?.frozen_at ? "success" : "warn"],
          ]} />
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Asunto</div>
            <div className="mt-2 text-sm font-semibold text-slate-950">{preview?.subject || "—"}</div>
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <ListBlock title="Hechos resumidos" values={preview?.validated_facts_summary} tone="info" />
            <ListBlock title="Peticiones" values={preview?.requested_outcomes} tone="success" />
          </div>
          <div className="mt-4 rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-indigo-950">
            <div className="text-xs font-semibold uppercase tracking-wide">Enfoque principal</div>
            <div className="mt-2 whitespace-pre-wrap text-sm leading-6">{preview?.primary_strategy || "—"}</div>
          </div>
          <div className="mt-4 space-y-3">
            {(preview?.legal_arguments || []).map((argument, index) => (
              <article key={argument?.code || index} className="rounded-2xl border border-slate-200 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-semibold text-slate-950">{index + 1}. {argument?.title || argument?.code}</h3>
                  <Pill tone={argument?.priority === "primary" ? "info" : "default"}>{argument?.priority || "secondary"}</Pill>
                </div>
                <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{argument?.body}</div>
                <div className="mt-3 text-xs text-slate-500"><b>Hechos utilizados:</b> {(argument?.source_fact_keys || []).join(", ") || "—"}</div>
                <ListBlock title="Fundamentos indicados" values={argument?.legal_basis} tone="default" />
              </article>
            ))}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <ListBlock title="Estrategias subsidiarias" values={preview?.secondary_strategies} tone="default" />
            <ListBlock title="Solicitudes adicionales" values={preview?.additional_requests} tone="default" />
            <ListBlock title="Riesgos" values={preview?.risks} tone="warn" />
            <ListBlock title="Elementos pendientes" values={(preview?.missing_items || []).map((item) => `${item?.severity}: ${item?.description}`)} tone={(preview?.missing_items || []).some((item) => item?.severity === "blocking") ? "danger" : "warn"} />
          </div>
          <div className="mt-4 space-y-2">
            {(preview?.deadlines || []).map((deadline, index) => (
              <div key={`${deadline?.label}-${index}`} className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
                <b>{deadline?.label || "Plazo"}:</b> {deadline?.due_at ? formatDate(deadline.due_at) : "No resuelto"} · {deadline?.calculation_status || "—"}
              </div>
            ))}
          </div>
          <VersionHistory title="Historial de previas" records={authority?.versions} statusGetter={(record) => record?.status} />
        </>
      )}
    </Section>
  );
}

function ResourceSection({ authority, documents, onDownload, downloadingId }) {
  const latest = authority?.latest_active;
  const findDocument = (id) => (documents || []).find((item) => item.id === id);
  const docx = findDocument(latest?.docx_document_id);
  const pdf = findDocument(latest?.pdf_document_id);
  return (
    <Section
      id="resource"
      title="Recurso generado"
      subtitle="Generate solo transforma la previa congelada; no modifica hechos, familia ni estrategia."
      right={latest ? <Pill tone={toneForStatus(latest?.status)}>{latest?.status}</Pill> : <Pill tone="warn">Sin documento</Pill>}
    >
      {!latest ? <EmptyState>Todavía no existe un recurso generado por el gateway CORE.</EmptyState> : (
        <>
          <KeyValueGrid items={[
            ["Familia", latest?.family || "—"],
            ["Generador", latest?.generator_version || "—"],
            ["Generado por", latest?.generated_by || "—"],
            ["Aprobado por", latest?.approved_by || "Pendiente", latest?.approved_at ? "success" : "warn"],
            ["Huella de contenido", shortId(latest?.content_sha256)],
            ["Huella de previa", shortId(latest?.preview_payload_sha256)],
          ]} />
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {[pdf, docx].map((item, index) => (
              <div key={item?.id || index} className="rounded-2xl border border-slate-200 p-4">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">{index === 0 ? "PDF final" : "DOCX editable"}</div>
                <div className="mt-2 text-sm font-semibold text-slate-900">{item?.kind || "Documento no localizado en la proyección"}</div>
                {item ? (
                  <button
                    type="button"
                    onClick={() => onDownload(item)}
                    disabled={downloadingId === item.id}
                    className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                  >
                    {downloadingId === item.id ? "Descargando…" : "Abrir y descargar"}
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {!latest?.approved_at ? (
            <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
              Antes de habilitar la presentación, OPS debe abrir el PDF, contrastarlo con la previa congelada y aprobar expresamente esta versión.
            </div>
          ) : null}
          <VersionHistory title="Historial de recursos" records={authority?.versions} statusGetter={(record) => record?.status} />
        </>
      )}
    </Section>
  );
}

function TimelineSection({ timeline }) {
  const rows = Array.isArray(timeline) ? timeline : [];
  return (
    <Section id="timeline" title="Trazabilidad" subtitle="La vista OPS muestra tipos de evento y fechas sin reconstruir hechos desde payloads legacy.">
      {!rows.length ? <EmptyState>No hay eventos disponibles.</EmptyState> : (
        <div className="space-y-2">
          {rows.map((item, index) => (
            <div key={`${item?.type}-${item?.created_at}-${index}`} className="flex flex-col gap-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm md:flex-row md:items-center md:justify-between">
              <div className="font-mono text-xs font-semibold text-slate-800">{item?.type || "evento"}</div>
              <div className="text-xs text-slate-500">{formatDate(item?.created_at)}</div>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function ActionPanel({ nextStep, reason, setReason, busyCode, onAction }) {
  const actions = Array.isArray(nextStep?.actions) ? nextStep.actions : [];
  const copy = STAGE_COPY[nextStep?.stage] || [nextStep?.stage || "Estado CORE", "Revisa la cadena antes de continuar."];
  const needsReason = actions.some((action) => action?.requires_reason);
  return (
    <section className="sticky top-3 z-20 rounded-3xl border border-slate-700 bg-slate-950 p-5 text-white shadow-2xl">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div>
          <div className="text-[10px] uppercase tracking-[0.3em] text-slate-400">Siguiente autoridad</div>
          <h2 className="mt-1 text-xl font-semibold">{copy[0]}</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">{copy[1]}</p>
        </div>
        <Pill tone="dark">{nextStep?.policy_version || "CORE"}</Pill>
      </div>
      {needsReason ? (
        <div className="mt-4">
          <label className="text-xs font-semibold uppercase tracking-wide text-slate-300" htmlFor="ops-core-reason">Motivo obligatorio</label>
          <textarea
            id="ops-core-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="mt-2 min-h-20 w-full rounded-2xl border border-slate-600 bg-slate-900 p-3 text-sm text-white outline-none focus:border-blue-400"
            placeholder="Explica por qué debe invalidarse o corregirse esta versión…"
          />
        </div>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {actions.map((action) => {
          const canExecute = Boolean(action?.endpoint);
          const primary = action?.code === nextStep?.primary_action;
          return (
            <button
              key={action?.code}
              type="button"
              onClick={() => onAction(action)}
              disabled={busyCode || !canExecute}
              className={cx(
                "rounded-xl px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
                primary ? "bg-blue-600 text-white hover:bg-blue-500" : "border border-slate-600 bg-slate-900 text-slate-100 hover:bg-slate-800",
              )}
              title={!canExecute ? "Esta actuación se realiza fuera del automatismo CORE" : ""}
            >
              {busyCode === action?.code ? "Procesando…" : action?.label || action?.code}
            </button>
          );
        })}
      </div>
      {actions.some((action) => !action?.endpoint) ? (
        <div className="mt-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
          La presentación, el cobro o el seguimiento externo permanecen separados del motor jurídico y no se ejecutan desde esta ficha sin un endpoint autorizado.
        </div>
      ) : null}
    </section>
  );
}

export default function OpsCoreWorkspace() {
  const { caseId } = useParams();
  const [workspace, setWorkspace] = useState(null);
  const [inspection, setInspection] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busyCode, setBusyCode] = useState("");
  const [reason, setReason] = useState("");
  const [downloadingId, setDownloadingId] = useState("");

  const token = getOperatorToken();

  const loadWorkspace = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError("");
    try {
      const data = await loadCoreWorkspace(caseId, { token });
      setWorkspace(data);
    } catch (err) {
      setError(err?.message || "No se pudo cargar la ficha RTM CORE.");
      if (!silent) setWorkspace(null);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [caseId, token]);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  const scrollTo = useCallback((sectionId) => {
    window.requestAnimationFrame(() => {
      window.document.getElementById(sectionId)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }, []);

  const handleAction = useCallback(async (action) => {
    setError("");
    setMessage("");

    const localSections = {
      review_validated_facts: "facts",
      review_family_conflict: "family",
      review_legal_preview: "preview",
      inspect_workspace: "top",
    };
    if (localSections[action?.code]) {
      scrollTo(localSections[action.code]);
      return;
    }

    if (!action?.endpoint) {
      setMessage("Esta actuación permanece fuera del automatismo jurídico CORE. Debe realizarse mediante el canal operativo correspondiente y conservar su justificante.");
      return;
    }

    if (action?.requires_reason && String(reason || "").trim().length < 3) {
      setError("Indica un motivo de al menos 3 caracteres antes de continuar.");
      return;
    }

    if (action?.requires_confirmation) {
      const confirmed = window.confirm(`${action?.label || action?.code}\n\nLa operación quedará registrada y versionada. ¿Continuar?`);
      if (!confirmed) return;
    }

    setBusyCode(action.code);
    try {
      const result = await executeCoreWorkspaceAction(action, {
        token,
        reason,
      });
      if (action.code === "preview_reanalysis_facts") {
        setInspection(result?.result || result);
        setMessage("Vista previa cargada. No se ha persistido ni congelado ningún hecho.");
        scrollTo("reanalysis-inspection");
      } else {
        setInspection(null);
        setReason("");
        setMessage("Operación CORE completada y registrada correctamente.");
        await loadWorkspace({ silent: true });
      }
    } catch (err) {
      setError(err?.message || "No se pudo ejecutar la acción CORE.");
    } finally {
      setBusyCode("");
    }
  }, [loadWorkspace, reason, scrollTo, token]);

  const handleDownload = useCallback(async (documentRecord) => {
    setError("");
    setDownloadingId(documentRecord?.id || "");
    try {
      await downloadOpsDocument(documentRecord, { token });
    } catch (err) {
      setError(err?.message || "No se pudo descargar el documento.");
    } finally {
      setDownloadingId("");
    }
  }, [token]);

  const caseData = workspace?.case || {};
  const authority = workspace?.authority || {};
  const nextStep = workspace?.next_step || {};
  const title = caseData?.expediente_ref || caseId;

  const headerFacts = useMemo(() => {
    const family = authority?.family_resolution?.latest_active?.resolution;
    const preview = authority?.legal_preview?.latest_active;
    return [
      ["Estado", caseData?.status || "—", toneForStatus(caseData?.status)],
      ["Servicio", `${caseData?.department || "—"} / ${caseData?.case_type || "—"}`],
      ["Familia", family?.family || "Pendiente", family?.family ? "info" : "warn"],
      ["Previa", preview?.status || "Pendiente", preview?.status ? toneForStatus(preview.status) : "warn"],
      ["Pago", caseData?.payment_status || "Pendiente", caseData?.payment_status === "paid" ? "success" : "warn"],
      ["Autorización", caseData?.authorized ? "Confirmada" : "Pendiente", caseData?.authorized ? "success" : "warn"],
    ];
  }, [authority, caseData]);

  if (loading) {
    return (
      <div className="sr-container py-10">
        <div className="rounded-3xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="text-lg font-semibold text-slate-900">Cargando ficha RTM CORE…</div>
          <div className="mt-2 text-sm text-slate-500">Hechos, familia, previa, documentos y trazabilidad.</div>
        </div>
      </div>
    );
  }

  if (!token || (!workspace && error)) {
    return (
      <div className="sr-container py-10">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-950">
          <h1 className="text-xl font-semibold">No se puede abrir la ficha OPS</h1>
          <p className="mt-2 text-sm leading-6">{error || "Falta token de operador."}</p>
          <Link to="/ops" className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Volver al panel OPS</Link>
        </div>
      </div>
    );
  }

  return (
    <main id="top" className="sr-container space-y-5 py-5 pb-16">
      <header className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl md:p-7">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">RTM Intelligence CORE · OPS</div>
            <h1 className="mt-2 break-words text-2xl font-semibold md:text-3xl">{title}</h1>
            <p className="mt-2 break-all text-xs text-slate-400">Case ID: {caseId}</p>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
              Esta ficha consume la autoridad persistida del backend. No clasifica, no corrige hechos y no genera documentos por su cuenta.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => loadWorkspace()} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-100">
              Recargar
            </button>
            <Link to="/ops/queue-smart" className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
              Cola OPS
            </Link>
            <Link to="/ops" className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
              Dashboard
            </Link>
          </div>
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          {headerFacts.map(([label, value, tone]) => (
            <div key={label} className="rounded-2xl border border-slate-800 bg-slate-900 px-3 py-3">
              <div className="text-[10px] uppercase tracking-wide text-slate-500">{label}</div>
              <div className="mt-2 text-sm font-semibold text-white">{tone ? <Pill tone={tone}>{value}</Pill> : value}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-[11px] text-slate-500">
          Workspace {workspace?.workspace_version || "—"} · Cliente {OPS_CORE_CLIENT_VERSION}
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div> : null}
      {message ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{message}</div> : null}

      <ActionPanel
        nextStep={nextStep}
        reason={reason}
        setReason={setReason}
        busyCode={busyCode}
        onAction={handleAction}
      />

      <Chain workspace={workspace} />

      <Section id="identity" title="Expediente e interesado" subtitle="Datos visibles únicamente dentro del panel protegido de operador.">
        <KeyValueGrid items={[
          ["Nombre", caseData?.identity?.full_name || "—"],
          ["DNI/NIE", caseData?.identity?.dni_nie || "—"],
          ["Domicilio", caseData?.identity?.address || "—"],
          ["Email", caseData?.identity?.email || "—"],
          ["Teléfono", caseData?.identity?.phone || "—"],
          ["Matrícula", caseData?.identity?.matricula || "—"],
          ["Organismo", caseData?.organismo || "—"],
          ["Expediente", caseData?.expediente_ref || "—"],
          ["Origen", caseData?.source_module || "—"],
        ]} />
      </Section>

      <ReadinessSection readiness={workspace?.readiness} />
      <DocumentsSection documents={workspace?.documents} onDownload={handleDownload} downloadingId={downloadingId} />
      <ReanalysisSection reanalysis={workspace?.reanalysis} />
      <ReanalysisInspection inspection={inspection} />
      <FactsSection authority={authority?.validated_facts} />
      <FamilySection authority={authority?.family_resolution} />
      <PreviewSection authority={authority?.legal_preview} />
      <ResourceSection authority={authority?.generated_resource} documents={workspace?.documents} onDownload={handleDownload} downloadingId={downloadingId} />
      <TimelineSection timeline={workspace?.timeline} />
    </main>
  );
}
