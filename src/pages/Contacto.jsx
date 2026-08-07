import React, { useState } from "react";

export default function Contacto() {
  const [tipo, setTipo] = useState("");
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [sending, setSending] = useState(false);
  const [status, setStatus] = useState({ type: "", message: "" });

  const API_BASE = (import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");
  const CONTACT_URL = API_BASE ? `${API_BASE}/contact` : "/contact";

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus({ type: "", message: "" });

    if (!tipo || !nombre || !email || !mensaje) {
      setStatus({
        type: "error",
        message: "Por favor, completa todos los campos.",
      });
      return;
    }

    try {
      setSending(true);

      const res = await fetch(CONTACT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          tipo_consulta: tipo,
          nombre,
          email,
          mensaje,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(
          data?.detail || data?.message || "No se pudo enviar la consulta."
        );
      }

      setStatus({
        type: "success",
        message: "Consulta enviada correctamente.",
      });

      setTipo("");
      setNombre("");
      setEmail("");
      setMensaje("");
    } catch (err) {
      setStatus({
        type: "error",
        message:
          err?.message ||
          "Ha ocurrido un error al enviar la consulta. Inténtalo de nuevo.",
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={{ padding: "40px 20px", maxWidth: "900px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "32px", marginBottom: "10px" }}>
        Contacto
      </h1>

      <p style={{ fontSize: "18px", marginBottom: "20px", color: "#555" }}>
        Canal de contacto para consultas relacionadas con expedientes, incidencias o colaboraciones.
      </p>

      <div
        style={{
          background: "rgba(255,255,255,0.9)",
          padding: "25px",
          borderRadius: "12px",
          marginBottom: "30px",
        }}
      >
        <h3 style={{ marginBottom: "10px" }}>Email</h3>
        <p style={{ marginBottom: "20px" }}>
          soporte@recurretumulta.eu
        </p>

        <h3 style={{ marginBottom: "10px" }}>Empresa</h3>
        <p>
          LA TALAMANQUINA, S.L.
          <br />
          Calle Velázquez, 15
          <br />
          28001 Madrid (España)
        </p>
      </div>

      <div
        style={{
          background: "rgba(255,255,255,0.9)",
          padding: "25px",
          borderRadius: "12px",
        }}
      >
        <h3 style={{ marginBottom: "15px" }}>Enviar consulta</h3>

        <p style={{ fontSize: "14px", color: "#666", marginBottom: "20px" }}>
          Este canal no ofrece atención inmediata. Respondemos lo antes posible en consultas justificadas.
        </p>

        {status.message ? (
          <div
            style={{
              marginBottom: "20px",
              padding: "12px 14px",
              borderRadius: "8px",
              backgroundColor:
                status.type === "success" ? "#ecfdf5" : "#fef2f2",
              color: status.type === "success" ? "#166534" : "#991b1b",
              border:
                status.type === "success"
                  ? "1px solid #bbf7d0"
                  : "1px solid #fecaca",
            }}
          >
            {status.message}
          </div>
        ) : null}

        <form
          onSubmit={handleSubmit}
          style={{ display: "flex", flexDirection: "column", gap: "15px" }}
        >
          <select
            required
            value={tipo}
            onChange={(e) => setTipo(e.target.value)}
            style={{ padding: "12px", fontSize: "16px" }}
          >
            <option value="">Tipo de consulta</option>
            <option value="Incidencia con un expediente">
              Incidencia con un expediente
            </option>
            <option value="Consulta sobre un servicio contratado">
              Consulta sobre un servicio contratado
            </option>
            <option value="Colaboraciones / gestorías">
              Colaboraciones / gestorías
            </option>
            <option value="Otros (justificados)">
              Otros (justificados)
            </option>
          </select>

          <input
            type="text"
            placeholder="Nombre"
            required
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            style={{ padding: "12px", fontSize: "16px" }}
          />

          <input
            type="email"
            placeholder="Email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ padding: "12px", fontSize: "16px" }}
          />

          <textarea
            placeholder="Describe tu consulta con detalle..."
            rows="5"
            required
            value={mensaje}
            onChange={(e) => setMensaje(e.target.value)}
            style={{ padding: "12px", fontSize: "16px" }}
          />

          <button
            type="submit"
            disabled={sending}
            style={{
              padding: "14px",
              backgroundColor: sending ? "#6b7280" : "#0b4aa2",
              color: "white",
              border: "none",
              fontSize: "16px",
              cursor: sending ? "not-allowed" : "pointer",
              borderRadius: "8px",
              opacity: sending ? 0.9 : 1,
            }}
          >
            {sending ? "Enviando..." : "Enviar consulta"}
          </button>
        </form>
      </div>

      <p
        style={{
          marginTop: "30px",
          fontSize: "14px",
          color: "#777",
          textAlign: "center",
        }}
      >
        Este canal está destinado a consultas serias y justificadas.
      </p>
    </div>
  );
}
