import { useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";

const SERVICES = [
  {
    icon: "🚗",
    title: "Recurrir una multa",
    text: "¿Ha recibido una multa o sanción? Envíenos la notificación y revisaremos su caso para explicarle qué opciones tiene.",
    action: "Revisar mi multa",
    to: "/iniciar-expediente/traffic/fine?family=trafico",
    available: true,
  },
  {
    icon: "♻️",
    title: "Eliminar un vehículo",
    text: "Si tiene un vehículo que ya no usa, está parado o continúa generándole problemas, le ayudamos a estudiar cómo resolver la situación.",
    action: "Ver opciones para mi vehículo",
    to: "/eliminar-coche",
    available: true,
  },
  {
    icon: "📄",
    title: "Otros trámites de tráfico",
    text: "¿Su problema no encaja en los anteriores? Cuéntenos qué ocurre con su vehículo, la DGT o un trámite de tráfico y le orientaremos.",
    action: "Contarnos qué ocurre",
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
                Cuéntenos qué ocurre. Le ayudamos a encontrar el camino.
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
                Una multa, un vehículo que ya no utiliza o un trámite que no sabe cómo resolver.
                Empiece por elegir la opción que más se parece a su caso.
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

        <section style={{ padding: "34px 20px 0", background: "#f8fafc" }}>
          <div
            className="sr-container"
            style={{
              maxWidth: 900,
              margin: "0 auto",
              padding: "24px 26px",
              borderRadius: 22,
              background: "#fff",
              border: "1px solid #e2e8f0",
              boxShadow: "0 10px 28px rgba(15,23,42,.05)",
              textAlign: "center",
            }}
          >
            <div style={{ fontSize: 28, marginBottom: 8 }}>🤝</div>
            <h2 style={{ margin: "0 0 9px", fontSize: 22, color: "#0f172a" }}>
              No necesita saber qué trámite corresponde
            </h2>
            <p
              style={{
                margin: "0 auto",
                maxWidth: 720,
                color: "#64748b",
                lineHeight: 1.65,
                fontSize: 16,
              }}
            >
              Si no tiene claro qué debe hacer, empiece por la opción que más se acerque
              a su problema. La documentación y los datos del caso nos ayudarán a orientarle.
            </p>
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
                ["1", "Cuéntenos el problema", "Elija la opción que más se parece a su situación y facilite los datos básicos."],
                ["2", "Revisamos su caso", "Adjunte el documento principal y todo lo que tenga relacionado. Nosotros revisaremos qué es importante."],
                ["3", "Le explicamos los siguientes pasos", "Sabrá qué podemos hacer y podrá continuar con la gestión cuando corresponda."],
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
