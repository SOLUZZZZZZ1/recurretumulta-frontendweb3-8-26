import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";

const DIRECT_BACKEND = "https://recurretumulta-backend.onrender.com";

const API_CANDIDATES = [
  "/api",
  import.meta.env.VITE_API_BASE_URL,
  import.meta.env.VITE_API_URL,
  DIRECT_BACKEND,
].filter(Boolean);

const EXTERNAL_KINDS = [
  { value: "justificante_presentacion", label: "Justificante de presentación" },
  { value: "instancia_firmada", label: "Instancia firmada" },
  { value: "csv_registro", label: "CSV / registro" },
  { value: "resolucion", label: "Resolución" },
  { value: "requerimiento", label: "Requerimiento" },
  { value: "contestacion_ayuntamiento", label: "Contestación del Ayuntamiento" },
  { value: "prueba_externa", label: "Prueba externa" },
  { value: "recurso_presentado", label: "Recurso presentado" },
  { value: "multa_presentada", label: "Multa presentada" },
  { value: "autorizacion_presentada", label: "Autorización presentada" },
  { value: "documento_externo", label: "Documento externo" },
];

function buildUrl(base, path) {
  return `${String(base || "").replace(/\/$/, "")}${path}`;
}

function fmt(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d);
  }
}

function prettyBytes(size) {
  const n = Number(size || 0);
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

async function readResponse(response) {
  const text = await response.text().catch(() => "");
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const detail = data?.detail || data?.message || text || `HTTP ${response.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  return data;
}

async function fetchJsonFallback(path, options = {}) {
  const errors = [];

  for (const base of API_CANDIDATES) {
    const url = buildUrl(base, path);

    try {
      const response = await fetch(url, options);
      return await readResponse(response);
    } catch (e) {
      errors.push(`${url} → ${e?.message || "Error"}`);
    }
  }

  throw new Error(errors.join(" | "));
}

async function fetchBlobFallback(path, options = {}) {
  const errors = [];

  for (const base of API_CANDIDATES) {
    const url = buildUrl(base, path);
    try {
      const response = await fetch(url, options);
      if (!response.ok) {
        const text = await response.text().catch(() => "");
        throw new Error(text || `HTTP ${response.status}`);
      }
      return await response.blob();
    } catch (e) {
      errors.push(`${url} → ${e?.message || "Error"}`);
    }
  }

  throw new Error(errors.join(" | "));
}

function docLabel(kind = "") {
  const k = String(kind || "").toLowerCase();

  if (k.includes("authorization_signed")) return "Autorización firmada";
  if (k.includes("authorization") || k.includes("autorizacion")) return "Autorización";
  if (k.includes("submission_receipt")) return "Justificante de presentación";
  if (k.includes("justificante")) return "Justificante de presentación";
  if (k.includes("instancia")) return "Instancia firmada";
  if (k.includes("resolucion")) return "Resolución";
  if (k.includes("requerimiento")) return "Requerimiento";
  if (k.includes("contestacion")) return "Contestación";
  if (k.includes("prueba")) return "Prueba externa";
  if (k.includes("original")) return "Documento original";
  if (k.includes("recurso_pdf")) return "Recurso PDF";
  if (k.includes("recurso_docx")) return "Recurso Word";
  if (k.includes("generated") && k.includes("pdf")) return "Recurso PDF";
  if (k.includes("generated") && k.includes("docx")) return "Recurso Word";
  if (k.includes("recurso")) return "Recurso";
  if (k.includes("multa")) return "Multa";
  if (k.includes("csv")) return "CSV / registro";
  if (k.includes("pdf")) return "PDF";
  if (k.includes("docx")) return "Word";

  return kind || "Documento";
}

function docGroup(kind = "") {
  const k = String(kind || "").toLowerCase();
  if (k.includes("recurso") || k.includes("generated")) return "resource";
  if (
    k.includes("justificante") ||
    k.includes("instancia") ||
    k.includes("csv") ||
    k.includes("resolucion") ||
    k.includes("requerimiento") ||
    k.includes("contestacion") ||
    k.includes("prueba")
  ) {
    return "external";
  }
  return "other";
}

function docIcon(doc = {}) {
  const kind = String(doc.kind || "").toLowerCase();
  const mime = String(doc.mime || "").toLowerCase();
  const key = String(doc.key || doc.b2_key || "").toLowerCase();

  if (kind.includes("justificante")) return "🏛️";
  if (kind.includes("resolucion")) return "⚖️";
  if (kind.includes("requerimiento")) return "📨";
  if (kind.includes("recurso")) return "🧾";
  if (kind.includes("multa")) return "🚗";
  if (kind.includes("autoriz")) return "✍️";
  if (kind.includes("csv")) return "#️⃣";
  if (mime.includes("pdf") || key.endsWith(".pdf")) return "📄";
  if (mime.includes("word") || key.endsWith(".docx")) return "📝";
  if (mime.includes("image") || key.match(/\.(jpg|jpeg|png|webp)$/)) return "🖼️";
  return "📎";
}

function isResource(kind = "") {
  return docGroup(kind) === "resource";
}

function isExternal(kind = "") {
  return docGroup(kind) === "external";
}


function isSuggestedForZip(doc = {}) {
  const kind = String(doc.kind || "").toLowerCase();
  const key = String(doc.key || doc.b2_key || "").toLowerCase();

  if (kind.includes("justificante")) return true;
  if (kind.includes("authorization") || kind.includes("autoriz")) return true;
  if (kind.includes("multa") || kind.includes("original")) return true;
  if (kind.includes("csv")) return true;
  if (kind.includes("resolucion")) return true;
  if (kind.includes("final")) return true;
  if (key.includes("final")) return true;

  return false;
}

function looksDuplicated(doc = {}) {
  const kind = String(doc.kind || "").toLowerCase();
  const key = String(doc.key || doc.b2_key || "").toLowerCase();


  async function createFollowup() {
    if (!followupTitle.trim()) {
      setMsg("❌ Indica un título para el seguimiento.");
      return;
    }
    if (!followupDueAt.trim()) {
      setMsg("❌ Indica una fecha límite.");
      return;
    }

    setFollowupCreating(true);
    setMsg("");
    setDebug("");

    try {
      const fd = new FormData();
      fd.append("kind", "seguimiento_manual");
      fd.append("title", followupTitle.trim());
      fd.append("due_at", followupDueAt.trim());
      if (followupDescription.trim()) fd.append("description", followupDescription.trim());

      await fetchJsonFallback(`/ops/cases/${caseId}/followups`, {
        method: "POST",
        headers,
        body: fd,
      });

      setFollowupTitle("");
      setFollowupDueAt("");
      setFollowupDescription("");
      setMsg("✅ Seguimiento creado.");
      await load();
    } catch (err) {
      setMsg("❌ No se pudo crear el seguimiento.");
      setDebug(err?.message || "");
    } finally {
      setFollowupCreating(false);
    }
  }

  async function resolveFollowup(followupId) {
    setMsg("");
    setDebug("");

    try {
      const fd = new FormData();
      fd.append("note", "Resuelto desde OPS");

      await fetchJsonFallback(`/ops/cases/${caseId}/followups/${followupId}/resolve`, {
        method: "POST",
        headers,
        body: fd,
      });

      setMsg("✅ Seguimiento marcado como resuelto.");
      await load();
    } catch (err) {
      setMsg("❌ No se pudo resolver el seguimiento.");
      setDebug(err?.message || "");
    }
  }

  function followupBadge(fu) {
    if (fu.status === "resolved") {
      return { text: "Resuelto", bg: "#dcfce7", color: "#166534" };
    }
    if (fu.overdue) {
      return { text: "Vencido", bg: "#fee2e2", color: "#991b1b" };
    }
    if (typeof fu.days_left === "number" && fu.days_left <= 7) {
      return { text: "Próximo", bg: "#fef9c3", color: "#854d0e" };
    }
    return { text: "Pendiente", bg: "#dbeafe", color: "#1d4ed8" };
  }


  return (
    key.includes("old") ||
    key.includes("test") ||
    key.includes("v1") ||
    key.includes("tmp") ||
    key.includes("debug") ||
    kind.includes("old") ||
    kind.includes("duplicate")
  );
}

function eventMeta(type = "") {
  const t = String(type || "").toLowerCase();

  if (t.includes("manual_submission_registered")) {
    return { icon: "📌", label: "Presentación manual registrada", color: "#16a34a", bg: "#dcfce7" };
  }
  if (t.includes("external_document_uploaded")) {
    return { icon: "📎", label: "Documento externo adjuntado", color: "#2563eb", bg: "#dbeafe" };
  }
  if (t.includes("justificante_uploaded")) {
    return { icon: "🏛️", label: "Justificante subido", color: "#16a34a", bg: "#dcfce7" };
  }
  if (t.includes("paid_ok") || t.includes("paid")) {
    return { icon: "💳", label: "Pago confirmado", color: "#16a34a", bg: "#dcfce7" };
  }
  if (t.includes("checkout")) {
    return { icon: "💳", label: "Pago iniciado", color: "#ca8a04", bg: "#fef9c3" };
  }
  if (t.includes("authorized") || t.includes("authorization")) {
    return { icon: "✍️", label: "Autorización registrada", color: "#7c3aed", bg: "#ede9fe" };
  }
  if (t.includes("resource_generated") || t.includes("generated")) {
    return { icon: "🧾", label: "Recurso generado", color: "#2563eb", bg: "#dbeafe" };
  }
  if (t.includes("submitted")) {
    return { icon: "✅", label: "Expediente presentado", color: "#16a34a", bg: "#dcfce7" };
  }
  if (t.includes("review")) {
    return { icon: "🔎", label: "Revisión", color: "#ca8a04", bg: "#fef9c3" };
  }
  if (t.includes("note")) {
    return { icon: "📝", label: "Nota interna", color: "#64748b", bg: "#f1f5f9" };
  }
  if (t.includes("failed") || t.includes("error")) {
    return { icon: "❌", label: "Error / incidencia", color: "#dc2626", bg: "#fee2e2" };
  }

  return { icon: "•", label: type || "Evento", color: "#64748b", bg: "#f1f5f9" };
}

function extractEventSummary(event = {}) {
  const payload = event.payload || {};
  if (typeof payload === "string") return payload.slice(0, 160);

  const bits = [];
  if (payload.organismo) bits.push(payload.organismo);
  if (payload.registro) bits.push(`Registro: ${payload.registro}`);
  if (payload.csv) bits.push(`CSV: ${payload.csv}`);
  if (payload.kind) bits.push(docLabel(payload.kind));
  if (payload.filename) bits.push(payload.filename);
  if (payload.channel) bits.push(payload.channel);
  if (payload.note) bits.push(payload.note);
  if (payload.status) bits.push(payload.status);

  return bits.join(" · ");
}

function Card({ children, className = "", style = {} }) {

  async function createFollowup() {
    if (!followupTitle.trim()) {
      setMsg("❌ Indica un título para el seguimiento.");
      return;
    }
    if (!followupDueAt.trim()) {
      setMsg("❌ Indica una fecha límite.");
      return;
    }

    setFollowupCreating(true);
    setMsg("");
    setDebug("");

    try {
      const fd = new FormData();
      fd.append("kind", "seguimiento_manual");
      fd.append("title", followupTitle.trim());
      fd.append("due_at", followupDueAt.trim());
      if (followupDescription.trim()) fd.append("description", followupDescription.trim());

      await fetchJsonFallback(`/ops/cases/${caseId}/followups`, {
        method: "POST",
        headers,
        body: fd,
      });

      setFollowupTitle("");
      setFollowupDueAt("");
      setFollowupDescription("");
      setMsg("✅ Seguimiento creado.");
      await load();
    } catch (err) {
      setMsg("❌ No se pudo crear el seguimiento.");
      setDebug(err?.message || "");
    } finally {
      setFollowupCreating(false);
    }
  }

  async function resolveFollowup(followupId) {
    setMsg("");
    setDebug("");

    try {
      const fd = new FormData();
      fd.append("note", "Resuelto desde OPS");

      await fetchJsonFallback(`/ops/cases/${caseId}/followups/${followupId}/resolve`, {
        method: "POST",
        headers,
        body: fd,
      });

      setMsg("✅ Seguimiento marcado como resuelto.");
      await load();
    } catch (err) {
      setMsg("❌ No se pudo resolver el seguimiento.");
      setDebug(err?.message || "");
    }
  }

  function followupBadge(fu) {
    if (fu.status === "resolved") {
      return { text: "Resuelto", bg: "#dcfce7", color: "#166534" };
    }
    if (fu.overdue) {
      return { text: "Vencido", bg: "#fee2e2", color: "#991b1b" };
    }
    if (typeof fu.days_left === "number" && fu.days_left <= 7) {
      return { text: "Próximo", bg: "#fef9c3", color: "#854d0e" };
    }
    return { text: "Pendiente", bg: "#dbeafe", color: "#1d4ed8" };
  }


  return (
    <div className={`sr-card ${className}`} style={style}>
      {children}
    </div>
  );
}

function StatusBox({ msg, debug }) {
  if (!msg && !debug) return null;


  async function createFollowup() {
    if (!followupTitle.trim()) {
      setMsg("❌ Indica un título para el seguimiento.");
      return;
    }
    if (!followupDueAt.trim()) {
      setMsg("❌ Indica una fecha límite.");
      return;
    }

    setFollowupCreating(true);
    setMsg("");
    setDebug("");

    try {
      const fd = new FormData();
      fd.append("kind", "seguimiento_manual");
      fd.append("title", followupTitle.trim());
      fd.append("due_at", followupDueAt.trim());
      if (followupDescription.trim()) fd.append("description", followupDescription.trim());

      await fetchJsonFallback(`/ops/cases/${caseId}/followups`, {
        method: "POST",
        headers,
        body: fd,
      });

      setFollowupTitle("");
      setFollowupDueAt("");
      setFollowupDescription("");
      setMsg("✅ Seguimiento creado.");
      await load();
    } catch (err) {
      setMsg("❌ No se pudo crear el seguimiento.");
      setDebug(err?.message || "");
    } finally {
      setFollowupCreating(false);
    }
  }

  async function resolveFollowup(followupId) {
    setMsg("");
    setDebug("");

    try {
      const fd = new FormData();
      fd.append("note", "Resuelto desde OPS");

      await fetchJsonFallback(`/ops/cases/${caseId}/followups/${followupId}/resolve`, {
        method: "POST",
        headers,
        body: fd,
      });

      setMsg("✅ Seguimiento marcado como resuelto.");
      await load();
    } catch (err) {
      setMsg("❌ No se pudo resolver el seguimiento.");
      setDebug(err?.message || "");
    }
  }

  function followupBadge(fu) {
    if (fu.status === "resolved") {
      return { text: "Resuelto", bg: "#dcfce7", color: "#166534" };
    }
    if (fu.overdue) {
      return { text: "Vencido", bg: "#fee2e2", color: "#991b1b" };
    }
    if (typeof fu.days_left === "number" && fu.days_left <= 7) {
      return { text: "Próximo", bg: "#fef9c3", color: "#854d0e" };
    }
    return { text: "Pendiente", bg: "#dbeafe", color: "#1d4ed8" };
  }


  return (
    <>
      {msg ? (
        <Card
          className="mt-4"
          style={{
            color: msg.startsWith("✅") ? "#166534" : "#991b1b",
            background: msg.startsWith("✅") ? "#ecfdf5" : "#fef2f2",
            border: msg.startsWith("✅") ? "1px solid #bbf7d0" : "1px solid #fecaca",
            fontWeight: 900,
          }}
        >
          {msg}
        </Card>
      ) : null}

      {debug ? (
        <Card
          className="mt-4"
          style={{
            color: "#475569",
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            fontSize: 12,
            wordBreak: "break-word",
          }}
        >
          Detalle: {debug}
        </Card>
      ) : null}
    </>
  );
}

function DocumentRow({ doc, onOpen, selectable = false, selected = false, onToggle }) {

  async function createFollowup() {
    if (!followupTitle.trim()) {
      setMsg("❌ Indica un título para el seguimiento.");
      return;
    }
    if (!followupDueAt.trim()) {
      setMsg("❌ Indica una fecha límite.");
      return;
    }

    setFollowupCreating(true);
    setMsg("");
    setDebug("");

    try {
      const fd = new FormData();
      fd.append("kind", "seguimiento_manual");
      fd.append("title", followupTitle.trim());
      fd.append("due_at", followupDueAt.trim());
      if (followupDescription.trim()) fd.append("description", followupDescription.trim());

      await fetchJsonFallback(`/ops/cases/${caseId}/followups`, {
        method: "POST",
        headers,
        body: fd,
      });

      setFollowupTitle("");
      setFollowupDueAt("");
      setFollowupDescription("");
      setMsg("✅ Seguimiento creado.");
      await load();
    } catch (err) {
      setMsg("❌ No se pudo crear el seguimiento.");
      setDebug(err?.message || "");
    } finally {
      setFollowupCreating(false);
    }
  }

  async function resolveFollowup(followupId) {
    setMsg("");
    setDebug("");

    try {
      const fd = new FormData();
      fd.append("note", "Resuelto desde OPS");

      await fetchJsonFallback(`/ops/cases/${caseId}/followups/${followupId}/resolve`, {
        method: "POST",
        headers,
        body: fd,
      });

      setMsg("✅ Seguimiento marcado como resuelto.");
      await load();
    } catch (err) {
      setMsg("❌ No se pudo resolver el seguimiento.");
      setDebug(err?.message || "");
    }
  }

  function followupBadge(fu) {
    if (fu.status === "resolved") {
      return { text: "Resuelto", bg: "#dcfce7", color: "#166534" };
    }
    if (fu.overdue) {
      return { text: "Vencido", bg: "#fee2e2", color: "#991b1b" };
    }
    if (typeof fu.days_left === "number" && fu.days_left <= 7) {
      return { text: "Próximo", bg: "#fef9c3", color: "#854d0e" };
    }
    return { text: "Pendiente", bg: "#dbeafe", color: "#1d4ed8" };
  }


  return (
    <div
      className="block w-full text-left border rounded-xl p-3 mt-2 text-sm transition"
      style={{
        background: selected ? "#eff6ff" : "#ffffff",
        borderColor: selected ? "#60a5fa" : "#e2e8f0",
        boxShadow: selected ? "0 0 0 2px rgba(37,99,235,0.10)" : "0 1px 2px rgba(15,23,42,0.04)",
      }}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3" style={{ minWidth: 0 }}>
          {selectable ? (
            <input
              type="checkbox"
              checked={selected}
              onChange={() => onToggle?.(doc)}
              title="Incluir en ZIP"
              style={{ marginTop: 12, width: 18, height: 18, flexShrink: 0 }}
            />
          ) : null}

          <button
            type="button"
            onClick={() => onOpen(doc)}
            style={{
              width: 38,
              height: 38,
              borderRadius: 14,
              background: "#f1f5f9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 20,
              flexShrink: 0,
              border: "none",
              cursor: "pointer",
            }}
          >
            {docIcon(doc)}
          </button>

          <div style={{ minWidth: 0 }}>
            <strong>{docLabel(doc.kind)}</strong>
            <div style={{ color: "#64748b", marginTop: 3 }}>
              {fmt(doc.created_at)}
            </div>

            <div className="flex gap-2 flex-wrap mt-2">
              {isSuggestedForZip(doc) ? (
                <span
                  style={{
                    background: "#dcfce7",
                    color: "#166534",
                    border: "1px solid #86efac",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  ⭐ Sugerido ZIP
                </span>
              ) : null}

              {looksDuplicated(doc) ? (
                <span
                  style={{
                    background: "#fee2e2",
                    color: "#991b1b",
                    border: "1px solid #fecaca",
                    padding: "2px 8px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 800,
                  }}
                >
                  Duplicado / antiguo
                </span>
              ) : null}
            </div>
            <div style={{ color: "#64748b", marginTop: 3, fontSize: 12 }}>
              {doc.mime || "application/octet-stream"}
              {doc.size_bytes ? ` · ${prettyBytes(doc.size_bytes)}` : ""}
            </div>
            <div
              style={{
                color: "#94a3b8",
                marginTop: 3,
                wordBreak: "break-word",
                fontSize: 11,
              }}
            >
              {doc.key || doc.b2_key || doc.id}
            </div>
          </div>
        </div>

        <button
          type="button"
          className="sr-btn-secondary"
          style={{ whiteSpace: "nowrap" }}
          onClick={() => onOpen(doc)}
        >
          Descargar
        </button>
      </div>
    </div>
  );
}

function EmptyBox({ children }) {

  async function createFollowup() {
    if (!followupTitle.trim()) {
      setMsg("❌ Indica un título para el seguimiento.");
      return;
    }
    if (!followupDueAt.trim()) {
      setMsg("❌ Indica una fecha límite.");
      return;
    }

    setFollowupCreating(true);
    setMsg("");
    setDebug("");

    try {
      const fd = new FormData();
      fd.append("kind", "seguimiento_manual");
      fd.append("title", followupTitle.trim());
      fd.append("due_at", followupDueAt.trim());
      if (followupDescription.trim()) fd.append("description", followupDescription.trim());

      await fetchJsonFallback(`/ops/cases/${caseId}/followups`, {
        method: "POST",
        headers,
        body: fd,
      });

      setFollowupTitle("");
      setFollowupDueAt("");
      setFollowupDescription("");
      setMsg("✅ Seguimiento creado.");
      await load();
    } catch (err) {
      setMsg("❌ No se pudo crear el seguimiento.");
      setDebug(err?.message || "");
    } finally {
      setFollowupCreating(false);
    }
  }

  async function resolveFollowup(followupId) {
    setMsg("");
    setDebug("");

    try {
      const fd = new FormData();
      fd.append("note", "Resuelto desde OPS");

      await fetchJsonFallback(`/ops/cases/${caseId}/followups/${followupId}/resolve`, {
        method: "POST",
        headers,
        body: fd,
      });

      setMsg("✅ Seguimiento marcado como resuelto.");
      await load();
    } catch (err) {
      setMsg("❌ No se pudo resolver el seguimiento.");
      setDebug(err?.message || "");
    }
  }

  function followupBadge(fu) {
    if (fu.status === "resolved") {
      return { text: "Resuelto", bg: "#dcfce7", color: "#166534" };
    }
    if (fu.overdue) {
      return { text: "Vencido", bg: "#fee2e2", color: "#991b1b" };
    }
    if (typeof fu.days_left === "number" && fu.days_left <= 7) {
      return { text: "Próximo", bg: "#fef9c3", color: "#854d0e" };
    }
    return { text: "Pendiente", bg: "#dbeafe", color: "#1d4ed8" };
  }


  return (
    <div
      style={{
        marginTop: 12,
        padding: 14,
        border: "1px dashed #cbd5e1",
        borderRadius: 12,
        color: "#64748b",
        background: "#f8fafc",
      }}
    >
      {children}
    </div>
  );
}

function TimelineItem({ event, index }) {
  const meta = eventMeta(event.type);
  const summary = extractEventSummary(event);


  async function createFollowup() {
    if (!followupTitle.trim()) {
      setMsg("❌ Indica un título para el seguimiento.");
      return;
    }
    if (!followupDueAt.trim()) {
      setMsg("❌ Indica una fecha límite.");
      return;
    }

    setFollowupCreating(true);
    setMsg("");
    setDebug("");

    try {
      const fd = new FormData();
      fd.append("kind", "seguimiento_manual");
      fd.append("title", followupTitle.trim());
      fd.append("due_at", followupDueAt.trim());
      if (followupDescription.trim()) fd.append("description", followupDescription.trim());

      await fetchJsonFallback(`/ops/cases/${caseId}/followups`, {
        method: "POST",
        headers,
        body: fd,
      });

      setFollowupTitle("");
      setFollowupDueAt("");
      setFollowupDescription("");
      setMsg("✅ Seguimiento creado.");
      await load();
    } catch (err) {
      setMsg("❌ No se pudo crear el seguimiento.");
      setDebug(err?.message || "");
    } finally {
      setFollowupCreating(false);
    }
  }

  async function resolveFollowup(followupId) {
    setMsg("");
    setDebug("");

    try {
      const fd = new FormData();
      fd.append("note", "Resuelto desde OPS");

      await fetchJsonFallback(`/ops/cases/${caseId}/followups/${followupId}/resolve`, {
        method: "POST",
        headers,
        body: fd,
      });

      setMsg("✅ Seguimiento marcado como resuelto.");
      await load();
    } catch (err) {
      setMsg("❌ No se pudo resolver el seguimiento.");
      setDebug(err?.message || "");
    }
  }

  function followupBadge(fu) {
    if (fu.status === "resolved") {
      return { text: "Resuelto", bg: "#dcfce7", color: "#166534" };
    }
    if (fu.overdue) {
      return { text: "Vencido", bg: "#fee2e2", color: "#991b1b" };
    }
    if (typeof fu.days_left === "number" && fu.days_left <= 7) {
      return { text: "Próximo", bg: "#fef9c3", color: "#854d0e" };
    }
    return { text: "Pendiente", bg: "#dbeafe", color: "#1d4ed8" };
  }


  return (
    <div className="flex gap-3 mt-3">
      <div style={{ width: 34, display: "flex", flexDirection: "column", alignItems: "center" }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 999,
            background: meta.bg,
            color: meta.color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 16,
            fontWeight: 900,
            border: `1px solid ${meta.color}33`,
          }}
        >
          {meta.icon}
        </div>
        {index !== 999 ? (
          <div style={{ width: 2, flex: 1, background: "#e2e8f0", minHeight: 20, marginTop: 4 }} />
        ) : null}
      </div>

      <div
        style={{
          flex: 1,
          border: "1px solid #e2e8f0",
          borderRadius: 14,
          padding: 12,
          background: "#ffffff",
        }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <strong style={{ color: "#0f172a" }}>{meta.label}</strong>
            <div style={{ color: "#64748b", fontSize: 12, marginTop: 2 }}>{event.type}</div>
          </div>
          <div style={{ color: "#64748b", fontSize: 12, whiteSpace: "nowrap" }}>
            {fmt(event.created_at)}
          </div>
        </div>

        {summary ? (
          <div style={{ marginTop: 8, color: "#334155", fontSize: 13 }}>
            {summary}
          </div>
        ) : null}

        {event.payload ? (
          <details style={{ marginTop: 8 }}>
            <summary style={{ cursor: "pointer", color: "#2563eb", fontWeight: 800 }}>
              Ver detalle
            </summary>
            <pre
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                marginTop: 8,
                background: "#f8fafc",
                padding: 10,
                borderRadius: 10,
                fontSize: 11,
                color: "#334155",
              }}
            >
              {typeof event.payload === "string"
                ? event.payload
                : JSON.stringify(event.payload, null, 2)}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}

export default function OpsCaseDetail() {
  const { caseId } = useParams();
  const token = localStorage.getItem("ops_token") || "";
  const headers = token ? { "X-Operator-Token": token } : {};

  const [docs, setDocs] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [events, setEvents] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [registro, setRegistro] = useState("");
  const [note, setNote] = useState("");
  const [justificante, setJustificante] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [zipLoading, setZipLoading] = useState(false);
  const [freezing, setFreezing] = useState(false);
  const [msg, setMsg] = useState("");
  const [debug, setDebug] = useState("");
  const [followupTitle, setFollowupTitle] = useState("");
  const [followupDueAt, setFollowupDueAt] = useState("");
  const [followupDescription, setFollowupDescription] = useState("");
  const [followupCreating, setFollowupCreating] = useState(false);

  const [manualOrganismo, setManualOrganismo] = useState("Ajuntament / organismo");
  const [manualRegistro, setManualRegistro] = useState("");
  const [manualCsv, setManualCsv] = useState("");
  const [manualDate, setManualDate] = useState("");
  const [manualChannel, setManualChannel] = useState("ayuntamiento_manual");
  const [manualNote, setManualNote] = useState("");
  const [manualFile, setManualFile] = useState(null);
  const [manualSubmitting, setManualSubmitting] = useState(false);

  const [externalKind, setExternalKind] = useState("documento_externo");
  const [externalNote, setExternalNote] = useState("");
  const [externalFile, setExternalFile] = useState(null);
  const [externalUploading, setExternalUploading] = useState(false);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  const resourceDocs = useMemo(() => docs.filter((d) => isResource(d.kind)), [docs]);
  const externalDocs = useMemo(() => docs.filter((d) => isExternal(d.kind)), [docs]);
  const otherDocs = useMemo(
    () => docs.filter((d) => !isResource(d.kind) && !isExternal(d.kind)),
    [docs]
  );

  const hasManualSubmission = useMemo(
    () => events.some((e) => String(e.type || "").includes("manual_submission_registered")),
    [events]
  );

  const hasFinalResource = useMemo(
    () =>
      events.some((e) => String(e.type || "").includes("final")) ||
      docs.some((d) => String(d.kind || "").includes("final")),
    [docs, events]
  );

  async function load() {
    setLoading(true);
    setMsg("");
    setDebug("");

    try {
      const [d, e, f] = await Promise.all([
        fetchJsonFallback(`/ops/cases/${caseId}/documents`, { headers }),
        fetchJsonFallback(`/ops/cases/${caseId}/events`, { headers }),
        fetchJsonFallback(`/ops/cases/${caseId}/followups`, { headers }).catch(() => ({ followups: [] })),
      ]);

      const loadedDocs = d.documents || d.items || [];
      setDocs(loadedDocs);
      setEvents(e.events || e.items || []);
      setFollowups(f.followups || []);

      const suggestedIds = loadedDocs
        .filter((doc) => isSuggestedForZip(doc) && doc.id)
        .map((doc) => String(doc.id));

      setSelectedDocIds(suggestedIds);
    } catch (err) {
      setMsg("❌ No se pudieron cargar documentos o timeline.");
      setDebug(err?.message || "");
    } finally {
      setLoading(false);
    }
  }

  async function openDocument(doc) {
    setMsg("");
    setDebug("");

    try {
      if (doc.id) {
        const blob = await fetchBlobFallback(`/ops/documents/${doc.id}/download`, { headers });
        const objectUrl = URL.createObjectURL(blob);
        window.open(objectUrl, "_blank", "noopener,noreferrer");
        return;
      }

      const bucket = doc.bucket || doc.b2_bucket;
      const key = doc.key || doc.b2_key;

      if (!bucket || !key) throw new Error("Documento sin bucket/key.");

      const data = await fetchJsonFallback(
        `/files/presign?case_id=${encodeURIComponent(caseId)}&bucket=${encodeURIComponent(bucket)}&key=${encodeURIComponent(key)}`
      );

      if (!data?.url) throw new Error("No se recibió URL de descarga.");
      window.open(data.url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setMsg("❌ No se pudo abrir el documento.");
      setDebug(err?.message || "");
    }
  }

  async function generateResourceNow() {
    setGenerating(true);
    setMsg("");
    setDebug("");

    try {
      await fetchJsonFallback("/generate/dgt", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          case_id: caseId,
          interesado: {},
        }),
      });

      setMsg("✅ Recurso generado. Actualizando documentos…");
      await load();
    } catch (err) {
      setMsg("❌ No se pudo generar el recurso.");
      setDebug(err?.message || "");
    } finally {
      setGenerating(false);
    }
  }

  async function markSubmitted() {
    setMsg("");
    setDebug("");

    try {
      const fd = new FormData();
      if (registro) fd.append("registro", registro);
      if (note) fd.append("note", note);

      await fetchJsonFallback(`/ops/cases/${caseId}/mark-submitted`, {
        method: "POST",
        headers,
        body: fd,
      });

      setMsg("✅ Caso marcado como presentado automático.");
      await load();
    } catch (err) {
      setMsg("❌ No se pudo marcar como presentado automático.");
      setDebug(err?.message || "");
    }
  }

  async function uploadJustificante() {
    if (!justificante) {
      setMsg("❌ Selecciona un archivo.");
      return;
    }

    setUploading(true);
    setMsg("");
    setDebug("");

    try {
      const fd = new FormData();
      fd.append("file", justificante);

      await fetchJsonFallback(`/ops/cases/${caseId}/upload-justificante`, {
        method: "POST",
        headers,
        body: fd,
      });

      setJustificante(null);
      setMsg("✅ Justificante subido.");
      await load();
    } catch (err) {
      setMsg("❌ No se pudo subir el justificante.");
      setDebug(err?.message || "");
    } finally {
      setUploading(false);
    }
  }

  async function registerManualSubmission() {
    if (!manualOrganismo.trim()) {
      setMsg("❌ Indica el organismo.");
      return;
    }
    if (!manualRegistro.trim()) {
      setMsg("❌ Indica el número de registro.");
      return;
    }

    setManualSubmitting(true);
    setMsg("");
    setDebug("");

    try {
      const fd = new FormData();
      fd.append("organismo", manualOrganismo.trim());
      fd.append("registro", manualRegistro.trim());
      if (manualCsv.trim()) fd.append("csv", manualCsv.trim());
      if (manualDate.trim()) fd.append("submitted_at", manualDate.trim());
      if (manualChannel.trim()) fd.append("channel", manualChannel.trim());
      if (manualNote.trim()) fd.append("note", manualNote.trim());
      if (manualFile) fd.append("file", manualFile);

      await fetchJsonFallback(`/ops/cases/${caseId}/register-manual-submission`, {
        method: "POST",
        headers,
        body: fd,
      });

      setMsg("✅ Presentación manual registrada en el expediente.");
      setManualRegistro("");
      setManualCsv("");
      setManualDate("");
      setManualNote("");
      setManualFile(null);
      await load();
    } catch (err) {
      setMsg("❌ No se pudo registrar la presentación manual.");
      setDebug(err?.message || "");
    } finally {
      setManualSubmitting(false);
    }
  }

  async function uploadExternalDocument() {
    if (!externalFile) {
      setMsg("❌ Selecciona un archivo externo.");
      return;
    }

    setExternalUploading(true);
    setMsg("");
    setDebug("");

    try {
      const fd = new FormData();
      fd.append("file", externalFile);
      fd.append("kind", externalKind);
      if (externalNote.trim()) fd.append("note", externalNote.trim());

      await fetchJsonFallback(`/ops/cases/${caseId}/upload-external-document`, {
        method: "POST",
        headers,
        body: fd,
      });

      setExternalFile(null);
      setExternalNote("");
      setMsg("✅ Documento externo adjuntado al expediente.");
      await load();
    } catch (err) {
      setMsg("❌ No se pudo adjuntar el documento externo.");
      setDebug(err?.message || "");
    } finally {
      setExternalUploading(false);
    }
  }

  async function freezeFinalResource() {
    setFreezing(true);
    setMsg("");
    setDebug("");

    try {
      await fetchJsonFallback(`/ops/cases/${caseId}/finalize-resource`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          note: "Versión final bloqueada desde OPS",
        }),
      });

      setMsg("✅ Recurso marcado como versión final.");
      await load();
    } catch (err) {
      setMsg("❌ No se pudo marcar versión final. Puede faltar el endpoint backend.");
      setDebug(err?.message || "");
    } finally {
      setFreezing(false);
    }
  }


  function isDocSelected(doc) {
    return selectedDocIds.includes(String(doc.id));
  }

  function toggleDocSelection(doc) {
    const id = String(doc.id || "");
    if (!id) return;

    setSelectedDocIds((prev) =>
      prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id]
    );
  }

  function selectAllVisibleDocs() {
    setSelectedDocIds(docs.filter((d) => d.id).map((d) => String(d.id)));
  }

  function clearSelectedDocs() {
    setSelectedDocIds([]);
  }

  async function downloadZip() {
    setZipLoading(true);
    setMsg("");
    setDebug("");

    try {
      let blob;

      if (selectedDocIds.length > 0) {
        blob = await fetchBlobFallback(`/ops/cases/${caseId}/zip-selected`, {
          method: "POST",
          headers: {
            ...headers,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ document_ids: selectedDocIds }),
        });
      } else {
        blob = await fetchBlobFallback(`/ops/cases/${caseId}/zip`, { headers });
      }

      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download =
        selectedDocIds.length > 0
          ? `expediente_${caseId}_seleccionado.zip`
          : `expediente_${caseId}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (err) {
      setMsg("❌ No se pudo descargar el ZIP.");
      setDebug(err?.message || "");
    } finally {
      setZipLoading(false);
    }
  }


  async function createFollowup() {
    if (!followupTitle.trim()) {
      setMsg("❌ Indica un título para el seguimiento.");
      return;
    }
    if (!followupDueAt.trim()) {
      setMsg("❌ Indica una fecha límite.");
      return;
    }

    setFollowupCreating(true);
    setMsg("");
    setDebug("");

    try {
      const fd = new FormData();
      fd.append("kind", "seguimiento_manual");
      fd.append("title", followupTitle.trim());
      fd.append("due_at", followupDueAt.trim());
      if (followupDescription.trim()) fd.append("description", followupDescription.trim());

      await fetchJsonFallback(`/ops/cases/${caseId}/followups`, {
        method: "POST",
        headers,
        body: fd,
      });

      setFollowupTitle("");
      setFollowupDueAt("");
      setFollowupDescription("");
      setMsg("✅ Seguimiento creado.");
      await load();
    } catch (err) {
      setMsg("❌ No se pudo crear el seguimiento.");
      setDebug(err?.message || "");
    } finally {
      setFollowupCreating(false);
    }
  }

  async function resolveFollowup(followupId) {
    setMsg("");
    setDebug("");

    try {
      const fd = new FormData();
      fd.append("note", "Resuelto desde OPS");

      await fetchJsonFallback(`/ops/cases/${caseId}/followups/${followupId}/resolve`, {
        method: "POST",
        headers,
        body: fd,
      });

      setMsg("✅ Seguimiento marcado como resuelto.");
      await load();
    } catch (err) {
      setMsg("❌ No se pudo resolver el seguimiento.");
      setDebug(err?.message || "");
    }
  }

  function followupBadge(fu) {
    if (fu.status === "resolved") {
      return { text: "Resuelto", bg: "#dcfce7", color: "#166534" };
    }
    if (fu.overdue) {
      return { text: "Vencido", bg: "#fee2e2", color: "#991b1b" };
    }
    if (typeof fu.days_left === "number" && fu.days_left <= 7) {
      return { text: "Próximo", bg: "#fef9c3", color: "#854d0e" };
    }
    return { text: "Pendiente", bg: "#dbeafe", color: "#1d4ed8" };
  }


  return (
    <div className="sr-container py-8">
      <div className="flex gap-2 flex-wrap">
        <Link to="/ops" className="sr-btn-secondary">
          ← Volver al panel
        </Link>
        <Link to="/ops" className="sr-btn-secondary">
          ⚖️ Dashboard jurídico
        </Link>

        <Link to="/ops" className="sr-btn-secondary">
          🟢 Presentados / histórico
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap mt-4">
        <div>
          <h1 className="sr-h2">Expediente {caseId}</h1>
          <p className="sr-p" style={{ marginTop: 4 }}>
            Gestión jurídica completa: recurso, documentos, presentación y trazabilidad.
          </p>
        </div>

        <div className="flex gap-2 flex-wrap">
          <span
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              fontWeight: 900,
              background: hasManualSubmission ? "#dcfce7" : "#fef9c3",
              color: hasManualSubmission ? "#166534" : "#854d0e",
              border: hasManualSubmission ? "1px solid #86efac" : "1px solid #fde68a",
            }}
          >
            {hasManualSubmission ? "🟢 Presentado manualmente" : "🟡 Pendiente / revisión"}
          </span>
          <span
            style={{
              padding: "8px 12px",
              borderRadius: 999,
              fontWeight: 900,
              background: hasFinalResource ? "#ede9fe" : "#f1f5f9",
              color: hasFinalResource ? "#5b21b6" : "#475569",
              border: hasFinalResource ? "1px solid #c4b5fd" : "1px solid #e2e8f0",
            }}
          >
            {hasFinalResource ? "Versión final" : "Editable"}
          </span>
        </div>
      </div>

      <Card
        className="mt-4"
        style={{ background: "#fffbeb", border: "1px solid #fde68a" }}
      >
        <h3 className="sr-h3" style={{ marginTop: 0 }}>
          🟡 Revisión manual obligatoria
        </h3>
        <p className="sr-p" style={{ marginBottom: 0 }}>
          Para ayuntamientos, revisa el recurso y registra aquí la presentación manual con justificante,
          CSV y documentos externos. DGT podrá ir por submitter automático cuando esté cerrado.
        </p>
      </Card>

      <div className="grid md:grid-cols-2 gap-4 mt-4">
        <Card>
          <h3 className="sr-h3">⚙️ Acciones rápidas</h3>

          <div className="grid md:grid-cols-2 gap-3 mt-3">
            <input
              placeholder="Número de registro automático/manual (opcional)"
              value={registro}
              onChange={(e) => setRegistro(e.target.value)}
              className="border rounded px-3 py-2 text-sm"
            />
            <input
              placeholder="Nota interna (opcional)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="border rounded px-3 py-2 text-sm"
            />
          </div>

          <div className="flex gap-3 flex-wrap mt-4">
            <button className="sr-btn-primary" onClick={generateResourceNow} disabled={generating}>
              {generating ? "Generando recurso…" : "Generar recurso ahora"}
            </button>

            <button className="sr-btn-secondary" onClick={markSubmitted}>
              Marcar automático
            </button>

            <button className="sr-btn-secondary" onClick={freezeFinalResource} disabled={freezing}>
              {freezing ? "Bloqueando…" : "🔒 Versión final"}
            </button>

            <button className="sr-btn-secondary" onClick={downloadZip} disabled={zipLoading}>
              {zipLoading ? "Preparando ZIP…" : selectedDocIds.length > 0 ? `⬇ ZIP selección (${selectedDocIds.length})` : "⬇ ZIP expediente"}
            </button>
          </div>

          <div className="flex gap-3 flex-wrap items-center mt-4">
            <input
              type="file"
              onChange={(e) => setJustificante(e.target.files?.[0] || null)}
            />

            <button
              className="sr-btn-primary"
              onClick={uploadJustificante}
              disabled={uploading}
            >
              {uploading ? "Subiendo…" : "Subir justificante"}
            </button>
          </div>
        </Card>

        <Card style={{ background: "#f8fafc", border: "1px solid #e2e8f0" }}>
          <h3 className="sr-h3">📊 Resumen del expediente</h3>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <div style={{ background: "#fff", borderRadius: 14, padding: 12, border: "1px solid #e2e8f0" }}>
              <div style={{ color: "#64748b", fontSize: 12 }}>Documentos</div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{docs.length}</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 14, padding: 12, border: "1px solid #e2e8f0" }}>
              <div style={{ color: "#64748b", fontSize: 12 }}>Eventos</div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{events.length}</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 14, padding: 12, border: "1px solid #e2e8f0" }}>
              <div style={{ color: "#64748b", fontSize: 12 }}>Recursos</div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{resourceDocs.length}</div>
            </div>
            <div style={{ background: "#fff", borderRadius: 14, padding: 12, border: "1px solid #e2e8f0" }}>
              <div style={{ color: "#64748b", fontSize: 12 }}>Externos</div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>{externalDocs.length}</div>
            </div>
          </div>
        </Card>
      </div>

      <StatusBox msg={msg} debug={debug} />

      <Card className="mt-4" style={{ border: "1px solid #fde68a", background: "#fffbeb" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="sr-h3" style={{ marginTop: 0 }}>⏰ Control de plazos y seguimiento</h3>
            <p className="sr-p" style={{ marginBottom: 0 }}>
              Alertas operativas tras la presentación: revisar respuesta, silencio, requerimientos o siguiente acción.
            </p>
          </div>
          <button className="sr-btn-secondary" onClick={load} type="button">
            Refrescar
          </button>
        </div>

        <div className="grid md:grid-cols-3 gap-3 mt-4">
          <input
            placeholder="Título: Revisar respuesta del Ayuntamiento"
            value={followupTitle}
            onChange={(e) => setFollowupTitle(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Fecha: 2026-06-07 o 2026-06-07 10:00"
            value={followupDueAt}
            onChange={(e) => setFollowupDueAt(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Descripción / nota"
            value={followupDescription}
            onChange={(e) => setFollowupDescription(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="mt-3">
          <button
            className="sr-btn-primary"
            onClick={createFollowup}
            disabled={followupCreating}
            type="button"
          >
            {followupCreating ? "Creando…" : "Crear seguimiento"}
          </button>
        </div>

        <div className="mt-4 space-y-2">
          {followups.length ? (
            followups.map((fu) => {
              const badge = followupBadge(fu);
              return (
                <div
                  key={fu.id}
                  className="border rounded-xl p-3"
                  style={{ background: "#fff", borderColor: "#e2e8f0" }}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <strong>{fu.title}</strong>
                      <div style={{ color: "#64748b", fontSize: 13, marginTop: 3 }}>
                        Vence: {fmt(fu.due_at)}
                        {typeof fu.days_left === "number" ? ` · ${fu.days_left} días` : ""}
                      </div>
                      {fu.description ? (
                        <div style={{ color: "#334155", fontSize: 13, marginTop: 6 }}>
                          {fu.description}
                        </div>
                      ) : null}
                    </div>

                    <div className="flex gap-2 items-center flex-wrap justify-end">
                      <span
                        style={{
                          background: badge.bg,
                          color: badge.color,
                          borderRadius: 999,
                          padding: "4px 10px",
                          fontWeight: 900,
                          fontSize: 12,
                        }}
                      >
                        {badge.text}
                      </span>

                      {fu.status !== "resolved" ? (
                        <button
                          className="sr-btn-secondary"
                          onClick={() => resolveFollowup(fu.id)}
                          type="button"
                        >
                          Marcar resuelto
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <EmptyBox>No hay seguimientos todavía. Al registrar una presentación manual se crearán alertas de 30/60/90 días.</EmptyBox>
          )}
        </div>
      </Card>


      <Card className="mt-4" style={{ border: "1px solid #bbf7d0", background: "#f0fdf4" }}>
        <h3 className="sr-h3" style={{ marginTop: 0 }}>📌 Registrar presentación manual</h3>
        <p className="sr-p">
          Para ayuntamientos o presentaciones hechas fuera de OPS. Guarda el registro, CSV y justificante sin pasar por submitters.
        </p>

        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <input
            placeholder="Organismo: Ajuntament de Terrassa"
            value={manualOrganismo}
            onChange={(e) => setManualOrganismo(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Número registro: E-AJT-..."
            value={manualRegistro}
            onChange={(e) => setManualRegistro(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="CSV / código verificación"
            value={manualCsv}
            onChange={(e) => setManualCsv(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Fecha/hora presentación: 2026-05-07 10:43"
            value={manualDate}
            onChange={(e) => setManualDate(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Canal"
            value={manualChannel}
            onChange={(e) => setManualChannel(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            placeholder="Nota interna"
            value={manualNote}
            onChange={(e) => setManualNote(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-3 flex-wrap items-center mt-4">
          <input
            type="file"
            onChange={(e) => setManualFile(e.target.files?.[0] || null)}
          />
          <button
            className="sr-btn-primary"
            onClick={registerManualSubmission}
            disabled={manualSubmitting}
          >
            {manualSubmitting ? "Registrando…" : "Registrar presentación manual"}
          </button>
        </div>
      </Card>

      <Card className="mt-4" style={{ border: "1px solid #bfdbfe", background: "#eff6ff" }}>
        <h3 className="sr-h3" style={{ marginTop: 0 }}>📎 Adjuntar documentación externa</h3>
        <p className="sr-p">
          Añade resoluciones, requerimientos, instancias, justificantes, contestaciones o pruebas externas al expediente.
        </p>

        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <select
            value={externalKind}
            onChange={(e) => setExternalKind(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          >
            {EXTERNAL_KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
          <input
            placeholder="Nota del documento (opcional)"
            value={externalNote}
            onChange={(e) => setExternalNote(e.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
        </div>

        <div className="flex gap-3 flex-wrap items-center mt-4">
          <input
            type="file"
            onChange={(e) => setExternalFile(e.target.files?.[0] || null)}
          />
          <button
            className="sr-btn-primary"
            onClick={uploadExternalDocument}
            disabled={externalUploading}
          >
            {externalUploading ? "Adjuntando…" : "Adjuntar documento externo"}
          </button>
        </div>
      </Card>

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <Card>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="sr-h3">📂 Documentos del expediente</h3>
              <div style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>
                Seleccionados para ZIP: <strong>{selectedDocIds.length}</strong>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <button className="sr-btn-secondary" onClick={selectAllVisibleDocs} type="button">
                Seleccionar todos
              </button>
              <button className="sr-btn-secondary" onClick={clearSelectedDocs} type="button">
                Limpiar
              </button>
              <button className="sr-btn-secondary" onClick={downloadZip} disabled={zipLoading} type="button">
                {zipLoading
                  ? "Preparando ZIP…"
                  : selectedDocIds.length > 0
                    ? `⬇ ZIP selección (${selectedDocIds.length})`
                    : "⬇ ZIP todo"}
              </button>
              <button className="sr-btn-secondary" onClick={load} disabled={loading} type="button">
                {loading ? "Cargando…" : "Refrescar"}
              </button>
            </div>
          </div>

          <h4 className="font-bold mt-4">🧾 Recursos generados</h4>
          {resourceDocs.length ? (
            resourceDocs.map((d, i) => (
              <DocumentRow key={`${d.id || d.kind}-${i}`} doc={d} onOpen={openDocument} selectable selected={isDocSelected(d)} onToggle={toggleDocSelection} />
            ))
          ) : (
            <EmptyBox>Todavía no hay recurso visible. Pulsa “Generar recurso ahora”.</EmptyBox>
          )}

          <h4 className="font-bold mt-5">🏛️ Documentación externa / presentación</h4>
          {externalDocs.length ? (
            externalDocs.map((d, i) => (
              <DocumentRow key={`${d.id || d.kind}-external-${i}`} doc={d} onOpen={openDocument} selectable selected={isDocSelected(d)} onToggle={toggleDocSelection} />
            ))
          ) : (
            <EmptyBox>No hay documentación externa todavía.</EmptyBox>
          )}

          <h4 className="font-bold mt-5">📎 Otros documentos</h4>
          {otherDocs.length ? (
            otherDocs.map((d, i) => (
              <DocumentRow key={`${d.id || d.kind}-other-${i}`} doc={d} onOpen={openDocument} selectable selected={isDocSelected(d)} onToggle={toggleDocSelection} />
            ))
          ) : (
            <EmptyBox>No hay otros documentos visibles.</EmptyBox>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h3 className="sr-h3">🕒 Timeline jurídico</h3>
            <button className="sr-btn-secondary" onClick={load} disabled={loading}>
              Refrescar
            </button>
          </div>

          {events.length ? (
            events.map((e, i) => (
              <TimelineItem key={`${e.type}-${e.created_at}-${i}`} event={e} index={i === events.length - 1 ? 999 : i} />
            ))
          ) : (
            <EmptyBox>Todavía no hay eventos visibles.</EmptyBox>
          )}
        </Card>
      </div>
    </div>
  );
}
