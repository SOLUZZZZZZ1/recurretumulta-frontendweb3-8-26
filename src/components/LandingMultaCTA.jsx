import React from "react";
import { Link } from "react-router-dom";

export default function LandingMultaCTA() {
  return (
    <section
      className="sr-card"
      style={{
        maxWidth: 980,
        margin: "0 auto",
        padding: "32px 24px",
        textAlign: "center",
        background: "rgba(255,255,255,0.94)",
      }}
    >
      <div
        className="sr-small"
        style={{
          display: "inline-block",
          marginBottom: 10,
          padding: "6px 10px",
          borderRadius: 999,
          background: "#fef3c7",
          color: "#92400e",
          fontWeight: 800,
        }}
      >
        Revisión online de multas
      </div>

      <h1
        className="sr-h1"
        style={{
          marginTop: 0,
          marginBottom: 14,
          lineHeight: 1.1,
        }}
      >
        ¿Te han multado?
        <br />
        Podrías no tener que pagarla
      </h1>

      <p
        className="sr-p"
        style={{
          maxWidth: 760,
          margin: "0 auto 18px auto",
          fontSize: "1.1rem",
        }}
      >
        Analizamos tu multa y, si es viable, la recurrimos por ti.
        Sin papeleo. Sin complicaciones.
      </p>

      <p
        className="sr-p"
        style={{
          maxWidth: 760,
          margin: "0 auto 22px auto",
          color: "#374151",
          fontWeight: 700,
        }}
      >
        Miles de multas se pueden recurrir. Mucha gente paga sin comprobarlo.
      </p>

      <div
        className="sr-cta-row"
        style={{
          justifyContent: "center",
          gap: 12,
          flexWrap: "wrap",
          marginBottom: 20,
        }}
      >
        <Link to="/#subir-multa" className="sr-btn-primary">
          Revisar mi multa gratis
        </Link>

        <Link to="/como-funciona" className="sr-btn-secondary">
          Cómo funciona
        </Link>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
          marginTop: 8,
          textAlign: "left",
        }}
      >
        <div className="sr-card" style={{ background: "#f9fafb", padding: 14 }}>
          <strong>1. Sube tu multa</strong>
          <div className="sr-small" style={{ color: "#6b7280", marginTop: 6 }}>
            Adjunta la denuncia o notificación.
          </div>
        </div>

        <div className="sr-card" style={{ background: "#f9fafb", padding: 14 }}>
          <strong>2. La analizamos</strong>
          <div className="sr-small" style={{ color: "#6b7280", marginTop: 6 }}>
            Revisamos si merece la pena recurrir.
          </div>
        </div>

        <div className="sr-card" style={{ background: "#f9fafb", padding: 14 }}>
          <strong>3. La recurrimos por ti</strong>
          <div className="sr-small" style={{ color: "#6b7280", marginTop: 6 }}>
            Preparamos y presentamos el recurso.
          </div>
        </div>
      </div>

      <div className="sr-small" style={{ marginTop: 18, color: "#6b7280" }}>
        Solo pagas si tu expediente puede tramitarse. Proceso 100% online.
      </div>
    </section>
  );
}
