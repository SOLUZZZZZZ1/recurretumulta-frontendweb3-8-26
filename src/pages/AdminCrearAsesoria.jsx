import React, { useState } from "react";
import Seo from "../components/Seo.jsx";

const API = "/api";

async function fetchJson(url, options = {}) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || `Error HTTP ${r.status}`);
  return data;
}

const inputStyle = {
  padding: "12px 14px",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  width: "100%",
  background: "#fff",
};

export default function AdminCrearAsesoria() {
  const [adminToken, setAdminToken] = useState("");
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [result, setResult] = useState(null);
  const [copyMsg, setCopyMsg] = useState("");

  function setField(k, v) {
    setForm((prev) => ({ ...prev, [k]: v }));
  }

  async function crear() {
    setErr("");
    setResult(null);
    setCopyMsg("");

    if (!adminToken.trim()) return setErr("Falta x-admin-token.");
    if (!form.name.trim()) return setErr("Indica el nombre de la asesoría.");
    if (!form.email.trim()) return setErr("Indica el email.");
    if (form.password.trim().length < 8) return setErr("La contraseña debe tener al menos 8 caracteres.");

    setLoading(true);
    try {
      const data = await fetchJson(`${API}/partner/admin-create`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-token": adminToken.trim(),
        },
        body: JSON.stringify({
          name: form.name.trim(),
          email: form.email.trim(),
          password: form.password.trim(),
        }),
      });

      setResult(data);
    } catch (e) {
      setErr(e.message || "No se pudo crear la asesoría.");
    } finally {
      setLoading(false);
    }
  }

  async function copyToken() {
    try {
      await navigator.clipboard.writeText(result?.token || "");
      setCopyMsg("✅ Token copiado");
      setTimeout(() => setCopyMsg(""), 1800);
    } catch {
      setCopyMsg("No se pudo copiar");
      setTimeout(() => setCopyMsg(""), 1800);
    }
  }

  async function copyCreds() {
    const txt = [
      `Asesoría: ${form.name}`,
      `Email: ${form.email}`,
      `Contraseña inicial: ${form.password}`,
      `Token: ${result?.token || ""}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(txt);
      setCopyMsg("✅ Datos copiados");
      setTimeout(() => setCopyMsg(""), 1800);
    } catch {
      setCopyMsg("No se pudo copiar");
      setTimeout(() => setCopyMsg(""), 1800);
    }
  }

  return (
    <>
      <Seo
        title="Admin · Crear asesoría"
        description="Alta interna de asesorías con generación de token."
        canonical="https://www.recurretumulta.eu/admin/crear-asesoria"
      />
      <main className="sr-container py-12" style={{ minHeight: "calc(100vh - 160px)" }}>
        <h1 className="sr-h1 mb-4">Admin · Crear asesoría</h1>

        <div className="sr-card" style={{ maxWidth: 760 }}>
          <p className="sr-p" style={{ marginTop: 0 }}>
            Alta interna de asesorías. Este panel genera la cuenta y devuelve el token profesional.
          </p>

          <div style={{ display: "grid", gap: 12 }}>
            <input
              style={inputStyle}
              placeholder="x-admin-token"
              value={adminToken}
              onChange={(e) => setAdminToken(e.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Nombre de la asesoría"
              value={form.name}
              onChange={(e) => setField("name", e.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Email"
              value={form.email}
              onChange={(e) => setField("email", e.target.value)}
            />
            <input
              style={inputStyle}
              placeholder="Contraseña inicial"
              value={form.password}
              onChange={(e) => setField("password", e.target.value)}
            />
          </div>

          {err ? (
            <div className="sr-small" style={{ marginTop: 12, color: "#991b1b" }}>
              ❌ {err}
            </div>
          ) : null}

          <div className="sr-cta-row" style={{ justifyContent: "flex-start", marginTop: 14 }}>
            <button className="sr-btn-primary" onClick={crear} disabled={loading}>
              {loading ? "Creando…" : "Crear asesoría"}
            </button>
          </div>
        </div>

        {result ? (
          <div className="sr-card" style={{ maxWidth: 760, marginTop: 18 }}>
            <h3 className="sr-h3" style={{ marginTop: 0 }}>Asesoría creada</h3>

            <div className="sr-small" style={{ marginTop: 8 }}>
              <b>partner_id:</b> {result.partner_id || "—"}
            </div>

            <div className="sr-small" style={{ marginTop: 8 }}>
              <b>Token:</b>
            </div>

            <textarea
              readOnly
              value={result.token || ""}
              style={{
                ...inputStyle,
                minHeight: 110,
                marginTop: 8,
                resize: "vertical",
                fontFamily: "monospace",
              }}
            />

            <div className="sr-cta-row" style={{ justifyContent: "flex-start", marginTop: 14 }}>
              <button className="sr-btn-primary" onClick={copyToken}>
                Copiar token
              </button>
              <button className="sr-btn-secondary" onClick={copyCreds}>
                Copiar datos completos
              </button>
            </div>

            {copyMsg ? (
              <div className="sr-small" style={{ marginTop: 12, color: "#166534" }}>
                {copyMsg}
              </div>
            ) : null}
          </div>
        ) : null}
      </main>
    </>
  );
}
