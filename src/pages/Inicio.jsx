import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { RTM_API_CANDIDATES } from "../lib/api.js";

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

  for (const base of RTM_API_CANDIDATES) {
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

  for (const base of RTM_API_CANDIDATES) {
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

const SERVICES = [
  {
    icon: "🚗",
    title: "Tráfico",
    text: "Multas, sanciones, vehículos y otros trámites relacionados.",
    action: "Ver servicios de tráfico",
    to: "/trafico",
  },
  {
    icon: "💳",
    title: "Deudas y morosidad",
    text: "ASNEF, ficheros de morosidad e incidencias relacionadas con crédito.",
    action: "Comprobar mi situación",
    to: "/asnef",
  },
  {
    icon: "🏛️",
    title: "Administración y organismos públicos",
    text: "Hacienda, Seguridad Social, ayuntamientos, comunidades autónomas y otros organismos.",
    action: "Enviar mi caso",
    to: "/administracion",
  },
  {
    icon: "📂",
    title: "No encuentro mi caso",
    text: "Envíenos la documentación y revisaremos si podemos ayudarle.",
    action: "Consultar mi caso",
    to: "/otros-procedimientos",
  },
];

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
        title="RTM · Procedimientos jurídicos y administrativos"
        description="RTM le ayuda a gestionar multas, deudas, reclamaciones y procedimientos frente a administraciones y organismos."
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
        <section
          className="rtm-home-hero"
          style={{
            padding: "72px 20px 64px",
            color: "#fff",
            background:
              "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #0f766e 100%)",
          }}
        >
          <div className="sr-container" style={{ maxWidth: 1120, margin: "0 auto" }}>
            <div style={{ maxWidth: 850, margin: "0 auto 38px", textAlign: "center" }}>
              <div
                style={{
                  display: "inline-flex",
                  padding: "7px 13px",
                  marginBottom: 18,
                  borderRadius: 999,
                  background: "rgba(255,255,255,.14)",
                  border: "1px solid rgba(255,255,255,.24)",
                  fontWeight: 850,
                }}
              >
                Plataforma RTM
              </div>

              <h1
                style={{
                  margin: "0 0 18px",
                  fontSize: "clamp(38px, 6vw, 66px)",
                  lineHeight: 1.03,
                  letterSpacing: "-.045em",
                  fontWeight: 950,
                }}
              >
                ¿Qué problema necesita resolver?
              </h1>

              <p
                style={{
                  maxWidth: 760,
                  margin: "0 auto",
                  fontSize: "clamp(18px, 2vw, 21px)",
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,.88)",
                }}
              >
                Seleccione el servicio que necesita o envíenos la documentación.
                Estudiaremos su caso y le indicaremos la forma más adecuada de actuar.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(235px, 1fr))",
                gap: 18,
              }}
            >
              {SERVICES.map((service) => (
                <article
                  key={service.title}
                  style={{
                    display: "flex",
                    minHeight: 270,
                    padding: 24,
                    flexDirection: "column",
                    borderRadius: 24,
                    background: "#fff",
                    color: "#0f172a",
                    boxShadow: "0 20px 55px rgba(15,23,42,.25)",
                  }}
                >
                  <div style={{ fontSize: 39, marginBottom: 16 }}>{service.icon}</div>

                  <h2
                    style={{
                      margin: "0 0 10px",
                      fontSize: 25,
                      lineHeight: 1.15,
                      fontWeight: 950,
                    }}
                  >
                    {service.title}
                  </h2>

                  <p
                    style={{
                      margin: "0 0 22px",
                      color: "#64748b",
                      lineHeight: 1.55,
                      flexGrow: 1,
                    }}
                  >
                    {service.text}
                  </p>

                  <button
                    type="button"
                    onClick={() => navigate(service.to)}
                    style={{
                      width: "100%",
                      minHeight: 48,
                      padding: "13px 16px",
                      border: 0,
                      borderRadius: 13,
                      background: "#16a34a",
                      color: "#fff",
                      fontSize: 16,
                      fontWeight: 950,
                      cursor: "pointer",
                      boxShadow: "0 12px 24px rgba(22,163,74,.22)",
                    }}
                  >
                    {service.action}
                  </button>
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
