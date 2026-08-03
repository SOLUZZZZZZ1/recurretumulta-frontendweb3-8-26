import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";

const API = "/api";

function fmt(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleString();
  } catch {
    return String(d);
  }
}

async function fetchJson(url, options = {}) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || "Error API");
  return data;
}

export default function OpsCaseDetail() {
  const { caseId } = useParams();
  const token = localStorage.getItem("ops_token");
  const headers = { "X-Operator-Token": token };

  const [docs, setDocs] = useState([]);
  const [events, setEvents] = useState([]);
  const [registro, setRegistro] = useState("");
  const [note, setNote] = useState("");
  const [justificante, setJustificante] = useState(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    load();
  }, [caseId]);

  async function load() {
    const [d, e] = await Promise.all([
      fetchJson(`${API}/ops/cases/${caseId}/documents`, { headers }),
      fetchJson(`${API}/ops/cases/${caseId}/events`, { headers }),
    ]);
    setDocs(d.items || []);
    setEvents(e.items || []);
  }

  async function presignAndOpen(bucket, key) {
    const url = `${API}/files/presign?case_id=${caseId}&bucket=${bucket}&key=${key}`;
    const data = await fetchJson(url);
    window.open(data.url, "_blank", "noopener,noreferrer");
  }

  async function markSubmitted() {
    const fd = new FormData();
    if (registro) fd.append("registro", registro);
    if (note) fd.append("note", note);

    await fetchJson(`${API}/ops/cases/${caseId}/mark-submitted`, {
      method: "POST",
      headers,
      body: fd,
    });

    alert("✅ Caso marcado como presentado");
    load();
  }

  async function uploadJustificante() {
    if (!justificante) return alert("Selecciona un archivo");
    setUploading(true);

    const fd = new FormData();
    fd.append("file", justificante);

    await fetchJson(`${API}/ops/cases/${caseId}/upload-justificante`, {
      method: "POST",
      headers,
      body: fd,
    });

    setUploading(false);
    setJustificante(null);
    alert("📎 Justificante subido");
    load();
  }

  return (
    <div className="sr-container py-8">
      <Link to="/ops" className="sr-btn-secondary">
        ← Volver al panel
      </Link>

      <h1 className="sr-h2 mt-4">Expediente {caseId}</h1>

      <div className="sr-card mt-4">
        <h3 className="sr-h3">Acciones</h3>

        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <input
            placeholder="Número de registro (opcional)"
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
          <button className="sr-btn-primary" onClick={markSubmitted}>
            Marcar como presentado
          </button>

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
      </div>

      <div className="grid md:grid-cols-2 gap-4 mt-6">
        <div className="sr-card">
          <h3 className="sr-h3">Documentos</h3>
          {docs.map((d, i) => (
            <button
              key={i}
              onClick={() => presignAndOpen(d.bucket, d.key)}
              className="block w-full text-left border rounded p-2 mt-2 text-xs"
            >
              <strong>{d.kind}</strong>
              <div>{fmt(d.created_at)}</div>
            </button>
          ))}
        </div>

        <div className="sr-card">
          <h3 className="sr-h3">Logs</h3>
          {events.map((e, i) => (
            <div key={i} className="border rounded p-2 mt-2 text-xs">
              <strong>{e.type}</strong>
              <div>{fmt(e.created_at)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
