import React from "react";
import { useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";

const CASES = [
  {
    icon: "🏦",
    title: "Hacienda / AEAT",
    text: "Liquidaciones, sanciones, requerimientos, embargos y otros procedimientos tributarios.",
    to: "/iniciar-expediente/administration/aeat?family=administracion",
  },
  {
    icon: "🧾",
    title: "Seguridad Social",
    text: "Deudas, reclamaciones, notificaciones y procedimientos de la Seguridad Social.",
    to: "/iniciar-expediente/administration/social_security?family=administracion",
  },
  {
    icon: "🏛️",
    title: "Ayuntamientos",
    text: "Sanciones, tributos, tasas, licencias y otros expedientes municipales.",
    to: "/iniciar-expediente/administration/town_hall?family=administracion",
  },
  {
    icon: "🗺️",
    title: "Catastro",
    text: "Discrepancias, datos catastrales, valoraciones y procedimientos relacionados con inmuebles.",
    to: "/iniciar-expediente/administration/general_administration?family=administracion",
  },
  {
    icon: "📑",
    title: "Comunidades Autónomas",
    text: "Notificaciones, sanciones y procedimientos ante organismos autonómicos.",
    to: "/iniciar-expediente/administration/general_administration?family=administracion",
  },
  {
    icon: "⚖️",
    title: "Otros organismos públicos",
    text: "Si tu expediente procede de otra Administración, lo revisamos y te indicamos cómo continuar.",
    to: "/iniciar-expediente/administration/general_administration?family=administracion",
  },
];

const STEPS = [
  ["1", "Nos cuentas qué ha ocurrido", "Recogemos los datos y la documentación administrativa disponible."],
  ["2", "Revisamos expediente y plazos", "Identificamos el organismo, el procedimiento y las fechas que pueden ser relevantes."],
  ["3", "Te explicamos las opciones", "Ordenamos la situación y te indicamos las posibles vías de actuación."],
  ["4", "Valoración y presupuesto", "Si procede continuar, conocerás previamente el alcance y el coste de la gestión."],
  ["5", "Actuamos si tú decides", "Solo iniciamos actuaciones posteriores cuando las aceptas expresamente."],
];

const TRUST = [
  ["🔎", "Revisión antes de actuar", "Primero entendemos el expediente, la documentación y la situación administrativa."],
  ["⏱️", "Atención a los plazos", "Las fechas pueden ser importantes. Las identificamos desde el inicio del estudio."],
  ["💬", "Explicación clara", "Te contamos qué vemos y cuál puede ser el siguiente paso sin lenguaje innecesariamente complejo."],
  ["🔒", "Expediente organizado", "Documentación, actuaciones y seguimiento quedan vinculados a un único expediente RTM."],
];

export default function AdministracionHome() {
  const navigate = useNavigate();

  return (
    <>
      <Seo
        title="Administración Pública · Revisión de expedientes · RTM"
        description="Revisión inicial de expedientes de Hacienda, Seguridad Social, ayuntamientos, Catastro y otros organismos públicos."
        canonical="https://www.recurretumulta.eu/administracion"
      />

      <main style={{ background: "#f8fbff", color: "#0f172a" }}>
        <section style={{ padding: "66px 20px 58px", background: "linear-gradient(135deg,#eef5ff 0%,#ffffff 54%,#eef8f4 100%)" }}>
          <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(310px,1fr))", gap: 38, alignItems: "center" }}>
            <div>
              <div style={badge}>🏛️ Administración pública</div>
              <h1 style={{ margin: "16px 0", fontSize: "clamp(40px,5.7vw,64px)", lineHeight: 1.03, letterSpacing: "-.045em", color: "#123b73" }}>
                Entender el expediente es el primer paso para <span style={{ color: "#159455" }}>actuar bien.</span>
              </h1>
              <p style={lead}>
                Hacienda, Seguridad Social, ayuntamientos u otros organismos. Revisamos la documentación y la situación antes de iniciar cualquier actuación.
              </p>

              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
                <span style={pill}>✓ Revisión antes de actuar</span>
                <span style={pill}>✓ Atención a documentación y plazos</span>
                <span style={pill}>✓ Tú decides cómo continuar</span>
              </div>
            </div>

            <div style={heroVisual}>
              <div style={{ fontSize: 82 }}>🏛️</div>
              <div style={{ display: "flex", gap: 14, fontSize: 50, margin: "4px 0 18px" }}>
                <span>📄</span><span>🔎</span><span>⏱️</span>
              </div>
              <div style={{ padding: "20px 24px", borderRadius: 20, background: "#fff", boxShadow: "0 16px 38px rgba(15,23,42,.10)", textAlign: "center" }}>
                <strong style={{ display: "block", color: "#123b73", fontSize: 22 }}>Tu expediente merece contexto.</strong>
                <span style={{ display: "block", marginTop: 5, color: "#64748b" }}>Primero lo entendemos. Después te explicamos las opciones.</span>
              </div>
            </div>
          </div>
        </section>

        <section style={{ padding: "48px 20px 24px" }}>
          <div style={{ maxWidth: 1160, margin: "0 auto" }}>
            <h2 style={h2}>¿Con qué Administración tienes el problema?</h2>
            <p style={sub}>Selecciona el organismo o la situación que más se aproxima a tu expediente.</p>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(165px,1fr))", gap: 15, marginTop: 24 }}>
              {CASES.map((item) => (
                <article key={item.title} style={caseCard}>
                  <div style={caseIcon}>{item.icon}</div>
                  <h3 style={{ margin: "10px 0", fontSize: 18, lineHeight: 1.2 }}>{item.title}</h3>
                  <p style={{ color: "#64748b", lineHeight: 1.5, fontSize: 14, flexGrow: 1 }}>{item.text}</p>
                  <button style={greenButton} onClick={() => navigate(item.to)}>Revisar mi expediente</button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: "30px 20px" }}>
          <div style={{ maxWidth: 1160, margin: "0 auto", padding: "34px", borderRadius: 28, background: "linear-gradient(135deg,#edf5ff,#f9fcff)", border: "1px solid #dbeafe" }}>
            <div className="rtm-admin-process" style={{ display: "grid", gridTemplateColumns: "220px minmax(0,1fr)", gap: 30, alignItems: "center" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 76 }}>📂</div>
                <div style={{ fontSize: 40, marginTop: -10 }}>📄</div>
                <strong style={{ display: "block", marginTop: 12, color: "#123b73", fontSize: 25, lineHeight: 1.15 }}>
                  Así trabajamos contigo
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
              🔒 <strong>Tu decisión sigue siendo tuya:</strong> la revisión inicial sirve para estudiar y ordenar el expediente. No iniciamos una gestión posterior sin explicarte antes las opciones y, cuando corresponda, el presupuesto.
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
              <div style={{ fontSize: 40 }}>📑</div>
              <h2 style={{ margin: "4px 0 7px", fontSize: 31, color: "#123b73" }}>Empieza por saber dónde estás</h2>
              <p style={{ margin: 0, color: "#475569", maxWidth: 620 }}>
                Abre tu expediente RTM y realizaremos la revisión inicial administrativa por 25 €.
              </p>
            </div>

            <button
              style={{ ...greenButton, width: "auto", padding: "15px 24px", fontSize: 16 }}
              onClick={() => navigate("/iniciar-expediente/administration/general_administration?family=administracion")}
            >
              Iniciar revisión inicial · 25 €
            </button>
          </div>
        </section>

        <style>{`
          @media(max-width:720px){
            .rtm-admin-process{grid-template-columns:1fr !important}
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
