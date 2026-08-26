import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { PUBLIC_SERVICE_FAMILIES } from "../data/publicServices.js";

const API = "/api";
const DIRECT_BACKEND = "https://recurretumulta-backend.onrender.com";
const API_CANDIDATES = [
  import.meta.env.VITE_API_BASE_URL,
  import.meta.env.VITE_API_URL,
  DIRECT_BACKEND,
  API,
].filter(Boolean);

async function parseResponse(response) {
  const text = await response.text().catch(() => "");
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const detail =
      data?.detail ||
      data?.message ||
      data?.error ||
      text ||
      `HTTP ${response.status}`;

    throw new Error(
      typeof detail === "string"
        ? `HTTP ${response.status}: ${detail}`
        : `HTTP ${response.status}`
    );
  }

  return data;
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
      return await parseResponse(response);
    } catch (error) {
      errors.push(`${url} → ${error?.message || "error"}`);
    }
  }

  throw new Error(`No se pudo recuperar el expediente. ${errors.join(" | ")}`);
}

async function fetchContinueLookupWithFallback(caseIdOrExpediente) {
  const errors = [];

  for (const base of API_CANDIDATES) {
    const cleanBase = String(base).replace(/\/$/, "");
    const url = `${cleanBase}/cases/continue-lookup?q=${encodeURIComponent(
      caseIdOrExpediente
    )}`;

    try {
      const response = await fetch(url, { method: "GET" });
      return await parseResponse(response);
    } catch (error) {
      errors.push(`${url} → ${error?.message || "error"}`);
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

const SERVICES = PUBLIC_SERVICE_FAMILIES;

const BENEFITS = [
  "Expediente digital y documentación organizada.",
  "Seguimiento online del estado del caso.",
  "Información clara y sin falsas expectativas.",
  "Presupuesto previo cuando la actuación lo requiera.",
  "Tecnología para agilizar la recepción y el análisis.",
  "Profesionales cuando sea necesario.",
];

const STEPS = [
  {
    number: "1",
    title: "Cuéntenos qué ha ocurrido",
    text: "Seleccione el servicio y envíenos la información y los documentos disponibles.",
  },
  {
    number: "2",
    title: "Analizamos el expediente",
    text: "Ordenamos la documentación y revisamos las posibles vías de actuación.",
  },
  {
    number: "3",
    title: "Le proponemos la estrategia",
    text: "Le explicamos las opciones y, si desea continuar, gestionamos el procedimiento.",
  },
];

export default function InicioRTM() {
  const navigate = useNavigate();
  const [caseId, setCaseId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function continueCase() {
    const clean = caseId.trim();

    if (!clean) {
      setError("Introduce el número de expediente o el código interno.");
      return;
    }

    setError("");
    setLoading(true);

    try {
      const data = looksLikeUuid(clean)
        ? await fetchPublicStatusWithFallback(clean)
        : await fetchContinueLookupWithFallback(clean);

      const caseKey = data?.case_id || data?.id || clean;
      const phase = getCasePhase(data);

      if (phase === "authorize") {
        navigate(`/autorizar?case=${encodeURIComponent(caseKey)}`);
        return;
      }

      if (phase === "status") {
        navigate(`/estado-expediente?case=${encodeURIComponent(caseKey)}`);
        return;
      }

      navigate(`/resumen?case=${encodeURIComponent(caseKey)}`);
    } catch (err) {
      setError(err?.message || "No se pudo recuperar el expediente.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Seo
        title="RTM · Resuelve tus movidas"
        description="RTM ayuda a comprender y gestionar problemas de tráfico, viajes, deudas y trámites con la Administración. También cubre bancos, energía, telecomunicaciones, seguros y consultas de vivienda."
        canonical="https://www.recurretumulta.eu/"
      />

      <main
        className="rtm-home"
        style={{
          minHeight: "calc(100vh - 120px)",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <section className="rtm-home-hero rtm-home-hero--catalog">
          <span className="rtm-home-hero-glow rtm-home-hero-glow--one" aria-hidden="true" />
          <span className="rtm-home-hero-glow rtm-home-hero-glow--two" aria-hidden="true" />
          <div className="sr-container rtm-home-hero-content">
            <div className="rtm-home-hero-badge">RTM · Resuelve tus movidas</div>
            <h1>Tu problema tiene un primer paso más claro.</h1>
            <p>
              Elige el área que mejor se parece a tu caso. Ordenamos la información,
              explicamos la vía disponible y evitamos prometer una gestión que todavía
              no existe.
            </p>
            <div className="rtm-home-hero-actions">
              <a href="#servicios-publicos">Explorar las 9 áreas</a>
              <Link to="/iniciar-expediente">Iniciar una revisión</Link>
            </div>
            <div className="rtm-home-hero-trust" aria-label="Cómo trabaja RTM">
              <span>✓ Expediente digital</span>
              <span>✓ Información clara</span>
              <span>✓ Decides cómo continuar</span>
            </div>
          </div>
        </section>

        <section id="servicios-publicos" className="rtm-home-catalog-section">
          <div className="sr-container rtm-home-catalog-container">
            <header className="rtm-home-catalog-heading">
              <span>Nueve familias públicas</span>
              <h2>¿En qué asunto necesita ayuda?</h2>
              <p>
                Seleccione el área relacionada con su problema. Todas parten del mismo
                catálogo: si el backend admite un expediente, abrimos el tipo real; si
                no, le llevamos primero a una consulta de encaje.
              </p>
            </header>

            <div className="rtm-home-family-grid">
              {SERVICES.map((service, index) => (
                <article
                  className="rtm-home-family-card"
                  key={service.id}
                  style={{ "--family-delay": `${index * 40}ms` }}
                >
                  <div className="rtm-home-family-icon" aria-hidden="true">
                    {service.icon}
                  </div>
                  <div className="rtm-home-family-meta">
                    <span>
                      {service.entryMode === "consultation"
                        ? "Consulta de encaje"
                        : "Servicio público"}
                    </span>
                  </div>
                  <h3>{service.title}</h3>
                  <p>{service.summary}</p>
                  <Link to={service.path}>
                    {service.action} <span aria-hidden="true">→</span>
                  </Link>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: "42px 20px 20px" }}>
          <div className="sr-container" style={{ maxWidth: 1120, margin: "0 auto" }}>
            <div
              className="rtm-home-services-grid"
              style={{
                display: "grid",
                gridTemplateColumns: "minmax(0, 1.12fr) minmax(320px, .88fr)",
                gap: 20,
                alignItems: "stretch",
              }}
            >
              <article
                className="rtm-home-card"
                style={{
                  padding: 28,
                  border: "1px solid #e2e8f0",
                  borderRadius: 24,
                  background: "#fff",
                  boxShadow: "0 12px 34px rgba(15,23,42,.06)",
                }}
              >
                <h2 style={{ margin: "0 0 20px", fontSize: 30, fontWeight: 950 }}>
                  ¿Por qué RTM?
                </h2>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
                    gap: 14,
                  }}
                >
                  {BENEFITS.map((benefit) => (
                    <div
                      key={benefit}
                      style={{
                        display: "flex",
                        gap: 11,
                        alignItems: "flex-start",
                        padding: 14,
                        borderRadius: 16,
                        background: "#f8fafc",
                        lineHeight: 1.45,
                      }}
                    >
                      <span
                        style={{
                          minWidth: 27,
                          height: 27,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: 999,
                          background: "#dcfce7",
                          color: "#166534",
                          fontWeight: 950,
                        }}
                      >
                        ✓
                      </span>
                      <span>{benefit}</span>
                    </div>
                  ))}
                </div>
              </article>

              <article
                className="rtm-home-card"
                style={{
                  padding: 28,
                  border: "1px solid #e2e8f0",
                  borderRadius: 24,
                  background: "#fff",
                  boxShadow: "0 12px 34px rgba(15,23,42,.06)",
                }}
              >
                <h2 style={{ margin: "0 0 10px", fontSize: 26, fontWeight: 950 }}>
                  Recuperar expediente
                </h2>

                <p style={{ margin: "0 0 18px", color: "#64748b", lineHeight: 1.55 }}>
                  Introduzca el número administrativo o el código interno y le
                  llevaremos al punto exacto donde dejó el expediente.
                </p>

                <input
                  value={caseId}
                  onChange={(event) => setCaseId(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") continueCase();
                  }}
                  placeholder="Número de expediente o código interno"
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    marginBottom: 12,
                    padding: "14px 15px",
                    border: "1px solid #cbd5e1",
                    borderRadius: 14,
                    fontSize: 16,
                  }}
                />

                <button
                  type="button"
                  onClick={continueCase}
                  disabled={loading}
                  style={{
                    width: "100%",
                    minHeight: 48,
                    padding: "14px 18px",
                    border: 0,
                    borderRadius: 14,
                    background: loading ? "#64748b" : "#0f172a",
                    color: "#fff",
                    fontWeight: 950,
                    cursor: loading ? "not-allowed" : "pointer",
                  }}
                >
                  {loading ? "Buscando expediente…" : "Continuar expediente"}
                </button>

                <div
                  style={{
                    marginTop: 12,
                    color: "#64748b",
                    fontSize: 13,
                    lineHeight: 1.45,
                  }}
                >
                  Útil si falta la autorización, el pago o desea consultar el estado.
                </div>

                {error ? (
                  <div
                    role="alert"
                    style={{
                      marginTop: 14,
                      padding: 12,
                      borderRadius: 12,
                      background: "#fef2f2",
                      color: "#991b1b",
                      fontWeight: 750,
                      lineHeight: 1.4,
                    }}
                  >
                    {error}
                  </div>
                ) : null}
              </article>
            </div>
          </div>
        </section>

        <section style={{ padding: "24px 20px 62px" }}>
          <div className="sr-container" style={{ maxWidth: 1120, margin: "0 auto" }}>
            <div
              className="rtm-home-steps"
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                gap: 20,
                padding: 30,
                borderRadius: 26,
                background: "#0f172a",
                color: "#fff",
              }}
            >
              {STEPS.map((step) => (
                <article key={step.number}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 13,
                      borderRadius: 12,
                      background: "#16a34a",
                      fontWeight: 950,
                    }}
                  >
                    {step.number}
                  </div>

                  <h2 style={{ margin: "0 0 7px", fontSize: 20, fontWeight: 950 }}>
                    {step.title}
                  </h2>

                  <p
                    style={{
                      margin: 0,
                      color: "rgba(255,255,255,.76)",
                      lineHeight: 1.55,
                    }}
                  >
                    {step.text}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
