import React from "react";
import { Link, useLocation } from "react-router-dom";

export default function Footer() {
  const { search, hash } = useLocation();

  // Visible solo si detecta ops=1 en query (compatibilidad con HashRouter)
  const q1 = new URLSearchParams(search);
  const q2 = new URLSearchParams(window.location.search);
  const q3 = new URLSearchParams(hash?.split("?")[1] || "");
  const showOps =
    q1.get("ops") === "1" || q2.get("ops") === "1" || q3.get("ops") === "1";

  return (
    <footer
      className="mt-12"
      style={{
        background: "#0f172a",
        color: "white",
        padding: "28px 0",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        className="sr-container"
        style={{
          display: "grid",
          gap: 20,
          gridTemplateColumns: "repeat(3, minmax(0,1fr))",
        }}
      >
        {/* MARCA RTM */}
        <div>
          <div className="rtm-footer-brand">
            <span className="rtm-footer-brand-name">RTM</span>
            <span className="rtm-footer-brand-tagline">Resuelve tus movidas</span>
          </div>
          <ul style={{ listStyle: "none", padding: 0, lineHeight: 1.9 }}>
            <li>
              <Link to="/" style={{ color: "#e5e7eb" }}>
                Inicio
              </Link>
            </li>
            <li>
              <Link to="/como-funciona" style={{ color: "#e5e7eb" }}>
                Cómo funciona
              </Link>
            </li>
            <li>
              <Link to="/precios" style={{ color: "#e5e7eb" }}>
                Precios
              </Link>
            </li>
            <li>
              <Link to="/contacto" style={{ color: "#e5e7eb" }}>
                Contacto
              </Link>
            </li>

            {/* 🔒 Acceso OPS solo si ops=1 */}
            {showOps && (
              <li style={{ marginTop: 6 }}>
                <Link to="/ops" style={{ color: "#2bb673", fontWeight: 800 }}>
                  Operador
                </Link>
              </li>
            )}
          </ul>
        </div>

        {/* CONTACTO */}
        <div>
          <h4 style={{ marginBottom: 8, fontSize: 16, fontWeight: 800 }}>
            Contacto
          </h4>
          <p style={{ lineHeight: 1.7, color: "#e5e7eb", margin: 0 }}>
            Para cualquier consulta sobre el uso de la plataforma, escríbenos a:
          </p>
          <p style={{ marginTop: 6 }}>
            <a
              href="mailto:soporte@recurretumulta.eu"
              style={{ color: "#2bb673", fontWeight: 700 }}
            >
              soporte@recurretumulta.eu
            </a>
          </p>
          <p style={{ fontSize: 12, opacity: 0.85, lineHeight: 1.6 }}>
            RTM ofrece también asesoramiento jurídico. Este canal es exclusivamente
            para consultas técnicas o de funcionamiento del servicio.
          </p>
        </div>

        {/* LEGAL */}
        <div>
          <h4 style={{ marginBottom: 8, fontSize: 16, fontWeight: 800 }}>
            Legal
          </h4>
          <ul style={{ listStyle: "none", padding: 0, lineHeight: 1.9 }}>
            <li>
              <Link to="/aviso-legal" style={{ color: "#e5e7eb" }}>
                Aviso legal
              </Link>
            </li>
            <li>
              <Link to="/privacidad" style={{ color: "#e5e7eb" }}>
                Privacidad
              </Link>
            </li>
            <li>
              <Link to="/cookies" style={{ color: "#e5e7eb" }}>
                Cookies
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div
        className="sr-container"
        style={{
          marginTop: 24,
          fontSize: 12,
          opacity: 0.9,
          textAlign: "center",
          lineHeight: 1.7,
        }}
      >
        © {new Date().getFullYear()} RTM · Resuelve tus movidas
        <br />
        Asistencia automatizada en trámites administrativos
        <br />
        RTM presta servicios de asistencia y, cuando corresponde, asesoramiento
        jurídico; no garantiza un resultado favorable.
        <br />
        www.recurretumulta.eu
      </div>
    </footer>
  );
}
