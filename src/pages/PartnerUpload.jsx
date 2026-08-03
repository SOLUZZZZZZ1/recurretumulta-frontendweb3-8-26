import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

const API = "/api";

async function fetchJson(url, options = {}) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || `Error HTTP ${r.status}`);
  return data;
}

export default function PartnerUpload() {
  const nav = useNavigate();

  const [partnerToken, setPartnerToken] = useState(() => localStorage.getItem("partner_token") || "");
  const [confirm, setConfirm] = useState(true);

  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");

  // interesado (mínimo para que el recurso no salga con placeholders)
  const [nombre, setNombre] = useState("");
  const [dni, setDni] = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [localidad, setLocalidad] = useState("");

  const [files, setFiles] = useState([]);
  const [partnerNote, setPartnerNote] = useState("");

  const [loading, setLoading] = useState(false);
  const [okCaseId, setOkCaseId] = useState("");
  const [error, setError] = useState("");

  const authHeader = useMemo(() => {
    const t = (partnerToken || "").trim();
    return t ? { Authorization: `Bearer ${t}` } : {};
  }, [partnerToken]);

  async function submit() {
    setError("");
    setOkCaseId("");

    const t = (partnerToken || "").trim();
    if (!t || t.length < 20) {
      setError("Falta el token de la asesoría (Partner Token).");
      return;
    }
    if (!confirm) {
      setError("Debes confirmar que el cliente ha sido informado.");
      return;
    }
    if (!files || files.length === 0) {
      setError("Debes subir al menos 1 documento.");
      return;
    }
    if (files.length > 5) {
      setError("Máximo 5 documentos por expediente.");
      return;
    }

    const interesado = {
      nombre: (nombre || "").trim(),
      dni: (dni || "").trim(),
      domicilio: (domicilio || "").trim(),
      localidad: (localidad || "").trim(),
    };

    const fd = new FormData();
    fd.append("confirm_client_informed", "true");

    if ((clientName || "").trim()) fd.append("client_name", clientName.trim());
    if ((clientEmail || "").trim()) fd.append("client_email", clientEmail.trim());
    if ((partnerNote || "").trim()) fd.append("partner_note", partnerNote.trim());

    fd.append("interesado_json", JSON.stringify(interesado));

    files.forEach((f) => fd.append("files", f));

    setLoading(true);
    try {
      const data = await fetchJson(`${API}/partner/cases`, {
        method: "POST",
        headers: { ...authHeader },
        body: fd,
      });

      if (!data?.case_id) throw new Error("Respuesta OK pero falta case_id.");
      setOkCaseId(data.case_id);

      // Guardamos token para próximas veces
      localStorage.setItem("partner_token", t);

      // opcional: navegar a OPS si lo usas internamente
      // nav(`/ops/case/${data.case_id}`);
    } catch (e) {
      setError(e.message || "Error creando expediente (partner)");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="sr-container" style={{ paddingTop: 24, paddingBottom: 48 }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h1 className="sr-h2" style={{ margin: 0 }}>Entrada Asesorías (B2B)</h1>
        <Link to="/" className="sr-btn-secondary">← Volver</Link>
      </div>

      {error && (
        <div className="sr-card" style={{ marginTop: 14 }}>
          <div className="sr-p" style={{ margin: 0, color: "#991b1b" }}>❌ {error}</div>
        </div>
      )}

      {okCaseId && (
        <div className="sr-card" style={{ marginTop: 14 }}>
          <div className="sr-p" style={{ margin: 0, color: "#166534", fontWeight: 700 }}>
            ✅ Expediente creado: {okCaseId}
          </div>
          <div className="sr-small" style={{ color: "#6b7280", marginTop: 6 }}>
            Este expediente entra por canal asesoría (facturación mensual). No pasa por Stripe.
          </div>
          <div style={{ marginTop: 10 }}>
            <button className="sr-btn-primary" onClick={() => nav(`/ops/case/${okCaseId}`)}>
              Abrir en OPS
            </button>
          </div>
        </div>
      )}

      <div className="sr-card" style={{ marginTop: 14 }}>
        <h3 className="sr-h3" style={{ marginTop: 0 }}>Token de la asesoría</h3>
        <input
          className="w-full border rounded px-3 py-2 text-sm"
          value={partnerToken}
          onChange={(e) => setPartnerToken(e.target.value)}
          placeholder="Partner Token (Bearer)"
        />
        <div className="sr-small" style={{ color: "#6b7280", marginTop: 6 }}>
          Se guarda en este navegador para próximos envíos.
        </div>
      </div>

      <div className="sr-card" style={{ marginTop: 14 }}>
        <h3 className="sr-h3" style={{ marginTop: 0 }}>Datos del cliente (opcional)</h3>
        <div className="grid" style={{ display: "grid", gap: 10 }}>
          <input className="w-full border rounded px-3 py-2 text-sm" value={clientName} onChange={(e)=>setClientName(e.target.value)} placeholder="Nombre cliente (opcional)" />
          <input className="w-full border rounded px-3 py-2 text-sm" value={clientEmail} onChange={(e)=>setClientEmail(e.target.value)} placeholder="Email cliente (opcional)" />
        </div>
      </div>

      <div className="sr-card" style={{ marginTop: 14 }}>
        <h3 className="sr-h3" style={{ marginTop: 0 }}>Datos del interesado (recomendado)</h3>
        <div style={{ display: "grid", gap: 10 }}>
          <input className="w-full border rounded px-3 py-2 text-sm" value={nombre} onChange={(e)=>setNombre(e.target.value)} placeholder="Nombre y apellidos" />
          <input className="w-full border rounded px-3 py-2 text-sm" value={dni} onChange={(e)=>setDni(e.target.value)} placeholder="DNI/NIE" />
          <input className="w-full border rounded px-3 py-2 text-sm" value={domicilio} onChange={(e)=>setDomicilio(e.target.value)} placeholder="Domicilio" />
          <input className="w-full border rounded px-3 py-2 text-sm" value={localidad} onChange={(e)=>setLocalidad(e.target.value)} placeholder="Localidad" />
        </div>
        <div className="sr-small" style={{ color: "#6b7280", marginTop: 6 }}>
          Esto evita que el recurso salga con campos en blanco.
        </div>
      </div>

      <div className="sr-card" style={{ marginTop: 14 }}>
        <h3 className="sr-h3" style={{ marginTop: 0 }}>Documentos (1–5)</h3>
        <input
          type="file"
          multiple
          accept=".pdf,.jpg,.jpeg,.png,.webp"
          onChange={(e) => setFiles(Array.from(e.target.files || []))}
        />
        <div className="sr-small" style={{ color: "#6b7280", marginTop: 6 }}>
          Admite PDF e imágenes (JPG/PNG/WEBP). Máximo 5.
        </div>
      </div>

      <div className="sr-card" style={{ marginTop: 14 }}>
        <h3 className="sr-h3" style={{ marginTop: 0 }}>Nota interna (opcional)</h3>
        <textarea
          className="w-full border rounded px-3 py-2 text-sm"
          rows={3}
          value={partnerNote}
          onChange={(e)=>setPartnerNote(e.target.value)}
          placeholder="Nota interna para RTM (opcional)"
        />
      </div>

      <div className="sr-card" style={{ marginTop: 14 }}>
        <label className="sr-small" style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <input type="checkbox" checked={confirm} onChange={(e)=>setConfirm(e.target.checked)} />
          Confirmo que el cliente ha sido informado y autoriza el tratamiento para este expediente.
        </label>

        <div style={{ marginTop: 12 }}>
          <button className="sr-btn-primary" onClick={submit} disabled={loading}>
            {loading ? "Enviando…" : "Crear expediente (asesoría)"}
          </button>
        </div>
      </div>
    </div>
  );
}
