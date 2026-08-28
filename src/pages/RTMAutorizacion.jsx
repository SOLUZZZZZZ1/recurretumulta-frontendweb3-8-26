import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { RTM_API_CANDIDATES } from "../lib/api.js";

const DEPARTMENT_CONFIG = {
  traffic: {
    label: "Tráfico",
    icon: "🚗",
    color: "#1d4ed8",
    soft: "#dbeafe",
    authorization:
      "actuar ante la DGT, ayuntamientos y demás organismos sancionadores relacionados con este expediente, incluyendo la preparación y presentación de alegaciones, recursos, solicitudes y documentación necesaria.",
  },
  debt: {
    label: "Morosidad y deudas",
    icon: "💳",
    color: "#166534",
    soft: "#dcfce7",
    authorization:
      "actuar ante Equifax, ASNEF, Experian, BADEXCUG, acreedores, entidades financieras y demás entidades relacionadas con este expediente, incluyendo el ejercicio de los derechos de acceso, rectificación, supresión, oposición y las reclamaciones que procedan.",
  },
  administration: {
    label: "Administración",
    icon: "🏛️",
    color: "#9f1239",
    soft: "#ffe4e6",
    authorization:
      "actuar ante la AEAT, la Seguridad Social, ayuntamientos y demás administraciones u organismos públicos relacionados con este expediente, incluyendo la presentación de escritos, solicitudes, alegaciones y recursos.",
  },
  claims: {
    label: "Reclamaciones",
    icon: "✈️",
    color: "#6d28d9",
    soft: "#ede9fe",
    authorization:
      "actuar ante compañías aéreas, aseguradoras, empresas, organismos de consumo y demás entidades relacionadas con la reclamación, incluyendo solicitudes, negociaciones y reclamaciones extrajudiciales.",
  },
  other: {
    label: "Otros casos",
    icon: "📂",
    color: "#334155",
    soft: "#e2e8f0",
    authorization:
      "realizar las gestiones extrajudiciales y administrativas necesarias ante las entidades relacionadas exclusivamente con este expediente.",
  },
};

function getCaseId(search) {
  const qs = new URLSearchParams(search);
  return qs.get("case") || qs.get("case_id") || qs.get("id") || "";
}

function buildUrl(base, path) {
  return `${String(base || "").replace(/\/$/, "")}${path}`;
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
    const detail =
      data?.detail?.message ||
      data?.detail ||
      data?.message ||
      text ||
      `HTTP ${response.status}`;

    throw new Error(
      typeof detail === "string" ? detail : JSON.stringify(detail)
    );
  }

  return data;
}

async function fetchJsonFallback(path, options = {}) {
  const errors = [];

  for (const base of RTM_API_CANDIDATES) {
    const url = buildUrl(base, path);

    try {
      const response = await fetch(url, options);
      return await readResponse(response);
    } catch (error) {
      errors.push(`${url} → ${error?.message || "Error"}`);
    }
  }

  throw new Error(errors.join(" | "));
}

function openBackendFile(path) {
  window.open(
    buildUrl(RTM_API_CANDIDATES[0], path),
    "_blank",
    "noopener,noreferrer"
  );
}

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function normalizeDepartment(value) {
  const key = String(value || "").trim().toLowerCase();

  if (["traffic", "trafico", "tráfico", "fine", "multa"].includes(key)) {
    return "traffic";
  }

  if (["debt", "deudas", "morosidad", "asnef", "equifax"].includes(key)) {
    return "debt";
  }

  if (["administration", "administracion", "administración", "aeat"].includes(key)) {
    return "administration";
  }

  if (["claims", "claim", "reclamaciones", "reclamacion", "reclamación"].includes(key)) {
    return "claims";
  }

  return "other";
}

function getNextPath(department, caseId) {
  const encoded = encodeURIComponent(caseId);

  if (department === "traffic") return `/multas/documentos?case=${encoded}`;
  if (department === "debt") return `/deudas/documentos?case=${encoded}`;
  if (department === "administration") {
    return `/administracion/documentos?case=${encoded}`;
  }
  if (department === "claims") {
    return `/reclamaciones/documentos?case=${encoded}`;
  }
  return `/otros/documentos?case=${encoded}`;
}

export default function RTMAutorizacion() {
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
  const [department, setDepartment] = useState("other");
  const [signedFile, setSignedFile] = useState(null);
  const [generated, setGenerated] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [msg, setMsg] = useState("");
  const [debug, setDebug] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingCase, setLoadingCase] = useState(true);

  const config = DEPARTMENT_CONFIG[department] || DEPARTMENT_CONFIG.other;
  const isTraffic = department === "traffic";

  useEffect(() => {
    async function loadCase() {
      if (!caseId) {
        setLoadingCase(false);
        setMsg("❌ No se ha encontrado el expediente.");
        return;
      }

      setLoadingCase(true);
      setMsg("");
      setDebug("");

      try {
        const status = await fetchJsonFallback(
          `/cases/${caseId}/public-status`
        );

        setCaseData(status);

        const interested = status?.interested_data || {};
        const resolvedDepartment = normalizeDepartment(
          status?.department ||
            interested?.department ||
            interested?.category ||
            status?.category
        );

        setDepartment(resolvedDepartment);

        setForm({
          full_name: firstValue(
            interested.full_name,
            status?.contact_name
          ),
          dni_nie: firstValue(interested.dni_nie, interested.dni),
          domicilio_notif: firstValue(
            interested.domicilio_notif,
            interested.domicilio
          ),
          matricula: firstValue(
            interested.matricula,
            interested.plate,
            interested.vehicle_plate
          ),
          email: firstValue(interested.email, status?.contact_email),
          telefono: firstValue(interested.telefono, interested.phone),
        });

        if (status?.authorized === true) {
          setUploaded(true);
          setGenerated(true);
        }
      } catch (error) {
        setMsg("❌ No se pudieron cargar los datos del expediente.");
        setDebug(error?.message || "");
      } finally {
        setLoadingCase(false);
      }
    }

    loadCase();
  }, [caseId]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setMsg("");
    setDebug("");
  }

  function validateDetails() {
    if (!caseId) return "No se ha encontrado el expediente.";
    if (!form.full_name.trim()) return "Indica nombre y apellidos.";
    if (!form.dni_nie.trim()) return "Indica DNI/NIE/Pasaporte.";
    if (!form.domicilio_notif.trim()) {
      return "Indica el domicilio a efectos de notificaciones.";
    }
    if (!form.email.trim()) return "Indica el email.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      return "Indica un email válido.";
    }
    if (isTraffic && !form.matricula.trim()) {
      return "Indica la matrícula del vehículo.";
    }
    if (!checks.autorizo_gestion) {
      return "Debes marcar la autorización de gestión.";
    }
    if (!checks.acepto_responsabilidad) {
      return "Debes confirmar que los datos son correctos.";
    }
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
          matricula: isTraffic
            ? form.matricula.trim().toUpperCase()
            : null,
          domicilio_notif: form.domicilio_notif.trim(),
          autorizo_gestion: checks.autorizo_gestion,
          acepto_responsabilidad: checks.acepto_responsabilidad,
          email: form.email.trim(),
          telefono: form.telefono.trim() || null,
        }),
      });

      setGenerated(true);
      setMsg(
        "✅ Datos guardados. Se ha abierto la autorización para descargar y firmar."
      );

      openBackendFile(`/cases/${caseId}/rtm-authorization-pdf`);
    } catch (error) {
      setMsg("❌ No se pudo generar la autorización RTM.");
      setDebug(error?.message || "");
    } finally {
      setLoading(false);
    }
  }

  async function uploadSignedAuthorization() {
    setMsg("");
    setDebug("");

    if (!signedFile) {
      setMsg("❌ Selecciona la autorización firmada.");
      return;
    }

    setLoading(true);

    try {
      const fd = new FormData();
      fd.append("file", signedFile);

      await fetchJsonFallback(
        `/cases/${caseId}/upload-authorization-signed`,
        {
          method: "POST",
          body: fd,
        }
      );

      setUploaded(true);
      setMsg("✅ Autorización firmada subida correctamente.");
    } catch (error) {
      setMsg("❌ No se pudo subir la autorización firmada.");
      setDebug(error?.message || "");
    } finally {
      setLoading(false);
    }
  }

  function continueToDocuments() {
    navigate(getNextPath(department, caseId));
  }

  return (
    <main className="sr-page">
      <section className="sr-section">
        <div className="sr-card" style={{ maxWidth: 920, margin: "0 auto" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "7px 12px",
                  borderRadius: 999,
                  background: config.soft,
                  color: config.color,
                  fontWeight: 900,
                  marginBottom: 12,
                }}
              >
                <span>{config.icon}</span>
                <span>{config.label}</span>
              </div>

              <h1 className="sr-h1">Autorización RTM</h1>
              <p className="sr-p" style={{ marginBottom: 0 }}>
                Revisa los datos, descarga la autorización, fírmala y vuelve a
                subirla para continuar.
              </p>
            </div>

            <button
              type="button"
              className="sr-btn-secondary"
              onClick={() => navigate(-1)}
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
            <Info label="Expediente RTM" value={caseId} />
            <Info label="Departamento" value={config.label} />
            <Info
              label="Tipo de expediente"
              value={
                caseData?.case_type ||
                caseData?.interested_data?.case_type ||
                "Pendiente de revisar"
              }
            />
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
              <Field
                label="Nombre y apellidos"
                value={form.full_name}
                onChange={(value) => update("full_name", value)}
              />

              <Field
                label="DNI/NIE/Pasaporte"
                value={form.dni_nie}
                onChange={(value) => update("dni_nie", value)}
              />

              {isTraffic ? (
                <Field
                  label="Matrícula"
                  value={form.matricula}
                  onChange={(value) =>
                    update("matricula", value.toUpperCase())
                  }
                />
              ) : null}

              <Field
                label="Email"
                type="email"
                value={form.email}
                onChange={(value) => update("email", value)}
              />

              <Field
                label="Teléfono"
                value={form.telefono}
                onChange={(value) => update("telefono", value)}
              />
            </div>

            <label style={{ display: "block", marginTop: 12 }}>
              <span style={labelStyle}>
                Domicilio a efectos de notificaciones
              </span>
              <textarea
                value={form.domicilio_notif}
                onChange={(event) =>
                  update("domicilio_notif", event.target.value)
                }
                placeholder="Calle, número, piso, puerta, código postal, población y provincia"
                rows={3}
                style={inputStyle}
              />
            </label>

            <div
              style={{
                marginTop: 14,
                background: config.soft,
                border: `1px solid ${config.color}33`,
                borderRadius: 14,
                padding: 14,
                color: "#334155",
                lineHeight: 1.6,
              }}
            >
              Yo, {form.full_name || "el/la interesado/a"}, autorizo a LA
              TALAMANQUINA, S.L. (RTM / RecurreTuMulta) a {config.authorization}
            </div>

            <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
              <CheckRow
                checked={checks.autorizo_gestion}
                onChange={(value) =>
                  setChecks((current) => ({
                    ...current,
                    autorizo_gestion: value,
                  }))
                }
              >
                Autorizo expresamente la gestión descrita, limitada al
                expediente RTM {caseId || "indicado"}.
              </CheckRow>

              <CheckRow
                checked={checks.acepto_responsabilidad}
                onChange={(value) =>
                  setChecks((current) => ({
                    ...current,
                    acepto_responsabilidad: value,
                  }))
                }
              >
                Confirmo que los datos introducidos son correctos y que dispongo
                de legitimación para solicitar esta gestión.
              </CheckRow>
            </div>

            {isTraffic ? (
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
                <strong>⚠ Importante:</strong> en muchas sanciones de tráfico,
                presentar alegaciones o recursos implica perder el descuento del
                50 % por pronto pago.
              </div>
            ) : null}

            <div
              className="sr-cta-row"
              style={{ marginTop: 16, justifyContent: "flex-start" }}
            >
              <button
                type="button"
                className="sr-btn-primary"
                onClick={saveDetailsAndDownloadPdf}
                disabled={loading}
              >
                {loading
                  ? "Generando…"
                  : "Guardar datos y descargar autorización"}
              </button>
            </div>
          </div>

          <div className="sr-card" style={{ marginTop: 18 }}>
            <h2 className="sr-h2" style={{ marginTop: 0 }}>
              Paso 2 · Subir autorización firmada
            </h2>

            <p className="sr-p">
              Firma el PDF descargado y súbelo aquí para continuar con la
              documentación del caso.
            </p>

            {!generated && !uploaded ? (
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

            <button
              type="button"
              className="sr-btn-secondary"
              onClick={() =>
                openBackendFile(`/cases/${caseId}/rtm-authorization-pdf`)
              }
              disabled={!caseId}
              style={{ marginBottom: 14 }}
            >
              ⬇ Descargar de nuevo la autorización RTM
            </button>

            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,image/*"
              onChange={(event) => {
                setSignedFile(event.target.files?.[0] || null);
                setMsg("");
                setDebug("");
              }}
              style={inputStyle}
            />

            {signedFile ? (
              <p className="sr-small" style={{ marginTop: 8 }}>
                Archivo seleccionado: {signedFile.name}
              </p>
            ) : null}

            <div
              className="sr-cta-row"
              style={{ marginTop: 16, justifyContent: "flex-start" }}
            >
              <button
                type="button"
                className="sr-btn-primary"
                onClick={uploadSignedAuthorization}
                disabled={loading || !signedFile}
              >
                {loading ? "Subiendo…" : "Subir autorización firmada"}
              </button>
            </div>

            {uploaded ? (
              <button
                type="button"
                className="sr-btn-primary"
                onClick={continueToDocuments}
                style={{ marginTop: 16, width: "100%" }}
              >
                Continuar y subir documentación del caso
              </button>
            ) : null}
          </div>

          {msg ? (
            <div
              style={{
                marginTop: 16,
                color: msg.startsWith("✅") ? "#166534" : "#991b1b",
                background: msg.startsWith("✅") ? "#ecfdf5" : "#fef2f2",
                border: msg.startsWith("✅")
                  ? "1px solid #bbf7d0"
                  : "1px solid #fecaca",
                borderRadius: 14,
                padding: 14,
                fontWeight: 900,
              }}
            >
              {msg}
            </div>
          ) : null}

          {debug ? (
            <details style={{ marginTop: 10, color: "#64748b" }}>
              <summary>Detalle técnico</summary>
              <div style={{ marginTop: 8, wordBreak: "break-word" }}>
                {debug}
              </div>
            </details>
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
        onChange={(event) => onChange(event.target.checked)}
        style={{ marginTop: 3, width: 18, height: 18 }}
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
      <div
        style={{
          marginTop: 4,
          fontWeight: 900,
          color: "#0f172a",
          wordBreak: "break-word",
        }}
      >
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
        onChange={(event) => onChange(event.target.value)}
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
