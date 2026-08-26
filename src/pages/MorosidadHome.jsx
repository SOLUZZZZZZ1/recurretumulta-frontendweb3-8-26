import React from "react";
import { useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";

const CASES = [
  {
    icon: "📋",
    title: "ASNEF / Equifax",
    text: "Revisamos la inclusión, la deuda, las comunicaciones recibidas y la documentación disponible.",
    to: "/asnef",
  },
  {
    icon: "✅",
    title: "Deuda ya pagada",
    text: "Si la deuda se pagó pero la anotación continúa apareciendo, estudiamos la situación.",
    to: "/iniciar-expediente/debt/asnef_equifax?family=morosidad",
  },
  {
    icon: "👤",
    title: "Datos incorrectos",
    text: "Errores de identidad, importes o información que no coincide con tu situación.",
    to: "/iniciar-expediente/debt/asnef_equifax?family=morosidad",
  },
  {
    icon: "✉️",
    title: "Falta de comunicación",
    text: "Revisamos las comunicaciones y requerimientos relacionados con la inclusión.",
    to: "/iniciar-expediente/debt/asnef_equifax?family=morosidad",
  },
  {
    icon: "❓",
    title: "Deuda discutida",
    text: "Importes que no reconoces o sobre los que existe una discrepancia con el acreedor.",
    to: "/iniciar-expediente/debt/creditor_claim?family=morosidad",
  },
  {
    icon: "⚖️",
    title: "Reclamación al acreedor",
    text: "Estudiamos reclamaciones frente a acreedores o entidades relacionadas con la deuda.",
    to: "/iniciar-expediente/debt/creditor_claim?family=morosidad",
  },
];

const STEPS = [
  ["1", "Nos cuentas la situación", "Recogemos tus datos, la anotación y la documentación que tengas disponible."],
  ["2", "Revisamos la información", "Estudiamos el origen de la deuda, las comunicaciones y los datos del fichero."],
  ["3", "Te explicamos las opciones", "Te indicamos si vemos una vía razonable de actuación y qué puede faltar."],
  ["4", "Valoración y presupuesto", "Si procede una gestión posterior, conocerás antes su alcance y su coste."],
  ["5", "Actuamos si tú decides", "La gestión posterior solo comienza después de tu aceptación expresa."],
];

const TRUST = [
  ["🔎", "Primero revisamos", "No damos por hecho que una anotación sea correcta o incorrecta sin estudiar la documentación."],
  ["💬", "Información clara", "Te explicamos qué hemos encontrado y cuáles pueden ser los siguientes pasos."],
  ["🗂️", "Todo organizado", "La documentación y el seguimiento permanecen dentro de un único expediente RTM."],
  ["🔒", "Información protegida", "Tratamos la documentación con confidencialidad y trazabilidad."],
];

export default function MorosidadHome() {
  const navigate = useNavigate();

  return (
    <>
      <Seo
        title="Deudas y morosidad · ASNEF y Equifax · RTM"
        description="Revisión inicial de inclusiones en ASNEF, Equifax y otros ficheros de morosidad, deudas discutidas y reclamaciones frente a acreedores."
        canonical="https://www.recurretumulta.eu/morosidad"
      />

      <main style={{ background: "#f8fbff", color: "#0f172a" }}>
        <section style={{ padding: "66px 20px 58px", background: "linear-gradient(135deg,#eef5ff 0%,#ffffff 54%,#edf9f3 100%)" }}>
          <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))", gap: 38, alignItems: "center" }}>
            <div>
              <div style={badge}>💳 Deudas y morosidad</div>

              <h1 style={{ margin: "16px 0", fontSize: "clamp(40px,5.7vw,64px)", lineHeight: 1.03, letterSpacing: "-.045em", color: "#123b73" }}>
                Primero entendemos qué ocurre. <span style={{ color: "#159455" }}>Después vemos cómo actuar.</span>
              </h1>

              <p style={lead}>
                Si apareces en ASNEF, Equifax u otro fichero, o tienes un problema con una deuda o un acreedor, revisamos la documentación antes de proponerte una actuación.
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
                <span style={pill}>✓ Revisión antes de actuar</span>
                <span style={pill}>✓ Explicación clara</span>
                <span style={pill}>✓ Presupuesto previo si procede</span>
              </div>
            </div>

            <div style={heroVisual}>
              <div style={{ fontSize: 74 }}>📄</div>
              <div style={{ display: "flex", gap: 14, fontSize: 44, margin: "5px 0 18px" }}>
                <span>🔎</span><span>💬</span><span>✓</span>
              </div>
              <div style={{ padding: "20px 24px", borderRadius: 20, background: "#fff", boxShadow: "0 16px 38px rgba(15,23,42,.10)", textAlign: "center" }}>
                <strong style={{ display: "block", color: "#123b73", fontSize: 22 }}>
                  Saber por qué apareces es el primer paso.
                </strong>
                <span style={{ display: "block", marginTop: 5, color: "#64748b" }}>
                  Revisamos los datos antes de decirte qué opciones existen.
                </span>
              </div>
            </div>
          </div>
        </section>

        <section style={{ padding: "48px 20px 24px" }}>
          <div style={{ maxWidth: 1160, margin: "0 auto" }}>
            <h2 style={h2}>¿Qué situación necesitas revisar?</h2>
            <p style={sub}>Selecciona la que más se aproxima a tu caso.</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 15, marginTop: 24 }}>
              {CASES.map((item) => (
                <article key={item.title} style={caseCard}>
                  <div style={caseIcon}>{item.icon}</div>
                  <h3 style={{ margin: "10px 0", fontSize: 18, lineHeight: 1.2 }}>{item.title}</h3>
                  <p style={{ color: "#64748b", lineHeight: 1.5, fontSize: 14, flexGrow: 1 }}>{item.text}</p>
                  <button style={greenButton} onClick={() => navigate(item.to)}>
                    Revisar mi situación
                  </button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: "30px 20px" }}>
          <div style={{ maxWidth: 1160, margin: "0 auto", padding: "34px", borderRadius: 28, background: "linear-gradient(135deg,#edf5ff,#f9fcff)", border: "1px solid #dbeafe" }}>
            <div className="rtm-debt-process" style={{ display: "grid", gridTemplateColumns: "220px minmax(0,1fr)", gap: 30, alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 72 }}>🗂️</div>
                <div style={{ fontSize: 40, marginTop: -8 }}>🔎</div>
                <strong style={{ display: "block", marginTop: 12, color: "#123b73", fontSize: 25, lineHeight: 1.15 }}>
                  Así revisamos tu caso
                </strong>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 12 }}>
                {STEPS.map(([numberValue, title, description]) => (
                  <div key={numberValue} style={{ padding: 13 }}>
                    <span style={number}>{numberValue}</span>
                    <strong style={{ display: "block", margin: "10px 0 6px" }}>{title}</strong>
                    <small style={{ color: "#64748b", lineHeight: 1.45 }}>{description}</small>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 20, padding: 16, borderRadius: 15, background: "#e8f2ff", color: "#174b88", lineHeight: 1.5 }}>
              🔒 <strong>Puedes enviarnos la documentación con tranquilidad:</strong> la revisión inicial sirve para estudiar la situación. Una gestión posterior solo se inicia después de explicarte las opciones y de que tú decidas continuar.
            </div>
          </div>
        </section>

        <section style={{ padding: "38px 20px 48px" }}>
          <div style={{ maxWidth: 1160, margin: "0 auto" }}>
            <h2 style={{ ...h2, textAlign: "center" }}>¿Por qué confiar en RTM?</h2>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 16, marginTop: 24 }}>
              {TRUST.map(([icon, title, description]) => (
                <article key={title} style={{ padding: 22, textAlign: "center" }}>
                  <div style={{ fontSize: 36 }}>{icon}</div>
                  <h3 style={{ marginBottom: 8 }}>{title}</h3>
                  <p style={{ margin: 0, color: "#64748b", lineHeight: 1.55 }}>{description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: "0 20px 64px" }}>
          <div style={{ maxWidth: 1160, margin: "0 auto", padding: "32px", borderRadius: 26, background: "linear-gradient(110deg,#e8f4ff,#f7fbff 58%,#e5f7ef)", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 22, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 40 }}>📋</div>
              <h2 style={{ margin: "4px 0 7px", fontSize: 31, color: "#123b73" }}>
                Empieza por conocer tu situación
              </h2>
              <p style={{ margin: 0, color: "#475569", maxWidth: 620 }}>
                Abre tu expediente RTM y realizaremos la revisión inicial básica por 10 €.
              </p>
            </div>

            <button
              style={{ ...greenButton, width: "auto", padding: "15px 24px", fontSize: 16 }}
              onClick={() => navigate("/iniciar-expediente/debt/asnef_equifax?family=morosidad")}
            >
              Iniciar revisión inicial · 10 €
            </button>
          </div>
        </section>

        <style>{`
          @media(max-width:720px){
            .rtm-debt-process{grid-template-columns:1fr !important}
          }
        `}</style>
      </main>
    </>
  );
}

const badge = { display: "inline-flex", padding: "8px 13px", borderRadius: 999, background: "#dbeafe", color: "#1456a0", fontWeight: 900 };
const lead = { maxWidth: 650, fontSize: 19, lineHeight: 1.6, color: "#475569" };
const pill = { padding: "10px 12px", borderRadius: 12, background: "#fff", border: "1px solid #dbeafe", color: "#24415f", fontWeight: 800, fontSize: 13 };
const heroVisual = { minHeight: 345, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", borderRadius: 30, background: "linear-gradient(145deg,#dceeff,#ffffff)", boxShadow: "0 24px 60px rgba(30,64,175,.12)", padding: 30 };
const h2 = { margin: 0, fontSize: "clamp(28px,4vw,38px)", color: "#123b73" };
const sub = { margin: "8px 0 0", color: "#64748b", fontSize: 17 };
const caseCard = { minHeight: 310, display: "flex", flexDirection: "column", padding: 18, borderRadius: 20, background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 10px 28px rgba(15,23,42,.05)" };
const caseIcon = { width: 64, height: 64, display: "grid", placeItems: "center", borderRadius: 999, background: "#eff6ff", fontSize: 31 };
const greenButton = { width: "100%", border: 0, borderRadius: 11, padding: "12px 13px", background: "#16a34a", color: "#fff", fontWeight: 900, cursor: "pointer" };
const number = { width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 999, background: "#1766c2", color: "#fff", fontWeight: 950 };
