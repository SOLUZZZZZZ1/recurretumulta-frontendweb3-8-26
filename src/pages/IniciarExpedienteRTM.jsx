import { clientRequest, clientApiUrl } from "../lib/clientApi.js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { fileSizeError } from "../lib/clientFiles.js";

const SERVICE_CONFIG = {
  traffic: {
    label: "Tráfico",
    icon: "🚗",
    defaultCaseType: "fine",
    nextPath: "/multas/documentos",
    caseTypes: {
      fine: "Recurrir una multa",
      vehicle_removal: "Eliminar un vehículo",
      other_traffic: "Otro trámite de tráfico",
    },
  },
  debt: {
    label: "Deudas y morosidad",
    icon: "💳",
    defaultCaseType: "asnef_equifax",
    nextPath: "/deudas/documentos",
    caseTypes: {
      asnef_equifax: "ASNEF / Equifax",
      creditor_claim: "Reclamación frente al acreedor",
      other_debt: "Otro asunto de deuda",
    },
  },
  administration: {
    label: "Administración",
    icon: "🏛️",
    defaultCaseType: "general_administration",
    nextPath: "/administracion/documentos",
    caseTypes: {
      aeat: "Hacienda / AEAT",
      social_security: "Seguridad Social",
      town_hall: "Ayuntamiento",
      general_administration: "Otro organismo público",
    },
  },
  claims: {
    label: "Reclamaciones",
    icon: "✈️",
    defaultCaseType: "airline",
    nextPath: "/reclamaciones/documentos",
    caseTypes: {
      airline: "Aerolínea",
      consumer: "Consumo",
      other_claim: "Otra reclamación",
    },
  },
};

function openBackendFile(path) {
  window.open(clientApiUrl(path), "_blank", "noopener,noreferrer");
}

function normalizeDni(value = "") {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}

function validEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function formatBytes(bytes = 0) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function IniciarExpedienteRTM() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams] = useSearchParams();

  const requestedDepartment =
    params.department ||
    searchParams.get("department") ||
    searchParams.get("service") ||
    "";

  const department = requestedDepartment || "traffic";
  const config = SERVICE_CONFIG[department] || SERVICE_CONFIG.traffic;
  const needsServiceSelection = !requestedDepartment;
  const requestedType = params.caseType || searchParams.get("case_type") || config.defaultCaseType;
  const initialType = config.caseTypes[requestedType] ? requestedType : config.defaultCaseType;

  const [form, setForm] = useState({
    full_name: "",
    dni_nie: "",
    email: "",
    telefono: "",
    street: "",
    street_number: "",
    floor: "",
    door: "",
    postal_code: "",
    city: "",
    province: "",
    preferred_contact: "email",
    case_type: initialType,
    customer_comment: "",
    representation_confirmed: false,
    privacy_accepted: false,
  });

  const [dniFront, setDniFront] = useState(null);
  const [dniBack, setDniBack] = useState(null);
  const [signedAuthorization, setSignedAuthorization] = useState(null);
  const [draftCase, setDraftCase] = useState(null);
  const [authorizationUploaded, setAuthorizationUploaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const messageRef = useRef(null);

  useEffect(() => {
    if (message) messageRef.current?.focus();
  }, [message]);

  const dniFrontRef = useRef(null);
  const dniBackRef = useRef(null);
  const authRef = useRef(null);

  const domicilio = useMemo(() => {
    const line1 = [form.street, form.street_number, form.floor ? `Piso ${form.floor}` : "", form.door ? `Puerta ${form.door}` : ""].filter(Boolean).join(", ");
    const line2 = [form.postal_code, form.city, form.province ? `(${form.province})` : ""].filter(Boolean).join(" ");
    return [line1, line2].filter(Boolean).join(" · ");
  }, [form]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage("");
  }

  function validateDraft() {
    if (form.full_name.trim().length < 3) return "Indica el nombre y apellidos.";
    if (normalizeDni(form.dni_nie).length < 5) return "Indica el DNI, NIE o pasaporte.";
    if (!validEmail(form.email)) return "Indica un email válido.";
    if (form.telefono.trim().length < 6) return "Indica un teléfono.";
    if (!form.street.trim()) return "Indica la calle.";
    if (!form.street_number.trim()) return "Indica el número.";
    if (!form.postal_code.trim()) return "Indica el código postal.";
    if (!form.city.trim()) return "Indica la población.";
    if (!form.province.trim()) return "Indica la provincia.";
    if (!dniFront) return "Adjunta la parte frontal del documento de identidad.";
    if (!dniBack) return "Adjunta la parte posterior del documento de identidad.";
    const identityFileError = fileSizeError(dniFront) || fileSizeError(dniBack);
    if (identityFileError) return identityFileError;
    if (form.customer_comment.trim().length < 15) return "Cuéntanos brevemente qué ha ocurrido.";
    if (!form.representation_confirmed) return "Confirma la generación de la autorización.";
    if (!form.privacy_accepted) return "Acepta la política de privacidad.";
    return "";
  }

  async function createDraftAndDownload(event) {
    event.preventDefault();
    const error = validateDraft();
    if (error) return setMessage(error);

    setLoading(true);
    setMessage("");

    try {
      const fd = new FormData();
      Object.entries({
        department,
        case_type: form.case_type,
        source_module: "rtm_web",
        full_name: form.full_name.trim(),
        dni_nie: normalizeDni(form.dni_nie),
        email: form.email.trim(),
        telefono: form.telefono.trim(),
        domicilio_notif: domicilio,
        street: form.street.trim(),
        street_number: form.street_number.trim(),
        floor: form.floor.trim(),
        door: form.door.trim(),
        postal_code: form.postal_code.trim(),
        city: form.city.trim(),
        province: form.province.trim(),
        preferred_contact: form.preferred_contact,
        customer_comment: form.customer_comment.trim(),
        representation_confirmed: String(form.representation_confirmed),
        privacy_accepted: String(form.privacy_accepted),
      }).forEach(([key, value]) => fd.append(key, value));

      fd.append("dni_front", dniFront);
      fd.append("dni_back", dniBack);

      const data = await clientRequest("/cases/intake-draft", { method: "POST", body: fd });
      const caseId = data?.case_id || data?.id;
      if (!caseId) throw new Error("El backend no devolvió el número del expediente.");

      const pdfPath = data?.authorization_download_url || `/cases/${caseId}/rtm-authorization-pdf`;
      setDraftCase({ caseId, pdfPath, nextPath: data?.next_path || config.nextPath });
      setMessage("✅ Expediente creado. Se ha abierto la autorización para descargar y firmar.");
      openBackendFile(pdfPath);
    } catch (error) {
      setMessage(error?.message || "No se pudo crear el expediente.");
    } finally {
      setLoading(false);
    }
  }

  async function uploadAuthorization() {
    if (!draftCase?.caseId) return setMessage("Primero crea el expediente.");
    if (!signedAuthorization) return setMessage("Selecciona la autorización firmada.");
    if (fileSizeError(signedAuthorization)) return setMessage(fileSizeError(signedAuthorization));

    setUploading(true);
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("file", signedAuthorization);
      await clientRequest(`/cases/${draftCase.caseId}/upload-authorization-signed`, { method: "POST", body: fd });
      setAuthorizationUploaded(true);
      setMessage("✅ Autorización firmada recibida. Ya puedes continuar con la documentación del expediente.");
    } catch (error) {
      setMessage(error?.message || "No se pudo subir la autorización.");
    } finally {
      setUploading(false);
    }
  }

  function continueToDocuments() {
    const separator = draftCase.nextPath.includes("?") ? "&" : "?";
    navigate(`${draftCase.nextPath}${separator}case=${encodeURIComponent(draftCase.caseId)}`);
  }

  if (needsServiceSelection) {
    const services = [
      {
        key: "traffic",
        icon: "🚗",
        title: "Multas y vehículos",
        text: "Multas, sanciones, retirada o baja de vehículos y otros trámites de tráfico.",
      },
      {
        key: "debt",
        icon: "💳",
        title: "Deudas y morosidad",
        text: "ASNEF, Equifax, acreedores y otros problemas relacionados con deudas.",
      },
      {
        key: "administration",
        icon: "🏛️",
        title: "Administración pública",
        text: "Hacienda, Seguridad Social, ayuntamientos y otros organismos públicos.",
      },
      {
        key: "claims",
        icon: "✈️",
        title: "Viajes y reclamaciones",
        text: "Vuelos, equipaje, consumo y otras reclamaciones frente a empresas.",
      },
    ];

    return (
      <>
        <Seo
          title="Iniciar expediente · RTM"
          description="Selecciona el área correspondiente e inicia tu expediente RTM."
          canonical="https://www.recurretumulta.eu/iniciar-expediente"
        />

        <main
          style={{
            minHeight: "calc(100vh - 120px)",
            padding: "54px 16px 76px",
            background:
              "linear-gradient(135deg,#0f172a 0%,#1e3a8a 56%,#0f766e 100%)",
          }}
        >
          <section
            style={{
              maxWidth: 1080,
              margin: "0 auto",
              padding: "36px 24px",
              borderRadius: 28,
              background: "rgba(255,255,255,.98)",
              boxShadow: "0 24px 70px rgba(15,23,42,.34)",
            }}
          >
            <header
              style={{
                maxWidth: 760,
                margin: "0 auto 30px",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  display: "inline-flex",
                  marginBottom: 14,
                  padding: "7px 12px",
                  borderRadius: 999,
                  background: "#dbeafe",
                  color: "#1d4ed8",
                  fontWeight: 900,
                }}
              >
                Revisión Inicial del Expediente
              </div>

              <h1
                style={{
                  margin: "0 0 14px",
                  color: "#0f172a",
                  fontSize: "clamp(36px,5vw,54px)",
                  lineHeight: 1.04,
                  letterSpacing: "-.04em",
                }}
              >
                ¿Qué problema necesitas resolver?
              </h1>

              <p
                style={{
                  margin: 0,
                  color: "#64748b",
                  fontSize: 18,
                  lineHeight: 1.65,
                }}
              >
                Selecciona el área correspondiente. Después podrás completar tus
                datos y abrir el expediente.
              </p>
            </header>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,230px),1fr))",
                gap: 17,
              }}
            >
              {services.map((service) => (
                <button
                  key={service.key}
                  type="button"
                  onClick={() =>
                    navigate(`/iniciar-expediente/${service.key}`)
                  }
                  style={{
                    minHeight: 205,
                    padding: 24,
                    border: "1px solid #dbeafe",
                    borderRadius: 22,
                    background: "#fff",
                    color: "#0f172a",
                    textAlign: "left",
                    boxShadow: "0 14px 35px rgba(15,23,42,.07)",
                    cursor: "pointer",
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      display: "grid",
                      width: 52,
                      height: 52,
                      placeItems: "center",
                      marginBottom: 17,
                      borderRadius: 16,
                      background: "#eff6ff",
                      fontSize: 27,
                    }}
                  >
                    {service.icon}
                  </span>

                  <strong
                    style={{
                      display: "block",
                      marginBottom: 9,
                      color: "#0c2f61",
                      fontSize: 21,
                    }}
                  >
                    {service.title}
                  </strong>

                  <span
                    style={{
                      display: "block",
                      color: "#64748b",
                      lineHeight: 1.55,
                    }}
                  >
                    {service.text}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <Seo title={`Iniciar expediente · ${config.label} · RTM`} description="Crea tu expediente RTM y descarga la autorización." canonical="https://www.recurretumulta.eu/iniciar-expediente" />

      <main style={{ minHeight: "calc(100vh - 120px)", padding: "42px 16px 68px", background: "linear-gradient(135deg,#0f172a 0%,#1e3a8a 56%,#0f766e 100%)" }}>
        <section style={{ maxWidth: 1040, margin: "0 auto", padding: "30px 22px", borderRadius: 26, background: "rgba(255,255,255,.98)", boxShadow: "0 24px 70px rgba(15,23,42,.34)" }}>
          <header style={{ marginBottom: 26 }}>
            <h1 style={{ margin: "0 0 12px", fontSize: "clamp(34px,5vw,50px)", lineHeight: 1.04 }}>Inicia tu expediente</h1>
            <p style={{ margin: 0, color: "#475569", fontSize: 18, lineHeight: 1.6 }}>
              Cuéntanos lo necesario para abrir el expediente. Después descarga la autorización RTM, fírmala y continúa con la documentación.
            </p>
            <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 14, background: "#eff6ff", color: "#1e3a8a", fontWeight: 800, lineHeight: 1.5 }}>
              Un único expediente RTM · Datos → Autorización → Documentación → Revisión inicial → Valoración
            </div>
          </header>

          <form onSubmit={createDraftAndDownload}>
            <Section title="1. Tipo de expediente">
              <select aria-label="Tipo de expediente" value={form.case_type} onChange={(e) => update("case_type", e.target.value)} style={inputStyle} disabled={Boolean(draftCase) || loading}>
                {Object.entries(config.caseTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Section>

            <Section title="2. Datos personales">
              <div style={gridStyle}>
                <Field label="Nombre y apellidos" value={form.full_name} onChange={(v) => update("full_name", v)} placeholder="Nombre completo" disabled={Boolean(draftCase)} />
                <Field label="DNI / NIE / Pasaporte" value={form.dni_nie} onChange={(v) => update("dni_nie", v)} placeholder="Ej. 12345678Z" disabled={Boolean(draftCase)} />
                <Field label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} placeholder="tu@email.com" disabled={Boolean(draftCase)} />
                <Field label="Teléfono" type="tel" value={form.telefono} onChange={(v) => update("telefono", v)} placeholder="Ej. 600 000 000" disabled={Boolean(draftCase)} />
              </div>
              <div style={{ marginTop: 16 }}>
                <span style={labelStyle}>Preferencia de contacto</span>
                <select aria-label="Preferencia de contacto" value={form.preferred_contact} onChange={(e) => update("preferred_contact", e.target.value)} style={inputStyle} disabled={Boolean(draftCase)}>
                  <option value="email">Email</option><option value="phone">Teléfono</option><option value="whatsapp">WhatsApp</option>
                </select>
              </div>
            </Section>

            <Section title="3. Domicilio a efectos de notificaciones">
              <div style={gridStyle}>
                <Field label="Calle" value={form.street} onChange={(v) => update("street", v)} placeholder="Nombre de la vía" disabled={Boolean(draftCase)} />
                <Field label="Número" value={form.street_number} onChange={(v) => update("street_number", v)} placeholder="Número" disabled={Boolean(draftCase)} />
                <Field label="Piso" value={form.floor} onChange={(v) => update("floor", v)} placeholder="Opcional" disabled={Boolean(draftCase)} />
                <Field label="Puerta" value={form.door} onChange={(v) => update("door", v)} placeholder="Opcional" disabled={Boolean(draftCase)} />
                <Field label="Código postal" value={form.postal_code} onChange={(v) => update("postal_code", v)} placeholder="Código postal" disabled={Boolean(draftCase)} />
                <Field label="Población" value={form.city} onChange={(v) => update("city", v)} placeholder="Población" disabled={Boolean(draftCase)} />
                <Field label="Provincia" value={form.province} onChange={(v) => update("province", v)} placeholder="Provincia" disabled={Boolean(draftCase)} />
              </div>
            </Section>

            <Section title="4. Documento de identidad">
              <div style={gridStyle}>
                <UploadBox label="Parte frontal" file={dniFront} inputRef={dniFrontRef} onChange={setDniFront} disabled={Boolean(draftCase)} />
                <UploadBox label="Parte posterior" file={dniBack} inputRef={dniBackRef} onChange={setDniBack} disabled={Boolean(draftCase)} />
              </div>
            </Section>

            <Section title="5. Cuéntanos brevemente qué ha ocurrido">
              <textarea aria-label="Cuéntanos brevemente qué ha ocurrido" rows={7} maxLength={1500} value={form.customer_comment} onChange={(e) => update("customer_comment", e.target.value)} placeholder="Explica brevemente el problema..." style={{ ...inputStyle, resize: "vertical" }} disabled={Boolean(draftCase)} />
            </Section>

            {!draftCase && <>
              <Check checked={form.representation_confirmed} onChange={(v) => update("representation_confirmed", v)}>Deseo generar la autorización RTM vinculada a este expediente.</Check>
              <Check checked={form.privacy_accepted} onChange={(v) => update("privacy_accepted", v)}>Acepto la política de privacidad y confirmo que los datos son correctos.</Check>
              <button type="submit" disabled={loading} style={primaryButton}>{loading ? "Creando expediente…" : "Crear expediente y descargar autorización"}</button>
            </>}
          </form>

          {draftCase && <Section title="6. Descargar y subir la autorización RTM">
            <div style={{ padding: 14, marginBottom: 16, borderRadius: 14, background: "#dcfce7", color: "#166534", fontWeight: 900, overflowWrap: "anywhere" }}>Expediente: {draftCase.caseId}</div>
            <button type="button" className="sr-btn-primary" onClick={() => openBackendFile(draftCase.pdfPath)}>⬇ Descargar autorización RTM</button>
            <div style={{ marginTop: 18 }}>
              <UploadBox label="Autorización firmada" file={signedAuthorization} inputRef={authRef} onChange={setSignedAuthorization} accept=".pdf,.jpg,.jpeg,.png,image/*" />
            </div>
            <button type="button" className="sr-btn-primary" onClick={uploadAuthorization} disabled={uploading || !signedAuthorization} style={{ marginTop: 16 }}>{uploading ? "Subiendo…" : "Subir autorización firmada"}</button>
            {authorizationUploaded && <button type="button" className="sr-btn-primary" onClick={continueToDocuments} style={{ marginTop: 16, width: "100%" }}>Continuar y subir documentación del caso</button>}
          </Section>}

          {message && <div ref={messageRef} tabIndex={-1} role="alert" style={{ marginTop: 16, padding: 14, borderRadius: 14, background: message.startsWith("✅") ? "#ecfdf5" : "#fef2f2", color: message.startsWith("✅") ? "#166534" : "#991b1b", fontWeight: 850, overflowWrap: "anywhere" }}>{message}</div>}
        </section>
      </main>
    </>
  );
}

function Section({ title, children }) {
  return <section style={{ marginBottom: 22, padding: 22, border: "1px solid #e2e8f0", borderRadius: 20, background: "#fff" }}><h2 style={{ margin: "0 0 16px", fontSize: 23 }}>{title}</h2>{children}</section>;
}

function Field({ label, value, onChange, placeholder, type = "text", disabled = false }) {
  return <label style={{ display: "block", minWidth: 0 }}><span style={labelStyle}>{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} disabled={disabled} /></label>;
}

function UploadBox({ label, file, inputRef, onChange, accept = "image/*,application/pdf", disabled = false }) {
  const [error, setError] = useState("");
  function selectFile(event) {
    const selected = event.target.files?.[0];
    if (selected) {
      const problem = fileSizeError(selected);
      setError(problem);
      if (!problem) onChange(selected);
    }
    event.target.value = "";
  }

  return (
    <div style={{ minWidth: 0 }}>
      <span style={labelStyle}>{label}</span>
      <button
        type="button"
        aria-label={`${label}: ${file ? file.name : "Seleccionar archivo"}`}
        onClick={() => !disabled && inputRef.current?.click()}
        disabled={disabled}
        style={{ width: "100%", minHeight: 118, padding: 16, border: "2px dashed #cbd5e1", borderRadius: 16, background: file ? "#f0fdf4" : "#f8fafc", cursor: disabled ? "not-allowed" : "pointer", overflowWrap: "anywhere" }}
      >
        <div style={{ fontSize: 30 }}>{file ? "✅" : "📷"}</div>
        <strong>{file ? file.name : "Seleccionar archivo"}</strong>
        {file && <div style={{ color: "#64748b", fontSize: 13 }}>{formatBytes(file.size)}</div>}
      </button>
      <input ref={inputRef} aria-label={label} type="file" accept={accept} onChange={selectFile} style={{ display: "none" }} disabled={disabled} />
      <small style={{ display: "block", marginTop: 7, color: "#475569" }}>Imagen o PDF · máximo 12 MB</small>
      {error && <p role="alert" style={{ color: "#991b1b", marginTop: 8 }}>{error}{file ? " Se conserva el archivo anterior." : ""}</p>}
    </div>
  );
}

function Check({ checked, onChange, children }) {
  return <label style={{ display: "flex", gap: 10, marginBottom: 12, color: "#334155" }}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span>{children}</span></label>;
}

const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: 16 };
const labelStyle = { display: "block", marginBottom: 7, fontWeight: 850, color: "#0f172a" };
const inputStyle = { width: "100%", minWidth: 0, boxSizing: "border-box", padding: "12px 13px", border: "1px solid #cbd5e1", borderRadius: 13, background: "#fff", fontSize: 16 };
const primaryButton = { width: "100%", minHeight: 56, border: 0, borderRadius: 15, padding: "15px 18px", background: "#16a34a", color: "#fff", fontSize: 17, fontWeight: 950, cursor: "pointer" };
