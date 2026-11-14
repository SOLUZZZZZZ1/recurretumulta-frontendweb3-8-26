import { clientRequest } from "../lib/clientApi.js";
import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import InvoiceRequestFields, { emptyInvoiceData, validInvoiceData } from "../components/InvoiceRequestFields.jsx";

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

function normalizeCode(value = "") {
  return String(value || "").trim().toLowerCase().replace(/[-\s]+/g, "_");
}

function getServiceCode(data) {
  return normalizeCode(
    data?.department ||
      data?.service ||
      data?.service_code ||
      data?.case_type ||
      data?.product_code ||
      data?.interested_data?.department ||
      data?.interested_data?.service ||
      data?.interested_data?.case_type ||
      "review"
  );
}

function getReviewInfo(data) {
  const code = getServiceCode(data);
  const isAdmin =
    code === "administration" ||
    code === "admin" ||
    code === "administracion" ||
    code === "administracion_publica" ||
    code === "aeat" ||
    code === "social_security" ||
    code === "town_hall" ||
    code === "ayuntamiento" ||
    code === "hacienda" ||
    code === "seguridad_social" ||
    code === "catastro" ||
    code === "general_administration";

  return {
    product: isAdmin ? "administration" : code || "review",
    amount: isAdmin ? 25 : 10,
    label: isAdmin ? "Revisión inicial administrativa" : "Revisión inicial del expediente",
  };
}

function caseProgress(data) {
  const status = normalizeCode(data?.status);
  if (status === "resolved") return { label: "Expediente resuelto", message: "El expediente figura como resuelto. Si necesitas aclaraciones sobre el resultado, contacta con RTM indicando tu número de expediente." };
  if (status === "closed") return { label: "Expediente cerrado", message: "El expediente figura como cerrado. Si necesitas aclaraciones, contacta con RTM indicando tu número de expediente." };
  if (status === "submitted" || status.includes("presentado")) return { label: "Expediente presentado", message: "El expediente figura como presentado. Desde aquí puedes consultar su estado." };
  return null;
}

function statusLabel(data, loading) {
  if (!data) return loading ? "Revisando…" : "Estado no confirmado";
  if (caseProgress(data)) return caseProgress(data).label;
  if (isPaid(data.payment_status)) return "Revisión inicial pagada";
  if (isAuthorized(data)) return "Autorización recibida";
  if (data.status === "generated") return "Documentación preparada";
  return "Expediente recibido";
}

function messageFor(data, loading) {
  if (loading && !data) return "Revisando la información del expediente…";
  if (!data) return "El estado del expediente todavía no está disponible.";
  if (caseProgress(data)) return caseProgress(data).message;
  if (isPaid(data.payment_status)) {
    return "La revisión inicial está confirmada. El expediente pasa ahora a valoración por RTM.";
  }
  if (isAuthorized(data)) {
    return "Ya tenemos tu autorización. Antes de continuar te explicamos el coste y el alcance de la revisión inicial.";
  }
  return "Hemos recibido tu solicitud. Para continuar necesitamos tus datos y la autorización firmada.";
}

export default function Resumen() {
  const location = useLocation();
  const caseId = getCaseId(location.search);
  return <ResumenContent key={caseId} caseId={caseId} />;
}

function ResumenContent({ caseId }) {
  const navigate = useNavigate();
  const requestVersion = useRef(0);
  const requestPending = useRef(false);

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [technicalError, setTechnicalError] = useState("");
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");
  const [invoiceRequested, setInvoiceRequested] = useState(false);
  const [invoiceData, setInvoiceData] = useState(emptyInvoiceData);

  async function loadStatus({ silent = false } = {}) {
    if (requestPending.current) return;
    if (!caseId) {
      setTechnicalError("No se ha encontrado el expediente.");
      setLoading(false);
      return;
    }

    const version = ++requestVersion.current;
    requestPending.current = true;
    if (!silent) setLoading(true);

    try {
      let last = null;
      // varios intentos para evitar ver estados intermedios justo tras pago/autorización
      for (let i = 0; i < 4; i += 1) {
        last = await clientRequest(`/cases/${caseId}/public-status`);
        if (version !== requestVersion.current) return;
        if (isPaid(last?.payment_status) || isAuthorized(last) || caseProgress(last)) break;
        await new Promise((resolve) => setTimeout(resolve, 900));
        if (version !== requestVersion.current) return;
      }
      setData(last);
      setTechnicalError("");
    } catch (e) {
      if (version !== requestVersion.current) return;
      setData(null);
      setTechnicalError(e?.message || "No se pudo consultar el expediente.");
    } finally {
      if (version === requestVersion.current) {
        requestPending.current = false;
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    loadStatus();
    const id = setInterval(() => loadStatus({ silent: true }), 5000);
    return () => {
      clearInterval(id);
      requestVersion.current += 1;
      requestPending.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function startPayment() {
    setPayError("");
    if (invoiceRequested && !validInvoiceData(invoiceData)) {
      setPayError("Completa todos los datos fiscales para solicitar la factura.");
      return;
    }
    setPaying(true);

    try {
      // Refresco justo antes de pagar para no pedir doble pago.
      const current = await clientRequest(`/cases/${caseId}/public-status`);
      setData(current);
      if (caseProgress(current)) return;

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

      const checkout = await clientRequest("/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          product: getReviewInfo(current).product,
          payment_stage: "review",
          email,
          invoice_requested: invoiceRequested,
          invoice_data: invoiceRequested ? invoiceData : null,
        }),
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
  const reviewInfo = getReviewInfo(data);
  const progress = caseProgress(data);
  const showPayButton = Boolean(data) && !technicalError && !progress && authorized && !paid;
  const showAuthNeeded = Boolean(data) && !technicalError && !progress && !authorized && !paid;

  return (
    <main className="sr-page">
      <section className="sr-section">
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
          <h1 className="sr-h1">Resumen del expediente</h1>
          <button className="sr-btn-secondary" onClick={() => navigate(-1)}>← Volver</button>
        </div>

        <div className="sr-card">
          <table style={{ width: "100%", tableLayout: "fixed", borderCollapse: "collapse" }}>
            <tbody>
              <Row label="Expediente interno" value={caseId} />
              <Row label="Estado" value={statusLabel(data, loading)} />
              <Row label="Autorización firmada" value={!data ? (loading ? "Revisando…" : "Sin confirmar") : authorized ? "Recibida" : "Pendiente"} />
              <Row label="Pago" value={!data ? (loading ? "Revisando…" : "Sin confirmar") : paid ? "Confirmado" : "Pendiente de confirmar"} />
            </tbody>
          </table>

          <div style={{ marginTop: 16 }}>
            <strong>Estado del expediente</strong>
            {technicalError ? (
              <p role="alert" className="sr-p" style={{ marginTop: 6, color: "#991b1b" }}>
                {caseId ? "No hemos podido consultar el estado del expediente. Pulsa «Revisar de nuevo» para volver a intentarlo." : "Falta el número de expediente. Vuelve al inicio e introduce el número que recibiste."}
              </p>
            ) : <p className="sr-p" style={{ marginTop: 6 }}>{messageFor(data, loading)}</p>}

            <button className="sr-btn-secondary" onClick={() => loadStatus()} disabled={loading || !caseId}>
              {loading ? "Revisando…" : "Revisar de nuevo"}
            </button>
            {!caseId ? <Link className="sr-btn-secondary" to="/">Volver al inicio</Link> : null}
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
              <h2 className="sr-h2">Antes de iniciar la revisión</h2>
              <p className="sr-p">
                RTM revisará la documentación y la situación del expediente para determinar
                qué opciones existen y cuál es la mejor forma de continuar.
              </p>
            </div>

            <div className="sr-card" style={{ marginTop: 0 }}>
              <h2 className="sr-h2">{reviewInfo.label}</h2>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
                  gap: 12,
                  margin: "16px 0",
                }}
              >
                <div style={{ padding: 16, borderRadius: 16, background: "#eff6ff" }}>
                  <div style={{ color: "#475569", fontSize: 13, fontWeight: 800 }}>
                    Importe ahora
                  </div>
                  <div style={{ marginTop: 4, color: "#0f172a", fontSize: 30, fontWeight: 950 }}>
                    {reviewInfo.amount} €
                  </div>
                </div>

                <div style={{ padding: 16, borderRadius: 16, background: "#f8fafc" }}>
                  <div style={{ color: "#475569", fontSize: 13, fontWeight: 800 }}>
                    Después de la revisión
                  </div>
                  <div style={{ marginTop: 6, color: "#0f172a", fontWeight: 900 }}>
                    Recibirás una valoración clara antes de decidir
                  </div>
                </div>
              </div>

              <p className="sr-p">
                Este pago corresponde únicamente a la revisión inicial. Si después decides
                continuar con una gestión de pago, descontaremos este importe del precio que
                corresponda. No se realizará ningún cobro posterior sin informarte primero.
              </p>

              <InvoiceRequestFields
                requested={invoiceRequested}
                onRequestedChange={(requested) => { setInvoiceRequested(requested); setPayError(""); }}
                data={invoiceData}
                onDataChange={(nextData) => { setInvoiceData(nextData); setPayError(""); }}
                disabled={paying}
              />

              <button className="sr-btn-primary" onClick={startPayment} disabled={paying || loading}>
                {paying ? "Abriendo pago…" : `Pagar revisión inicial · ${reviewInfo.amount} €`}
              </button>

              {payError ? (
                <div role="alert" style={{ marginTop: 12, color: "#991b1b", fontWeight: 800 }}>
                  ❌ {payError}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {paid && !progress ? (
          <div className="sr-card" style={{ marginTop: 16 }}>
            <h2 className="sr-h2">Revisión inicial en curso</h2>
            <p className="sr-p">
              Hemos recibido el pago de la revisión inicial. RTM revisará el expediente y te
              explicará el resultado, las opciones disponibles y el coste de cualquier
              gestión posterior antes de que tengas que decidir.
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
      <th scope="row" style={{ padding: "12px 10px 12px 0", textAlign: "left", fontWeight: 900, width: "42%", overflowWrap: "anywhere" }}>{label}</th>
      <td style={{ padding: "12px 0", color: "#64748b", overflowWrap: "anywhere" }}>{value || "—"}</td>
    </tr>
  );
}
