import React, { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  apiFetch,
  rememberCaseAccessToken,
} from "../lib/api.js";
import { rememberCaseScopedData } from "../lib/caseSession.js";
import {
  appendAiDocumentConsent,
  DOCUMENT_ANALYSIS_PRIVACY_VERSION,
} from "../lib/aiDocumentConsent.js";
import AiDocumentConsent from "./AiDocumentConsent.jsx";

const API = "/api";
const MAX_FILES = 5;

async function fetchJson(url, options = {}) {
  const r = await apiFetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) {
    const detail = data?.detail || data?.message || data?.error || "Error API";
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data;
}

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

function cleanPlate(v) {
  return String(v || "").toUpperCase().replace(/\s+/g, "").replace(/-/g, "");
}

function validateClientData(client) {
  const missing = [];

  if (!client.full_name.trim() || client.full_name.trim().length < 3) missing.push("nombre");
  if (!client.email.trim() || !client.email.includes("@")) missing.push("email");
  if (!client.telefono.trim() || client.telefono.trim().length < 6) missing.push("teléfono");
  if (!client.dni_nie.trim() || client.dni_nie.trim().length < 3) missing.push("DNI/NIE");
  if (!client.matricula.trim() || client.matricula.trim().length < 4) missing.push("matrícula");
  if (!client.domicilio_notif.trim() || client.domicilio_notif.trim().length < 5) missing.push("domicilio");

  return missing;
}

export default function UploadExpediente({ maxSizeMB = 12 }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [client, setClient] = useState({
    full_name: "",
    email: "",
    telefono: "",
    dni_nie: "",
    matricula: "",
    domicilio_notif: "",
  });

  const [files, setFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [aiProcessingConsent, setAiProcessingConsent] = useState(false);

  const maxBytes = useMemo(() => maxSizeMB * 1024 * 1024, [maxSizeMB]);

  function updateClient(key, value) {
    setClient((prev) => ({ ...prev, [key]: value }));
  }

  function pickFiles() {
    inputRef.current?.click();
  }

  function addFiles(fileList) {
    setMsg("");
    setAiProcessingConsent(false);
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;

    const space = MAX_FILES - files.length;
    const sliced = incoming.slice(0, Math.max(0, space));

    if (incoming.length > sliced.length) {
      setMsg(`Máximo ${MAX_FILES} documentos por expediente. Se han añadido solo los primeros.`);
    }

    const valid = [];
    for (const f of sliced) {
      if (f.size > maxBytes) {
        setMsg(`Uno de los archivos supera ${maxSizeMB} MB. Reduce el tamaño o usa otro documento.`);
        continue;
      }
      valid.push({ id: crypto.randomUUID(), file: f });
    }

    if (!valid.length) return;
    setFiles((prev) => [...prev, ...valid]);
  }

  function removeFile(id) {
    setFiles((prev) => prev.filter((x) => x.id !== id));
    setAiProcessingConsent(false);
  }

  function clearAll() {
    setFiles([]);
    setMsg("");
    setAiProcessingConsent(false);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function saveClientDetails(caseId) {
    const payload = {
      full_name: client.full_name.trim(),
      dni_nie: client.dni_nie.trim().toUpperCase(),
      domicilio_notif: client.domicilio_notif.trim(),
      email: client.email.trim(),
      telefono: client.telefono.trim(),
    };

    await fetchJson(`${API}/cases/${caseId}/details`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    return {
      ...payload,
      matricula: cleanPlate(client.matricula),
    };
  }

  async function analyze() {
    setMsg("");

    const missing = validateClientData(client);
    if (missing.length) {
      setMsg(`❌ Antes de subir la multa faltan datos: ${missing.join(", ")}.`);
      return;
    }

    if (files.length === 0) {
      setMsg("❌ Primero añade al menos un documento.");
      return;
    }

    if (!aiProcessingConsent) {
      setMsg("❌ Debes autorizar expresamente el procesamiento documental con IA.");
      return;
    }

    setLoading(true);

    try {
      let data;
      let caseId;

      if (files.length === 1) {
        const fd = new FormData();
        fd.append("file", files[0].file);
        appendAiDocumentConsent(fd, {
          consented: aiProcessingConsent,
          privacyVersion: DOCUMENT_ANALYSIS_PRIVACY_VERSION,
        });

        data = await fetchJson(`${API}/analyze`, {
          method: "POST",
          body: fd,
        });

        caseId =
          data?.case_id ||
          data?.caseId ||
          data?.id ||
          data?.extracted?.case_id ||
          data?.extracted?.id;

        if (!caseId) throw new Error("No se pudo obtener el número de expediente.");
      } else {
        const fdMulti = new FormData();
        files.forEach((f) => fdMulti.append("files", f.file));
        appendAiDocumentConsent(fdMulti, {
          consented: aiProcessingConsent,
          privacyVersion: DOCUMENT_ANALYSIS_PRIVACY_VERSION,
        });

        data = await fetchJson(`${API}/analyze/expediente`, {
          method: "POST",
          body: fdMulti,
        });

        caseId = data?.case_id;
        if (!caseId) throw new Error("El backend no devolvió case_id para el expediente.");
      }

      if (!rememberCaseAccessToken(caseId, data?.case_access_token)) {
        throw new Error("El backend no devolvió la capacidad segura del expediente.");
      }
      const clientData = await saveClientDetails(caseId);
      rememberCaseScopedData(caseId, {
        client_data: clientData,
      });

      setMsg("✅ Documentación recibida. Ahora revisa el resumen, autoriza y completa el pago para iniciar la tramitación.");
      navigate(`/resumen?case=${encodeURIComponent(caseId)}`);
    } catch (e) {
      setMsg(e?.message || "Error al analizar el expediente.");
    } finally {
      setLoading(false);
    }
  }

  const labelBtn = files.length <= 1 ? "Analizar documento" : "Analizar expediente";

  return (
    <div className="sr-card" style={{ textAlign: "left" }}>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="sr-h2" style={{ marginBottom: 6 }}>
            Datos y subida de multa
          </h2>
          <p className="sr-p" style={{ marginBottom: 0 }}>
            Para evitar expedientes sin cliente, necesitamos tus datos antes de subir la documentación.
          </p>
        </div>

        <div className="sr-small" style={{ color: "#6b7280" }}>
          {files.length}/{MAX_FILES} documentos
        </div>
      </div>

      <div className="sr-card" style={{ marginTop: 14, background: "rgba(248,250,252,0.9)" }}>
        <div className="sr-h3">1. Datos obligatorios del cliente</div>

        <div className="grid md:grid-cols-2 gap-3" style={{ marginTop: 12 }}>
          <input
            className="sr-input"
            placeholder="Nombre y apellidos"
            value={client.full_name}
            onChange={(e) => updateClient("full_name", e.target.value)}
          />
          <input
            className="sr-input"
            placeholder="Email"
            type="email"
            value={client.email}
            onChange={(e) => updateClient("email", e.target.value)}
          />
          <input
            className="sr-input"
            placeholder="Teléfono"
            value={client.telefono}
            onChange={(e) => updateClient("telefono", e.target.value)}
          />
          <input
            className="sr-input"
            placeholder="DNI / NIE / Pasaporte"
            value={client.dni_nie}
            onChange={(e) => updateClient("dni_nie", e.target.value)}
          />
          <input
            className="sr-input"
            placeholder="Matrícula"
            value={client.matricula}
            onChange={(e) => updateClient("matricula", e.target.value)}
          />
          <input
            className="sr-input"
            placeholder="Domicilio a efectos de notificaciones"
            value={client.domicilio_notif}
            onChange={(e) => updateClient("domicilio_notif", e.target.value)}
          />
        </div>

        <p className="sr-small" style={{ marginTop: 10, color: "#64748b" }}>
          La tramitación no se inicia hasta que completes autorización y pago.
        </p>
      </div>

      <div className="sr-card" style={{ marginTop: 14 }}>
        <div className="sr-h3">2. Documentos del expediente</div>

        <div
          onDragEnter={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={(e) => {
            e.preventDefault();
            setDragOver(false);
          }}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            addFiles(e.dataTransfer?.files);
          }}
          role="button"
          tabIndex={0}
          onClick={pickFiles}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") pickFiles();
          }}
          style={{
            marginTop: 14,
            border: `2px dashed ${dragOver ? "#111827" : "#cbd5e1"}`,
            background: dragOver ? "rgba(17,24,39,0.04)" : "rgba(255,255,255,0.75)",
            borderRadius: 16,
            padding: 18,
            cursor: "pointer",
            transition: "all 120ms ease",
          }}
        >
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            style={{ display: "none" }}
            onChange={(e) => addFiles(e.target.files)}
          />

          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <p className="sr-p" style={{ margin: 0 }}>
                <strong>Arrastra y suelta</strong> aquí tus documentos, o haz clic para seleccionar.
              </p>
              <p className="sr-small" style={{ marginTop: 6, opacity: 0.85 }}>
                Formatos: JPG/PNG/WebP/PDF/DOCX · Tamaño máx: {maxSizeMB} MB
              </p>
            </div>

            <button
              type="button"
              className="sr-btn-primary"
              onClick={(e) => {
                e.stopPropagation();
                pickFiles();
              }}
            >
              Añadir documento
            </button>
          </div>
        </div>

        {files.length > 0 && (
          <div className="sr-card" style={{ marginTop: 12 }}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="sr-h3">Documentos añadidos</div>
              <button className="sr-btn-secondary" type="button" onClick={clearAll}>
                Limpiar todo
              </button>
            </div>

            <div style={{ marginTop: 10, display: "grid", gap: 10 }}>
              {files.map((f, idx) => (
                <div
                  key={f.id}
                  style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 12,
                    padding: 10,
                    background: "rgba(255,255,255,0.7)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    gap: 12,
                  }}
                >
                  <div>
                    <div className="sr-small" style={{ fontWeight: 800 }}>
                      Documento {idx + 1}
                    </div>
                    <div className="sr-small" style={{ color: "#6b7280" }}>
                      {f.file.name} · {formatBytes(f.file.size)}
                    </div>
                  </div>

                  <button className="sr-btn-secondary" type="button" onClick={() => removeFile(f.id)}>
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <AiDocumentConsent
        id="upload-expediente-ai-processing-consent"
        checked={aiProcessingConsent}
        onChange={setAiProcessingConsent}
        disabled={!files.length || loading}
        documentLabel="los documentos seleccionados"
      />

      <div className="sr-cta-row" style={{ marginTop: 14, justifyContent: "flex-start" }}>
        <button
          className="sr-btn-primary"
          onClick={analyze}
          disabled={loading || !files.length || !aiProcessingConsent}
        >
          {loading ? "Procesando…" : labelBtn}
        </button>

        {msg && (
          <span
            className="sr-small"
            style={{ alignSelf: "center", color: msg.startsWith("✅") ? "#166534" : "#991b1b" }}
          >
            {msg}
          </span>
        )}
      </div>
    </div>
  );
}
