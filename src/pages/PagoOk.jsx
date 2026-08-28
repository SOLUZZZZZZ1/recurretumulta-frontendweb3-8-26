import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import { apiFetch, RTM_API_BASE } from "../lib/api.js";

function paramsFromSearch(search) {
  const qs = new URLSearchParams(search);
  return {
    caseId: qs.get("case") || qs.get("case_id") || qs.get("id") || "",
    sessionId: qs.get("session_id") || "",
  };
}

async function readJson(response) {
  const text = await response.text().catch(() => "");
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!response.ok) {
    const detail = data?.detail || data?.message || data?.raw || `HTTP ${response.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  return data;
}

async function postConfirm(caseId, sessionId) {
  const response = await apiFetch(`${RTM_API_BASE}/billing/confirm`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      case_id: caseId,
      session_id: sessionId,
    }),
  });

  return readJson(response);
}

async function getPublicStatus(caseId) {
  const response = await apiFetch(`${RTM_API_BASE}/cases/${encodeURIComponent(caseId)}/public-status`, {
    method: "GET",
  });

  return readJson(response);
}

async function getBillingStatus(caseId) {
  const response = await apiFetch(`${RTM_API_BASE}/billing/status/${encodeURIComponent(caseId)}`, {
    method: "GET",
  });

  return readJson(response);
}

function isPaid(value) {
  const v = String(value || "").toLowerCase();
  return v === "paid" || v === "succeeded" || v === "complete" || v === "completed";
}

export default function PagoOk() {
  const location = useLocation();
  const navigate = useNavigate();

  const { caseId, sessionId } = useMemo(
    () => paramsFromSearch(location.search),
    [location.search]
  );

  const [state, setState] = useState("confirming");
  const [message, setMessage] = useState("Confirmando el pago…");
  const [detail, setDetail] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!caseId) {
        setState("error");
        setMessage("No se ha encontrado el expediente.");
        return;
      }

      try {
        if (!sessionId) {
          setState("processing");
          setMessage("Pago recibido. Estamos sincronizando el expediente.");
        } else {
          await postConfirm(caseId, sessionId);
        }

        let finalStatus = null;

        for (let i = 0; i < 10; i += 1) {
          try {
            finalStatus = await getPublicStatus(caseId);
            if (isPaid(finalStatus?.payment_status)) break;
          } catch {
            try {
              finalStatus = await getBillingStatus(caseId);
              if (isPaid(finalStatus?.payment_status)) break;
            } catch {
              // siguiente intento
            }
          }

          await new Promise((resolve) => setTimeout(resolve, 900));
        }

        if (cancelled) return;

        if (isPaid(finalStatus?.payment_status)) {
          setState("ok");
          setMessage("Tu pago se ha realizado correctamente. Estamos gestionando tu expediente.");
        } else {
          setState("processing");
          setMessage("Pago recibido. Estamos terminando de sincronizar el expediente.");
        }

        setTimeout(() => {
          navigate(`/resumen?case=${encodeURIComponent(caseId)}`, { replace: true });
        }, 1600);
      } catch (e) {
        if (cancelled) return;

        // No mostramos al cliente que “falló el pago” si Stripe lo ha cobrado.
        // Guardamos el detalle técnico y lo mandamos al resumen.
        setState("processing");
        setMessage("Pago recibido. Estamos terminando de confirmar el expediente.");
        setDetail(e?.message || "");

        setTimeout(() => {
          navigate(`/resumen?case=${encodeURIComponent(caseId)}`, { replace: true });
        }, 2600);
      }
    }

    run();

    return () => {
      cancelled = true;
    };
  }, [caseId, sessionId, navigate]);

  return (
    <>
      <Seo title="Pago confirmado · RecurreTuMulta" />

      <main className="sr-container py-12" style={{ minHeight: "calc(100vh - 160px)" }}>
        <h1 className="sr-h1">Pago confirmado</h1>

        <div className="sr-card">
          <p
            className="sr-p"
            style={{
              fontWeight: 800,
              color: state === "error" ? "#991b1b" : "#166534",
            }}
          >
            {state === "error" ? "❌" : "✅"} {message}
          </p>

          {caseId ? (
            <p className="sr-p">
              Expediente: <strong>{caseId}</strong>
            </p>
          ) : null}

          <div
            style={{
              marginTop: 16,
              padding: 16,
              borderRadius: 14,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              color: "#475569",
            }}
          >
            {state === "confirming" && "🔄 Confirmando pago y preparando tu expediente…"}
            {state === "processing" && "🔄 El sistema está sincronizando el pago. No es necesario volver a pagar."}
            {state === "ok" && "Tu expediente queda en gestión. Te avisaremos por email si necesitamos algo más."}
            {state === "error" && "No se pudo confirmar automáticamente. Puedes volver al expediente."}
          </div>

          {detail ? (
            <details style={{ marginTop: 12, color: "#64748b", fontSize: 12 }}>
              <summary>Detalle técnico</summary>
              <div style={{ marginTop: 8, wordBreak: "break-word" }}>{detail}</div>
            </details>
          ) : null}

          <div className="sr-cta-row" style={{ marginTop: 22 }}>
            <Link className="sr-btn-primary" to={`/resumen?case=${encodeURIComponent(caseId)}`}>
              Ver mi expediente
            </Link>
            <Link className="sr-btn-secondary" to="/">
              Ir al inicio
            </Link>
          </div>

          <p className="sr-p" style={{ marginTop: 20 }}>
            Recibirás actualizaciones sobre el estado de tu expediente en tu correo electrónico.
          </p>
        </div>
      </main>
    </>
  );
}
