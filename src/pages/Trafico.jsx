import { useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";

const SERVICES = [
  {
    icon: "🚗",
    title: "Recurrir una multa",
    text: "Suba la multa o notificación. La analizaremos y le diremos con claridad si merece la pena recurrir.",
    action: "Analizar mi multa",
    to: "/iniciar-expediente/traffic/fine",
    available: true,
  },
  {
    icon: "♻️",
    title: "Eliminar un vehículo",
    text: "Gestión de baja o retirada de vehículos parados, sin uso o que siguen generando problemas.",
    action: "Iniciar la gestión",
    to: "/eliminar-coche",
    available: true,
  },
  {
    icon: "📄",
    title: "Otros trámites de tráfico",
    text: "Cambio de titularidad, comunicaciones de la DGT y otros asuntos relacionados con vehículos.",
    action: "Consultar mi caso",
    to: "/contacto",
    available: true,
  },
];

export default function Trafico() {
  const navigate = useNavigate();

  return (
    <>
      <Seo
        title="Tráfico, multas y vehículos · RTM"
        description="Acceda a los servicios RTM de multas, sanciones, baja de vehículos y otros trámites de tráfico."
        canonical="https://www.recurretumulta.eu/trafico"
      />

      <main
        style={{
          minHeight: "calc(100vh - 120px)",
          background: "#f8fafc",
          color: "#0f172a",
        }}
      >
        <section
          style={{
            padding: "70px 20px 62px",
            color: "#fff",
            background:
              "linear-gradient(135deg, #0f172a 0%, #1e3a8a 55%, #0f766e 100%)",
          }}
        >
          <div
            className="sr-container"
            style={{ maxWidth: 1120, margin: "0 auto" }}
          >
            <div
              style={{
                maxWidth: 820,
                margin: "0 auto 38px",
                textAlign: "center",
              }}
            >
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
                RTM · Tráfico
              </div>

              <h1
                style={{
                  margin: "0 0 18px",
                  fontSize: "clamp(38px, 6vw, 64px)",
                  lineHeight: 1.03,
                  letterSpacing: "-.045em",
                  fontWeight: 950,
                }}
              >
                ¿Qué necesita gestionar?
              </h1>

              <p
                style={{
                  maxWidth: 720,
                  margin: "0 auto",
                  fontSize: "clamp(18px, 2vw, 21px)",
                  lineHeight: 1.55,
                  color: "rgba(255,255,255,.88)",
                }}
              >
                Elija el servicio relacionado con su multa, vehículo o trámite
                de tráfico.
              </p>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
                gap: 20,
              }}
            >
              {SERVICES.map((service) => (
                <article
                  key={service.title}
                  style={{
                    minHeight: 300,
                    display: "flex",
                    flexDirection: "column",
                    padding: 26,
                    borderRadius: 24,
                    background: "#fff",
                    color: "#0f172a",
                    boxShadow: "0 20px 55px rgba(15,23,42,.25)",
                  }}
                >
                  <div style={{ fontSize: 42, marginBottom: 16 }}>
                    {service.icon}
                  </div>

                  <h2
                    style={{
                      margin: "0 0 11px",
                      fontSize: 27,
                      lineHeight: 1.15,
                      fontWeight: 950,
                    }}
                  >
                    {service.title}
                  </h2>

                  <p
                    style={{
                      margin: "0 0 24px",
                      color: "#64748b",
                      lineHeight: 1.58,
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
                      minHeight: 49,
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

        <section style={{ padding: "42px 20px 62px" }}>
          <div
            className="sr-container"
            style={{ maxWidth: 1120, margin: "0 auto" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(235px, 1fr))",
                gap: 18,
              }}
            >
              {[
                ["1", "Seleccione el servicio", "Entre en la gestión que corresponde a su caso."],
                ["2", "Envíe los datos", "Adjunte la documentación necesaria desde el móvil o el ordenador."],
                ["3", "Siga el expediente", "Consulte el estado y complete autorización o pago cuando corresponda."],
              ].map(([number, title, text]) => (
                <article
                  key={number}
                  style={{
                    padding: 24,
                    border: "1px solid #e2e8f0",
                    borderRadius: 22,
                    background: "#fff",
                    boxShadow: "0 10px 28px rgba(15,23,42,.05)",
                  }}
                >
                  <div
                    style={{
                      width: 39,
                      height: 39,
                      display: "grid",
                      placeItems: "center",
                      marginBottom: 13,
                      borderRadius: 12,
                      background: "#16a34a",
                      color: "#fff",
                      fontWeight: 950,
                    }}
                  >
                    {number}
                  </div>
                  <h2 style={{ margin: "0 0 8px", fontSize: 20 }}>
                    {title}
                  </h2>
                  <p style={{ margin: 0, color: "#64748b", lineHeight: 1.55 }}>
                    {text}
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
