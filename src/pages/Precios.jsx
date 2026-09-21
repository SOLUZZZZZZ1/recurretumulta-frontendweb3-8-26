import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import {
  fetchPublicReviewPrices,
  formatPublicReviewPrice,
  illustrativeFineAppealBalance,
} from "../lib/publicReviewPrices.js";

const REVIEW_OPTIONS = [
  {
    icon: "🚗",
    title: "Multas y vehículos",
    service: "traffic",
    text: "Revisión inicial de la documentación y de la situación del expediente.",
    to: "/trafico",
    action: "Ver Multas y vehículos",
  },
  {
    icon: "💳",
    title: "Deudas y morosidad",
    service: "debt",
    text: "Revisión inicial de inclusiones en ficheros de morosidad y problemas relacionados con deudas.",
    to: "/morosidad",
    action: "Ver Deudas y morosidad",
  },
  {
    icon: "🏛️",
    title: "Administración pública",
    service: "administration",
    text: "Revisión inicial de expedientes frente a administraciones y organismos públicos.",
    to: "/administracion",
    action: "Ver Administración",
  },
  {
    icon: "🛒",
    title: "Reclamaciones de consumo",
    service: "claims",
    label: "Estudio inicial del caso",
    text: "Estudiamos la documentación y el encaje de asuntos relacionados con bancos, energía, telecomunicaciones, seguros, viajes y otros servicios de consumo.",
    to: "/iniciar-expediente",
    action: "Elegir área de consumo",
  },
];

export default function Precios() {
  const [catalog, setCatalog] = useState(null);
  const [loadingPrices, setLoadingPrices] = useState(true);
  const [priceError, setPriceError] = useState(false);
  const [priceAttempt, setPriceAttempt] = useState(0);
  const prices = catalog?.reviewPrices;
  const fineAppealOffer = catalog?.fineAppealOffer;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setCatalog(null);
    setLoadingPrices(true);
    setPriceError(false);
    const timeout = setTimeout(() => controller.abort(), 15000);

    fetchPublicReviewPrices({ signal: controller.signal })
      .then((catalog) => {
        if (active) setCatalog(catalog);
      })
      .catch(() => {
        if (active) setPriceError(true);
      })
      .finally(() => {
        clearTimeout(timeout);
        if (active) setLoadingPrices(false);
      });

    return () => {
      active = false;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [priceAttempt]);

  return (
    <>
      <Seo
        title="Precios · RTM"
        description="Consulta las tarifas de revisión inicial y cómo se informa cualquier precio o presupuesto posterior antes de contratar."
      />

      <main
        style={{
          minHeight: "calc(100vh - 120px)",
          padding: "54px 20px 70px",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <div style={{ width: "100%", maxWidth: 1120, margin: "0 auto" }}>
          <header
            style={{
              maxWidth: 780,
              margin: "0 auto 34px",
              textAlign: "center",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                marginBottom: 15,
                padding: "7px 12px",
                borderRadius: 999,
                background: "#dbeafe",
                color: "#1d4ed8",
                fontSize: 14,
                fontWeight: 850,
              }}
            >
              Tarifas RTM
            </span>

            <h1
              style={{
                margin: "0 0 14px",
                fontSize: "clamp(36px, 5vw, 58px)",
                lineHeight: 1.04,
                letterSpacing: "-.04em",
                fontWeight: 950,
              }}
            >
              Empieza por una revisión inicial
            </h1>

            <p
              style={{
                margin: 0,
                color: "#64748b",
                fontSize: "clamp(17px, 2vw, 20px)",
                lineHeight: 1.6,
              }}
            >
              Primero revisamos el expediente. Si existe una vía razonable de
              actuación, podrás decidir si quieres continuar con la gestión.
            </p>
            <p style={{ margin: "14px 0 0", color: "#475569", lineHeight: 1.6 }}>
              Estas tarifas corresponden a la revisión o al estudio inicial.
              Confirmaremos el precio de tu expediente antes del pago.
            </p>
          </header>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(245px, 100%), 1fr))",
              gap: 18,
              alignItems: "stretch",
            }}
          >
            {REVIEW_OPTIONS.map((item) => (
              <article
                key={item.title}
                style={{
                  display: "flex",
                  minHeight: 330,
                  padding: 25,
                  flexDirection: "column",
                  border: "1px solid #dbeafe",
                  borderRadius: 24,
                  background: "#fff",
                  boxShadow: "0 16px 42px rgba(15,23,42,.08)",
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    width: 50,
                    height: 50,
                    display: "grid",
                    placeItems: "center",
                    marginBottom: 17,
                    borderRadius: 15,
                    background: "#eff6ff",
                    fontSize: 27,
                  }}
                >
                  {item.icon}
                </div>

                <h2
                  style={{
                    margin: "0 0 9px",
                    fontSize: 25,
                    lineHeight: 1.15,
                    fontWeight: 950,
                  }}
                >
                  {item.title}
                </h2>

                <div
                  aria-live="polite"
                  aria-busy={loadingPrices}
                  style={{
                    margin: "5px 0 14px",
                    color: "#0b4aa2",
                    fontSize: prices ? "clamp(32px, 4vw, 42px)" : "clamp(17px, 2vw, 21px)",
                    lineHeight: 1.2,
                    fontWeight: 950,
                  }}
                >
                  {loadingPrices
                    ? "Consultando tarifa…"
                    : prices
                      ? formatPublicReviewPrice(prices[item.service])
                      : "Tarifa no disponible"}
                </div>

                <div
                  style={{
                    marginBottom: 15,
                    color: "#475569",
                    fontSize: 14,
                    fontWeight: 800,
                  }}
                >
                  {item.label || "Revisión Inicial del Expediente"}
                </div>

                <p
                  style={{
                    margin: "0 0 22px",
                    color: "#64748b",
                    lineHeight: 1.55,
                    flexGrow: 1,
                  }}
                >
                  {item.text}
                </p>

                <Link
                  to={item.to}
                  style={{
                    minHeight: 48,
                    padding: "13px 15px",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    borderRadius: 13,
                    background: "#2bb673",
                    color: "#fff",
                    textDecoration: "none",
                    textAlign: "center",
                    fontWeight: 900,
                  }}
                >
                  {item.action}
                </Link>
              </article>
            ))}
          </section>

          {priceError && (
            <div style={{ marginTop: 18, color: "#475569", textAlign: "center" }}>
              <p role="status">No hemos podido consultar las tarifas. Puedes seguir explorando los servicios.</p>
              <button
                type="button"
                onClick={() => setPriceAttempt((attempt) => attempt + 1)}
                style={{ padding: "10px 16px", border: "1px solid #0b4aa2", borderRadius: 10, background: "#fff", color: "#0b4aa2", cursor: "pointer", fontWeight: 800 }}
              >
                Reintentar tarifas
              </button>
            </div>
          )}

          <section
            style={{
              marginTop: 22,
              padding: 27,
              border: "1px solid #bfdbfe",
              borderRadius: 24,
              background: "#eff6ff",
            }}
          >
            <h2
              style={{
                margin: "0 0 10px",
                fontSize: 26,
                fontWeight: 950,
              }}
            >
              Si decides continuar
            </h2>

            <p
              style={{
                margin: 0,
                color: "#334155",
                fontSize: 17,
                lineHeight: 1.6,
              }}
            >
              El importe abonado por la revisión o el estudio inicial se descontará íntegramente del precio o presupuesto
              de la gestión que aceptes si decides continuar.
            </p>
          </section>

          <section
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(280px, 100%), 1fr))",
              gap: 18,
              marginTop: 22,
            }}
          >
            <article
              style={{
                padding: 26,
                border: "1px solid #e2e8f0",
                borderRadius: 22,
                background: "#fff",
              }}
            >
              <span style={{ fontSize: 28 }} aria-hidden="true">
                📄
              </span>
              <h2 style={{ margin: "12px 0 9px", fontSize: 23, fontWeight: 950 }}>
                Recurso administrativo de multa
              </h2>
              <div
                aria-live="polite"
                aria-busy={loadingPrices}
                style={{
                  marginBottom: 12,
                  color: "#0b4aa2",
                  fontSize: fineAppealOffer ? "clamp(32px, 4vw, 42px)" : "clamp(17px, 2vw, 21px)",
                  fontWeight: 950,
                }}
              >
                {loadingPrices
                  ? "Consultando tarifa…"
                  : fineAppealOffer
                    ? formatPublicReviewPrice(fineAppealOffer)
                    : "Tarifa no disponible"}
              </div>
              {fineAppealOffer && (
                <>
                  <p style={{ margin: "0 0 10px", color: "#334155", lineHeight: 1.55 }}>
                    Precio total, incluida la revisión inicial de {formatPublicReviewPrice(prices.traffic)}, a cuenta del total.
                  </p>
                  <p style={{ margin: "0 0 10px", color: "#334155", lineHeight: 1.55 }}>
                    Si ya has pagado {formatPublicReviewPrice(prices.traffic)}, quedarían {formatPublicReviewPrice(illustrativeFineAppealBalance(catalog))}.
                  </p>
                  <p style={{ margin: "0 0 10px", color: "#64748b", lineHeight: 1.55 }}>
                    La revisión se descuenta una sola vez, cuando el pago conste confirmado en tu expediente.
                  </p>
                </>
              )}
              <p style={{ margin: 0, color: "#64748b", lineHeight: 1.55 }}>
                Confirmaremos el importe pendiente antes de contratar esta actuación.
              </p>
            </article>

            <article
              style={{
                padding: 26,
                border: "1px solid #e2e8f0",
                borderRadius: 22,
                background: "#fff",
              }}
            >
              <span style={{ fontSize: 28 }} aria-hidden="true">
                ⚖️
              </span>
              <h2 style={{ margin: "12px 0 9px", fontSize: 23, fontWeight: 950 }}>
                Actuaciones complejas
              </h2>
              <div
                style={{
                  marginBottom: 12,
                  color: "#0b4aa2",
                  fontSize: 27,
                  fontWeight: 950,
                }}
              >
                Presupuesto
              </div>
              <p style={{ margin: 0, color: "#64748b", lineHeight: 1.55 }}>
                Los procedimientos judiciales, contenciosos y las actuaciones
                que requieran un estudio específico se presupuestarán antes de
                iniciar la gestión.
              </p>
            </article>
          </section>

          <div
            style={{
              marginTop: 30,
              padding: 23,
              borderRadius: 20,
              background: "#0f172a",
              color: "#fff",
              textAlign: "center",
            }}
          >
            <strong
              style={{
                display: "block",
                marginBottom: 7,
                fontSize: 21,
              }}
            >
              Antes de pagar sabrás qué servicio estás contratando.
            </strong>
            <span style={{ color: "rgba(255,255,255,.76)", lineHeight: 1.5 }}>
              Cuando sea necesario un presupuesto, podrás revisarlo antes de
              decidir si continúas.
            </span>
          </div>
        </div>
      </main>
    </>
  );
}
