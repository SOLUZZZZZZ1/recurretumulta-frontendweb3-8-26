import React, { useState } from "react";
import Seo from "../components/Seo.jsx";

const API = "/api";

async function fetchJson(url, options = {}) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || "Error API");
  return data;
}

const inputStyle = {
  padding: "12px 14px",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  width: "100%",
  background: "#fff",
};

export default function SolicitarAltaGestoria() {
  const [form, setForm] = useState({
    empresa: "",
    contacto: "",
    email: "",
    telefono: "",
    provincia: "",
    volumen: "",
    mensaje: "",
  });
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  function setField(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function enviar() {
    setMsg("");
    setErr("");

    if (!form.empresa.trim()) return setErr("Indica el nombre de la asesoría.");
    if (!form.contacto.trim()) return setErr("Indica la persona de contacto.");
    if (!form.email.trim()) return setErr("Indica el email.");

    setSending(true);
    try {
      await fetchJson(`${API}/partner/signup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      setMsg("✅ Solicitud enviada correctamente. Te responderemos tras revisar el alta.");
      setForm({
        empresa: "",
        contacto: "",
        email: "",
        telefono: "",
        provincia: "",
        volumen: "",
        mensaje: "",
      });
    } catch (e) {
      setErr(e.message || "No se pudo enviar la solicitud.");
    } finally {
      setSending(false);
    }
  }

  return (
    <>
      <Seo
        title="Solicitud de alta · Asesorías"
        description="Solicitud de acceso profesional para asesorías."
        canonical="https://www.recurretumulta.eu/gestorias/alta"
      />
      <main className="sr-container py-12" style={{ minHeight: "calc(100vh - 160px)" }}>
        <h1 className="sr-h1 mb-4">Solicitud de alta para asesorías</h1>

        <div className="sr-card" style={{ maxWidth: 760 }}>
          <p className="sr-p" style={{ marginTop: 0 }}>
            Déjanos tus datos y revisaremos el acceso profesional para tu asesoría.
          </p>

          <div style={{ display: "grid", gap: 12 }}>
            <input style={inputStyle} placeholder="Nombre de la asesoría" value={form.empresa} onChange={(e) => setField("empresa", e.target.value)} />
            <input style={inputStyle} placeholder="Persona de contacto" value={form.contacto} onChange={(e) => setField("contacto", e.target.value)} />
            <input style={inputStyle} placeholder="Email" value={form.email} onChange={(e) => setField("email", e.target.value)} />
            <input style={inputStyle} placeholder="Teléfono" value={form.telefono} onChange={(e) => setField("telefono", e.target.value)} />
            <input style={inputStyle} placeholder="Provincia" value={form.provincia} onChange={(e) => setField("provincia", e.target.value)} />
            <input style={inputStyle} placeholder="Expedientes aproximados al mes" value={form.volumen} onChange={(e) => setField("volumen", e.target.value)} />
            <textarea style={{ ...inputStyle, minHeight: 130 }} placeholder="Mensaje (opcional)" value={form.mensaje} onChange={(e) => setField("mensaje", e.target.value)} />
          </div>

          {err && <div className="sr-small" style={{ marginTop: 12, color: "#991b1b" }}>❌ {err}</div>}
          {msg && <div className="sr-small" style={{ marginTop: 12, color: "#166534" }}>{msg}</div>}

          <div className="sr-cta-row" style={{ justifyContent: "flex-start", marginTop: 14 }}>
            <button className="sr-btn-primary" onClick={enviar} disabled={sending}>
              {sending ? "Enviando…" : "Solicitar alta"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}