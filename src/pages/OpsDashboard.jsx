// OpsDashboard.jsx — completo con control de auto-submit
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const API = "/api";

async function fetchJson(url, options = {}) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || "Error API");
  return data;
}

function formatDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleString("es-ES");
  } catch {
    return "—";
  }
}

function shortId(id) {
  if (!id || id.length < 12) return id;
  return `${id.slice(0, 8)}…${id.slice(-4)}`;
}


function isPresentedStatus(status) {
  const s = String(status || "").toLowerCase();
  return (
    s === "submitted" ||
    s === "presentado_manual_ayuntamiento" ||
    s === "presentado_auto_dgt" ||
    s === "presentado_auto_registro" ||
    s.includes("presentado")
  );
}

function isClosedStatus(status) {
  const s = String(status || "").toLowerCase();
  return s === "closed" || s === "archived" || s === "resolved" || s === "estimado" || s === "desestimado";
}

function isPendingOperatorStatus(status) {
  const s = String(status || "").toLowerCase();
  if (isPresentedStatus(s) || isClosedStatus(s)) return false;
  return (
    s === "manual_review" ||
    s === "ready_to_submit" ||
    s === "pending_documents" ||
    s === "generated" ||
    s === "analyzed" ||
    s === "uploaded" ||
    s === "ready_to_pay"
  );
}

function operationalLabel(status) {
  const s = String(status || "").toLowerCase();
  if (s === "presentado_manual_ayuntamiento") return "Presentado manual";
  if (s === "presentado_auto_dgt") return "Presentado DGT";
  if (s === "submitted") return "Presentado";
  if (s === "manual_review") return "Revisión manual";
  if (s === "ready_to_submit") return "Listo para presentar";
  if (s === "pending_documents") return "Pendiente docs";
  if (s === "generated") return "Generado";
  if (s === "uploaded") return "Subido";
  return status || "—";
}

function Pill({ children, tone = "default" }) {
  const tones = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-700",
    warn: "bg-amber-100 text-amber-700",
    danger: "bg-rose-100 text-rose-700",
    info: "bg-blue-100 text-blue-700",
  };
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.default}`}>
      {children}
    </span>
  );
}

function StatCard({ title, value, tone = "default", help = "" }) {
  const tones = {
    default: "border-slate-200 bg-white",
    success: "border-emerald-200 bg-emerald-50",
    warn: "border-amber-200 bg-amber-50",
    danger: "border-rose-200 bg-rose-50",
    info: "border-blue-200 bg-blue-50",
  };

  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${tones[tone] || tones.default}`}>
      <div className="text-[11px] uppercase tracking-wide opacity-70">{title}</div>
      <div className="mt-2 text-xl font-semibold text-slate-900">{value}</div>
      {help ? <div className="mt-1 text-xs text-slate-500">{help}</div> : null}
    </div>
  );
}

function classifyLane(item) {
  const confidence = Number(item?.confidence);
  const conf = Number.isFinite(confidence) ? (confidence <= 1 ? confidence : confidence / 100) : null;
  const authorized = !!item?.authorized;
  const paid = item?.payment_status === "paid";
  const hasPdf = !!item?.has_generated_pdf;
  const hasDocx = !!item?.has_generated_docx;
  const nextAction = String(item?.next_action || "").toUpperCase();

  const clean =
    authorized &&
    paid &&
    hasPdf &&
    hasDocx &&
    conf !== null &&
    conf >= 0.8 &&
    !["REVISAR", "REGENERAR", "FALTA_AUTORIZACION", "FALTA_PAGO"].includes(nextAction);

  return clean ? "AUTOMATICO" : "MANUAL";
}

export default function OpsDashboard() {
  const [token, setToken] = useState(() => localStorage.getItem("ops_token") || "");
  
  const [presentedCases, setPresentedCases] = useState([]);
  const [presentedSearch, setPresentedSearch] = useState("");
const [pin, setPin] = useState("");

  const [status, setStatus] = useState("ready_to_submit");
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [autoMode, setAutoMode] = useState("review");
  const [tickResult, setTickResult] = useState(null);
  const [tickLoading, setTickLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [workerAlive, setWorkerAlive] = useState(true);
  const [smartQueue, setSmartQueue] = useState({ items: [], summary: {}, count: 0 });
  const [smartLoading, setSmartLoading] = useState(false);
  const [tickError, setTickError] = useState("");
  const [lastRefreshAt, setLastRefreshAt] = useState("");

  const authed = token && token.trim().length > 10;
  const authHeaders = { "X-Operator-Token": token };

  async function loadQueue() {
    setLoading(true);
    setError("");
    try {
      const data = await fetchJson(
        `${API}/ops/queue?status=${encodeURIComponent(status)}`,
        { headers: authHeaders }
      );
      setCases(data.items || []);
    } catch (e) {
      setError(e.message);
      setCases([]);
    } finally {
      setLoading(false);
    }
  }

  async function loadSmartQueue() {
    if (!authed) return;
    setSmartLoading(true);
    setTickError("");
    try {
      const data = await fetchJson(`${API}/ops/queue-smart`, {
        headers: authHeaders,
      });
      setSmartQueue({
        items: data.items || [],
        summary: data.summary || {},
        count: data.count || 0,
      });
      setLastRefreshAt(new Date().toISOString());
      setWorkerAlive(true);
    } catch (e) {
      setTickError(e.message || "No se pudo cargar la cola inteligente");
      setWorkerAlive(false);
    } finally {
      setSmartLoading(false);
    }
  }


  async function loadPresentedCases(searchValue = presentedSearch) {
    if (!authed) return;

    try {
      const qs = searchValue ? `?q=${encodeURIComponent(searchValue)}&limit=100` : "?limit=100";
      const data = await fetchJson(`${API}/ops/presented-cases${qs}`, {
        headers: authHeaders,
      });
      setPresentedCases(data.items || []);
    } catch (e) {
      setPresentedCases([]);
    }
  }

  async function runTick() {
    setTickLoading(true);
    setTickError("");
    try {
      const data = await fetchJson(`${API}/ops/automation/tick?limit=25`, {
        method: "POST",
        headers: authHeaders,
      });

      setTickResult({
        ...data,
        ranAt: new Date().toISOString(),
      });
      setWorkerAlive(true);

      if (data?.mode) {
        setAutoMode(String(data.mode));
      }

      await Promise.all([loadQueue(), loadSmartQueue()]);
    } catch (e) {
      setTickError(e.message || "No se pudo ejecutar el tick");
      setWorkerAlive(false);
    } finally {
      setTickLoading(false);
    }
  }

  async function loginWithPin() {
    try {
      if (!pin || pin.trim().length < 4) {
        alert("PIN inválido");
        return;
      }
      const fd = new FormData();
      fd.append("pin", pin.trim());

      const data = await fetchJson(`${API}/ops/login`, {
        method: "POST",
        body: fd,
      });

      if (!data?.token) throw new Error("Login OK pero falta token");
      localStorage.setItem("ops_token", data.token);
      setToken(data.token);
      setPin("");
    } catch (e) {
      alert(e.message);
    }
  }

  useEffect(() => {
    if (authed) {
      loadQueue();
      loadSmartQueue();
    }
  }, [authed, status]);

  useEffect(() => {
    if (!authed || !autoRefresh) return;
    const id = setInterval(() => {
      loadSmartQueue();
    }, 15000);
    return () => clearInterval(id);
  }, [authed, autoRefresh]);

  const automaticItems = useMemo(
    () => (smartQueue.items || []).filter((item) => classifyLane(item) === "AUTOMATICO"),
    [smartQueue]
  );

  const manualItems = useMemo(
    () => (smartQueue.items || []).filter((item) => classifyLane(item) === "MANUAL"),
    [smartQueue]
  );

  const submittedItems = useMemo(
    () => (cases || []).filter((c) => isPresentedStatus(c.status)),
    [cases]
  );

  const manualSubmittedItems = useMemo(
    () => (cases || []).filter((c) => String(c.status || "").toLowerCase().includes("presentado_manual")),
    [cases]
  );

  const pendingOperatorItems = useMemo(
    () => (cases || []).filter((c) => isPendingOperatorStatus(c.status)),
    [cases]
  );


  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
        <div className="bg-white rounded-xl shadow p-6 max-w-md w-full">
          <h1 className="text-xl font-semibold mb-3">Acceso Operador</h1>

          <input
            type="password"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            placeholder="PIN operador"
            className="w-full border rounded px-3 py-2 text-sm"
          />

          <button className="mt-4 w-full sr-btn-primary" onClick={loginWithPin}>
            Entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">

        <div className="rounded-[22px] bg-slate-950 px-4 py-4 text-white shadow-xl mb-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-slate-300">OPS · Monitor automático</div>
              <h1 className="mt-1 text-2xl font-semibold">Panel Operador</h1>
              <p className="mt-2 text-xs text-slate-300">
                Control central del auto-submit + acceso rápido a la cola manual e inteligente.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                to="/ops/queue-smart"
                className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                🔥 Cola inteligente
              </Link>

              <Link
                to="/ops/vehicle-removal"
                className="rounded-xl bg-blue-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-600"
              >
                🚗 OPS vehículos
              </Link>

              <button
                type="button"
                onClick={runTick}
                disabled={tickLoading}
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-50"
              >
                {tickLoading ? "Ejecutando..." : "▶ Lanzar tick"}
              </button>

              <button
                className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
                onClick={() => {
                  localStorage.removeItem("ops_token");
                  setToken("");
                  setPin("");
                }}
              >
                Salir
              </button>
            </div>
          </div>
        </div>

        {(error || tickError) ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error || tickError}
          </div>
        ) : null}

        <div className="bg-white rounded-xl shadow p-4 mb-6">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-3">
            <h2 className="text-lg font-semibold">⚙️ Control automático</h2>

            <button
              className="sr-btn-primary"
              onClick={runTick}
              disabled={tickLoading}
              style={{ padding: "8px 14px" }}
            >
              {tickLoading ? "Ejecutando..." : "▶ Lanzar tick"}
            </button>
          </div>

          <div className="flex gap-3 flex-wrap items-center">
            <div className="flex items-center gap-2">
              <span className="text-sm">Modo:</span>

              <select
                value={autoMode}
                onChange={(e) => setAutoMode(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              >
                <option value="off">OFF</option>
                <option value="review">REVIEW</option>
                <option value="on">ON</option>
              </select>
            </div>

            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={() => setAutoRefresh(!autoRefresh)}
              />
              Auto-refresh
            </label>

            <span className="text-xs text-slate-500">
              Última actualización: {lastRefreshAt ? formatDate(lastRefreshAt) : "—"}
            </span>
          </div>

          <div className="mt-4 flex gap-4 flex-wrap text-sm">
            <span>🧠 Worker: {workerAlive ? "Activo" : "Parado"}</span>
            <span>📦 Picked: {tickResult?.picked ?? "-"}</span>
            <span>✅ Processed: {tickResult?.processed ?? "-"}</span>
            <span>❌ Failed: {tickResult?.failed ?? "-"}</span>
            <span>⏱ Último tick: {tickResult?.ranAt ? new Date(tickResult.ranAt).toLocaleTimeString() : "-"}</span>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5 mb-5">
          <StatCard title="Automáticos" value={automaticItems.length} tone="success" help="Casos limpios para auto-submit" />
          <StatCard title="Manuales" value={manualItems.length} tone="danger" help="Casos que requieren operador" />
          <StatCard title="En cola smart" value={smartQueue.count || 0} tone="info" help="Total en queue-smart" />
          <StatCard title="Presentados" value={submittedItems.length} tone="success" help="Incluye DGT y presentaciones manuales" />
          <StatCard title="Manual presentados" value={manualSubmittedItems.length} tone="success" help="Ayuntamientos / externo" />
          <StatCard title="Pendientes reales" value={pendingOperatorItems.length} tone="warn" help="Trabajo real de operador" />
          <StatCard title="Modo actual" value={String(autoMode || "review").toUpperCase()} tone="warn" help="Control visual del auto-submit" />
        </div>

        <div className="bg-white rounded-xl shadow p-4 mb-6 flex gap-4 items-center flex-wrap">
          <label className="text-sm">Estado:</label>
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border rounded px-2 py-1 text-sm"
          >
            <option value="ready_to_submit">ready_to_submit</option>
            <option value="uploaded">uploaded</option>
            <option value="generated">generated</option>
            <option value="submitted">submitted</option>
            <option value="all">all</option>
          </select>

          <button onClick={loadQueue} className="sr-btn-primary" style={{ padding: "8px 14px" }}>
            Refrescar cola
          </button>

          {loading && <span className="text-sm text-gray-500">Cargando…</span>}
          {smartLoading && <span className="text-sm text-gray-500">Actualizando monitor…</span>}
        </div>

        
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 shadow-sm mb-5">
          <div className="flex flex-col gap-3 border-b border-emerald-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">🟢 Presentados / histórico operativo</h2>
              <div className="text-xs text-slate-600">
                Expedientes ya tramitados que salen de la cola pendiente, pero siguen vivos para seguimiento y resolución.
              </div>
            </div>

            <div className="flex gap-2 flex-wrap">
              <input
                value={presentedSearch}
                onChange={(e) => setPresentedSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") loadPresentedCases(e.currentTarget.value);
                }}
                placeholder="Buscar expediente, email o case_id"
                className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => loadPresentedCases()}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
              >
                Cargar presentados
              </button>
            </div>
          </div>

          <div className="p-4">
            {!presentedCases.length ? (
              <div className="rounded-2xl border border-dashed border-emerald-200 bg-white/70 px-4 py-6 text-sm text-slate-500">
                No hay expedientes presentados visibles. Busca por referencia, email o case_id si necesitas localizar uno concreto.
              </div>
            ) : (
              <div className="space-y-3">
                {presentedCases.slice(0, 10).map((item) => (
                  <div key={item.case_id} className="rounded-2xl border border-emerald-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {item.expediente_ref || item.case_id}
                        </div>
                        <div className="mt-1 text-xs text-slate-500 break-all">
                          Case ID: {item.case_id}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.contact_email || "Sin email"} · Actualizado: {formatDate(item.updated_at)}
                        </div>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <Pill tone="success">
                          {item.status === "presentado_manual_ayuntamiento"
                            ? "Presentado manual"
                            : item.status || "Presentado"}
                        </Pill>

                        <Link
                          to={`/ops/case/${encodeURIComponent(item.case_id)}`}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
                        >
                          Abrir seguimiento
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}

                {presentedCases.length > 10 ? (
                  <div className="text-xs text-slate-500">
                    Mostrando 10 de {presentedCases.length}. Usa el buscador para localizar un expediente concreto.
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

<div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr] mb-5">
          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Monitor de auto-submit</h2>
                <div className="text-xs text-slate-500">
                  Vista operativa del motor automático usando cola inteligente + tick manual.
                </div>
              </div>

              <button
                type="button"
                onClick={loadSmartQueue}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              >
                Refrescar monitor
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div className="grid gap-3 md:grid-cols-3">
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-emerald-700/80">Auto-submit listo</div>
                  <div className="mt-2 text-2xl font-semibold text-emerald-700">{automaticItems.length}</div>
                  <div className="mt-1 text-xs text-emerald-700/80">Se presentarían rápido</div>
                </div>

                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-amber-700/80">Revisión manual</div>
                  <div className="mt-2 text-2xl font-semibold text-amber-700">{manualItems.length}</div>
                  <div className="mt-1 text-xs text-amber-700/80">Casos para operador</div>
                </div>

                <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-blue-700/80">Último tick</div>
                  <div className="mt-2 text-sm font-semibold text-blue-700">
                    {tickResult?.ranAt ? formatDate(tickResult.ranAt) : "Sin ejecutar manual"}
                  </div>
                  <div className="mt-2 text-xs text-blue-700/80">
                    Modo: {tickResult?.mode || autoMode || "—"} · picked: {tickResult?.picked ?? "—"} · failed: {tickResult?.failed ?? "—"}
                  </div>
                </div>
              </div>

              {tickResult ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <Pill tone="info">picked: {tickResult.picked ?? 0}</Pill>
                    <Pill tone="success">processed: {tickResult.processed ?? 0}</Pill>
                    <Pill tone={(tickResult.failed || 0) > 0 ? "danger" : "default"}>
                      failed: {tickResult.failed ?? 0}
                    </Pill>
                    <Pill tone="warn">mode: {tickResult.mode || autoMode || "—"}</Pill>
                  </div>

                  <div className="max-h-64 overflow-auto rounded-xl bg-white p-3 text-xs text-slate-700 border border-slate-200">
                    <pre className="whitespace-pre-wrap break-words">{JSON.stringify(tickResult, null, 2)}</pre>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                  Todavía no has lanzado un tick manual desde el panel.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-100 px-4 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Siguiente foco</h2>
              <div className="text-xs text-slate-500">Lo más útil para actuar ahora</div>
            </div>

            <div className="p-4 space-y-3">
              {automaticItems[0] ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-emerald-800">Próximo automático</div>
                    <Pill tone="success">AUTO</Pill>
                  </div>
                  <div className="mt-2 text-sm text-slate-900 break-all">
                    {automaticItems[0].expediente_ref || automaticItems[0].case_id}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">{automaticItems[0].contact_email || "—"}</div>
                  <Link
                    to={`/ops/case/${encodeURIComponent(automaticItems[0].case_id)}`}
                    className="mt-3 inline-flex rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Abrir caso
                  </Link>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No hay casos automáticos detectados ahora.
                </div>
              )}

              {manualItems[0] ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-sm font-semibold text-amber-800">Próximo manual</div>
                    <Pill tone="warn">REVISAR</Pill>
                  </div>
                  <div className="mt-2 text-sm text-slate-900 break-all">
                    {manualItems[0].expediente_ref || manualItems[0].case_id}
                  </div>
                  <div className="mt-1 text-xs text-slate-600">{manualItems[0].contact_email || "—"}</div>
                  <Link
                    to={`/ops/case/${encodeURIComponent(manualItems[0].case_id)}`}
                    className="mt-3 inline-flex rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-600"
                  >
                    Revisar caso
                  </Link>
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-sm text-slate-500">
                  No hay casos manuales pendientes ahora.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-2 text-left">Fecha</th>
                <th className="p-2 text-left">Case ID</th>
                <th className="p-2">Estado</th>
                <th className="p-2">Pago</th>
                <th className="p-2">Email</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {cases.map((c) => (
                <tr key={c.case_id} className="border-t">
                  <td className="p-2">{formatDate(c.created_at)}</td>
                  <td className="p-2 font-mono text-xs">{shortId(c.case_id)}</td>
                  <td className="p-2">{c.status}</td>
                  <td className="p-2">{c.payment_status || "—"}</td>
                  <td className="p-2">{c.contact_email || "-"}</td>
                  <td className="p-2">
                    <Link to={`/ops/case/${c.case_id}`} className="text-xs underline">
                      Abrir
                    </Link>
                  </td>
                </tr>
              ))}
              {!cases.length && (
                <tr>
                  <td colSpan="6" className="p-4 text-center text-gray-500">
                    No hay casos
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

      </div>
    </div>
  );
}
