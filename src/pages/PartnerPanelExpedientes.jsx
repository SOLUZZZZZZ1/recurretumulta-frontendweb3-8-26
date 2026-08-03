import React, { useEffect, useMemo, useState } from "react";
import Seo from "../components/Seo.jsx";
import { Link, useNavigate } from "react-router-dom";

const API = "/api";

async function fetchJson(url, options = {}) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || `Error HTTP ${r.status}`);
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

  const [partnerToken, setPartnerToken] = useState(() => localStorage.getItem("partner_token") || "");
  const [partnerName, setPartnerName] = useState(() => localStorage.getItem("partner_name") || "");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    const t = (localStorage.getItem("partner_token") || "").trim();
    const n = localStorage.getItem("partner_name") || "";
    setPartnerToken(t);
    setPartnerName(n);

    if (!t) {
      nav("/gestorias");
      return;
    }

    loadCases(t, "", "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadCases(tokenOverride = null, qOverride = null, statusOverride = null) {
    setErr("");

    const t = (tokenOverride ?? partnerToken ?? "").trim();
    const qq = qOverride ?? q;
    const st = statusOverride ?? status;

    if (!t) {
      setErr("Sesión no encontrada. Vuelve a entrar en el portal de asesorías.");
      nav("/gestorias");
      return;
    }

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if ((qq || "").trim()) params.set("q", qq.trim());
      if ((st || "").trim()) params.set("status", st.trim());

      const qs = params.toString();
      const url = qs ? `${API}/partner/cases?${qs}` : `${API}/partner/cases`;

      const data = await fetchJson(url, {
        headers: {
          Authorization: `Bearer ${t}`,
        },
      });

      setItems(data.items || []);
      if (data.partner_name) {
        setPartnerName(data.partner_name);
        localStorage.setItem("partner_name", data.partner_name);
      }
    } catch (e) {
      setItems([]);
      setErr(e.message || "No se pudo cargar el listado de expedientes.");
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("partner_token");
    localStorage.removeItem("partner_name");
    localStorage.removeItem("partner_email");
    localStorage.removeItem("partner_must_change");
    nav("/gestorias");
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

      <main className="sr-container py-12" style={{ minHeight: "calc(100vh - 160px)" }}>
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
            <Link to="/gestorias/subir" className="sr-btn-primary">
              + Nuevo expediente
            </Link>
            <Link to="/gestorias" className="sr-btn-secondary">
              ← Volver
            </Link>
            <button className="sr-btn-secondary" onClick={logout}>
              Salir
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-4 gap-3" style={{ marginBottom: 14 }}>
          <div className="sr-card">
            <div className="sr-small" style={{ color: "#6b7280" }}>Total expedientes</div>
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
              <button className="sr-btn-primary" onClick={() => loadCases()} disabled={loading}>
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
              {items.length} resultados
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
                          Recibida: <b>{item.authorization_received ? "Sí" : "No"}</b>
                        </div>
                        <div className="sr-small">
                          Documento: <b>{item.authorization_document_uploaded ? "Sí" : "No"}</b>
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
        </div>
      </main>
    </>
  );
}
