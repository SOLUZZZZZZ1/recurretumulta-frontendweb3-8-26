import { clientRequest } from "../lib/clientApi.js";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { fileSizeError } from "../lib/clientFiles.js";
import UploadBox from "../components/FileUploadBox.jsx";
import IntakeAuthorization from "../components/IntakeAuthorization.jsx";
import "./Intake.css";

const SERVICE_CONFIG = {
  traffic: {
    label: "Tráfico",
    icon: "🚗",
    defaultCaseType: "fine",
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
    caseTypes: {
      airline: "Aerolínea",
      consumer: "Consumo",
      other_claim: "Otra reclamación",
    },
  },
};

function normalizeDni(value = "") {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").trim();
}

function validEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function IniciarExpedienteRTM() {
  const navigate = useNavigate();
  const params = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const caseId = searchParams.get("case") || "";

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
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [message, setMessage] = useState("");
  const messageRef = useRef(null);
  const stepRef = useRef(null);
  const previousStep = useRef(1);
  const submissionLock = useRef(false);
  const active = useRef(true);

  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);

  useEffect(() => {
    if (message) messageRef.current?.focus();
  }, [message]);

  useEffect(() => {
    if (previousStep.current !== step) stepRef.current?.focus();
    previousStep.current = step;
  }, [step]);

  const dniFrontRef = useRef(null);
  const dniBackRef = useRef(null);

  const domicilio = useMemo(() => {
    const line1 = [form.street, form.street_number, form.floor ? `Piso ${form.floor}` : "", form.door ? `Puerta ${form.door}` : ""].filter(Boolean).join(", ");
    const line2 = [form.postal_code, form.city, form.province ? `(${form.province})` : ""].filter(Boolean).join(" ");
    return [line1, line2].filter(Boolean).join(" · ");
  }, [form]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage("");
  }

  function validateDetails() {
    if (form.full_name.trim().length < 3) return "Indica el nombre y apellidos.";
    if (normalizeDni(form.dni_nie).length < 5) return "Indica el DNI, NIE o pasaporte.";
    if (!validEmail(form.email)) return "Indica un email válido.";
    if (form.telefono.trim().length < 6) return "Indica un teléfono.";
    if (!form.street.trim()) return "Indica la calle.";
    if (!form.street_number.trim()) return "Indica el número.";
    if (!form.postal_code.trim()) return "Indica el código postal.";
    if (!form.city.trim()) return "Indica la población.";
    if (!form.province.trim()) return "Indica la provincia.";
    if (form.customer_comment.trim().length < 15) return "Cuéntanos brevemente qué ha ocurrido.";
    return "";
  }

  function validateDocuments() {
    if (!dniFront) return "Adjunta la parte frontal del documento de identidad.";
    if (!dniBack) return "Adjunta la parte posterior del documento de identidad.";
    const identityFileError = fileSizeError(dniFront) || fileSizeError(dniBack);
    if (identityFileError) return identityFileError;
    return "";
  }

  function validateDraft() {
    const problem = validateDetails() || validateDocuments();
    if (problem) return problem;
    if (!form.representation_confirmed) return "Confirma la generación de la autorización.";
    if (!form.privacy_accepted) return "Acepta la política de privacidad.";
    return "";
  }

  async function submitStep(event) {
    event.preventDefault();
    if (submissionLock.current || uncertain) return;
    if (step < 3) {
      const error = step === 1 ? validateDetails() : validateDocuments();
      if (error) { setMessage(error); messageRef.current?.focus(); return; }
      setMessage("");
      setStep(current => current + 1);
      return;
    }
    const error = validateDraft();
    if (error) return setMessage(error);

    submissionLock.current = true;
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
      if (!active.current) return;
      const caseId = data?.case_id || data?.id;
      if (typeof caseId !== "string" || !caseId) {
        const error = new Error("No hemos podido confirmar el número del expediente. Contacta con RTM antes de volver a enviar la solicitud.");
        error.uncertain = true;
        throw error;
      }

      const nextSearch = new URLSearchParams(searchParams);
      nextSearch.set("case", caseId);
      setSearchParams(nextSearch, { replace: true });
      setMessage("");
    } catch (error) {
      if (!active.current) return;
      setUncertain(Boolean(error.uncertain));
      setMessage(error?.message || "No se pudo crear el expediente.");
    } finally {
      submissionLock.current = false;
      if (active.current) setLoading(false);
    }
  }

  function goToStep(next) {
    setMessage("");
    setStep(next);
  }

  if (caseId) return <><Seo title="Continuar expediente · RTM" description="Continúa la autorización de tu expediente RTM." /><IntakeAuthorization key={caseId} caseId={caseId} /></>;

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

      <main className="rtm-intake-page">
        <section className="rtm-intake-panel">
          <header>
            <h1>Inicia tu expediente</h1>
            <p>Completa estos tres pasos. Podrás revisar los datos antes de enviarlos y después firmar la autorización.</p>
            <ol aria-label="Progreso del alta" className="rtm-intake-progress">
              {["Datos", "Documentos", "Revisión"].map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined}><span aria-hidden="true">{index + 1}</span>{label}</li>)}
            </ol>
          </header>

          <h2 ref={stepRef} tabIndex={-1}>Paso {step} de 3 · {step === 1 ? "Tus datos y tu caso" : step === 2 ? "Documento de identidad" : "Revisa antes de enviar"}</h2>
          <form onSubmit={submitStep} noValidate>
            {step === 1 && <>
            <Section title="Tipo de expediente">
              <select aria-label="Tipo de expediente" value={form.case_type} onChange={(e) => update("case_type", e.target.value)} style={inputStyle}>
                {Object.entries(config.caseTypes).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Section>

            <Section title="Datos personales">
              <div style={gridStyle}>
                <Field label="Nombre y apellidos" name="full_name" autoComplete="name" value={form.full_name} onChange={(v) => update("full_name", v)} placeholder="Nombre completo" />
                <Field label="DNI / NIE / Pasaporte" name="dni_nie" value={form.dni_nie} onChange={(v) => update("dni_nie", v)} placeholder="Ej. 12345678Z" />
                <Field label="Email" name="email" autoComplete="email" type="email" value={form.email} onChange={(v) => update("email", v)} placeholder="tu@email.com" />
                <Field label="Teléfono" name="telefono" autoComplete="tel" type="tel" value={form.telefono} onChange={(v) => update("telefono", v)} placeholder="Ej. 600 000 000" />
              </div>
              <div style={{ marginTop: 16 }}>
                <span style={labelStyle}>Preferencia de contacto</span>
                <select aria-label="Preferencia de contacto" value={form.preferred_contact} onChange={(e) => update("preferred_contact", e.target.value)} style={inputStyle}>
                  <option value="email">Email</option><option value="phone">Teléfono</option><option value="whatsapp">WhatsApp</option>
                </select>
              </div>
            </Section>

            <Section title="Domicilio de notificaciones">
              <div style={gridStyle}>
                <Field label="Calle" name="street" autoComplete="address-line1" value={form.street} onChange={(v) => update("street", v)} placeholder="Nombre de la vía" />
                <Field label="Número" name="street_number" value={form.street_number} onChange={(v) => update("street_number", v)} placeholder="Número" />
                <Field label="Piso" name="floor" value={form.floor} onChange={(v) => update("floor", v)} placeholder="Opcional" />
                <Field label="Puerta" name="door" value={form.door} onChange={(v) => update("door", v)} placeholder="Opcional" />
                <Field label="Código postal" name="postal_code" autoComplete="postal-code" inputMode="numeric" value={form.postal_code} onChange={(v) => update("postal_code", v)} placeholder="Código postal" />
                <Field label="Población" name="city" autoComplete="address-level2" value={form.city} onChange={(v) => update("city", v)} placeholder="Población" />
                <Field label="Provincia" name="province" autoComplete="address-level1" value={form.province} onChange={(v) => update("province", v)} placeholder="Provincia" />
              </div>
            </Section>
            <Section title="Cuéntanos qué ha ocurrido">
              <textarea aria-label="Cuéntanos brevemente qué ha ocurrido" rows={5} maxLength={1500} value={form.customer_comment} onChange={(e) => update("customer_comment", e.target.value)} placeholder="Explica brevemente el problema..." style={{ ...inputStyle, resize: "vertical" }} />
            </Section>
            </>}
            {step === 2 && <Section title="Adjunta las dos caras">
              <p className="rtm-intake-hint">Comprueba que las imágenes sean legibles y que se vean los bordes del documento. A continuación revisarás los datos y los archivos seleccionados.</p>
              <div style={gridStyle}>
                <UploadBox label="Parte frontal" file={dniFront} inputRef={dniFrontRef} onChange={setDniFront} />
                <UploadBox label="Parte posterior" file={dniBack} inputRef={dniBackRef} onChange={setDniBack} />
              </div>
            </Section>}
            {step === 3 && <>
              <Section title="Resumen de tu solicitud">
                <dl className="rtm-intake-summary">
                  <SummaryItem label="Servicio" value={`${config.label} · ${config.caseTypes[form.case_type]}`} />
                  <SummaryItem label="Nombre y documento" value={`${form.full_name}\n${form.dni_nie}`} />
                  <SummaryItem label="Contacto" value={`${form.email}\n${form.telefono}\nPreferencia: ${form.preferred_contact === "phone" ? "Teléfono" : form.preferred_contact === "whatsapp" ? "WhatsApp" : "Email"}`} />
                  <SummaryItem label="Domicilio de notificaciones" value={domicilio} />
                  <SummaryItem label="Qué ha ocurrido" value={form.customer_comment} />
                  <SummaryItem label="Archivos seleccionados" value={`Parte frontal: ${dniFront?.name || "Pendiente"}\nParte posterior: ${dniBack?.name || "Pendiente"}`} />
                </dl>
                <p className="rtm-intake-hint">Los datos y archivos se enviarán al pulsar «Crear expediente».</p>
                <div className="rtm-intake-actions">
                  <button type="button" className="sr-btn-secondary" disabled={loading || uncertain} onClick={() => goToStep(1)}>Editar datos</button>
                  <button type="button" className="sr-btn-secondary" disabled={loading || uncertain} onClick={() => goToStep(2)}>Cambiar documentos</button>
                </div>
              </Section>
              <Check checked={form.representation_confirmed} disabled={loading || uncertain} onChange={(v) => update("representation_confirmed", v)}>Deseo generar la autorización RTM vinculada a este expediente.</Check>
              <Check checked={form.privacy_accepted} disabled={loading || uncertain} onChange={(v) => update("privacy_accepted", v)}>Acepto la política de privacidad y confirmo que los datos son correctos.</Check>
            </>}
            {message && <div ref={messageRef} tabIndex={-1} role="alert" className="rtm-intake-error">{message}</div>}
            {uncertain ? <p>Conserva esta pantalla y <Link to="/contacto">contacta con RTM</Link> para confirmar el alta antes de volver a enviarla.</p> : <div className="rtm-intake-actions">
              {step > 1 && <button type="button" className="sr-btn-secondary" disabled={loading} onClick={() => goToStep(step - 1)}>Atrás</button>}
              <button type="submit" disabled={loading} style={primaryButton}>{loading ? "Creando expediente…" : step === 1 ? "Continuar a documentos" : step === 2 ? "Revisar solicitud" : "Crear expediente"}</button>
            </div>}
          </form>
        </section>
      </main>
    </>
  );
}

function Section({ title, children }) {
  return <section className="rtm-intake-section" style={{ marginBottom: 22, border: "1px solid #e2e8f0", borderRadius: 20, background: "#fff" }}><h3 style={{ margin: "0 0 16px", fontSize: 20 }}>{title}</h3>{children}</section>;
}

function Field({ label, name, value, onChange, placeholder, type = "text", autoComplete = "off", inputMode }) {
  return <label style={{ display: "block", minWidth: 0 }}><span style={labelStyle}>{label}</span><input name={name} type={type} autoComplete={autoComplete} inputMode={inputMode} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} /></label>;
}

function SummaryItem({ label, value }) {
  return <div><dt>{label}</dt><dd>{value}</dd></div>;
}

function Check({ checked, onChange, disabled, children }) {
  return <label style={{ display: "flex", gap: 10, marginBottom: 12, color: "#334155" }}><input type="checkbox" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} /><span>{children}</span></label>;
}

const gridStyle = { display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(min(100%,240px),1fr))", gap: 16 };
const labelStyle = { display: "block", marginBottom: 7, fontWeight: 850, color: "#0f172a" };
const inputStyle = { width: "100%", minWidth: 0, boxSizing: "border-box", padding: "12px 13px", border: "1px solid #cbd5e1", borderRadius: 13, background: "#fff", fontSize: 16 };
const primaryButton = { width: "100%", minHeight: 56, border: 0, borderRadius: 15, padding: "15px 18px", background: "#16a34a", color: "#fff", fontSize: 17, fontWeight: 950, cursor: "pointer" };
