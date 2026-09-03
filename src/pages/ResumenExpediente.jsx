import React, { useEffect, useMemo, useState } from "react";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";
import { apiFetch, RTM_API_CANDIDATES } from "../lib/api.js";
import { requireStripeCheckoutUrl } from "../lib/safeNavigation.js";
import {
  isAuthorizationPendingReview,
  isAuthorizationVerified,
  isVehicleRemovalCase,
} from "../lib/authorizationEvidence.js";
import {
  formatReviewQuote,
  parseReviewCheckoutContext,
  parseReviewCheckoutEnvelope,
  sameReviewQuote,
} from "../lib/reviewCheckout.js";

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
  for (const base of RTM_API_CANDIDATES) {
    const url = buildUrl(base, path);
    try {
      const response = await apiFetch(url, options);
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
  return String(v || "").trim().toLowerCase() === "paid";
}

function isAuthorized(data) {
  return isAuthorizationVerified(data);
}

function statusLabel(data) {
  if (!data) return "Expediente recibido";
  if (isPaid(data.payment_status)) return "Revisión inicial pagada";
  if (isAuthorized(data)) return "Representación firmada verificada";
  if (isAuthorizationPendingReview(data)) return "Autorización pendiente de revisión";
  if (data.status === "generated") return "Documentación preparada";
  return "Expediente recibido";
}

function messageFor(data, loading) {
  if (loading && !data) return "Revisando la información del expediente…";
  if (!data) return "Hemos recibido la información. Estamos actualizando el expediente.";
  if (isPaid(data.payment_status)) {
    return "La revisión inicial está confirmada. El expediente pasa ahora a valoración por RTM.";
  }
  if (isAuthorized(data)) {
    return "La representación firmada consta como verificada. Antes de continuar te mostramos la cotización autoritativa y el alcance de la revisión inicial.";
  }
  if (isAuthorizationPendingReview(data)) {
    return "Hemos recibido el documento firmado como candidato. Una persona debe revisarlo antes de habilitar cualquier pago o presentación.";
  }
  return "Hemos recibido tu solicitud. Para continuar necesitamos tus datos y la autorización firmada.";
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
  const [reviewContext, setReviewContext] = useState(null);

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
      if (isAuthorized(last) && !isPaid(last?.payment_status)) {
        try {
          const contextPayload = await fetchJsonFallback(
            `/billing/review-context/${encodeURIComponent(caseId)}`
          );
          setReviewContext(parseReviewCheckoutContext(contextPayload, caseId));
        } catch (contextError) {
          setReviewContext(null);
          setTechnicalError(
            contextError?.message || "No se pudo verificar la cotización."
          );
        }
      } else {
        setReviewContext(null);
      }
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
      if (!isAuthorized(current)) {
        throw new Error("La autorización firmada todavía no está verificada.");
      }

      const contextPayload = await fetchJsonFallback(
        `/billing/review-context/${encodeURIComponent(caseId)}`
      );
      const latestContext = parseReviewCheckoutContext(contextPayload, caseId);
      if (!latestContext.signedAuthorityVerified || !latestContext.ready) {
        setReviewContext(latestContext);
        throw new Error(
          "El servidor todavía no confirma que el expediente esté listo para pagar."
        );
      }
      if (!reviewContext?.quote) {
        setReviewContext(latestContext);
        throw new Error(
          "La cotización acaba de actualizarse. Revísala antes de iniciar el pago."
        );
      }
      if (!sameReviewQuote(reviewContext.quote, latestContext.quote)) {
        setReviewContext(latestContext);
        throw new Error(
          "La cotización ha cambiado. Revisa el nuevo importe antes de continuar."
        );
      }

      const email =
        current?.contact_email ||
        current?.interested_data?.email ||
        current?.email ||
        "";

      const checkout = await fetchJsonFallback("/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          case_id: caseId,
          product: latestContext.quote.serviceCode,
          payment_stage: "review",
          email: email || null,
        }),
      });
      const verifiedCheckout = parseReviewCheckoutEnvelope(
        checkout,
        latestContext.quote
      );

      if (verifiedCheckout.alreadyPaid) {
        navigate(`/pago-ok?case=${encodeURIComponent(caseId)}`);
        return;
      }

      window.location.assign(requireStripeCheckoutUrl(verifiedCheckout.url));
    } catch (e) {
      setPayError(e?.message || "No se pudo iniciar el pago.");
    } finally {
      setPaying(false);
    }
  }

  const paid = isPaid(data?.payment_status);
  const authorized = isAuthorized(data);
  const authorizationPending = isAuthorizationPendingReview(data);
  const reviewQuote = reviewContext?.quote || null;
  const authoritativeReady = Boolean(
    reviewQuote && reviewContext?.ready && reviewContext?.signedAuthorityVerified
  );
  const showPayButton = authorized && !paid && authoritativeReady;
  const showAuthNeeded = !authorized && !authorizationPending && !paid;

  if (data && isVehicleRemovalCase(data)) {
    return (
      <Navigate
        to={`/eliminar-coche?case=${encodeURIComponent(caseId)}`}
        replace
      />
    );
  }

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
              <Row label="Autorización firmada" value={authorized ? "Verificada" : authorizationPending ? "Pendiente de revisión humana" : loading ? "Revisando…" : "Pendiente"} />
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

        {authorizationPending && !paid ? (
          <div className="sr-card" style={{ marginTop: 16 }} role="status">
            <h2 className="sr-h2">Autorización en revisión</h2>
            <p className="sr-p">
              El documento está recibido como candidato, pero todavía no ha sido
              verificado por una persona. No se habilitarán pagos ni presentaciones
              hasta completar esa revisión.
            </p>
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
              <h2 className="sr-h2">{reviewQuote.label}</h2>

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
                    {formatReviewQuote(reviewQuote)}
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

              <button className="sr-btn-primary" onClick={startPayment} disabled={paying || loading}>
                {paying
                  ? "Abriendo pago…"
                  : `Pagar revisión inicial · ${formatReviewQuote(reviewQuote)}`}
              </button>

              {payError ? (
                <div style={{ marginTop: 12, color: "#991b1b", fontWeight: 800 }}>
                  ❌ {payError}
                </div>
              ) : null}
            </div>
          </>
        ) : null}

        {authorized && !paid && !authoritativeReady ? (
          <div className="sr-card" style={{ marginTop: 16 }} role="status">
            <h2 className="sr-h2">Cotización pendiente de verificación</h2>
            <p className="sr-p">
              El pago permanece bloqueado hasta que el servidor confirme el importe,
              la moneda, el servicio y que el expediente está listo.
            </p>
            {payError ? (
              <div style={{ marginTop: 12, color: "#991b1b", fontWeight: 800 }}>
                ❌ {payError}
              </div>
            ) : null}
          </div>
        ) : null}

        {paid ? (
          <div className="sr-card" style={{ marginTop: 16 }}>
            <h2 className="sr-h2">Revisión inicial en curso</h2>
            <p className="sr-p">
              El servidor confirma el pago. RTM revisará el expediente y te
              explicará el resultado, las opciones disponibles y el coste de cualquier
              gestión posterior antes de que tengas que decidir.
            </p>
          </div>
        ) : null}

        {!authorized &&
        !authorizationPending &&
        !showPayButton &&
        !showAuthNeeded &&
        !paid ? (
          <div className="sr-card" style={{ marginTop: 16 }}>
            <h2 className="sr-h2">Gestión iniciada</h2>
            <p className="sr-p">
              Hemos recibido la información. Desde aquí podrás seguir el estado del expediente.
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
