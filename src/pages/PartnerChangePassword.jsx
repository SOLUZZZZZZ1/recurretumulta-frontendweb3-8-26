import React, { useState } from "react";
import Seo from "../components/Seo.jsx";
import { useNavigate } from "react-router-dom";

const API = "/api";

async function fetchJson(url, options = {}) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || `Error HTTP ${r.status}`);
  return data;
}

export default function PartnerChangePassword() {
  const nav = useNavigate();

  const [email, setEmail] = useState(() => localStorage.getItem("partner_email") || "");
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newPassword2, setNewPassword2] = useState("");

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  async function submit() {
    setErr("");
    setMsg("");

    if (!email.trim()) return setErr("Email obligatorio.");
    if (!oldPassword.trim()) return setErr("Contraseña temporal obligatoria.");
    if (newPassword.trim().length < 8) return setErr("La nueva contraseña debe tener al menos 8 caracteres.");
    if (newPassword.trim() !== newPassword2.trim()) return setErr("Las nuevas contraseñas no coinciden.");

    setLoading(true);
    try {
      await fetchJson(`${API}/partner/change-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          old_password: oldPassword.trim(),
          new_password: newPassword.trim(),
        }),
      });

      localStorage.setItem("partner_must_change", "0");
      setMsg("✅ Contraseña actualizada. Ya puedes entrar al portal.");
      setOldPassword("");
      setNewPassword("");
      setNewPassword2("");

      // Volver a gestorías para login normal
      setTimeout(() => nav("/gestorias"), 800);
    } catch (e) {
      setErr(e.message || "No se pudo cambiar la contraseña.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Seo title="Cambiar contraseña · Asesorías" description="Cambio obligatorio de contraseña para partners." />
      <main className="sr-container py-12" style={{ minHeight: "calc(100vh - 160px)" }}>
        <h1 className="sr-h1 mb-4">Cambiar contraseña</h1>

        <div className="sr-card" style={{ maxWidth: 560 }}>
          <p className="sr-p" style={{ marginTop: 0 }}>
            Por seguridad, debes cambiar la contraseña temporal antes de usar el portal.
          </p>

          <div style={{ display: "grid", gap: 10 }}>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 12 }}
            />

            <input
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Contraseña temporal"
              type="password"
              style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 12 }}
            />

            <input
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Nueva contraseña (mín. 8 caracteres)"
              type="password"
              style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 12 }}
            />

            <input
              value={newPassword2}
              onChange={(e) => setNewPassword2(e.target.value)}
              placeholder="Repite la nueva contraseña"
              type="password"
              style={{ padding: "10px 12px", border: "1px solid #e5e7eb", borderRadius: 12 }}
            />

            {err && <div className="sr-small" style={{ color: "#991b1b" }}>❌ {err}</div>}
            {msg && <div className="sr-small" style={{ color: "#166534" }}>{msg}</div>}

            <button className="sr-btn-primary" onClick={submit} disabled={loading}>
              {loading ? "Guardando…" : "Guardar nueva contraseña"}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
