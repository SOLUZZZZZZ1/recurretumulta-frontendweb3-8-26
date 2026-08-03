import React from "react";
import Seo from "../components/Seo.jsx";
import { Link } from "react-router-dom";

export default function Precios() {
  return (
    <>
      <Seo
        title="Precios · RecurreTuMulta"
        description="Servicio completo de análisis, preparación y presentación de recurso de multa en tu nombre."
      />

      <main style={{ padding: "40px", maxWidth: "800px", margin: "0 auto" }}>

        <h1 style={{ textAlign: "center" }}>
          Servicio completo para recurrir tu multa
        </h1>

        <p style={{ textAlign: "center", marginBottom: "30px" }}>
          No vendemos plantillas ni documentos descargables.  
          Nos encargamos de todo el proceso por ti.
        </p>

        <div style={{
          border: "2px solid black",
          padding: "25px",
          borderRadius: "10px"
        }}>

          <h2>Gestión completa</h2>

          <h3 style={{ fontSize: "32px", margin: "10px 0" }}>
            39€
          </h3>

          <p style={{ color: "#666", marginBottom: "20px" }}>
            Pago único. Sin suscripciones. Sin compromiso.
          </p>

          <ul style={{ lineHeight: "1.9" }}>
            <li>✔️ Análisis completo de la multa o expediente</li>
            <li>✔️ Detección de errores, defectos de prueba o problemas de motivación</li>
            <li>✔️ Preparación del recurso adaptado al caso</li>
            <li>✔️ Presentación del recurso en tu nombre con autorización previa</li>
            <li>✔️ Justificante oficial de presentación</li>
            <li>✔️ Seguimiento del expediente y control de plazos</li>
          </ul>

          <p style={{ marginTop: "20px", fontWeight: "bold" }}>
            Nos encargamos del proceso completo para que no tengas que preocuparte por plazos ni trámites.
          </p>

          <div style={{ marginTop: "25px", textAlign: "center" }}>
            <Link to="/" style={{
              padding: "12px 20px",
              background: "black",
              color: "white",
              textDecoration: "none",
              borderRadius: "5px"
            }}>
              Subir multa ahora
            </Link>
          </div>

        </div>

        <p style={{
          marginTop: "30px",
          textAlign: "center",
          fontWeight: "bold"
        }}>
          Antes de pagar la multa, comprueba si realmente es correcta o se puede recurrir.
        </p>

      </main>
    </>
  );
}