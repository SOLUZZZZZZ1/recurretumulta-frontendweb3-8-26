// src/components/GenerateRecursoDGT.jsx — Generación dinámica (DGT ahora, genérico después) ✅
import React, { useState } from "react";

const API = "/api";

function isDGT(organismo) {
  const s = (organismo || "").toLowerCase();
  return s.includes("tráfico") || s.includes("trafico") || s.includes("dgt");
}

async function fetchJson(url, options = {}) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || data?.message || "Error API");
  return data;
}

export default function GenerateRecursoDGT({
  caseId,
  organismo,
  recursoSugerido = "Recurso administrativo",
  suggestedTipo = null, // para DGT: "alegaciones" | "reposicion"
}) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [result, setResult] = useState(null);

  const isDgtCase = isDGT(organismo);

  async function presign(bucket, key) {
    const url = `${API}/files/presign?case_id=${encodeURIComponent(caseId)}&bucket=${encodeURIComponent(
      bucket
    )}&key=${encodeURIComponent(key)}`;
    const data = await fetchJson(url);
    return data.url;
  }

  async function generate() {
    setMsg("");
    setResult(null);

    if (!caseId) return setMsg("Falta el expediente interno.");

    // Por ahora solo generamos DGT con /generate/dgt
    if (!isDgtCase) {
      setMsg("La generación automática para este organismo está en preparación. Ya hemos detectado el tipo de recurso, pero aún no generamos el documento genérico.");
      return;
    }

    setLoading(true);
    try {
      const payload = {
        case_id: caseId,
        tipo: suggestedTipo || null,
        interesado: {}, // lo rellenaremos con /cases/{id}/details en el siguiente paso
      };

      const data = await fetchJson(`${API}/generate/dgt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setResult(data);
      setMsg("Documento generado.");
    } catch (e) {
      setMsg(e?.message || "No se pudo generar el documento.");
    } finally {
      setLoading(false);
    }
  }

  async function openDoc(doc) {
    try {
      const url = await presign(doc.bucket, doc.key);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      alert(e?.message || "No se pudo abrir el archivo.");
    }
  }

  return (
    <div className="sr-card" style={{ marginTop: 14 }}>
      <h3 className="sr-h3" style={{ marginTop: 0 }}>
        Generar documento — {recursoSugerido}
      </h3>

      <p className="sr-p">
        {isDgtCase ? (
          <>
            Genera el escrito en <strong>DOCX</strong> y <strong>PDF</strong> para este expediente (Tráfico/DGT).
          </>
        ) : (
          <>
            Hemos detectado el tipo de recurso y el organismo. En el siguiente paso generaremos el documento genérico con plantilla.
          </>
        )}
      </p>

      <div className="sr-cta-row" style={{ justifyContent: "flex-start" }}>
        <button className="sr-btn-primary" onClick={generate} disabled={loading || !isDgtCase}>
          {loading ? "Generando…" : isDgtCase ? "Generar documento" : "Generación en preparación"}
        </button>

        {msg && (
          <div className="sr-small" style={{ alignSelf: "center", color: msg.startsWith("Documento") ? "#166534" : "#991b1b" }}>
            {msg.startsWith("Documento") ? "✅" : "ℹ️"} {msg}
          </div>
        )}
      </div>

      {result?.docx && result?.pdf && (
        <div style={{ marginTop: 12, display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button className="sr-btn-secondary" onClick={() => openDoc(result.pdf)}>
            Abrir PDF
          </button>
          <button className="sr-btn-secondary" onClick={() => openDoc(result.docx)}>
            Abrir DOCX
          </button>
        </div>
      )}

      <div className="sr-small" style={{ marginTop: 10, color: "#6b7280" }}>
        Nota: en breve, este mismo bloque generará automáticamente escritos genéricos (OEPM, ayuntamientos, etc.) usando plantillas.
      </div>
    </div>
  );
}
