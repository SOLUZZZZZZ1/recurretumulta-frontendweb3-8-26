import React, { useMemo, useRef, useState } from "react";

const API = "/api";
const MAX_FILES = 5;

async function fetchJson(url, options = {}) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || data?.message || "Error API");
  return data;
}

function formatBytes(bytes) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(2)} MB`;
}

export default function AppendDocuments({ caseId, onDone }) {
  const inputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [msg, setMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const maxSizeMB = 12;
  const maxBytes = useMemo(() => maxSizeMB * 1024 * 1024, []);

  function pickFiles() {
    inputRef.current?.click();
  }

  function addFiles(fileList) {
    setMsg("");
    const incoming = Array.from(fileList || []);
    if (!incoming.length) return;

    const space = MAX_FILES - files.length;
    const sliced = incoming.slice(0, Math.max(0, space));

    if (incoming.length > sliced.length) {
      setMsg(`Máximo ${MAX_FILES} documentos por subida. Se han añadido solo los primeros.`);
    }

    const valid = [];
    for (const f of sliced) {
      if (f.size > maxBytes) {
        setMsg(`Uno de los archivos supera ${maxSizeMB} MB.`);
        continue;
      }
      valid.push({ id: crypto.randomUUID(), file: f });
    }

    if (!valid.length) return;
    setFiles((prev) => [...prev, ...valid]);
  }

  function removeFile(id) {
    setFiles((prev) => prev.filter((x) => x.id !== id));
  }

  async function upload() {
    setMsg("");
    if (!caseId) return setMsg("Falta caseId.");
    if (files.length === 0) return setMsg("Selecciona al menos un documento.");

    setLoading(true);
    try {
      const fd = new FormData();
      files.forEach((f) => fd.append("files", f.file));

      await fetchJson(`${API}/cases/${encodeURIComponent(caseId)}/append-documents`, {
        method: "POST",
        body: fd,
      });

      setMsg("✅ Documentos añadidos. Revisando expediente…");
      setFiles([]);

      if (onDone) onDone();
    } catch (e) {
      setMsg(e.message || "Error subiendo documentos.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sr-card" style={{ marginTop: 14, textAlign: "left" }}>
      <h3 className="sr-h3" style={{ marginTop: 0 }}>
        Añadir documento al expediente
      </h3>

      <p className="sr-p">
        Sube la nueva notificación/resolución para completar el expediente (máx. {MAX_FILES} archivos).
      </p>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf,.doc,.docx"
        style={{ display: "none" }}
        onChange={(e) => addFiles(e.target.files)}
      />

      <div className="sr-cta-row" style={{ justifyContent: "flex-start" }}>
        <button className="sr-btn-secondary" type="button" onClick={pickFiles}>
          Elegir archivos
        </button>
        <button className="sr-btn-primary" type="button" onClick={upload} disabled={loading}>
          {loading ? "Subiendo…" : "Subir documentos"}
        </button>
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
          {files.map((f, idx) => (
            <div
              key={f.id}
              style={{
                border: "1px solid #e5e7eb",
                borderRadius: 12,
                padding: 10,
                background: "rgba(255,255,255,0.75)",
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
      )}

      {msg && (
        <div className="sr-small" style={{ marginTop: 10, color: msg.startsWith("✅") ? "#166534" : "#991b1b" }}>
          {msg}
        </div>
      )}
    </div>
  );
}
