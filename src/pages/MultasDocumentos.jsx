import { useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { apiFetch, RTM_API_CANDIDATES } from "../lib/api.js";

const MAX_FILES = 5;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

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
      data?.error ||
      text ||
      `HTTP ${response.status}`;

    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  return data;
}

async function fetchJsonFallback(path, options = {}) {
  const errors = [];

  for (const base of RTM_API_CANDIDATES) {
    const url = buildUrl(base, path);

    try {
      const response = await apiFetch(url, options);
      return await readResponse(response);
    } catch (error) {
      errors.push(`${url} → ${error?.message || "Error"}`);
    }
  }

  throw new Error(errors.join(" | "));
}

function getCaseId(search) {
  const params = new URLSearchParams(search);
  return params.get("case") || params.get("case_id") || params.get("id") || "";
}

function formatBytes(bytes = 0) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function MultasDocumentos() {
  const location = useLocation();
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const caseId = useMemo(() => getCaseId(location.search), [location.search]);

  const [files, setFiles] = useState([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  function addFiles(fileList) {
    const incoming = Array.from(fileList || []);
    const available = MAX_FILES - files.length;
    const selected = incoming.slice(0, Math.max(0, available));

    const valid = selected.filter((file) => file.size <= MAX_FILE_BYTES);

    if (incoming.some((file) => file.size > MAX_FILE_BYTES)) {
      setMessage(`Algún archivo supera el máximo de ${formatBytes(MAX_FILE_BYTES)}.`);
    } else if (incoming.length > available) {
      setMessage(`Máximo ${MAX_FILES} documentos por subida.`);
    } else {
      setMessage("");
    }

    setFiles((current) => [
      ...current,
      ...valid.map((file) => ({
        id: crypto.randomUUID(),
        file,
      })),
    ]);
  }

  function removeFile(id) {
    setFiles((current) => current.filter((item) => item.id !== id));
  }

  async function uploadDocuments() {
    if (!caseId) {
      setMessage("No se ha encontrado el número de expediente.");
      return;
    }

    if (!files.length) {
      setMessage("Añade al menos un documento.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      const formData = new FormData();
      files.forEach((item) => formData.append("files", item.file));

      await fetchJsonFallback(`/cases/${caseId}/append-documents`, {
        method: "POST",
        body: formData,
      });

      setMessage("✅ Documentación recibida correctamente.");

      setTimeout(() => {
        navigate(`/resumen?case=${encodeURIComponent(caseId)}`);
      }, 700);
    } catch (error) {
      setMessage(error?.message || "No se pudo subir la documentación.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Seo
        title="Subir multa o notificación · RTM"
        description="Adjunta la multa, la notificación y cualquier otro documento relacionado."
        canonical="https://www.recurretumulta.eu"
      />

      <main
        style={{
          minHeight: "calc(100vh - 120px)",
          padding: "46px 18px 70px",
          background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 56%, #0f766e 100%)",
        }}
      >
        <section
          style={{
            maxWidth: 900,
            margin: "0 auto",
            padding: "30px 24px",
            borderRadius: 26,
            background: "rgba(255,255,255,.98)",
            boxShadow: "0 24px 70px rgba(15,23,42,.34)",
          }}
        >
          <header style={{ marginBottom: 24 }}>
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "7px 12px",
                marginBottom: 14,
                borderRadius: 999,
                background: "#dbeafe",
                color: "#1d4ed8",
                fontWeight: 950,
              }}
            >
              <span>🚗</span>
              <span>Expediente RTM</span>
            </div>

            <h1
              style={{
                margin: "0 0 12px",
                fontSize: "clamp(32px, 5vw, 48px)",
                lineHeight: 1.05,
                letterSpacing: "-.035em",
              }}
            >
              Subir multa o notificación
            </h1>

            <p style={{ margin: 0, color: "#475569", fontSize: 17, lineHeight: 1.6 }}>
              Adjunta la multa, la notificación y cualquier otro documento relacionado.
            </p>
          </header>

          <div
            style={{
              marginBottom: 20,
              padding: 16,
              borderRadius: 16,
              background: "#dbeafe",
              color: "#1d4ed8",
              overflowWrap: "anywhere",
            }}
          >
            <div style={{ fontSize: 13, fontWeight: 900, textTransform: "uppercase" }}>
              Número de expediente
            </div>
            <div style={{ marginTop: 5, fontSize: 21, fontWeight: 950 }}>
              {caseId || "No encontrado"}
            </div>
          </div>

          <div style={{ display: "grid", gap: 10, marginBottom: 20 }}>
            <StatusRow text="Datos personales recibidos" />
            <StatusRow text="Documento de identidad recibido" />
            <StatusRow text="Autorización firmada recibida" />
          </div>

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            style={{
              width: "100%",
              minHeight: 150,
              padding: 20,
              border: "2px dashed #cbd5e1",
              borderRadius: 18,
              background: "#f8fafc",
              cursor: "pointer",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 36, marginBottom: 8 }}>📎</div>
            <strong>Seleccionar documentación</strong>
            <div style={{ marginTop: 6, color: "#64748b", fontSize: 13 }}>
              JPG, PNG, WebP, PDF o DOCX · máximo {formatBytes(MAX_FILE_BYTES)} por archivo
            </div>
          </button>

          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx"
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
            style={{ display: "none" }}
          />

          {files.length ? (
            <div style={{ display: "grid", gap: 9, marginTop: 14 }}>
              {files.map((item, index) => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: 12,
                    padding: "11px 12px",
                    borderRadius: 12,
                    background: "#f1f5f9",
                  }}
                >
                  <span style={{ overflowWrap: "anywhere" }}>
                    Documento {index + 1} · {item.file.name} · {formatBytes(item.file.size)}
                  </span>

                  <button
                    type="button"
                    onClick={() => removeFile(item.id)}
                    style={{
                      flexShrink: 0,
                      border: 0,
                      borderRadius: 9,
                      padding: "7px 10px",
                      background: "#e2e8f0",
                      fontWeight: 800,
                      cursor: "pointer",
                    }}
                  >
                    Quitar
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          {message ? (
            <div
              role="alert"
              style={{
                marginTop: 16,
                padding: 14,
                borderRadius: 14,
                border: message.startsWith("✅")
                  ? "1px solid #bbf7d0"
                  : "1px solid #fecaca",
                background: message.startsWith("✅") ? "#ecfdf5" : "#fef2f2",
                color: message.startsWith("✅") ? "#166534" : "#991b1b",
                fontWeight: 850,
                overflowWrap: "anywhere",
              }}
            >
              {message}
            </div>
          ) : null}

          <button
            type="button"
            onClick={uploadDocuments}
            disabled={loading || !caseId || !files.length}
            style={{
              width: "100%",
              minHeight: 54,
              marginTop: 18,
              border: 0,
              borderRadius: 15,
              background: loading || !caseId || !files.length ? "#94a3b8" : "#16a34a",
              color: "#fff",
              fontSize: 16,
              fontWeight: 950,
              cursor: loading || !caseId || !files.length ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Subiendo documentación…" : "Guardar documentación y continuar"}
          </button>
        </section>
      </main>
    </>
  );
}

function StatusRow({ text }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 9,
        padding: "11px 13px",
        border: "1px solid #e2e8f0",
        borderRadius: 13,
        background: "#fff",
        color: "#334155",
        fontWeight: 800,
      }}
    >
      <span style={{ color: "#16a34a" }}>✓</span>
      <span>{text}</span>
    </div>
  );
}
