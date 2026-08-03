import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";

const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "https://recurretumulta-backend.onrender.com";

const MAX_FILE_BYTES = 8 * 1024 * 1024;
const MAX_FILES = 10;

const DOCUMENT_TYPES = [
  { value: "equifax_asnef", label: "Comunicación de Equifax / ASNEF" },
  { value: "acreedor", label: "Carta o comunicación del acreedor" },
  { value: "pago", label: "Justificante de pago" },
  { value: "reclamacion", label: "Reclamación previa o respuesta recibida" },
  { value: "otro", label: "Otro documento relacionado" },
];

function normalizeId(value = "") {
  return value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function validEmail(value = "") {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function formatBytes(bytes = 0) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getFileError(file) {
  if (!file) return "Archivo no válido.";
  if (file.size > MAX_FILE_BYTES) {
    return `${file.name} supera el límite de ${formatBytes(MAX_FILE_BYTES)}.`;
  }
  return "";
}

async function parseResponse(response) {
  const raw = await response.text().catch(() => "");
  let data = {};

  try {
    data = raw ? JSON.parse(raw) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const detail =
      data?.detail ||
      data?.message ||
      data?.error ||
      raw ||
      `HTTP ${response.status}`;
    throw new Error(typeof detail === "string" ? detail : "No se pudo crear el expediente.");
  }

  return data;
}

export default function Deudas() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    full_name: "",
    dni_nie: "",
    email: "",
    phone: "",
    document_type: "equifax_asnef",
    case_description: "",
    authorization_accepted: false,
    privacy_accepted: false,
  });

  const [dniFront, setDniFront] = useState(null);
  const [dniBack, setDniBack] = useState(null);
  const [authorizationFile, setAuthorizationFile] = useState(null);
  const [caseFiles, setCaseFiles] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const normalizedDni = useMemo(() => normalizeId(form.dni_nie), [form.dni_nie]);
  const emailOk = useMemo(() => validEmail(form.email), [form.email]);

  function update(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setMessage("");
  }

  function addCaseFiles(fileList) {
    const incoming = Array.from(fileList || []);
    const combined = [...caseFiles, ...incoming].slice(0, MAX_FILES);
    setCaseFiles(combined);
    setMessage("");
  }

  function removeCaseFile(index) {
    setCaseFiles((files) => files.filter((_, currentIndex) => currentIndex !== index));
  }

  function validate() {
    if (!form.full_name.trim()) return "Indica el nombre y apellidos.";
    if (!normalizedDni) return "Indica el DNI o NIE.";
    if (!form.email.trim()) return "Indica un email.";
    if (!emailOk) return "Indica un email válido.";
    if (!form.phone.trim()) return "Indica un teléfono de contacto.";

    if (!dniFront) return "Adjunta la foto frontal del DNI o NIE.";
    if (!dniBack) return "Adjunta la foto posterior del DNI o NIE.";
    if (!authorizationFile) return "Adjunta la autorización de representación firmada.";

    if (!caseFiles.length) {
      return "Adjunta al menos un documento relacionado con la deuda o la inclusión.";
    }

    const files = [dniFront, dniBack, authorizationFile, ...caseFiles];
    for (const file of files) {
      const fileError = getFileError(file);
      if (fileError) return fileError;
    }

    if (!form.case_description.trim()) {
      return "Cuéntanos brevemente qué ha ocurrido en tu caso.";
    }

    if (form.case_description.trim().length < 20) {
      return "La explicación es demasiado breve. Añade algún detalle relevante.";
    }

    if (!form.authorization_accepted) {
      return "Debes confirmar la autorización para gestionar este expediente.";
    }

    if (!form.privacy_accepted) {
      return "Debes aceptar la política de privacidad.";
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const error = validate();
    if (error) {
      setMessage(error);
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const payload = new FormData();

      payload.append("service", "debt");
      payload.append("department", "debt");
      payload.append("case_type", "asnef_equifax");
      payload.append("full_name", form.full_name.trim());
      payload.append("dni_nie", normalizedDni);
      payload.append("email", form.email.trim());
      payload.append("phone", form.phone.trim());
      payload.append("document_type", form.document_type);
      payload.append("case_description", form.case_description.trim());
      payload.append("authorization_accepted", String(form.authorization_accepted));
      payload.append("privacy_accepted", String(form.privacy_accepted));

      payload.append("dni_front", dniFront);
      payload.append("dni_back", dniBack);
      payload.append("authorization", authorizationFile);

      caseFiles.forEach((file) => payload.append("case_files", file));

      const response = await fetch(`${API_BASE}/rtm/intake`, {
        method: "POST",
        body: payload,
      });

      const data = await parseResponse(response);
      const caseId = data?.case_id || data?.id || data?.caseId;

      if (!caseId) {
        throw new Error("El expediente se creó, pero no se recibió su número interno.");
      }

      localStorage.setItem(
        "rtm_last_intake",
        JSON.stringify({
          ...data,
          department: "debt",
          case_type: "asnef_equifax",
          created_at: new Date().toISOString(),
        })
      );

      navigate(`/resumen?case=${encodeURIComponent(caseId)}`);
    } catch (error) {
      setMessage(error?.message || "No se pudo crear el expediente.");
      setLoading(false);
    }
  }

  return (
    <>
      <Seo
        title="Deudas, ASNEF y ficheros de morosidad · RTM"
        description="Inicia tu expediente RTM para revisar una inclusión en ASNEF, Equifax u otros ficheros de morosidad."
        canonical="https://www.recurretumulta.eu/deudas/iniciar"
      />

      <main
        style={{
          minHeight: "calc(100vh - 120px)",
          padding: "44px 18px 64px",
          background:
            "linear-gradient(135deg, #0f172a 0%, #1e3a8a 52%, #0f766e 100%)",
        }}
      >
        <section
          style={{
            maxWidth: 1040,
            margin: "0 auto",
            padding: "32px 24px",
            borderRadius: 26,
            background: "rgba(255,255,255,.97)",
            boxShadow: "0 24px 70px rgba(15,23,42,.32)",
          }}
        >
          <header style={{ maxWidth: 780, marginBottom: 30 }}>
            <div
              style={{
                display: "inline-flex",
                padding: "7px 12px",
                marginBottom: 14,
                borderRadius: 999,
                background: "#dbeafe",
                color: "#1e3a8a",
                fontWeight: 900,
              }}
            >
              RTM · Deudas y morosidad
            </div>

            <h1
              style={{
                margin: "0 0 13px",
                fontSize: "clamp(34px, 5vw, 50px)",
                lineHeight: 1.05,
                letterSpacing: "-.035em",
              }}
            >
              Inicia tu expediente
            </h1>

            <p style={{ margin: 0, color: "#475569", fontSize: 18, lineHeight: 1.6 }}>
              Necesitamos identificarte, recibir la autorización y revisar los documentos
              relacionados con la inclusión o la deuda.
            </p>
          </header>

          <form onSubmit={handleSubmit}>
            <Section title="1. Datos personales">
              <div style={gridStyle}>
                <Field
                  label="Nombre y apellidos"
                  value={form.full_name}
                  onChange={(value) => update("full_name", value)}
                  placeholder="Nombre completo"
                />

                <Field
                  label="DNI o NIE"
                  value={form.dni_nie}
                  onChange={(value) => update("dni_nie", value)}
                  placeholder="Ej. 12345678Z"
                />

                <Field
                  label="Email"
                  type="email"
                  value={form.email}
                  onChange={(value) => update("email", value)}
                  placeholder="tu@email.com"
                />

                <Field
                  label="Teléfono"
                  value={form.phone}
                  onChange={(value) => update("phone", value)}
                  placeholder="Ej. 600 000 000"
                />
              </div>
            </Section>

            <Section title="2. Documento de identidad">
              <div style={gridStyle}>
                <FileField
                  label="DNI/NIE · parte frontal"
                  file={dniFront}
                  onChange={setDniFront}
                />

                <FileField
                  label="DNI/NIE · parte posterior"
                  file={dniBack}
                  onChange={setDniBack}
                />
              </div>
            </Section>

            <Section title="3. Autorización de representación">
              <p style={helperStyle}>
                Adjunta la autorización firmada. Puede ser un PDF o una fotografía legible
                realizada con el móvil.
              </p>

              <FileField
                label="Autorización RTM firmada"
                file={authorizationFile}
                onChange={setAuthorizationFile}
                accept="image/*,application/pdf"
              />

              <label style={checkStyle}>
                <input
                  type="checkbox"
                  checked={form.authorization_accepted}
                  onChange={(event) =>
                    update("authorization_accepted", event.target.checked)
                  }
                  style={{ marginTop: 4 }}
                />
                <span>
                  Autorizo a RTM a actuar en mi nombre exclusivamente para las gestiones
                  relacionadas con este expediente, incluyendo el ejercicio de derechos,
                  solicitudes de información, rectificación o supresión y actuaciones ante
                  acreedores, Equifax, ASNEF u otros ficheros o entidades necesarias.
                </span>
              </label>
            </Section>

            <Section title="4. Documentación del caso">
              <label style={{ display: "block", marginBottom: 16 }}>
                <span style={labelStyle}>Documento principal</span>
                <select
                  value={form.document_type}
                  onChange={(event) => update("document_type", event.target.value)}
                  style={inputStyle}
                >
                  {DOCUMENT_TYPES.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>

              <label
                style={{
                  display: "block",
                  padding: 22,
                  border: "2px dashed #cbd5e1",
                  borderRadius: 18,
                  background: "#f8fafc",
                  textAlign: "center",
                  cursor: "pointer",
                }}
              >
                <input
                  type="file"
                  multiple
                  accept="image/*,application/pdf"
                  onChange={(event) => {
                    addCaseFiles(event.target.files);
                    event.target.value = "";
                  }}
                  style={{ display: "none" }}
                />

                <div style={{ fontSize: 34, marginBottom: 8 }}>📎</div>
                <strong>Seleccionar documentos</strong>
                <div style={{ color: "#64748b", fontSize: 14, marginTop: 5 }}>
                  Hasta {MAX_FILES} archivos · máximo {formatBytes(MAX_FILE_BYTES)} por archivo
                </div>
              </label>

              {caseFiles.length ? (
                <div style={{ display: "grid", gap: 9, marginTop: 14 }}>
                  {caseFiles.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                        padding: "10px 12px",
                        borderRadius: 12,
                        background: "#f1f5f9",
                      }}
                    >
                      <span style={{ overflowWrap: "anywhere" }}>
                        {file.name} · {formatBytes(file.size)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeCaseFile(index)}
                        style={smallButtonStyle}
                      >
                        Quitar
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </Section>

            <Section title="5. Cuéntanos brevemente qué ha ocurrido">
              <p style={helperStyle}>
                Explica los hechos importantes que no aparezcan claramente en los documentos.
              </p>

              <textarea
                value={form.case_description}
                onChange={(event) => update("case_description", event.target.value)}
                rows={6}
                maxLength={1200}
                placeholder="Ej. La deuda está pagada desde 2024, pero sigo apareciendo en el fichero. Adjunto el justificante de pago y la comunicación recibida."
                style={{ ...inputStyle, resize: "vertical", lineHeight: 1.55 }}
              />

              <div style={{ textAlign: "right", color: "#64748b", fontSize: 13 }}>
                {form.case_description.length}/1200
              </div>
            </Section>

            <label style={{ ...checkStyle, marginBottom: 18 }}>
              <input
                type="checkbox"
                checked={form.privacy_accepted}
                onChange={(event) => update("privacy_accepted", event.target.checked)}
                style={{ marginTop: 4 }}
              />
              <span>
                Confirmo que los datos aportados son correctos y acepto la política de
                privacidad y el tratamiento de la documentación para gestionar este expediente.
              </span>
            </label>

            {message ? (
              <div
                role="alert"
                style={{
                  marginBottom: 16,
                  padding: 14,
                  borderRadius: 14,
                  border: "1px solid #fecaca",
                  background: "#fef2f2",
                  color: "#991b1b",
                  fontWeight: 750,
                  lineHeight: 1.45,
                }}
              >
                {message}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                minHeight: 54,
                border: 0,
                borderRadius: 15,
                padding: "15px 18px",
                background: loading ? "#94a3b8" : "#16a34a",
                color: "#fff",
                fontSize: 17,
                fontWeight: 950,
                cursor: loading ? "not-allowed" : "pointer",
                boxShadow: "0 14px 28px rgba(22,163,74,.24)",
              }}
            >
              {loading ? "Creando expediente…" : "Crear expediente RTM"}
            </button>
          </form>
        </section>
      </main>
    </>
  );
}

function Section({ title, children }) {
  return (
    <section
      style={{
        marginBottom: 22,
        padding: 22,
        border: "1px solid #e2e8f0",
        borderRadius: 20,
        background: "#fff",
      }}
    >
      <h2 style={{ margin: "0 0 16px", fontSize: 23 }}>{title}</h2>
      {children}
    </section>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        style={inputStyle}
      />
    </label>
  );
}

function FileField({
  label,
  file,
  onChange,
  accept = "image/*,application/pdf",
}) {
  return (
    <label style={{ display: "block" }}>
      <span style={labelStyle}>{label}</span>
      <input
        type="file"
        accept={accept}
        onChange={(event) => onChange(event.target.files?.[0] || null)}
        style={{
          width: "100%",
          boxSizing: "border-box",
          padding: 11,
          border: "1px solid #cbd5e1",
          borderRadius: 13,
          background: "#f8fafc",
        }}
      />
      {file ? (
        <small style={{ display: "block", marginTop: 6, color: "#166534" }}>
          {file.name} · {formatBytes(file.size)}
        </small>
      ) : null}
    </label>
  );
}

const gridStyle = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 16,
};

const labelStyle = {
  display: "block",
  marginBottom: 7,
  fontWeight: 800,
};

const inputStyle = {
  width: "100%",
  boxSizing: "border-box",
  padding: "12px 13px",
  border: "1px solid #cbd5e1",
  borderRadius: 13,
  background: "#fff",
  fontSize: 15,
};

const helperStyle = {
  margin: "0 0 14px",
  color: "#64748b",
  lineHeight: 1.5,
};

const checkStyle = {
  display: "flex",
  gap: 10,
  alignItems: "flex-start",
  color: "#334155",
  fontSize: 14,
  lineHeight: 1.5,
};

const smallButtonStyle = {
  flexShrink: 0,
  border: 0,
  borderRadius: 9,
  padding: "7px 10px",
  background: "#e2e8f0",
  color: "#0f172a",
  fontWeight: 800,
  cursor: "pointer",
};
