import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const DIRECT_BACKEND = "https://recurretumulta-backend.onrender.com";

const API_CANDIDATES = [
  "/api",
  import.meta.env.VITE_API_BASE_URL,
  import.meta.env.VITE_API_URL,
  DIRECT_BACKEND,
].filter(Boolean);

function getCaseId(search) {
  const qs = new URLSearchParams(search);
  return qs.get("case") || qs.get("case_id") || qs.get("id") || "";
}

function buildUrl(base, path) {
  const cleanBase = String(base || "").replace(/\/$/, "");
  return `${cleanBase}${path}`;
}

async function readResponse(response) {
  const text = await response.text().catch(() => "");
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const detail = data?.detail || data?.message || text || `HTTP ${response.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  return data;
}

async function fetchJsonFallback(path, options = {}) {
  const errors = [];

  for (const base of API_CANDIDATES) {
    const url = buildUrl(base, path);

    try {
      const response = await fetch(url, options);
      return await readResponse(response);
    } catch (e) {
      errors.push(`${url} → ${e?.message || "Failed to fetch"}`);
    }
  }

  throw new Error(errors.join(" | "));
}

function openPdf(pathOrUrl) {
  const url = String(pathOrUrl || "");
  if (!url) return;

  if (url.startsWith("http")) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }

  window.open(buildUrl("/api", url), "_blank", "noopener,noreferrer");
}

function unwrapExtracted(value) {
  if (!value) return {};
  return value?.extracted?.extracted || value?.extracted || value || {};
}

function firstValue(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null && String(v).trim()) return String(v).trim();
  }
  return "";
}

export default function Autorizar() {
  const location = useLocation();
  const navigate = useNavigate();
  const caseId = useMemo(() => getCaseId(location.search), [location.search]);

  const [form, setForm] = useState({
    full_name: "",
    dni_nie: "",
    domicilio_notif: "",
    matricula: "",
    email: "",
    telefono: "",
  });

  const [checks, setChecks] = useState({
    autorizo_gestion: false,
    acepto_responsabilidad: false,
  });

  const [caseData, setCaseData] = useState(null);
  const [signedFile, setSignedFile] = useState(null);
  const [generated, setGenerated] = useState(false);
  const [msg, setMsg] = useState("");
  const [debug, setDebug] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingCase, setLoadingCase] = useState(true);

  useEffect(() => {
    async function loadCase() {
      if (!caseId) {
        setLoadingCase(false);
        return;
      }

      setLoadingCase(true);
      setMsg("");
      setDebug("");

      try {
        const status = await fetchJsonFallback(`/cases/${caseId}/public-status`);
        setCaseData(status);

        const interested = status?.interested_data || {};
        const extracted = unwrapExtracted(status?.extracted || {});
        const analysis = (() => {
          try {
            return JSON.parse(localStorage.getItem("rtm_last_analysis") || "{}");
          } catch {
            return {};
          }
        })();
        const localExtracted = unwrapExtracted(analysis);

        setForm((prev) => ({
          full_name: firstValue(
            interested.full_name,
            interested.contact_name,
            interested.name,
            extracted.full_name,
            extracted.nombre_completo,
            extracted.titular,
            extracted.nombre_multado,
            extracted.interesado,
            localExtracted.full_name,
            localExtracted.nombre_completo,
            localExtracted.titular,
            localExtracted.nombre_multado,
            localExtracted.interesado,
            prev.full_name
          ),
          dni_nie: firstValue(
            interested.dni_nie,
            interested.dni,
            interested.nie,
            extracted.dni_nie,
            extracted.dni,
            extracted.nie,
            extracted.documento_identidad,
            localExtracted.dni_nie,
            localExtracted.dni,
            localExtracted.nie,
            localExtracted.documento_identidad,
            prev.dni_nie
          ),
          domicilio_notif: firstValue(
            interested.domicilio_notif,
            interested.domicilio,
            interested.address,
            extracted.domicilio_notif,
            extracted.domicilio,
            extracted.direccion,
            extracted.domicilio_multado,
            localExtracted.domicilio_notif,
            localExtracted.domicilio,
            localExtracted.direccion,
            localExtracted.domicilio_multado,
            prev.domicilio_notif
          ),
          matricula: firstValue(
            interested.matricula,
            interested.plate,
            interested.vehicle_plate,
            extracted.matricula,
            extracted.matrícula,
            extracted.plate,
            extracted.vehicle_plate,
            extracted.matricula_vehiculo,
            localExtracted.matricula,
            localExtracted.matrícula,
            localExtracted.plate,
            localExtracted.vehicle_plate,
            localExtracted.matricula_vehiculo,
            prev.matricula
          ),
          email: firstValue(
            interested.email,
            status?.contact_email,
            localExtracted.email,
            prev.email
          ),
          telefono: firstValue(
            interested.telefono,
            interested.phone,
            extracted.telefono,
            extracted.phone,
            localExtracted.telefono,
            localExtracted.phone,
            prev.telefono
          ),
        }));
      } catch (e) {
        setMsg("❌ No se pudieron cargar los datos del expediente.");
        setDebug(e?.message || "");
      } finally {
        setLoadingCase(false);
      }
    }

    loadCase();
  }, [caseId]);

  function update(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setMsg("");
    setDebug("");
  }

  function validateDetails() {
    if (!caseId) return "No se ha encontrado el expediente.";
    if (!form.full_name.trim()) return "Indica nombre y apellidos.";
    if (!form.dni_nie.trim()) return "Indica DNI/NIE.";
    if (!form.matricula.trim()) return "Indica la matrícula del vehículo.";
    if (!form.domicilio_notif.trim()) return "Indica domicilio de notificaciones.";
    if (!checks.autorizo_gestion) return "Debes marcar la autorización de gestión.";
    if (!checks.acepto_responsabilidad) return "Debes confirmar que los datos son correctos.";
    if (!form.email.trim()) return "Indica email.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return "Indica un email válido.";
    return "";
  }

  async function saveDetailsAndDownloadPdf() {
    setMsg("");
    setDebug("");

    const error = validateDetails();
    if (error) {
      setMsg(`❌ ${error}`);
      return;
    }

    setLoading(true);

    try {
      await fetchJsonFallback(`/cases/${caseId}/details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: form.full_name.trim(),
          dni_nie: form.dni_nie.trim().toUpperCase(),
          matricula: form.matricula.trim().toUpperCase(),
          domicilio_notif: form.domicilio_notif.trim(),
          autorizo_gestion: checks.autorizo_gestion,
          acepto_responsabilidad: checks.acepto_responsabilidad,
          email: form.email.trim(),
          telefono: form.telefono.trim() || null,
        }),
      });

      let pdfUrl = `/cases/${caseId}/authorization-pdf`;

      try {
        const auth = await fetchJsonFallback(`/cases/${caseId}/authorize`, {
          method: "POST",
        });

        if (auth?.download_url) {
          pdfUrl = auth.download_url;
        }
      } catch {
        // Si authorize no devuelve URL, seguimos con endpoint directo del PDF.
      }

      setGenerated(true);
      setMsg("✅ Datos guardados. Se ha abierto la autorización para descargar, firmar y volver a subir.");
      openPdf(pdfUrl);
    } catch (e) {
      setMsg("❌ No se pudo generar la autorización.");
      setDebug(e?.message || "");
    } finally {
      setLoading(false);
    }
  }

  async function uploadSignedAuthorization() {
    setMsg("");
    setDebug("");

    if (!signedFile) {
      setMsg("❌ Selecciona la autorización firmada antes de subirla.");
      return;
    }

    setLoading(true);

    try {
      const fd = new FormData();
      fd.append("file", signedFile);

      await fetchJsonFallback(`/cases/${caseId}/upload-authorization-signed`, {
        method: "POST",
        body: fd,
      });

      setMsg("✅ Autorización firmada subida correctamente. Ya puedes continuar con la gestión.");

      setTimeout(() => {
        navigate(`/resumen?case=${encodeURIComponent(caseId)}`);
      }, 700);
    } catch (e) {
      setMsg("❌ No se pudo subir la autorización firmada.");
      setDebug(e?.message || "");
    } finally {
      setLoading(false);
    }
  }

  const extracted = unwrapExtracted(caseData?.extracted || {});
  const organismo = caseData?.organismo || extracted?.organismo || extracted?.organismo_cabecera || "";
  const expediente = caseData?.expediente_ref || extracted?.expediente_ref || extracted?.numero_expediente || "";

  return (
    <main className="sr-page">
      <section className="sr-section">
        <div className="sr-card" style={{ maxWidth: 900, margin: "0 auto" }}>
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div>
              <p className="sr-kicker">Autorización previa al pago</p>
              <h1 className="sr-h1">Autorizar la gestión del expediente</h1>
              <p className="sr-p" style={{ marginBottom: 0 }}>
                Completa los datos, descarga la autorización, fírmala y súbela para poder continuar.
              </p>
            </div>

            <button
              type="button"
              className="sr-btn-secondary"
              onClick={() => navigate(`/resumen?case=${encodeURIComponent(caseId)}`)}
            >
              ← Volver
            </button>
          </div>

          <div
            style={{
              marginTop: 16,
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: 10,
            }}
          >
            <Info label="Expediente interno" value={caseId} />
            <Info label="Organismo" value={organismo || "Pendiente de revisar"} />
            <Info label="Expediente sancionador" value={expediente || "Pendiente de revisar"} />
          </div>

          {loadingCase ? (
            <div className="sr-card" style={{ marginTop: 16 }}>
              Cargando datos del expediente…
            </div>
          ) : null}

          <div className="sr-card" style={{ marginTop: 18 }}>
            <h2 className="sr-h2" style={{ marginTop: 0 }}>
              Paso 1 · Datos del interesado
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: 12,
              }}
            >
              <Field label="Nombre y apellidos" value={form.full_name} onChange={(v) => update("full_name", v)} />
              <Field label="DNI/NIE/Pasaporte" value={form.dni_nie} onChange={(v) => update("dni_nie", v)} />
              <Field label="Matrícula" value={form.matricula} onChange={(v) => update("matricula", v.toUpperCase())} />
              <Field label="Email" value={form.email} onChange={(v) => update("email", v)} type="email" />
              <Field label="Teléfono" value={form.telefono} onChange={(v) => update("telefono", v)} />
            </div>

            <label style={{ display: "block", marginTop: 12 }}>
              <span style={labelStyle}>Domicilio a efectos de notificaciones</span>
              <textarea
                value={form.domicilio_notif}
                onChange={(e) => update("domicilio_notif", e.target.value)}
                placeholder="Calle, número, piso, CP, ciudad"
                rows={3}
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
              Yo, {form.full_name || "el/la interesado/a"}, autorizo a LA TALAMANQUINA, S.L.
              (RecurreTuMulta) a actuar en mi nombre para la tramitación administrativa
              del expediente asociado a este proceso, incluyendo la preparación y presentación
              de alegaciones y/o recursos ante la DGT u organismo competente.
            </div>


            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              <CheckRow
                checked={checks.autorizo_gestion}
                onChange={(value) => {
                  setChecks((prev) => ({ ...prev, autorizo_gestion: value }));
                  setMsg("");
                  setDebug("");
                }}
              >
                Autorizo expresamente a LA TALAMANQUINA, S.L. (RecurreTuMulta) a gestionar este expediente en mi nombre ante la Administración u organismo competente.
              </CheckRow>

              <CheckRow
                checked={checks.acepto_responsabilidad}
                onChange={(value) => {
                  setChecks((prev) => ({ ...prev, acepto_responsabilidad: value }));
                  setMsg("");
                  setDebug("");
                }}
              >
                Confirmo que los datos introducidos son correctos y que dispongo de legitimación para solicitar esta gestión.
              </CheckRow>
            </div>

            <div
              style={{
                marginTop: 18,
                background: "#fffbeb",
                border: "1px solid #f59e0b",
                borderRadius: 14,
                padding: 16,
                color: "#92400e",
                lineHeight: 1.6,
              }}
            >
              <div style={{ fontWeight: 900, marginBottom: 8 }}>
                ⚠ IMPORTANTE
              </div>

              <div>
                En la mayoría de multas de tráfico, si decides presentar alegaciones o recursos administrativos perderás el derecho al descuento del 50% por pronto pago.
              </div>

              <div style={{ marginTop: 10 }}>
                Si pagas la multa con reducción, normalmente renuncias a continuar el procedimiento administrativo de recurso.
              </div>

              <div style={{ marginTop: 10, fontWeight: 800 }}>
                Antes de continuar, valora qué opción prefieres:
              </div>

              <ul style={{ marginTop: 8, paddingLeft: 20 }}>
                <li>Pago reducido inmediato</li>
                <li>Recurso y defensa del expediente</li>
              </ul>
            </div>


            <div className="sr-cta-row" style={{ marginTop: 16, justifyContent: "flex-start" }}>
              <button
                type="button"
                className="sr-btn-primary"
                onClick={saveDetailsAndDownloadPdf}
                disabled={loading}
              >
                {loading ? "Generando…" : "Guardar datos y descargar autorización"}
              </button>
            </div>
          </div>

          <div className="sr-card" style={{ marginTop: 18 }}>
            <h2 className="sr-h2" style={{ marginTop: 0 }}>
              Paso 2 · Subir autorización firmada
            </h2>

            <p className="sr-p">
              Firma el PDF descargado y súbelo aquí. Después podrás continuar con el pago y la gestión.
            </p>

            {!generated ? (
              <div
                style={{
                  background: "#fff7ed",
                  color: "#9a3412",
                  border: "1px solid #fed7aa",
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 12,
                  fontWeight: 800,
                }}
              >
                Primero guarda los datos y descarga la autorización.
              </div>
            ) : null}

            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,image/*"
              onChange={(e) => {
                setSignedFile(e.target.files?.[0] || null);
                setMsg("");
                setDebug("");
              }}
              style={inputStyle}
            />

            {signedFile ? (
              <p className="sr-small" style={{ marginTop: 8, color: "#475569" }}>
                Archivo seleccionado: {signedFile.name}
              </p>
            ) : null}

            <div className="sr-cta-row" style={{ marginTop: 16, justifyContent: "flex-start" }}>
              <button
                type="button"
                className="sr-btn-primary"
                onClick={uploadSignedAuthorization}
                disabled={loading || !signedFile}
              >
                {loading ? "Subiendo…" : "Subir autorización firmada"}
              </button>
            </div>
          </div>

          {msg ? (
            <div
              style={{
                marginTop: 16,
                color: msg.startsWith("✅") ? "#166534" : "#991b1b",
                background: msg.startsWith("✅") ? "#ecfdf5" : "#fef2f2",
                border: msg.startsWith("✅") ? "1px solid #bbf7d0" : "1px solid #fecaca",
                borderRadius: 14,
                padding: 14,
                fontWeight: 900,
              }}
            >
              {msg}
            </div>
          ) : null}

          {debug ? (
            <div
              style={{
                marginTop: 10,
                background: "#f8fafc",
                border: "1px solid #e2e8f0",
                borderRadius: 12,
                padding: 10,
                color: "#475569",
                fontSize: 12,
                wordBreak: "break-word",
              }}
            >
              Detalle técnico: {debug}
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}

function CheckRow({ checked, onChange, children }) {
  return (
    <label
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 12,
        color: "#334155",
        fontWeight: 700,
        lineHeight: 1.45,
        cursor: "pointer",
      }}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        style={{ marginTop: 3, width: 18, height: 18, flex: "0 0 auto" }}
      />
      <span>{children}</span>
    </label>
  );
}

function Info({ label, value }) {
  return (
    <div
      style={{
        background: "#f8fafc",
        border: "1px solid #e2e8f0",
        borderRadius: 14,
        padding: 12,
      }}
    >
      <div className="sr-small" style={{ color: "#64748b", fontWeight: 800 }}>
        {label}
      </div>
      <div style={{ marginTop: 4, fontWeight: 900, color: "#0f172a", wordBreak: "break-word" }}>
        {value || "—"}
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        style={inputStyle}
      />
    </label>
  );
}

const labelStyle = {
  display: "block",
  fontWeight: 900,
  color: "#0f172a",
  marginBottom: 6,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  border: "1px solid #cbd5e1",
  borderRadius: 12,
  padding: "11px 12px",
  fontSize: 15,
  background: "#fff",
};
