import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";

const API = "/api";

const DIRECT_BACKEND = "https://recurretumulta-backend.onrender.com";

const API_CANDIDATES = [
  import.meta.env.VITE_API_BASE_URL,
  import.meta.env.VITE_API_URL,
  DIRECT_BACKEND,
  API,
].filter(Boolean);

const HARD_SEND_LIMIT_BYTES = 2.2 * 1024 * 1024;
const TARGET_IMAGE_BYTES = 1.6 * 1024 * 1024;
const IMAGE_MAX_SIDE = 1800;

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function getExt(name = "") {
  const m = String(name).match(/\.([a-zA-Z0-9]+)$/);
  return m ? m[1].toLowerCase() : "";
}

function isImageFile(file) {
  const ext = getExt(file?.name);
  return file?.type?.startsWith("image/") || ["jpg", "jpeg", "png", "webp"].includes(ext);
}

function isPdfFile(file) {
  return file?.type === "application/pdf" || getExt(file?.name) === "pdf";
}

function canvasToBlob(canvas, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error("No se pudo comprimir la imagen."));
        else resolve(blob);
      },
      "image/jpeg",
      quality
    );
  });
}

async function loadImage(file) {
  const url = URL.createObjectURL(file);
  try {
    return await new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () =>
        reject(
          new Error(
            "No se pudo leer la imagen. Si el móvil la guardó como HEIC, haz una captura de pantalla y sube esa captura."
          )
        );
      image.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function compressImageForUpload(file) {
  const image = await loadImage(file);

  const originalWidth = image.naturalWidth || image.width;
  const originalHeight = image.naturalHeight || image.height;

  if (!originalWidth || !originalHeight) {
    throw new Error("No se pudo leer el tamaño de la imagen.");
  }

  let bestBlob = null;
  let bestWidth = 0;
  let bestHeight = 0;

  for (const maxSide of [IMAGE_MAX_SIDE, 1600, 1400, 1100, 900]) {
    let width = originalWidth;
    let height = originalHeight;

    const longest = Math.max(width, height);
    if (longest > maxSide) {
      const ratio = maxSide / longest;
      width = Math.round(width * ratio);
      height = Math.round(height * ratio);
    }

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) throw new Error("No se pudo preparar la compresión.");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    for (const quality of [0.78, 0.68, 0.58, 0.48, 0.38, 0.3, 0.22]) {
      const blob = await canvasToBlob(canvas, quality);
      if (!bestBlob || blob.size < bestBlob.size) {
        bestBlob = blob;
        bestWidth = width;
        bestHeight = height;
      }
      if (blob.size <= TARGET_IMAGE_BYTES) {
        bestBlob = blob;
        bestWidth = width;
        bestHeight = height;
        break;
      }
    }

    if (bestBlob && bestBlob.size <= TARGET_IMAGE_BYTES) break;
  }

  if (!bestBlob) throw new Error("No se pudo optimizar la imagen.");

  if (bestBlob.size > HARD_SEND_LIMIT_BYTES) {
    throw new Error(
      `La imagen sigue pesando ${formatBytes(bestBlob.size)} tras prepararla. Haz una captura más simple del documento.`
    );
  }

  const base = String(file.name || "documento").replace(/\.[^.]+$/, "");
  const optimizedFile = new File([bestBlob], `${base}-preparado.jpg`, {
    type: "image/jpeg",
    lastModified: Date.now(),
  });

  return {
    file: optimizedFile,
    originalSize: file.size,
    finalSize: optimizedFile.size,
    width: bestWidth,
    height: bestHeight,
    optimized: true,
  };
}

async function prepareUploadFile(file) {
  if (!file) throw new Error("Archivo no válido.");

  if (isImageFile(file)) {
    return compressImageForUpload(file);
  }

  if (isPdfFile(file)) {
    if (file.size > HARD_SEND_LIMIT_BYTES) {
      throw new Error(
        `El PDF pesa ${formatBytes(file.size)}. Para evitar error de subida, sube una foto o captura clara del documento.`
      );
    }
    return {
      file,
      originalSize: file.size,
      finalSize: file.size,
      optimized: false,
    };
  }

  if (file.size > HARD_SEND_LIMIT_BYTES) {
    throw new Error(
      `El archivo pesa ${formatBytes(file.size)}. Sube una foto/captura para que el sistema la prepare automáticamente.`
    );
  }

  return {
    file,
    originalSize: file.size,
    finalSize: file.size,
    optimized: false,
  };
}

async function parseAnalyzeResponse(response) {
  const text = await response.text().catch(() => "");
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const detail = data?.detail || data?.message || data?.error || text || `HTTP ${response.status}`;
    throw new Error(typeof detail === "string" ? `HTTP ${response.status}: ${detail}` : `HTTP ${response.status}`);
  }

  return data;
}

async function postAnalyzeWithFallback(formData) {
  const errors = [];

  for (const base of API_CANDIDATES) {
    const cleanBase = String(base).replace(/\/$/, "");
    const url = `${cleanBase}/analyze`;

    try {
      const response = await fetch(url, {
        method: "POST",
        body: formData,
      });
      return await parseAnalyzeResponse(response);
    } catch (err) {
      errors.push(`${url} → ${err?.message || "error"}`);
    }
  }

  throw new Error(`No se pudo analizar el documento. ${errors.join(" | ")}`);
}



function looksLikeUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    String(value || "").trim()
  );
}

async function fetchPublicStatusWithFallback(caseId) {
  const errors = [];

  for (const base of API_CANDIDATES) {
    const cleanBase = String(base).replace(/\/$/, "");
    const url = `${cleanBase}/cases/${encodeURIComponent(caseId)}/public-status`;

    try {
      const response = await fetch(url, { method: "GET" });
      const data = await parseAnalyzeResponse(response);
      return data;
    } catch (err) {
      errors.push(`${url} → ${err?.message || "error"}`);
    }
  }

  throw new Error(`No se pudo recuperar el expediente. ${errors.join(" | ")}`);
}

function getCasePhase(data) {
  const authorized = Boolean(data?.authorized);
  const paymentStatus = String(data?.payment_status || "").toLowerCase();
  const status = String(data?.status || "").toLowerCase();

  if (!authorized) return "authorize";
  if (paymentStatus !== "paid") return "pay";

  if (
    status.includes("presentado") ||
    status === "submitted" ||
    status === "closed" ||
    status === "resolved"
  ) {
    return "status";
  }

  return "summary";
}

async function fetchContinueLookupWithFallback(caseIdOrExpediente) {
  const errors = [];

  for (const base of API_CANDIDATES) {
    const cleanBase = String(base).replace(/\/$/, "");
    const url = `${cleanBase}/cases/continue-lookup?q=${encodeURIComponent(caseIdOrExpediente)}`;

    try {
      const response = await fetch(url, { method: "GET" });
      const data = await parseAnalyzeResponse(response);
      return data;
    } catch (err) {
      errors.push(`${url} → ${err?.message || "error"}`);
    }
  }

  throw new Error(`No se pudo recuperar el expediente. ${errors.join(" | ")}`);
}

export default function Multas() {
  const nav = useNavigate();

  const [file, setFile] = useState(null);
  const [uploadInfo, setUploadInfo] = useState(null);
  const [caseId, setCaseId] = useState("");
  const [loading, setLoading] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [err, setErr] = useState("");

  async function handleFileChange(selectedFile) {
    setErr("");
    setUploadInfo(null);

    if (!selectedFile) {
      setFile(null);
      return;
    }

    setPreparing(true);

    try {
      const prepared = await prepareUploadFile(selectedFile);
      setFile(prepared.file);
      setUploadInfo(prepared);

      if (prepared.optimized) {
        setErr(
          `Imagen preparada correctamente: ${formatBytes(prepared.originalSize)} → ${formatBytes(prepared.finalSize)}`
        );
      }
    } catch (e) {
      setFile(null);
      setUploadInfo(null);
      setErr(e?.message || "No se pudo preparar el archivo.");
    } finally {
      setPreparing(false);
    }
  }

  async function handleUpload() {
    setErr("");

    if (!file) {
      setErr("Selecciona primero la multa o notificación que quieres analizar.");
      return;
    }

    if (file.size > HARD_SEND_LIMIT_BYTES) {
      setErr(
        `El archivo preparado pesa ${formatBytes(file.size)} y no se enviará para evitar error de subida.`
      );
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const data = await postAnalyzeWithFallback(formData);

      localStorage.setItem("rtm_last_analysis", JSON.stringify(data));

      const newCaseId =
        data?.case_id ||
        data?.caseId ||
        data?.id ||
        data?.extracted?.case_id ||
        data?.extracted?.id;

      if (!newCaseId) {
        throw new Error("El análisis se completó, pero no se recibió número de expediente.");
      }

      nav(`/resumen?case=${encodeURIComponent(newCaseId)}`);
    } catch (e) {
      setErr(e.message || "Error al subir el documento.");
    } finally {
      setLoading(false);
    }
  }

  async function continueCase() {
    const clean = caseId.trim();

    if (!clean) {
      setErr("Introduce el número de expediente o el código interno para continuar.");
      return;
    }

    setErr("");
    setLoading(true);

    try {
      let data;

      // Si es case_id interno UUID, usamos la ruta que YA existe y funciona:
      // /cases/{case_id}/public-status
      if (looksLikeUuid(clean)) {
        data = await fetchPublicStatusWithFallback(clean);
      } else {
        // Si es número administrativo, usamos el buscador nuevo del backend.
        // Si todavía no está desplegado, mostrará error claro.
        data = await fetchContinueLookupWithFallback(clean);
      }

      const caseKey = data?.case_id || data?.id || clean;
      const phase = getCasePhase(data);

      if (phase === "authorize") {
        nav(`/autorizar?case=${encodeURIComponent(caseKey)}`);
        return;
      }

      if (phase === "pay") {
        // No existe ruta /pagar en App.jsx. El pago se inicia desde ResumenExpediente.
        nav(`/resumen?case=${encodeURIComponent(caseKey)}`);
        return;
      }

      if (phase === "status") {
        nav(`/estado-expediente?case=${encodeURIComponent(caseKey)}`);
        return;
      }

      nav(`/resumen?case=${encodeURIComponent(caseKey)}`);
    } catch (e) {
      setErr(e?.message || "No se pudo recuperar el expediente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Seo
        title="Recurrir multas de tráfico · RecurreTuMulta"
        description="Sube tu multa, la analizamos y, si merece la pena, preparamos y presentamos el recurso por ti."
        canonical="https://www.recurretumulta.eu/"
      />

      <main className="rtm-home" style={{ background: "#f8fafc", minHeight: "calc(100vh - 120px)" }}>
        <section
          className="rtm-home-hero"
          style={{
            background: "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #0f766e 100%)",
            color: "#fff",
          }}
        >
          <div className="sr-container" style={{ maxWidth: 1120, margin: "0 auto" }}>
            <div className="rtm-home-hero-grid">
              <div className="rtm-home-copy">
                <div
                  style={{
                    display: "inline-flex",
                    padding: "7px 12px",
                    borderRadius: 999,
                    background: "rgba(255,255,255,0.14)",
                    border: "1px solid rgba(255,255,255,0.24)",
                    fontWeight: 800,
                    marginBottom: 18,
                  }}
                >
                  Revisión inicial gratuita
                </div>

                <h1
                  style={{
                    fontSize: "clamp(34px, 5vw, 58px)",
                    lineHeight: 1.04,
                    margin: "0 0 18px",
                    letterSpacing: "-0.04em",
                    fontWeight: 950,
                  }}
                >
                  ¿Te ha llegado una multa de tráfico?
                </h1>

                <p
                  style={{
                    fontSize: 20,
                    lineHeight: 1.55,
                    margin: "0 0 24px",
                    color: "rgba(255,255,255,0.88)",
                    maxWidth: 690,
                  }}
                >
                  Súbela y la revisamos. Si se puede defender bien, preparamos el recurso
                  adaptado a tu caso y lo presentamos en tu nombre con autorización previa.
                </p>

                <div className="rtm-home-benefits">
                  {[
                    "Análisis completo",
                    "Recurso adaptado",
                    "Presentación incluida",
                  ].map((x) => (
                    <div
                      key={x}
                      style={{
                        background: "rgba(255,255,255,0.12)",
                        border: "1px solid rgba(255,255,255,0.20)",
                        borderRadius: 16,
                        padding: 14,
                        fontWeight: 850,
                      }}
                    >
                      ✔ {x}
                    </div>
                  ))}
                </div>
              </div>

              <div
                className="rtm-home-upload-card"
                style={{
                  background: "#fff",
                  color: "#0f172a",
                  boxShadow: "0 24px 70px rgba(15,23,42,0.30)",
                }}
              >
                <h2 style={{ fontSize: 26, margin: "0 0 8px", fontWeight: 950 }}>
                  Sube tu multa
                </h2>

                <p style={{ color: "#64748b", lineHeight: 1.5, marginBottom: 18 }}>
                  Sube una foto o captura de la multa. Si pesa mucho, la preparamos automáticamente antes de enviarla.
                </p>

                <label
                  style={{
                    display: "block",
                    border: "2px dashed #cbd5e1",
                    borderRadius: 18,
                    padding: 22,
                    textAlign: "center",
                    background: "#f8fafc",
                    cursor: "pointer",
                    marginBottom: 14,
                  }}
                >
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp,image/*,.pdf"
                    onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
                    style={{ display: "none" }}
                  />

                  <div style={{ fontSize: 34, marginBottom: 8 }}>📄</div>
                  <div style={{ fontWeight: 900 }}>
                    {file ? file.name : "Seleccionar documento"}
                  </div>
                  <div style={{ color: "#64748b", fontSize: 14, marginTop: 4 }}>
                    Multa, notificación o resolución
                  </div>

                  {uploadInfo ? (
                    <div style={{ color: "#166534", fontSize: 13, marginTop: 8, fontWeight: 800 }}>
                      Archivo preparado: {formatBytes(uploadInfo.originalSize)} → {formatBytes(uploadInfo.finalSize)}
                    </div>
                  ) : null}
                </label>

                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={loading || preparing}
                  style={{
                    width: "100%",
                    border: 0,
                    borderRadius: 14,
                    padding: "15px 18px",
                    background: loading ? "#64748b" : "#16a34a",
                    color: "#fff",
                    fontWeight: 950,
                    fontSize: 17,
                    cursor: loading ? "not-allowed" : "pointer",
                    boxShadow: "0 14px 28px rgba(22,163,74,0.28)",
                  }}
                >
                  {preparing ? "Preparando imagen…" : loading ? "Analizando…" : "Analizar multa gratis"}
                </button>

                <div style={{ marginTop: 14, color: "#64748b", fontSize: 14, lineHeight: 1.45 }}>
                  Sin compromiso. Si no merece la pena recurrirla, te lo decimos claro.
                </div>

                <div
                  style={{
                    marginTop: 16,
                    background: "#fffbeb",
                    border: "1px solid #f59e0b",
                    borderRadius: 14,
                    padding: 14,
                    color: "#92400e",
                    lineHeight: 1.55,
                    fontSize: 14,
                  }}
                >
                  <div style={{ fontWeight: 900, marginBottom: 8 }}>
                    ⚠ IMPORTANTE
                  </div>

                  <div>
                    En la mayoría de multas de tráfico, si decides presentar alegaciones o recursos administrativos perderás el derecho al descuento del 50% por pronto pago.
                  </div>

                  <div style={{ marginTop: 8 }}>
                    Si pagas la multa con reducción, normalmente renuncias a continuar el procedimiento administrativo de recurso.
                  </div>
                </div>



                {err ? (
                  <div
                    style={{
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 12,
                      background: "#fef2f2",
                      color: "#991b1b",
                      fontWeight: 700,
                    }}
                  >
                    {err}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section style={{ padding: "34px 20px" }}>
          <div className="sr-container" style={{ maxWidth: 1120, margin: "0 auto" }}>
            <div className="rtm-home-services-grid">
              <div
                className="rtm-home-card"
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 12px 34px rgba(15,23,42,0.06)",
                }}
              >
                <h2 style={{ marginTop: 0, fontSize: 28, fontWeight: 950 }}>
                  ¿Qué incluye el servicio?
                </h2>

                <div style={{ display: "grid", gap: 14 }}>
                  {[
                    "Análisis completo de la multa o expediente.",
                    "Detección de errores, defectos de prueba o problemas de motivación.",
                    "Preparación del recurso adaptado al caso.",
                    "Presentación del recurso en tu nombre con autorización previa.",
                    "Seguimiento del recurso y plazos.",
                    "Justificante oficial de presentación.",
                  ].map((item) => (
                    <div
                      key={item}
                      style={{
                        display: "flex",
                        gap: 12,
                        alignItems: "flex-start",
                        fontSize: 16,
                        lineHeight: 1.45,
                      }}
                    >
                      <span
                        style={{
                          minWidth: 26,
                          height: 26,
                          borderRadius: 999,
                          background: "#dcfce7",
                          color: "#166534",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: 950,
                        }}
                      >
                        ✓
                      </span>
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div
                className="rtm-home-card"
                style={{
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  boxShadow: "0 12px 34px rgba(15,23,42,0.06)",
                }}
              >
                <h2 style={{ marginTop: 0, fontSize: 24, fontWeight: 950 }}>
                  Continuar expediente
                </h2>

                <p style={{ color: "#64748b", lineHeight: 1.5 }}>
                  Si ya tienes un expediente iniciado, introduce el número administrativo o el código interno y te llevaremos al punto exacto donde lo dejaste: autorización, pago o seguimiento.
                </p>

                <input
                  value={caseId}
                  onChange={(e) => setCaseId(e.target.value)}
                  placeholder="Ej. 025100670720 o código interno"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    border: "1px solid #cbd5e1",
                    borderRadius: 14,
                    padding: "14px 15px",
                    fontSize: 16,
                    marginBottom: 12,
                  }}
                />

                <button
                  type="button"
                  onClick={continueCase}
                  style={{
                    width: "100%",
                    border: 0,
                    borderRadius: 14,
                    padding: "14px 18px",
                    background: "#0f172a",
                    color: "#fff",
                    fontWeight: 950,
                    cursor: "pointer",
                  }}
                >
                  Continuar expediente
                </button>

                <div style={{ color: "#64748b", fontSize: 13, marginTop: 12, lineHeight: 1.45 }}>
                  Útil si cerraste la página, falta pagar, falta autorización o quieres ver el estado. No te mandará a subir documentos salvo que entres expresamente por añadir documento.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section style={{ padding: "10px 20px 54px" }}>
          <div className="sr-container" style={{ maxWidth: 1120, margin: "0 auto" }}>
            <div
              className="rtm-home-steps"
              style={{
                background: "#0f172a",
                color: "#fff",
              }}
            >
              {[
                ["1", "Sube la multa", "Analizamos el documento y localizamos posibles defectos."],
                ["2", "Decidimos si compensa", "Si no vemos recorrido, te lo decimos sin venderte nada."],
                ["3", "Recurso y presentación", "Con autorización, preparamos y presentamos el escrito."],
              ].map(([num, title, text]) => (
                <div key={num}>
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 12,
                      background: "#16a34a",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: 950,
                      marginBottom: 12,
                    }}
                  >
                    {num}
                  </div>
                  <div style={{ fontWeight: 950, fontSize: 18, marginBottom: 6 }}>{title}</div>
                  <div style={{ color: "rgba(255,255,255,0.76)", lineHeight: 1.5 }}>{text}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
