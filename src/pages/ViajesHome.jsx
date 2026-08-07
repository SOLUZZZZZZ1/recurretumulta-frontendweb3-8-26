import React from "react";
import { useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";

const CASES = [
  { icon: "✈️", title: "Vuelo cancelado", text: "Cancelaron tu vuelo y necesitas saber qué puedes reclamar.", to: "/iniciar-expediente/claims/airline?issue=cancelled_flight" },
  { icon: "🕐", title: "Vuelo retrasado", text: "Tu vuelo llegó con retraso y quieres conocer tus derechos.", to: "/iniciar-expediente/claims/airline?issue=flight_delay" },
  { icon: "🧳", title: "Equipaje perdido", text: "Tu equipaje no llegó, se extravió o sigue sin aparecer.", to: "/iniciar-expediente/claims/airline?issue=lost_baggage" },
  { icon: "🧳", title: "Equipaje dañado", text: "Tu equipaje llegó dañado y necesitas reclamar.", to: "/iniciar-expediente/claims/airline?issue=damaged_baggage" },
  { icon: "💺", title: "Overbooking", text: "No te permitieron embarcar pese a tener una reserva.", to: "/iniciar-expediente/claims/airline?issue=overbooking" },
  { icon: "🛳️", title: "Problemas con cruceros", text: "Cancelaciones, cambios, incidencias o reembolsos relacionados con tu crucero.", to: "/iniciar-expediente/claims/consumer?issue=cruise" },
  { icon: "🏨", title: "Agencias de viajes", text: "Problemas con paquetes, reservas, cambios, servicios o reembolsos.", to: "/iniciar-expediente/claims/consumer?issue=travel_agency" },
];

const STEPS = [
  ["1", "Nos cuentas qué ha ocurrido", "Nos envías la información y la documentación disponible."],
  ["2", "Analizamos tu caso", "Revisamos la situación y las posibles vías de actuación."],
  ["3", "Te informamos con claridad", "Te explicamos las opciones, la viabilidad y el siguiente paso."],
  ["4", "Presupuesto previo sin compromiso", "Conocerás el coste antes de iniciar cualquier actuación posterior."],
  ["5", "Actuamos por ti", "Si decides continuar, gestionamos la reclamación y te mantenemos informado."],
];

const TRUST = [
  ["🛡️", "Revisión antes de actuar", "Primero entendemos qué ha ocurrido y revisamos la documentación."],
  ["💬", "Comunicación clara", "Te explicamos la situación sin tecnicismos innecesarios."],
  ["👥", "Acompañamiento real", "Sabes en qué punto está tu expediente y cuál es el siguiente paso."],
  ["🔒", "Información protegida", "Tratamos la documentación con confidencialidad y trazabilidad."],
];

export default function ViajesHome() {
  const navigate = useNavigate();

  return (
    <>
      <Seo
        title="Reclamaciones de viajes, vuelos y cruceros · RTM"
        description="Revisión de incidencias con vuelos cancelados o retrasados, equipaje, overbooking, cruceros y agencias de viajes."
        canonical="https://www.recurretumulta.eu/viajes"
      />

      <main style={{ background: "#f8fbff", color: "#0f172a" }}>
        <section style={{ background: "linear-gradient(135deg,#eef6ff 0%,#ffffff 52%,#e9f8f2 100%)", padding: "64px 20px" }}>
          <div style={{ maxWidth: 1160, margin: "0 auto", display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: 34, alignItems: "center" }}>
            <div>
              <div style={badge}>✈️ Viajes y reclamaciones</div>
              <h1 style={{ margin: "16px 0", fontSize: "clamp(40px,6vw,66px)", lineHeight: 1.02, letterSpacing: "-.045em" }}>
                Reclamamos por ti.<br/><span style={{ color: "#159455" }}>Para que recuperes lo que te corresponde.</span>
              </h1>
              <p style={lead}>Problemas con vuelos, equipaje, cruceros o agencias de viajes. Revisamos tu caso y te indicamos la forma más adecuada de actuar.</p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 24 }}>
                {["Revisión antes de actuar", "Presupuesto previo si procede", "Información clara"].map(x => <span key={x} style={pill}>✓ {x}</span>)}
              </div>
            </div>

            <div style={heroVisual}>
              <img
                src="/viajes-hero.png"
                alt="Aeropuerto con avión y equipaje"
                style={heroImage}
              />
              <div style={heroMessage}>
                <div style={{ fontSize: 34, marginBottom: 4 }}>🛡️</div>
                <h2 style={{ margin: "0 0 4px", color: "#123b73", fontSize: 24 }}>
                  Tu viaje se complicó.
                </h2>
                <p style={{ margin: 0, color: "#64748b" }}>
                  Tu reclamación no tiene por qué hacerlo.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section style={{ padding: "48px 20px 24px" }}>
          <div style={{ maxWidth: 1160, margin: "0 auto" }}>
            <h2 style={h2}>¿Qué ha ocurrido?</h2>
            <p style={sub}>Selecciona tu situación y abriremos el expediente por el camino correcto.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 14, marginTop: 24 }}>
              {CASES.map(item => (
                <article key={item.title} style={caseCard}>
                  <div style={caseIcon}>{item.icon}</div>
                  <h3 style={{ fontSize: 17, lineHeight: 1.2, margin: "10px 0" }}>{item.title}</h3>
                  <p style={{ color: "#64748b", lineHeight: 1.5, fontSize: 14, flexGrow: 1 }}>{item.text}</p>
                  <button style={greenButton} onClick={() => navigate(item.to)}>Revisar mi caso</button>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: "30px 20px" }}>
          <div style={{ maxWidth: 1160, margin: "0 auto", padding: "34px", borderRadius: 28, background: "linear-gradient(135deg,#edf6ff,#f8fbff)", border: "1px solid #dbeafe" }}>
            <div style={{ display: "grid", gridTemplateColumns: "220px minmax(0,1fr)", gap: 30, alignItems: "center" }} className="rtm-viajes-process">
              <div style={{ textAlign: "center" }}>
                <img
                  src="/viajes-proceso.png"
                  alt="Maleta, pasaporte y documentación de viaje"
                  style={{ width: "100%", maxWidth: 210, borderRadius: 20, display: "block", margin: "0 auto 14px" }}
                />
                <strong style={{ color: "#123b73", fontSize: 25, lineHeight: 1.15, display: "block" }}>
                  Así trabajamos para ti
                </strong>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(145px,1fr))", gap: 14 }}>
                {STEPS.map(([n,t,d]) => (
                  <div key={n} style={{ padding: 14 }}>
                    <span style={number}>{n}</span>
                    <strong style={{ display: "block", margin: "10px 0 6px" }}>{t}</strong>
                    <small style={{ color: "#64748b", lineHeight: 1.45 }}>{d}</small>
                  </div>
                ))}
              </div>
            </div>
            <div style={{ marginTop: 20, padding: 16, borderRadius: 15, background: "#e8f2ff", color: "#174b88", lineHeight: 1.5 }}>
              🔒 <strong>Puedes enviarnos tu caso con tranquilidad:</strong> abrir el expediente y aportar documentación no implica contratar una gestión posterior. Primero revisamos y te explicamos las opciones.
            </div>
          </div>
        </section>

        <section style={{ padding: "36px 20px 50px" }}>
          <div style={{ maxWidth: 1160, margin: "0 auto" }}>
            <h2 style={h2}>¿Por qué confiar en RTM?</h2>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(210px,1fr))", gap: 16, marginTop: 22 }}>
              {TRUST.map(([i,t,d]) => (
                <article key={t} style={{ padding: 22, textAlign: "center" }}>
                  <div style={{ fontSize: 35 }}>{i}</div>
                  <h3>{t}</h3>
                  <p style={{ color: "#64748b", lineHeight: 1.55 }}>{d}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section style={{ padding: "0 20px 64px" }}>
          <div style={cruiseCta}>
            <img
              src="/viajes-crucero.png"
              alt="Crucero navegando junto a la costa"
              style={cruiseImage}
            />
            <div style={cruiseOverlay}>
              <div>
                <h2 style={{ margin: "0 0 7px", fontSize: 32, color: "#123b73" }}>
                  Da el primer paso
                </h2>
                <p style={{ margin: 0, color: "#475569", maxWidth: 520 }}>
                  Cuéntanos qué ha ocurrido y te diremos cómo podemos ayudarte.
                </p>
              </div>
              <button
                style={{ ...greenButton, width: "auto", padding: "15px 24px", fontSize: 16 }}
                onClick={() => navigate("/iniciar-expediente/claims")}
              >
                Iniciar una revisión inicial
              </button>
            </div>
          </div>
        </section>

        <style>{`
          @media(max-width:720px){
            .rtm-viajes-process{grid-template-columns:1fr !important}
          }
          @media(max-width:640px){
            .rtm-viajes-process img{max-width:170px !important}
          }
        `}</style>
      </main>
    </>
  );
}

const badge = { display: "inline-flex", padding: "8px 13px", borderRadius: 999, background: "#dbeafe", color: "#1456a0", fontWeight: 900 };
const lead = { maxWidth: 650, fontSize: 19, lineHeight: 1.6, color: "#475569" };
const pill = { padding: "10px 12px", borderRadius: 12, background: "#fff", border: "1px solid #dbeafe", color: "#24415f", fontWeight: 800, fontSize: 13 };
const heroVisual = { position: "relative", minHeight: 330, overflow: "hidden", borderRadius: 30, background: "#dceeff", boxShadow: "0 24px 60px rgba(30,64,175,.12)" };
const heroImage = { width: "100%", height: "100%", minHeight: 330, objectFit: "cover", display: "block" };
const heroMessage = { position: "absolute", left: 24, right: 24, bottom: 22, maxWidth: 360, marginLeft: "auto", padding: "20px 22px", borderRadius: 22, background: "rgba(255,255,255,.94)", boxShadow: "0 18px 45px rgba(15,23,42,.16)", textAlign: "center", backdropFilter: "blur(8px)" };
const cruiseCta = { position: "relative", maxWidth: 1160, minHeight: 230, margin: "0 auto", overflow: "hidden", borderRadius: 26, background: "#e8f4ff" };
const cruiseImage = { position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", display: "block" };
const cruiseOverlay = { position: "relative", zIndex: 1, minHeight: 230, padding: "34px", display: "flex", justifyContent: "space-between", alignItems: "center", gap: 22, flexWrap: "wrap", background: "linear-gradient(90deg,rgba(245,251,255,.98) 0%,rgba(245,251,255,.94) 38%,rgba(245,251,255,.55) 62%,rgba(245,251,255,.08) 100%)" };
const h2 = { margin: 0, fontSize: "clamp(28px,4vw,38px)", color: "#123b73" };
const sub = { margin: "8px 0 0", color: "#64748b", fontSize: 17 };
const caseCard = { minHeight: 300, display: "flex", flexDirection: "column", padding: 18, borderRadius: 20, background: "#fff", border: "1px solid #e2e8f0", boxShadow: "0 10px 28px rgba(15,23,42,.05)" };
const caseIcon = { width: 64, height: 64, display: "grid", placeItems: "center", borderRadius: 999, background: "#eff6ff", fontSize: 32 };
const greenButton = { width: "100%", border: 0, borderRadius: 11, padding: "12px 13px", background: "#16a34a", color: "#fff", fontWeight: 900, cursor: "pointer" };
const number = { width: 34, height: 34, display: "grid", placeItems: "center", borderRadius: 999, background: "#1766c2", color: "#fff", fontWeight: 950 };
