import React, { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import Seo from "../components/Seo.jsx";
import PagarPresentar from "../components/PagarPresentar.jsx";
import AppendDocuments from "../components/AppendDocuments.jsx";
import ContactoExpediente from "../components/ContactoExpediente.jsx";

const API = "/api";

function useQuery() {
  const { search } = useLocation();
  return useMemo(() => new URLSearchParams(search), [search]);
}

async function fetchJson(url, options = {}) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || data?.message || "Error API");
  return data;
}

function isDevSandbox(searchParams) {
  const stored = window.localStorage.getItem("rtm_dev_mode") === "1";
  const isLocalhost =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";
  return searchParams.get("dev") === "1" || stored || isLocalhost;
}

function getMockStatus(caseId) {
  try {
    const raw = window.localStorage.getItem(`rtm_mock_case_${caseId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveMockStatus(caseId, patch = {}) {
  const prev = getMockStatus(caseId) || {};
  const next = { ...prev, ...patch };
  window.localStorage.setItem(`rtm_mock_case_${caseId}`, JSON.stringify(next));
  return next;
}

function Row({ label, value }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "220px 1fr",
        gap: 10,
        padding: "8px 0",
        borderBottom: "1px solid #e5e7eb",
      }}
    >
      <div className="sr-small" style={{ fontWeight: 800 }}>
        {label}
      </div>
      <div className="sr-p" style={{ margin: 0 }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

export default function ResumenExpediente() {
  const q = useQuery();
  const caseId = q.get("case") || "";
  const devMode = isDevSandbox(q);

  const [publicStatus, setPublicStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function refresh(runReview = false) {
    if (!caseId) return;
    setErr("");
    setLoading(true);
    try {
      if (devMode) {
        const mock = getMockStatus(caseId) || {
          status: "uploaded",
          message: "Modo prueba activo. Selecciona un estado para simular el flujo.",
          payment_status: "pending",
          authorized: false,
        };
        setPublicStatus(mock);
        return;
      }

      if (runReview) {
        await fetchJson(`${API}/cases/${encodeURIComponent(caseId)}/review`, {
          method: "POST",
        });
      }
      const st = await fetchJson(
        `${API}/cases/${encodeURIComponent(caseId)}/public-status`
      );
      setPublicStatus(st);
    } catch (e) {
      setErr(e.message || "No se pudo revisar el expediente.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!caseId) return;
    refresh(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [caseId, devMode]);

  const status = publicStatus?.status || "uploaded";

  function applyDevStatus(nextStatus) {
    if (!caseId) return;
    const messages = {
      uploaded: "Modo prueba: expediente creado y pendiente de revisión.",
      pending_documents: "Modo prueba: expediente pendiente de documentación.",
      awaiting_authorization: "Modo prueba: falta autorización firmada.",
      ready_to_pay: "Modo prueba: expediente listo para pago.",
      paid: "Modo prueba: pago simulado correctamente.",
      in_review: "Modo prueba: expediente en revisión.",
    };

    const patch = {
      status: nextStatus,
      message: messages[nextStatus] || "Modo prueba activo.",
      payment_status: nextStatus === "paid" ? "paid" : "pending",
      authorized: nextStatus === "ready_to_pay" || nextStatus === "paid",
    };

    const next = saveMockStatus(caseId, patch);
    setPublicStatus(next);
  }

  return (
    <>
      <Seo title="Resumen del expediente · RecurreTuMulta" />

      <main
        className="sr-container py-12"
        style={{ minHeight: "calc(100vh - 160px)" }}
      >
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <h1 className="sr-h1">Resumen del expediente</h1>
          <Link to="/" className="sr-btn-secondary">
            ← Volver
          </Link>
        </div>

        {devMode && (
          <div className="sr-card" style={{ background: "#fffbeb", border: "1px solid #fde68a", marginBottom: 14 }}>
            <h3 className="sr-h3" style={{ marginTop: 0 }}>🧪 Sandbox de prueba</h3>
            <p className="sr-p">
              Este modo te permite probar el flujo completo sin una multa real y sin depender del backend.
            </p>
            <div className="sr-cta-row" style={{ justifyContent: "flex-start", flexWrap: "wrap" }}>
              <button className="sr-btn-secondary" onClick={() => applyDevStatus("uploaded")}>
                Expediente creado
              </button>
              <button className="sr-btn-secondary" onClick={() => applyDevStatus("awaiting_authorization")}>
                Falta autorización
              </button>
              <button className="sr-btn-secondary" onClick={() => applyDevStatus("pending_documents")}>
                Faltan documentos
              </button>
              <button className="sr-btn-secondary" onClick={() => applyDevStatus("ready_to_pay")}>
                Listo para pago
              </button>
              <button className="sr-btn-secondary" onClick={() => applyDevStatus("paid")}>
                Pago simulado
              </button>
            </div>
            <div className="sr-small" style={{ marginTop: 10, color: "#6b7280" }}>
              Actívalo entrando a la ruta con <strong>?dev=1</strong>, por ejemplo:
              {" "}#/resumen?case=TEST-001&dev=1
            </div>
          </div>
        )}

        <div className="sr-card">
          <Row label="Expediente interno" value={caseId} />
          <Row label="Estado" value={publicStatus?.status || "uploaded"} />
          <Row label="Autorización firmada" value={publicStatus?.authorized ? "Recibida" : "Pendiente"} />
          <Row label="Pago" value={publicStatus?.payment_status || "Pendiente"} />

          <div style={{ marginTop: 10 }}>
            <div className="sr-small" style={{ fontWeight: 800 }}>
              Estado del expediente
            </div>
            <div className="sr-p" style={{ margin: 0 }}>
              {loading
                ? "Revisando documentación…"
                : publicStatus?.message || "—"}
            </div>
          </div>

          {err && (
            <div
              className="sr-small"
              style={{ marginTop: 10, color: "#991b1b" }}
            >
              ❌ {err}
            </div>
          )}

          <div
            className="sr-cta-row"
            style={{ justifyContent: "flex-start", marginTop: 12 }}
          >
            <button
              className="sr-btn-secondary"
              onClick={() => refresh(true)}
              disabled={loading}
            >
              {loading ? "Revisando…" : "Revisar de nuevo"}
            </button>

            {devMode && (
              <Link
                to={`/autorizar?case=${encodeURIComponent(caseId)}&dev=1`}
                className="sr-btn-secondary"
              >
                Ir a autorización (modo prueba)
              </Link>
            )}
          </div>
        </div>

        {status === "pending_documents" && (
          <div style={{ marginTop: 14 }}>
            <div className="sr-card">
              <h3 className="sr-h3" style={{ marginTop: 0 }}>
                Expediente pendiente de documentación
              </h3>
              <p className="sr-p">
                Aún no se puede presentar el recurso. Si recibes una nueva
                notificación o resolución, súbela para completar el expediente.
              </p>

              <ContactoExpediente caseId={caseId} publicStatus={publicStatus} onSaved={() => refresh(false)} />
            </div>

            <AppendDocuments caseId={caseId} onDone={() => refresh(true)} />
          </div>
        )}

        {status === "awaiting_authorization" && (
          <div style={{ marginTop: 14 }} className="sr-card">
            <h3 className="sr-h3" style={{ marginTop: 0 }}>
              Falta la autorización firmada
            </h3>
            <p className="sr-p">
              Antes de continuar, necesitamos la autorización firmada para poder tramitar tu expediente en tu nombre.
            </p>
            <div className="sr-cta-row" style={{ justifyContent: "flex-start" }}>
              <Link
                to={`/autorizar?case=${encodeURIComponent(caseId)}${devMode ? "&dev=1" : ""}`}
                className="sr-btn-primary"
              >
                Completar autorización
              </Link>
            </div>
          </div>
        )}

        {status === "ready_to_pay" && (
          <div style={{ marginTop: 14 }}>
            <div className="sr-card">
              <h3 className="sr-h3" style={{ marginTop: 0 }}>
                Tu expediente puede tramitarse ahora
              </h3>
              <p className="sr-p">
                Hemos revisado tu documentación y tu expediente puede tramitarse en este
                momento. Si quieres, podemos presentarlo en tu nombre.
              </p>
            </div>

            {devMode ? (
              <div className="sr-card">
                <p className="sr-p" style={{ marginTop: 0 }}>
                  🧪 <strong>Modo prueba:</strong> el pago real está desactivado.
                </p>
                <div className="sr-cta-row" style={{ justifyContent: "flex-start" }}>
                  <button className="sr-btn-primary" onClick={() => applyDevStatus("paid")}>
                    Simular pago correcto
                  </button>
                </div>
              </div>
            ) : (
              <PagarPresentar caseId={caseId} />
            )}
          </div>
        )}

        {status === "paid" && (
          <div style={{ marginTop: 14 }} className="sr-card">
            <h3 className="sr-h3" style={{ marginTop: 0 }}>
              Pago confirmado
            </h3>
            <p className="sr-p">
              Tu expediente ha quedado marcado como pagado. Continuamos con la tramitación.
            </p>
          </div>
        )}

        {status !== "pending_documents" &&
          status !== "ready_to_pay" &&
          status !== "awaiting_authorization" &&
          status !== "paid" && (
          <div style={{ marginTop: 14 }} className="sr-card">
            <h3 className="sr-h3" style={{ marginTop: 0 }}>
              Expediente en revisión
            </h3>
            <p className="sr-p">
              Estamos revisando tu documentación. Desde aquí podrás seguir el estado de tu expediente
              y completar los pasos pendientes cuando sea necesario.
            </p>
          </div>
        )}
      </main>
    </>
  );
}
