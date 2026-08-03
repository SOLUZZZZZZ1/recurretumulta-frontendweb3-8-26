import { useEffect, useMemo, useState } from "react";

const DIRECT_BACKEND = "https://recurretumulta-backend.onrender.com";

const API =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  DIRECT_BACKEND;

function apiUrl(path) {
  const base = String(API || DIRECT_BACKEND).replace(/\/$/, "");
  return `${base}${path}`;
}

async function fetchJson(url, options = {}) {
  const r = await fetch(url, options);
  const text = await r.text().catch(() => "");
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!r.ok) {
    const detail = data?.detail || data?.message || text || `HTTP ${r.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  return data;
}

function pickExtracted(extracted = {}) {
  return extracted?.extracted || extracted || {};
}

export default function ChecklistAprobacion({
  caseId,
  extracted,
  publicStatus,
  onUpdated,
}) {
  const core = useMemo(() => pickExtracted(extracted), [extracted]);

  const [form, setForm] = useState({
    full_name: "",
    dni_nie: "",
    domicilio_notif: "",
    email: "",
    telefono: "",
  });

  const [acceptedText, setAcceptedText] = useState(false);
  const [confirmedIdentity, setConfirmedIdentity] = useState(false);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [downloadUrl, setDownloadUrl] = useState("");

  const alreadyAuthorized = Boolean(publicStatus?.authorized);

  useEffect(() => {
    const interested = publicStatus?.interested_data || {};
    setForm((prev) => ({
      ...prev,
      full_name:
        interested.full_name ||
        core.full_name ||
        core.nombre_completo ||
        core.titular ||
        prev.full_name ||
        "",
      dni_nie:
        interested.dni_nie ||
        interested.dni ||
        core.dni_nie ||
        core.dni ||
        prev.dni_nie ||
        "",
      domicilio_notif:
        interested.domicilio_notif ||
        interested.domicilio ||
        core.domicilio_notif ||
        core.domicilio ||
        prev.domicilio_notif ||
        "",
      email:
        interested.email ||
        publicStatus?.contact_email ||
        prev.email ||
        "",
      telefono:
        interested.telefono ||
        interested.phone ||
        prev.telefono ||
        "",
    }));
  }, [core, publicStatus]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setMsg("");
  }

  function validate() {
    if (!form.full_name.trim()) return "Indica nombre y apellidos.";
    if (!form.dni_nie.trim()) return "Indica DNI/NIE.";
    if (!form.domicilio_notif.trim()) return "Indica domicilio de notificaciones.";
    if (!form.email.trim()) return "Indica email.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Indica un email válido.";
    if (!acceptedText) return "Debes aceptar la autorización.";
    if (!confirmedIdentity) return "Debes confirmar que los datos son correctos.";
    return "";
  }

  async function downloadAuthorization() {
    const url = apiUrl(`/cases/${caseId}/authorization-pdf`);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  async function saveAndAuthorize() {
    setMsg("");
    const error = validate();
    if (error) {
      setMsg(error);
      return;
    }

    setSaving(true);

    try {
      await fetchJson(apiUrl(`/cases/${caseId}/details`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          dni_nie: form.dni_nie.trim().toUpperCase(),
          domicilio_notif: form.domicilio_notif.trim(),
          email: form.email.trim(),
          telefono: form.telefono.trim() || null,
        }),
      });

      const data = await fetchJson(apiUrl(`/cases/${caseId}/authorize`), {
        method: "POST",
      });

      const url = data?.download_url
        ? apiUrl(data.download_url)
        : apiUrl(`/cases/${caseId}/authorization-pdf`);

      setDownloadUrl(url);
      setMsg("✅ Autorización registrada. PDF generado correctamente.");

      try {
        window.open(url, "_blank", "noopener,noreferrer");
      } catch {
        // Si el navegador bloquea la ventana emergente, queda el botón de descarga.
      }

      if (typeof onUpdated === "function") {
        await onUpdated();
      }
    } catch (e) {
      setMsg(e?.message || "No se pudo guardar la autorización.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="sr-card">
      <h3 className="sr-h3" style={{ marginTop: 0 }}>
        Datos y autorización
      </h3>

      <p className="sr-p">
        Para iniciar la gestión necesitamos tus datos y autorización expresa para actuar en tu nombre.
      </p>

      {alreadyAuthorized ? (
        <div
          style={{
            background: "#ecfdf5",
            color: "#166534",
            border: "1px solid #bbf7d0",
            borderRadius: 14,
            padding: 14,
            marginBottom: 16,
            fontWeight: 800,
          }}
        >
          ✅ Autorización registrada.
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 12,
        }}
      >
        <Field
          label="Nombre y apellidos"
          value={form.full_name}
          onChange={(v) => update("full_name", v)}
          placeholder="Nombre completo"
        />
        <Field
          label="DNI/NIE"
          value={form.dni_nie}
          onChange={(v) => update("dni_nie", v)}
          placeholder="12345678Z"
        />
        <Field
          label="Email"
          value={form.email}
          onChange={(v) => update("email", v)}
          placeholder="tu@email.com"
          type="email"
        />
        <Field
          label="Teléfono"
          value={form.telefono}
          onChange={(v) => update("telefono", v)}
          placeholder="600 000 000"
        />
      </div>

      <label style={{ display: "block", marginTop: 12 }}>
        <span style={{ display: "block", fontWeight: 800, marginBottom: 6 }}>
          Domicilio a efectos de notificaciones
        </span>
        <textarea
          value={form.domicilio_notif}
          onChange={(e) => update("domicilio_notif", e.target.value)}
          rows={3}
          placeholder="Dirección completa"
          style={inputStyle}
        />
      </label>

      <div
        style={{
          marginTop: 14,
          background: "#f8fafc",
          border: "1px solid #e2e8f0",
          borderRadius: 14,
          padding: 14,
          color: "#334155",
          lineHeight: 1.55,
        }}
      >
        <strong>Autorización:</strong> autorizo a LA TALAMANQUINA, S.L.
        (RecurreTuMulta) a actuar en mi nombre para la preparación y tramitación
        administrativa del expediente sancionador indicado, incluyendo la presentación
        de alegaciones o recursos ante el organismo competente.
      </div>

      <label style={{ display: "flex", gap: 10, marginTop: 14, alignItems: "flex-start" }}>
        <input
          type="checkbox"
          checked={acceptedText}
          onChange={(e) => setAcceptedText(e.target.checked)}
          style={{ marginTop: 4 }}
        />
        <span style={{ fontSize: 14, color: "#334155" }}>
          Acepto el texto de autorización y solicito iniciar la gestión.
        </span>
      </label>

      <label style={{ display: "flex", gap: 10, marginTop: 10, alignItems: "flex-start" }}>
        <input
          type="checkbox"
          checked={confirmedIdentity}
          onChange={(e) => setConfirmedIdentity(e.target.checked)}
          style={{ marginTop: 4 }}
        />
        <span style={{ fontSize: 14, color: "#334155" }}>
          Confirmo que los datos indicados son correctos y corresponden al expediente.
        </span>
      </label>

      {msg ? (
        <div
          style={{
            marginTop: 14,
            color: msg.startsWith("✅") ? "#166534" : "#991b1b",
            fontWeight: 800,
          }}
        >
          {msg}
        </div>
      ) : null}

      <div className="sr-cta-row" style={{ marginTop: 16, justifyContent: "flex-start" }}>
        {!alreadyAuthorized ? (
          <button className="sr-btn-primary" type="button" onClick={saveAndAuthorize} disabled={saving}>
            {saving ? "Generando autorización…" : "Guardar datos y generar autorización"}
          </button>
        ) : (
          <button className="sr-btn-primary" type="button" onClick={downloadAuthorization}>
            Descargar autorización
          </button>
        )}

        {downloadUrl ? (
          <button className="sr-btn-secondary" type="button" onClick={() => window.open(downloadUrl, "_blank", "noopener,noreferrer")}>
            Abrir PDF
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label style={{ display: "block" }}>
      <span style={{ display: "block", fontWeight: 800, marginBottom: 6 }}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder || ""}
        style={inputStyle}
      />
    </label>
  );
}

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "11px 12px",
  fontSize: 15,
  background: "#fff",
};
