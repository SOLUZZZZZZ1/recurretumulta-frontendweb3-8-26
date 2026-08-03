import { useEffect, useMemo, useState } from "react";

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

function getEmailFromStatus(status) {
  return (
    status?.interested_data?.email ||
    status?.authorization_email ||
    status?.contact_email ||
    status?.email ||
    ""
  );
}

function isAuthorizedForPayment(status, billingAuthorized) {
  if (billingAuthorized) return true;
  if (!status) return false;

  const msg = String(status?.message || "").toLowerCase();
  const signedLabel = String(
    status?.authorization_signed ||
      status?.authorization_status ||
      status?.authorization_firmada ||
      ""
  ).toLowerCase();

  return (
    status?.authorized === true ||
    status?.authorized === "true" ||
    signedLabel === "true" ||
    signedLabel === "received" ||
    signedLabel === "recibida" ||
    status?.status === "ready_to_pay" ||
    status?.status === "manual_review" ||
    status?.status === "in_review" ||
    msg.includes("ya tenemos tu autorización") ||
    msg.includes("ya tenemos tu autorizacion") ||
    msg.includes("autorización firmada") ||
    msg.includes("autorizacion firmada")
  );
}

export default function PagarPresentar({ caseId, publicStatus, onUpdated }) {
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [debug, setDebug] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [billingAuthorized, setBillingAuthorized] = useState(false);
  const [freshStatus, setFreshStatus] = useState(null);
  const [manualEmail, setManualEmail] = useState("");

  const effectiveStatus = freshStatus || publicStatus || {};

  const email = useMemo(() => {
    return getEmailFromStatus(effectiveStatus) || manualEmail.trim();
  }, [effectiveStatus, manualEmail]);

  const paid =
    effectiveStatus?.payment_status === "paid" ||
    publicStatus?.payment_status === "paid" ||
    paymentStatus === "paid";

  const canPay = isAuthorizedForPayment(effectiveStatus, billingAuthorized);

  async function refreshStatus() {
    if (!caseId) return null;

    try {
      const data = await fetchJsonFallback(`/cases/${caseId}/public-status`);
      setFreshStatus(data);

      const e = getEmailFromStatus(data);
      if (e && !manualEmail) setManualEmail(e);

      if (typeof onUpdated === "function") {
        try {
          await onUpdated();
        } catch {}
      }

      return data;
    } catch {
      return null;
    }
  }

  useEffect(() => {
    async function load() {
      if (!caseId) return;

      await refreshStatus();

      try {
        const data = await fetchJsonFallback(`/billing/status/${caseId}`);
        setPaymentStatus(data?.payment_status || "");

        if (data?.authorized === true || data?.authorized === "true") {
          setBillingAuthorized(true);
        }
      } catch {}
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

  async function startCheckout() {
    setMsg("");
    setDebug("");

    if (!caseId) {
      setMsg("❌ No se ha encontrado el expediente.");
      return;
    }

    const latest = (await refreshStatus()) || effectiveStatus;
    const latestEmail = getEmailFromStatus(latest) || manualEmail.trim();
    const latestCanPay = isAuthorizedForPayment(latest, billingAuthorized);

    if (!latestCanPay) {
      setMsg("❌ Primero completa la autorización del expediente.");
      return;
    }

    if (!latestEmail) {
      setMsg("❌ Falta el email del interesado. Escríbelo aquí para continuar.");
      return;
    }

    setLoading(true);

    try {
      const data = await fetchJsonFallback("/billing/checkout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          case_id: caseId,
          product: "dgt",
          email: latestEmail,
          locale: "es",
        }),
      });

      if (data?.already_paid) {
        setPaymentStatus("paid");
        setMsg("✅ Este expediente ya está pagado.");
        if (typeof onUpdated === "function") await onUpdated();
        return;
      }

      const url = data?.url || data?.redirect;

      if (!url) {
        throw new Error("El backend no devolvió URL de Stripe.");
      }

      window.location.assign(url);
    } catch (e) {
      setMsg("❌ No se pudo iniciar el pago.");
      setDebug(e?.message || "");
    } finally {
      setLoading(false);
    }
  }

  if (paid) {
    return (
      <div className="sr-card">
        <h3 className="sr-h3">Gestión iniciada</h3>
        <p className="sr-p">
          Pago y autorización registrados correctamente. Te avisaremos con los próximos pasos
          y el estado de la tramitación.
        </p>
      </div>
    );
  }

  return (
    <div className="sr-card">
      <h3 className="sr-h3">Continuar con la gestión</h3>

      <p className="sr-p">
        Ya tenemos tu autorización. Ahora puedes iniciar la gestión para que preparemos
        el recurso y tramitemos el caso en tu nombre.
      </p>

      {!canPay ? (
        <div
          style={{
            background: "#fff7ed",
            color: "#9a3412",
            border: "1px solid #fed7aa",
            borderRadius: 14,
            padding: 12,
            marginBottom: 14,
            fontWeight: 800,
          }}
        >
          Primero completa la autorización del expediente.
        </div>
      ) : null}

      {!email ? (
        <div style={{ marginBottom: 14 }}>
          <label style={{ display: "block", fontWeight: 900, marginBottom: 6 }}>
            Email para confirmación
          </label>
          <input
            type="email"
            value={manualEmail}
            onChange={(e) => {
              setManualEmail(e.target.value);
              setMsg("");
            }}
            placeholder="tu@email.com"
            style={{
              width: "100%",
              boxSizing: "border-box",
              border: "1px solid #cbd5e1",
              borderRadius: 12,
              padding: "11px 12px",
              fontSize: 15,
              background: "#fff",
            }}
          />
        </div>
      ) : null}

      <div className="sr-cta-row" style={{ justifyContent: "flex-start" }}>
        <button
          type="button"
          className="sr-btn-primary"
          onClick={startCheckout}
          disabled={loading}
        >
          {loading ? "Redirigiendo…" : "Pagar e iniciar gestión"}
        </button>
      </div>

      {msg ? (
        <div
          style={{
            marginTop: 14,
            color: msg.startsWith("✅") ? "#166534" : "#991b1b",
            fontWeight: 900,
          }}
        >
          {msg}
        </div>
      ) : null}

      {debug ? (
        <div
          style={{
            marginTop: 10,
            background: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 12,
            padding: 10,
            color: "#475569",
            fontSize: 12,
            wordBreak: "break-word",
          }}
        >
          Detalle: {debug}
        </div>
      ) : null}
    </div>
  );
}
