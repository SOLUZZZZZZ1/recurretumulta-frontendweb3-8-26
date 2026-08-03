import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";

const DIRECT_BACKEND = "https://recurretumulta-backend.onrender.com";

const API_CANDIDATES = [
  "/api",
  import.meta.env.VITE_API_BASE_URL,
  import.meta.env.VITE_API_URL,
  DIRECT_BACKEND,
].filter(Boolean);

function buildUrl(base, path) {
  return `${String(base || "").replace(/\/$/, "")}${path}`;
}

async function readResponse(response) {
  const text = await response.text().catch(() => "");
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const detail = data?.detail || data?.message || text || `HTTP ${response.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  return data;
}

async function fetchJsonFallback(path, options = {}) {
  const errors = [];
  for (const base of API_CANDIDATES) {
    const url = buildUrl(base, path);
    try {
      const response = await fetch(url, options);
      return await readResponse(response);
    } catch (e) {
      errors.push(`${url} → ${e?.message || "Error"}`);
    }
  }
  throw new Error(errors.join(" | "));
}

function getCaseId(search) {
  const qs = new URLSearchParams(search);
  return qs.get("case") || qs.get("case_id") || qs.get("id") || "";
}

function isPaid(v) {
  const s = String(v || "").toLowerCase();
  return s === "paid" || s === "succeeded" || s === "complete" || s === "completed";
}

function isAuthorized(data) {
  if (!data) return false;
  if (data.authorized === true) return true;
  if (data.authorization_signed === true) return true;
  const interested = data.interested_data || {};
  if (interested.authorization_signed === true) return true;
  return false;
}

function statusLabel(data) {
  if (!data) return "Expediente recibido";
  if (isPaid(data.payment_status)) return "Pago confirmado";
  if (isAuthorized(data)) return "Expediente recibido";
  if (data.status === "generated") return "Recurso generado";
  return "Expediente recibido";
}

function messageFor(data, loading) {
  if (loading && !data) return "Revisando documentación…";
  if (!data) return "Hemos recibido tu documentación. Estamos actualizando el expediente.";
  if (isPaid(data.payment_status)) return "Hemos recibido tu solicitud. Continuamos con la preparación y gestión del expediente.";
  if (isAuthorized(data)) return "Ya tenemos tu autorización. Puedes continuar para iniciar la gestión.";
  return "Hemos analizado tu multa. Para continuar, necesitamos tus datos y autorización.";
}

export default function Resumen() {
  const location = useLocation();
  const navigate = useNavigate();
  const caseId = useMemo(() => getCaseId(location.search), [location.search]);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [technicalError, setTechnicalError] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  async function loadStatus({ silent = false } = {}) {
    if (!caseId) {
      setTechnicalError("No se ha encontrado el expediente.");
      setLoading(false);
      return;
    }

    if (!silent) setLoading(true);
    setTechnicalError("");

    try {
      let last = null;
      // varios intentos para evitar ver estados intermedios justo tras pago/autorización
      for (let i = 0; i < 4; i += 1) {
        last = await fetchJsonFallback(`/cases/${caseId}/public-status`);
        if (isPaid(last?.payment_status) || isAuthorized(last)) break;
        await new Promise((resolve) => setTimeout(resolve, 900));
      }
      setData(last);
    } catch (e) {
      // No mostramos “Error API” al cliente como estado principal.
      setTechnicalError(e?.message || "");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadStatus();
    const id = setInterval(() => loadStatus({ silent: true }), 5000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function startPayment() {
    setPayError("");
    setPaying(true);

    try {
      // Refresco justo antes de pagar para no pedir doble pago.
      const current = await fetchJsonFallback(`/cases/${caseId}/public-status`);
      setData(current);

      if (isPaid(current?.payment_status)) {
        navigate(`/pago-ok?case=${encodeURIComponent(caseId)}`);
        return;
      }

      const email =
        current?.contact_email ||
        current?.interested_data?.email ||
        current?.email ||
        "";

      if (!email) {
        setPayError("Falta el email del interesado. Vuelve a autorización y guarda los datos.");
        return;
      }

      const checkout = await fetchJsonFallback("/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId, product: "dgt", email }),
      });

      if (checkout?.redirect) {
        window.location.href = checkout.redirect;
        return;
      }

      if (!checkout?.url) {
        throw new Error("No se recibió URL de Stripe.");
      }

      window.location.href = checkout.url;
    } catch (e) {
      setPayError(e?.message || "No se pudo iniciar el pago.");
    } finally {
      setPaying(false);
    }
  }

  const paid = isPaid(data?.payment_status);
  const authorized = isAuthorized(data);
  const showPayButton = authorized && !paid;
  const showAuthNeeded = !authorized && !paid;

  return (
    <main className="sr-page">
      <section className="sr-section">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h1 className="sr-h1">Resumen del expediente</h1>
          <button className="sr-btn-secondary" onClick={() => navigate(-1)}>← Volver</button>
        </div>

        <div className="sr-card">
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <tbody>
              <Row label="Expediente interno" value={caseId} />
              <Row label="Estado" value={statusLabel(data)} />
              <Row label="Autorización firmada" value={authorized ? "Recibida" : loading ? "Revisando…" : "Pendiente"} />
              <Row label="Pago" value={paid ? "paid" : data?.payment_status || (loading ? "Revisando…" : "Pendiente")} />
            </tbody>
          </table>

          <div style={{ marginTop: 16 }}>
            <strong>Estado del expediente</strong>
            <p className="sr-p" style={{ marginTop: 6 }}>{messageFor(data, loading)}</p>

            <button className="sr-btn-secondary" onClick={() => loadStatus()} disabled={loading}>
              {loading ? "Revisando…" : "Revisar de nuevo"}
            </button>
          </div>

          {technicalError ? (
            <details style={{ marginTop: 14, color: "#64748b", fontSize: 12 }}>
              <summary>Detalle técnico</summary>
              <div style={{ marginTop: 8, wordBreak: "break-word" }}>{technicalError}</div>
            </details>
          ) : null}
        </div>

        {showAuthNeeded ? (
          <div className="sr-card" style={{ marginTop: 16 }}>
            <h2 className="sr-h2">Completar autorización</h2>
            <p className="sr-p">
              Para continuar, necesitamos tus datos y la autorización firmada.
            </p>
            <Link className="sr-btn-primary" to={`/autorizar?case=${encodeURIComponent(caseId)}`}>
              Completar autorización
            </Link>
          </div>
        ) : null}

        {showPayButton ? (
          <>
            <div className="sr-card" style={{ marginTop: 16 }}>
              <h2 className="sr-h2">Tu caso está listo para continuar</h2>
              <p className="sr-p">
                Hemos analizado tu multa. Podemos preparar el recurso y gestionar el caso por ti.
              </p>
            </div>

            <div className="sr-card" style={{ marginTop: 0 }}>
              <h2 className="sr-h2">Continuar con la gestión</h2>
              <p className="sr-p">
                Ya tenemos tu autorización. Ahora puedes iniciar la gestión para que preparemos el recurso y tramitemos el caso en tu nombre.
              </p>

              <button className="sr-btn-primary" onClick={startPayment} disabled={paying || loading}>
                {paying ? "Abriendo pago…" : "Pagar e iniciar gestión"}
              </button>

              {payError ? (
                <div style={{ marginTop: 12, color: "#991b1b", fontWeight: 800 }}>
                  ❌ {payError}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {paid ? (
          <div className="sr-card" style={{ marginTop: 16 }}>
            <h2 className="sr-h2">Gestión en curso</h2>
            <p className="sr-p">
              El pago y la autorización están recibidos. Estamos preparando y gestionando tu expediente.
            </p>
          </div>
        ) : null}

        {!showPayButton && !showAuthNeeded && !paid ? (
          <div className="sr-card" style={{ marginTop: 16 }}>
            <h2 className="sr-h2">Gestión iniciada</h2>
            <p className="sr-p">
              Hemos recibido tu documentación. Desde aquí podrás seguir el estado del expediente.
            </p>
          </div>
        ) : null}
      </section>
    </main>
  );
}

function Row({ label, value }) {
  return (
    <tr style={{ borderBottom: "1px solid #e5e7eb" }}>
      <td style={{ padding: "12px 0", fontWeight: 900, width: "25%" }}>{label}</td>
      <td style={{ padding: "12px 0", color: "#64748b" }}>{value || "—"}</td>
    </tr>
  );
}
