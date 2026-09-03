import { useEffect, useState } from "react";
import { apiFetch, RTM_API_CANDIDATES } from "../lib/api.js";

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

function isAuthorizedForPayment(status) {
  return (
    status?.authorization_evidence_status === "verified" &&
    status?.signed_authority_verified === true
  );
}

export default function PagarPresentar({ caseId, publicStatus, onUpdated }) {
  const [paymentStatus, setPaymentStatus] = useState("");
  const [freshStatus, setFreshStatus] = useState(null);

  const effectiveStatus = freshStatus || publicStatus || {};

  const paid =
    effectiveStatus?.payment_status === "paid" ||
    publicStatus?.payment_status === "paid" ||
    paymentStatus === "paid";

  const canPay = isAuthorizedForPayment(effectiveStatus);

  async function refreshStatus() {
    if (!caseId) return null;

    try {
      const data = await fetchJsonFallback(`/cases/${caseId}/public-status`);
      setFreshStatus(data);

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

      } catch {}
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId]);

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
        La continuación económica se habilitará cuando una revisión humana haya
        fijado y comunicado el presupuesto final de este expediente.
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
          La autorización firmada todavía no consta verificada por una revisión humana.
        </div>
      ) : null}

      <div
        role="status"
        style={{
          padding: 12,
          borderRadius: 14,
          border: "1px solid #bfdbfe",
          background: "#eff6ff",
          color: "#1e3a8a",
          fontWeight: 800,
        }}
      >
        Pago final no disponible hasta disponer de una cotización aprobada para
        este expediente.
      </div>

    </div>
  );
}
