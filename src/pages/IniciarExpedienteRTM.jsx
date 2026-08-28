import React, { useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import {
  PUBLIC_SERVICE_FAMILIES,
  getPublicService,
} from "../data/publicServices.js";
import { RTM_API_CANDIDATES } from "../lib/api.js";

const MAX_FILE_BYTES = 12 * 1024 * 1024;

const SERVICE_CONFIG = {
  traffic: {
    label: "Tráfico",
    icon: "🚗",
    defaultCaseType: "fine",
    nextPath: "/multas",
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
    const detail = data?.detail?.message || data?.detail || data?.message || text || `HTTP ${response.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data;
}

async function fetchJsonFallback(path, options = {}) {
  const errors = [];
  for (const base of RTM_API_CANDIDATES) {
    try {
      const response = await fetch(buildUrl(base, path), options);
      return await readResponse(response);
    } catch (error) {
      errors.push(error?.message || "Error");
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
    "";
  const requestedType = params.caseType || searchParams.get("case_type") || "";
  const requestedFamilyId = searchParams.get("family") || "";
  const ambiguousLegacyService = searchParams.get("service") || "";
  const department = requestedDepartment;
  const config = requestedDepartment ? SERVICE_CONFIG[requestedDepartment] : null;
  const selectedFamily = requestedFamilyId
    ? getPublicService(requestedFamilyId)
    : null;
  const invalidDepartment = Boolean(requestedDepartment && !config);
  const invalidType = Boolean(
    requestedType && (!config || !config.caseTypes[requestedType])
  );
  const invalidFamily = Boolean(
    requestedFamilyId && (!selectedFamily || !selectedFamily.intake)
  );
  const familyMismatch = Boolean(
    selectedFamily?.intake &&
      config &&
      (selectedFamily.intake.department !== department ||
        (requestedType && !selectedFamily.intake.caseTypes.includes(requestedType)))
  );
  const familyWithoutDepartment = Boolean(selectedFamily && !requestedDepartment);
  const invalidSelection =
    Boolean(ambiguousLegacyService) ||
    invalidDepartment ||
    invalidType ||
    invalidFamily ||
    familyMismatch ||
    familyWithoutDepartment;
  const needsServiceSelection = !requestedDepartment && !invalidSelection;
  const initialType =
    !invalidSelection && config
      ? requestedType || config.defaultCaseType
      : "";
  const availableCaseTypes = config
    ? selectedFamily?.intake?.caseTypes || Object.keys(config.caseTypes)
    : [];

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
    if (!config || invalidSelection) return "La ruta del expediente no es válida.";
    if (!availableCaseTypes.includes(form.case_type)) {
      return "El tipo de expediente no corresponde al área elegida.";
    }
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
    if (dniFront.size > MAX_FILE_BYTES || dniBack.size > MAX_FILE_BYTES) return "Alguna imagen supera 12 MB.";
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
        public_service_family: selectedFamily?.id || "",
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
        customer_comment: selectedFamily
          ? `Área pública seleccionada: ${selectedFamily.title}\n\n${form.customer_comment.trim()}`
          : form.customer_comment.trim(),
        representation_confirmed: String(form.representation_confirmed),
        privacy_accepted: String(form.privacy_accepted),
      }).forEach(([key, value]) => fd.append(key, value));

      fd.append("dni_front", dniFront);
      fd.append("dni_back", dniBack);

      const data = await fetchJsonFallback("/cases/intake-draft", { method: "POST", body: fd });
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
    if (signedAuthorization.size > MAX_FILE_BYTES) return setMessage("La autorización supera 12 MB.");

    setUploading(true);
    setMessage("");
    try {
      const fd = new FormData();
      fd.append("file", signedAuthorization);
      await fetchJsonFallback(`/cases/${draftCase.caseId}/upload-authorization-signed`, { method: "POST", body: fd });
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

  if (invalidSelection) {
    return (
      <>
        <Seo
          title="Ruta de expediente no válida · RTM"
          description="La combinación solicitada no corresponde a un tipo de expediente RTM."
          canonical="https://www.recurretumulta.eu/iniciar-expediente"
          noindex
        />
        <main className="rtm-intake-invalid">
          <section>
            <span aria-hidden="true">🧭</span>
            <div className="rtm-intake-invalid-badge">Selección no reconocida</div>
            <h1>No hemos abierto un expediente equivocado</h1>
            <p>
              La dirección contiene un área o un tipo que RTM no reconoce. Por
              seguridad, no lo convertimos automáticamente en un expediente de tráfico.
            </p>
            <button type="button" onClick={() => navigate("/iniciar-expediente")}>
              Elegir una de las 9 áreas
            </button>
          </section>
        </main>
      </>
    );
  }

  if (needsServiceSelection) {
    const services = PUBLIC_SERVICE_FAMILIES;

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
                Selecciona el área correspondiente. Te llevaremos al expediente
                disponible o, en Vivienda, a una consulta previa de encaje.
              </p>
            </header>

            <div
              className="rtm-intake-family-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))",
                gap: 17,
              }}
            >
              {services.map((service) => (
                <button
                  className="rtm-intake-family-card"
                  key={service.id}
                  type="button"
                  onClick={() => navigate(service.startPath)}
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
                    {service.summary}
                  </span>
                  <span
                    style={{
                      display: "inline-flex",
                      marginTop: 14,
                      padding: "6px 9px",
                      borderRadius: 999,
                      background:
                        service.entryMode === "consultation" ? "#fff7ed" : "#ecfdf5",
                      color:
                        service.entryMode === "consultation" ? "#9a3412" : "#166534",
                      fontSize: 12,
                      fontWeight: 900,
                    }}
                  >
                    {service.entryMode === "consultation"
                      ? "Consulta de encaje"
                      : "Expediente disponible"}
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
            {selectedFamily ? (
              <div style={{ marginTop: 12, padding: "12px 14px", borderRadius: 14, background: "#ecfdf5", color: "#166534", fontWeight: 900, lineHeight: 1.5 }}>
                {selectedFamily.icon} Área pública elegida: {selectedFamily.title}
              </div>
            ) : null}
          </header>

          <form onSubmit={createDraftAndDownload}>
            <Section title="1. Tipo de expediente">
              <select value={form.case_type} onChange={(e) => update("case_type", e.target.value)} style={inputStyle} disabled={Boolean(draftCase)}>
                {availableCaseTypes.map((value) => (
                  <option key={value} value={value}>{config.caseTypes[value]}</option>
                ))}
              </select>
            </Section>

            <Section title="2. Datos personales">
              <div style={gridStyle}>
                <Field label="Nombre y apellidos" value={form.full_name} onChange={(v) => update("full_name", v)} placeholder="Nombre completo" disabled={Boolean(draftCase)} />
                <Field label="DNI / NIE / Pasaporte" value={form.dni_nie} onChange={(v) => update("dni_nie", v)} placeholder="Ej. 12345678Z" disabled={Boolean(draftCase)} />
                <Field label="Email" type="email" value={form.email} onChange={(v) => update("email", v)} placeholder="tu@email.com" disabled={Boolean(draftCase)} />
                <Field label="Teléfono" value={form.telefono} onChange={(v) => update("telefono", v)} placeholder="Ej. 600 000 000" disabled={Boolean(draftCase)} />
              </div>
              <div style={{ marginTop: 16 }}>
                <span style={labelStyle}>Preferencia de contacto</span>
                <select value={form.preferred_contact} onChange={(e) => update("preferred_contact", e.target.value)} style={inputStyle} disabled={Boolean(draftCase)}>
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
              <textarea rows={7} maxLength={1500} value={form.customer_comment} onChange={(e) => update("customer_comment", e.target.value)} placeholder="Explica brevemente el problema..." style={{ ...inputStyle, resize: "vertical" }} disabled={Boolean(draftCase)} />
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

          {message && <div style={{ marginTop: 16, padding: 14, borderRadius: 14, background: message.startsWith("✅") ? "#ecfdf5" : "#fef2f2", color: message.startsWith("✅") ? "#166534" : "#991b1b", fontWeight: 850 }}>{message}</div>}
        </section>
      </main>
    </>
  );
}

function Section({ title, children }) {
  return <section style={{ marginBottom: 22, padding: 22, border: "1px solid #e2e8f0", borderRadius: 20, background: "#fff" }}><h2 style={{ margin: "0 0 16px", fontSize: 23 }}>{title}</h2>{children}</section>;
}

function Field({ label, value, onChange, placeholder, type = "text", disabled = false }) {
  return <label style={{ display: "block" }}><span style={labelStyle}>{label}</span><input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} disabled={disabled} /></label>;
}

function UploadBox({ label, file, inputRef, onChange, accept = "image/*,application/pdf", disabled = false }) {
  return <div><span style={labelStyle}>{label}</span><button type="button" onClick={() => !disabled && inputRef.current?.click()} disabled={disabled} style={{ width: "100%", minHeight: 118, padding: 16, border: "2px dashed #cbd5e1", borderRadius: 16, background: file ? "#f0fdf4" : "#f8fafc", cursor: disabled ? "not-allowed" : "pointer" }}><div style={{ fontSize: 30 }}>{file ? "✅" : "📷"}</div><strong>{file ? file.name : "Seleccionar archivo"}</strong>{file && <div style={{ color: "#64748b", fontSize: 13 }}>{formatBytes(file.size)}</div>}</button><input ref={inputRef} type="file" accept={accept} onChange={(e) => onChange(e.target.files?.[0] || null)} style={{ display: "none" }} disabled={disabled} /></div>;
}

function Check({ checked, onChange, children }) {
  return <label style={{ display: "flex", gap: 10, marginBottom: 12, color: "#334155" }}><input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} /><span>{children}</span></label>;
}

const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 16 };
const labelStyle = { display: "block", marginBottom: 7, fontWeight: 850, color: "#0f172a" };
const inputStyle = { width: "100%", boxSizing: "border-box", padding: "12px 13px", border: "1px solid #cbd5e1", borderRadius: 13, background: "#fff", fontSize: 15 };
const primaryButton = { width: "100%", minHeight: 56, border: 0, borderRadius: 15, padding: "15px 18px", background: "#16a34a", color: "#fff", fontSize: 17, fontWeight: 950, cursor: "pointer" };
