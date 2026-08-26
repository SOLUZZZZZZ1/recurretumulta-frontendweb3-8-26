import React from "react";
import { useSearchParams } from "react-router-dom";
import Seo from "../components/Seo.jsx";

export default function Contacto() {
  const [searchParams] = useSearchParams();
  const isHousingConsultation = searchParams.get("area") === "vivienda";
  const supportEmail = "soporte@recurretumulta.eu";
  const subjectText = isHousingConsultation
    ? "Consulta de encaje · Vivienda · RTM"
    : "Consulta RTM";
  const subject = encodeURIComponent(subjectText);
  const body = encodeURIComponent(
    isHousingConsultation
      ? "Hola, quiero solicitar una consulta de encaje sobre vivienda.\n\nResumen del caso:\n\nDocumentos disponibles:\n"
      : "Hola, quiero realizar una consulta a RTM.\n\n"
  );
  const mailto = `mailto:${supportEmail}?subject=${subject}&body=${body}`;

  return (
    <>
      <Seo
        title={
          isHousingConsultation
            ? "Consulta de encaje de vivienda · RTM"
            : "Contacto · RTM"
        }
        description={
          isHousingConsultation
            ? "Solicita una consulta previa para comprobar si RTM puede ayudarte con un asunto de vivienda."
            : "Contacta con RTM para consultas sobre expedientes, incidencias o colaboraciones."
        }
        canonical="https://www.recurretumulta.eu/contacto"
      />
      <main
      style={{
        minHeight: "calc(100vh - 120px)",
        padding: "56px 20px 72px",
        background: "linear-gradient(135deg,#f8fbff 0%,#ffffff 55%,#eef8f4 100%)",
        color: "#0f172a",
      }}
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <header style={{ marginBottom: 28 }}>
          <div
            style={{
              display: "inline-flex",
              padding: "8px 13px",
              borderRadius: 999,
              background: "#dbeafe",
              color: "#1456a0",
              fontWeight: 900,
            }}
          >
            {isHousingConsultation ? "🏠 Consulta de encaje · Vivienda" : "✉️ Contacto RTM"}
          </div>

          <h1
            style={{
              margin: "16px 0 12px",
              fontSize: "clamp(38px,5vw,56px)",
              lineHeight: 1.04,
              letterSpacing: "-.04em",
              color: "#123b73",
            }}
          >
            {isHousingConsultation
              ? "Cuéntanos primero tu caso de vivienda"
              : "¿Necesitas contactar con RTM?"}
          </h1>

          <p
            style={{
              margin: 0,
              maxWidth: 720,
              fontSize: 18,
              lineHeight: 1.65,
              color: "#475569",
            }}
          >
            {isHousingConsultation
              ? "Antes de crear ninguna gestión, revisaremos si el asunto encaja, qué información falta o si conviene otro profesional o canal."
              : "Para consultas relacionadas con expedientes, incidencias o colaboraciones, escríbenos directamente por correo electrónico."}
          </p>
        </header>

        {isHousingConsultation ? (
          <div className="rtm-contact-housing-notice" role="note">
            <span aria-hidden="true">🧭</span>
            <div>
              <strong>Esta consulta no crea un expediente automático</strong>
              <p>
                Vivienda todavía no dispone de un especialista backend específico.
                Te responderemos sobre el posible encaje sin prometer una actuación.
              </p>
            </div>
          </div>
        ) : null}

        <section
          style={{
            padding: 30,
            borderRadius: 24,
            background: "#fff",
            border: "1px solid #e2e8f0",
            boxShadow: "0 16px 40px rgba(15,23,42,.07)",
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))",
              gap: 20,
              alignItems: "center",
            }}
          >
            <div>
              <div style={{ color: "#64748b", fontWeight: 800, marginBottom: 8 }}>
                Correo de soporte
              </div>

              <a
                href={`mailto:${supportEmail}`}
                style={{
                  display: "inline-block",
                  color: "#159455",
                  fontSize: 24,
                  fontWeight: 950,
                  textDecoration: "none",
                  overflowWrap: "anywhere",
                }}
              >
                {supportEmail}
              </a>

              <p
                style={{
                  margin: "16px 0 0",
                  color: "#64748b",
                  lineHeight: 1.6,
                }}
              >
                Si tu consulta corresponde a un expediente existente, incluye el
                número de expediente en el asunto o en el mensaje.
              </p>
            </div>

            <div style={{ textAlign: "center" }}>
              <a
                href={mailto}
                style={{
                  minHeight: 54,
                  padding: "15px 24px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: 14,
                  background: "#16a34a",
                  color: "#fff",
                  textDecoration: "none",
                  fontSize: 17,
                  fontWeight: 950,
                  boxShadow: "0 12px 26px rgba(22,163,74,.22)",
                }}
              >
                {isHousingConsultation
                  ? "🏠 Solicitar consulta de encaje"
                  : "✉️ Escribir a RTM"}
              </a>
            </div>
          </div>
        </section>

        <section
          style={{
            marginTop: 22,
            padding: 26,
            borderRadius: 22,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
          }}
        >
          <h2 style={{ margin: "0 0 16px", fontSize: 24, color: "#123b73" }}>
            Empresa
          </h2>

          <p style={{ margin: 0, lineHeight: 1.7, color: "#334155" }}>
            <strong>LA TALAMANQUINA, S.L.</strong>
            <br />
            Calle Velázquez, 15
            <br />
            28001 Madrid (España)
          </p>
        </section>

        <div
          style={{
            marginTop: 22,
            padding: "16px 18px",
            borderRadius: 16,
            background: "#e8f2ff",
            color: "#174b88",
            lineHeight: 1.55,
          }}
        >
          RTM no ofrece atención inmediata por este canal. Responderemos lo antes posible
          a las consultas relacionadas con expedientes, incidencias o colaboraciones.
        </div>
      </div>
      </main>
    </>
  );
}
