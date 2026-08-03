// src/components/ContactoExpediente.jsx
import React, { useEffect, useState } from "react";

const API = "/api";

async function fetchJson(url, options = {}) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || data?.message || "Error API");
  return data;
}

function isValidEmail(v) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((v || "").trim());
}

export default function ContactoExpediente({ caseId, publicStatus, onSaved }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  useEffect(() => {
    const n = (publicStatus?.contact_name || "").trim();
    const e = (publicStatus?.contact_email || "").trim();
    if (n) setName(n);
    if (e) setEmail(e);
  }, [publicStatus]);

  async function save() {
    setMsg("");
    const n = (name || "").trim();
    const e = (email || "").trim();

    if (!caseId) {
      setMsg("Falta el número de expediente.");
      return;
    }
    if (!n) {
      setMsg("Escribe tu nombre para asociarlo al expediente.");
      return;
    }
    if (!isValidEmail(e)) {
      setMsg("Introduce un correo válido (ej.: nombre@correo.com).");
      return;
    }

    setSaving(true);
    try {
      await fetchJson(`${API}/cases/${encodeURIComponent(caseId)}/contact`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, email: e }),
      });
      setMsg(`✅ Te avisaremos en ${e}.`);
      onSaved?.();
    } catch (err) {
      setMsg(err?.message || "No se pudo guardar ahora mismo.");
    } finally {
      setSaving(false);
    }
  }

  const already = (publicStatus?.contact_email || "").trim();

  return (
    <div className="sr-card" style={{ marginTop: 12, textAlign: "left" }}>
      <h3 className="sr-h3" style={{ marginTop: 0 }}>
        ¿Dónde te avisamos cuando puedas continuar?
      </h3>

      <p className="sr-p" style={{ marginTop: 6 }}>
        Déjanos tu <b>nombre</b> y <b>correo</b> para avisarte cuando el expediente
        se desbloquee o falte documentación.
      </p>

      {already && (
        <div className="sr-small" style={{ marginTop: 8, color: "#166534" }}>
          ✅ Avisaremos a: <b>{already}</b>
        </div>
      )}

      <div style={{ display: "grid", gap: 10, gridTemplateColumns: "1fr 1fr", marginTop: 10 }}>
        <div>
          <div className="sr-small" style={{ fontWeight: 800, marginBottom: 6 }}>
            Nombre
          </div>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Tu nombre"
            autoComplete="name"
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "rgba(255,255,255,0.8)",
            }}
          />
        </div>

        <div>
          <div className="sr-small" style={{ fontWeight: 800, marginBottom: 6 }}>
            Correo
          </div>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@email.com"
            inputMode="email"
            autoComplete="email"
            style={{
              width: "100%",
              padding: "10px 12px",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              background: "rgba(255,255,255,0.8)",
            }}
          />
        </div>
      </div>

      <div className="sr-cta-row" style={{ justifyContent: "flex-start", marginTop: 12 }}>
        <button type="button" className="sr-btn-secondary" onClick={save} disabled={saving}>
          {saving ? "Guardando…" : "Guardar datos"}
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

      <div className="sr-small" style={{ marginTop: 8, color: "#6b7280" }}>
        Solo avisos relacionados con este expediente. No enviamos spam.
      </div>
    </div>
  );
}
