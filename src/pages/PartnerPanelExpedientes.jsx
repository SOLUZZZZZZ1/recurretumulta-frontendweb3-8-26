import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Seo from "../components/Seo.jsx";
import { Link, useNavigate } from "react-router-dom";
import {
  clearPartnerSession,
  getPartnerSessionValue,
  hasPartnerSessionHint,
  parsePartnerSessionEnvelope,
  partnerSessionRemainingMs,
  setPartnerSessionValue,
} from "../lib/partnerSession.js";
import {
  bindPartnerCookieSession,
  clearPartnerCookieSessionBinding,
  partnerFetch,
  readJsonResponseLimited,
  readPartnerCsrfToken,
} from "../lib/partnerApi.js";
import {
  normalizePartnerSearch,
  parsePartnerCasesEnvelope,
  PARTNER_CASE_PAGE_LIMIT,
  PARTNER_CASE_RESPONSE_MAX_BYTES,
  PARTNER_SEARCH_MAX_CHARS,
} from "../lib/partnerCases.js";
import {
  announcePartnerSessionChange,
  bindPartnerCrossTabSession,
  bindPartnerViewLifecycle,
} from "../lib/partnerViewLifecycle.js";

const API = "/api";
const MAX_CURSOR_HISTORY = 100;

async function fetchJson(url, options = {}, security = {}) {
  const r = await partnerFetch(url, options, security);
  const data = await readJsonResponseLimited(
    r,
    PARTNER_CASE_RESPONSE_MAX_BYTES
  ).catch(() => ({}));
  if (!r.ok) {
    const error = new Error(data?.detail || `Error HTTP ${r.status}`);
    error.status = r.status;
    throw error;
  }
  return data;
}

function fmt(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("es-ES");
  } catch {
    return String(d);
  }
}

function statusLabel(status) {
  const map = {
    uploaded: "Expediente recibido",
    pending_documents: "Pendiente de documentación",
    ready_to_pay: "Pendiente de pago",
    ready_to_submit: "Listo para presentación",
    submitted: "Recurso presentado",
    closed: "Cerrado",
  };
  return map[status] || status || "—";
}

function paymentLabel(status) {
  const map = {
    paid: "Pago confirmado",
    pending: "Pago pendiente",
    unpaid: "Pago pendiente",
    failed: "Pago fallido",
    refunded: "Reembolsado",
  };
  return map[status] || status || "—";
}

function authorizationEvidenceLabel(status) {
  const map = {
    verified: "Verificada",
    pending_review: "Pendiente de revisión humana",
    rejected: "Rechazada",
    not_submitted: "No presentada",
  };
  return map[status] || "No verificada";
}

function statusTone(status) {
  if (status === "submitted" || status === "closed") {
    return { bg: "#ecfdf5", color: "#166534", border: "#bbf7d0" };
  }
  if (status === "ready_to_submit") {
    return { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe" };
  }
  if (status === "pending_documents") {
    return { bg: "#fff7ed", color: "#c2410c", border: "#fed7aa" };
  }
  if (status === "ready_to_pay") {
    return { bg: "#fefce8", color: "#854d0e", border: "#fde68a" };
  }
  return { bg: "#f8fafc", color: "#334155", border: "#e2e8f0" };
}

function Badge({ children, tone }) {
  const t = tone || { bg: "#f8fafc", color: "#334155", border: "#e2e8f0" };
  return (
    <span
      className="sr-small"
      style={{
        display: "inline-flex",
        alignItems: "center",
        padding: "4px 9px",
        borderRadius: 999,
        background: t.bg,
        color: t.color,
        border: `1px solid ${t.border}`,
        fontWeight: 800,
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

export default function PartnerPanelExpedientes() {
  const nav = useNavigate();

  const [partnerName, setPartnerName] = useState(() => getPartnerSessionValue("partner_name"));
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loggingOut, setLoggingOut] = useState(false);
  const [viewReady, setViewReady] = useState(false);
  const [nextCursor, setNextCursor] = useState(null);
  const [pageNumber, setPageNumber] = useState(1);
  const [loadedQuery, setLoadedQuery] = useState("");
  const [loadedStatus, setLoadedStatus] = useState("");
  const qRef = useRef(q);
  const statusRef = useRef(status);
  const requestGenerationRef = useRef(0);
  const sensitiveViewRef = useRef(null);
  const currentCursorRef = useRef("");
  const cursorHistoryRef = useRef([]);
  qRef.current = q;
  statusRef.current = status;

  const invalidateSensitiveView = useCallback(() => {
    requestGenerationRef.current += 1;
    sensitiveViewRef.current?.setAttribute("hidden", "");
    setViewReady(false);
    setItems([]);
    setPartnerName("");
    setQ("");
    setStatus("");
    setErr("");
    setNextCursor(null);
    setPageNumber(1);
    setLoadedQuery("");
    setLoadedStatus("");
    currentCursorRef.current = "";
    cursorHistoryRef.current = [];
  }, []);

  const endExpiredSession = useCallback(() => {
    invalidateSensitiveView();
    clearPartnerCookieSessionBinding();
    clearPartnerSession();
    nav("/gestorias", { replace: true });
  }, [invalidateSensitiveView, nav]);

  const loadCases = useCallback(async ({
    qValue = qRef.current,
    statusValue = statusRef.current,
    cursor = "",
    history = [],
    hideUntilVerified = false,
    validateSession = false,
  } = {}) => {
    if (!hasPartnerSessionHint()) {
      endExpiredSession();
      return;
    }
    if (hideUntilVerified) invalidateSensitiveView();
    setErr("");

    const qq = normalizePartnerSearch(qValue);
    const st = statusValue;
    const generation = ++requestGenerationRef.current;

    setLoading(true);
    try {
      if (validateSession) {
        const csrfBefore = readPartnerCsrfToken();
        if (!csrfBefore) throw new Error("Falta la protección de la sesión partner.");
        const session = parsePartnerSessionEnvelope(
          await fetchJson(`${API}/partner/session`)
        );
        if (generation !== requestGenerationRef.current) return;
        if (csrfBefore !== readPartnerCsrfToken()) {
          throw new Error("La sesión partner ha cambiado en otra ventana.");
        }
        bindPartnerCookieSession(csrfBefore);
        setPartnerSessionValue("partner_authenticated", "1");
        setPartnerSessionValue("partner_expires_at", session.expiresAt);
        setPartnerSessionValue("partner_name", session.partnerName);
      }

      const params = new URLSearchParams();
      params.set("limit", String(PARTNER_CASE_PAGE_LIMIT));
      if ((qq || "").trim()) params.set("q", qq.trim());
      if ((st || "").trim()) params.set("status", st.trim());
      if (cursor) params.set("cursor", cursor);

      const qs = params.toString();
      const url = qs ? `${API}/partner/cases?${qs}` : `${API}/partner/cases`;

      const data = await fetchJson(url);

      if (generation !== requestGenerationRef.current) return;
      const page = parsePartnerCasesEnvelope(data);
      setItems(page.items);
      setPartnerName(page.partnerName);
      setPartnerSessionValue("partner_name", page.partnerName);
      const boundedHistory = history.slice(-MAX_CURSOR_HISTORY);
      currentCursorRef.current = cursor;
      cursorHistoryRef.current = boundedHistory;
      setNextCursor(page.nextCursor);
      setPageNumber(boundedHistory.length + 1);
      setLoadedQuery(qq.trim());
      setLoadedStatus(st.trim());
      setViewReady(true);
      sensitiveViewRef.current?.removeAttribute("hidden");
    } catch (e) {
      if (generation !== requestGenerationRef.current) return;
      setItems([]);
      if (
        validateSession ||
        e?.code === "PARTNER_SESSION_CHANGED" ||
        e?.status === 401 ||
        e?.status === 403
      ) {
        endExpiredSession();
        return;
      }
      setErr(e.message || "No se pudo cargar el listado de expedientes.");
      setViewReady(true);
      sensitiveViewRef.current?.removeAttribute("hidden");
    } finally {
      if (generation === requestGenerationRef.current) setLoading(false);
    }
  }, [endExpiredSession, invalidateSensitiveView]);

  useEffect(() => {
    const remainingMs = partnerSessionRemainingMs();
    if (!hasPartnerSessionHint() || remainingMs <= 0) {
      endExpiredSession();
      return undefined;
    }

    const expirationTimer = window.setTimeout(
      endExpiredSession,
      Math.min(remainingMs, 2_147_483_647)
    );
    const unbind = bindPartnerViewLifecycle(window, document, {
      invalidate: invalidateSensitiveView,
      revalidate: () => loadCases({
        qValue: "",
        statusValue: "",
        hideUntilVerified: true,
        validateSession: true,
      }),
    });
    const unbindCrossTab = bindPartnerCrossTabSession(window, endExpiredSession);
    setPartnerName(getPartnerSessionValue("partner_name"));
    loadCases({
      qValue: "",
      statusValue: "",
      hideUntilVerified: true,
      validateSession: true,
    });

    return () => {
      window.clearTimeout(expirationTimer);
      unbind();
      unbindCrossTab();
      invalidateSensitiveView();
    };
  }, [endExpiredSession, invalidateSensitiveView, loadCases]);

  const filtersDirty =
    normalizePartnerSearch(q).trim() !== loadedQuery || status.trim() !== loadedStatus;

  function refreshCases() {
    loadCases({ qValue: qRef.current, statusValue: statusRef.current });
  }

  function loadNextPage() {
    if (!nextCursor || filtersDirty || cursorHistoryRef.current.length >= MAX_CURSOR_HISTORY) {
      return;
    }
    loadCases({
      qValue: loadedQuery,
      statusValue: loadedStatus,
      cursor: nextCursor,
      history: [...cursorHistoryRef.current, currentCursorRef.current],
    });
  }

  function loadPreviousPage() {
    if (!cursorHistoryRef.current.length || filtersDirty) return;
    const history = cursorHistoryRef.current.slice(0, -1);
    const cursor = cursorHistoryRef.current[cursorHistoryRef.current.length - 1];
    loadCases({
      qValue: loadedQuery,
      statusValue: loadedStatus,
      cursor,
      history,
    });
  }

  async function logout() {
    invalidateSensitiveView();
    setErr("");
    setLoggingOut(true);
    try {
      await fetchJson(
        `${API}/partner/logout`,
        { method: "POST" },
        { requireCsrf: true }
      );
      clearPartnerSession();
      clearPartnerCookieSessionBinding();
      announcePartnerSessionChange();
      nav("/gestorias");
    } catch (e) {
      if (e?.status === 401 || e?.code === "PARTNER_SESSION_CHANGED") {
        clearPartnerSession();
        clearPartnerCookieSessionBinding();
        announcePartnerSessionChange();
        nav("/gestorias");
        return;
      }
      setErr("No se pudo revocar la sesión en el servidor. Vuelve a intentarlo.");
      setViewReady(true);
      sensitiveViewRef.current?.removeAttribute("hidden");
    } finally {
      setLoggingOut(false);
    }
  }

  const counters = useMemo(() => {
    const total = items.length;
    const pendingDocs = items.filter((x) => x.status === "pending_documents").length;
    const readyToSubmit = items.filter((x) => x.status === "ready_to_submit").length;
    const submitted = items.filter((x) => x.status === "submitted").length;

    return { total, pendingDocs, readyToSubmit, submitted };
  }, [items]);

  return (
    <>
      <Seo
        title="Panel gestorías · RecurreTuMulta"
        description="Listado de expedientes del portal profesional para asesorías."
        canonical="https://www.recurretumulta.eu/partner/panel"
      />

      {!viewReady ? (
        <main className="sr-container py-12" style={{ minHeight: "calc(100vh - 160px)" }}>
          <div className="sr-card">Comprobando la sesión segura…</div>
        </main>
      ) : null}
      <main ref={sensitiveViewRef} hidden={!viewReady} className="sr-container py-12" style={{ minHeight: "calc(100vh - 160px)" }}>
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <h1 className="sr-h1">Panel de expedientes</h1>
            <div className="sr-small" style={{ color: "#6b7280" }}>
              Asesoría: <b>{partnerName || "—"}</b>
            </div>
            <div className="sr-small" style={{ color: "#6b7280", marginTop: 4 }}>
              Sube expedientes, consulta el estado y conserva el histórico para la facturación mensual.
            </div>
          </div>

          <div className="sr-cta-row" style={{ justifyContent: "flex-end" }}>
            <Link to="/gestorias" className="sr-btn-primary">
              + Nuevo expediente
            </Link>
            <Link to="/gestorias" className="sr-btn-secondary">
              ← Volver
            </Link>
            <button className="sr-btn-secondary" onClick={logout} disabled={loggingOut}>
              {loggingOut ? "Cerrando…" : "Salir"}
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-3" style={{ marginBottom: 14 }}>
          <div className="sr-card">
            <div className="sr-small" style={{ color: "#6b7280" }}>En esta página</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{counters.total}</div>
          </div>

          <div className="sr-card">
            <div className="sr-small" style={{ color: "#6b7280" }}>Pendiente documentación</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{counters.pendingDocs}</div>
          </div>

          <div className="sr-card">
            <div className="sr-small" style={{ color: "#6b7280" }}>Listos para presentar</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{counters.readyToSubmit}</div>
          </div>

          <div className="sr-card">
            <div className="sr-small" style={{ color: "#6b7280" }}>Presentados</div>
            <div style={{ fontSize: 28, fontWeight: 900 }}>{counters.submitted}</div>
          </div>
        </div>

        <div className="sr-card">
          <div
            style={{
              display: "grid",
              gap: 12,
              gridTemplateColumns: "minmax(0, 1fr) 220px 180px",
              alignItems: "end",
            }}
          >
            <div>
              <label className="sr-small" style={{ fontWeight: 800 }}>Buscar expediente</label>
              <input
                className="sr-input"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                maxLength={PARTNER_SEARCH_MAX_CHARS}
                placeholder="Expediente, cliente o email"
              />
            </div>

            <div>
              <label className="sr-small" style={{ fontWeight: 800 }}>Estado</label>
              <select className="sr-input" value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="">Todos</option>
                <option value="uploaded">Expediente recibido</option>
                <option value="pending_documents">Pendiente de documentación</option>
                <option value="ready_to_pay">Pendiente de pago</option>
                <option value="ready_to_submit">Listo para presentación</option>
                <option value="submitted">Recurso presentado</option>
                <option value="closed">Cerrado</option>
              </select>
            </div>

            <div className="sr-cta-row" style={{ justifyContent: "flex-start" }}>
              <button className="sr-btn-primary" onClick={refreshCases} disabled={loading}>
                {loading ? "Cargando…" : "Actualizar"}
              </button>
            </div>
          </div>

          {err ? (
            <div className="sr-small" style={{ marginTop: 12, color: "#991b1b" }}>
              ❌ {err}
            </div>
          ) : null}
        </div>

        <div className="sr-card" style={{ marginTop: 14 }}>
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="sr-h3" style={{ margin: 0 }}>Historial de expedientes</div>
              <div className="sr-small" style={{ color: "#6b7280", marginTop: 4 }}>
                Información operativa para seguimiento y facturación. No se muestra el motor interno ni el contenido del recurso.
              </div>
            </div>

            <div className="sr-small" style={{ color: "#6b7280" }}>
              Página {pageNumber} · {items.length} resultados
            </div>
          </div>

          {items.length === 0 ? (
            <div className="sr-small" style={{ marginTop: 12, color: "#6b7280" }}>
              No hay expedientes para mostrar.
            </div>
          ) : (
            <div style={{ marginTop: 12, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", borderBottom: "1px solid #e5e7eb" }}>
                    <th style={{ padding: "10px 8px" }}>Expediente</th>
                    <th style={{ padding: "10px 8px" }}>Cliente</th>
                    <th style={{ padding: "10px 8px" }}>Estado</th>
                    <th style={{ padding: "10px 8px" }}>Autorización</th>
                    <th style={{ padding: "10px 8px" }}>Docs</th>
                    <th style={{ padding: "10px 8px" }}>Actualizado</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.case_id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                        <div className="sr-small" style={{ fontWeight: 900 }}>{item.case_id}</div>
                      </td>

                      <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                        <div className="sr-small" style={{ fontWeight: 800 }}>{item.client_name || "—"}</div>
                        <div className="sr-small" style={{ color: "#6b7280" }}>{item.client_email || "—"}</div>
                      </td>

                      <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                        <Badge tone={statusTone(item.status)}>
                          {statusLabel(item.status)}
                        </Badge>
                        <div className="sr-small" style={{ color: "#6b7280", marginTop: 6 }}>
                          {paymentLabel(item.payment_status)}
                        </div>
                      </td>

                      <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                        <div className="sr-small">
                          Modo: <b>{item.authorization_mode || "—"}</b>
                        </div>
                        <div className="sr-small">
                          Evidencia: <b>{authorizationEvidenceLabel(item.authorization_evidence_status)}</b>
                        </div>
                        <div className="sr-small">
                          Documento físico: <b>{item.authorization_document_uploaded ? "Recibido" : "No recibido"}</b>
                        </div>
                      </td>

                      <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                        <div className="sr-small" style={{ fontWeight: 800 }}>
                          {item.docs_total ?? "—"}
                        </div>
                      </td>

                      <td style={{ padding: "10px 8px", verticalAlign: "top" }}>
                        <div className="sr-small">{fmt(item.updated_at)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="sr-cta-row" style={{ justifyContent: "flex-end", marginTop: 14 }}>
            <button
              className="sr-btn-secondary"
              type="button"
              onClick={loadPreviousPage}
              disabled={loading || filtersDirty || cursorHistoryRef.current.length === 0}
            >
              ← Anterior
            </button>
            <button
              className="sr-btn-secondary"
              type="button"
              onClick={loadNextPage}
              disabled={
                loading ||
                filtersDirty ||
                !nextCursor ||
                cursorHistoryRef.current.length >= MAX_CURSOR_HISTORY
              }
            >
              Siguiente →
            </button>
          </div>
          {filtersDirty ? (
            <div className="sr-small" style={{ textAlign: "right", color: "#6b7280", marginTop: 6 }}>
              Actualiza para aplicar los filtros antes de cambiar de página.
            </div>
          ) : null}
        </div>
      </main>
    </>
  );
}
