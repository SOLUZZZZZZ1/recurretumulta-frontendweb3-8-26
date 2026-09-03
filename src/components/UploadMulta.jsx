// src/components/UploadMulta.jsx — Subida y análisis de documento
import React, { useState } from "react";
import {
  appendAiDocumentConsent,
  DOCUMENT_ANALYSIS_PRIVACY_VERSION,
} from "../lib/aiDocumentConsent.js";
import AiDocumentConsent from "./AiDocumentConsent.jsx";

const API = "/api";

export default function UploadMulta() {
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [aiProcessingConsent, setAiProcessingConsent] = useState(false);

  async function analyze() {
    if (!file) {
      setMsg("Selecciona un documento.");
      return;
    }

    if (!aiProcessingConsent) {
      setMsg("Debes autorizar expresamente el procesamiento documental con IA.");
      return;
    }

    setLoading(true);
    setMsg("");

    const fd = new FormData();
    fd.append("file", file);
    appendAiDocumentConsent(fd, {
      consented: aiProcessingConsent,
      privacyVersion: DOCUMENT_ANALYSIS_PRIVACY_VERSION,
    });

    try {
      const r = await fetch(`${API}/analyze`, { method: "POST", body: fd });
      if (!r.ok) throw new Error("No se pudo analizar el documento");
      setMsg("Documento analizado correctamente.");
    } catch (e) {
      setMsg("Error al analizar el documento.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sr-card">
      <h2 className="sr-h2">Subir documento</h2>

      <p className="sr-p">
        Sube una foto, escaneo o PDF del documento que quieras recurrir.
      </p>

      <input
        type="file"
        onChange={(e) => {
          setFile(e.target.files?.[0] || null);
          setAiProcessingConsent(false);
        }}
      />

      <AiDocumentConsent
        id="upload-multa-ai-processing-consent"
        checked={aiProcessingConsent}
        onChange={setAiProcessingConsent}
        disabled={!file || loading}
        documentLabel="el documento seleccionado"
      />

      <div className="sr-cta-row" style={{ marginTop: 12 }}>
        <button
          className="sr-btn-primary"
          onClick={analyze}
          disabled={loading || !file || !aiProcessingConsent}
        >
          {loading ? "Analizando…" : "Analizar documento"}
        </button>

        {msg && <span className="sr-small">{msg}</span>}
      </div>
    </div>
  );
}
