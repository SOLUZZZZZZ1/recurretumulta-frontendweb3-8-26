import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const API = "/api";

async function fetchJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.detail || `Error HTTP ${res.status}`);
  return data;
}

function fmtDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("es-ES");
  } catch {
    return String(value);
  }
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

function statusTone(status) {
  if (status === "vehicle_removal_completed") return "success";
  if (status === "vehicle_removal_assigned") return "info";
  if (status === "vehicle_removal_paid") return "warn";
  if (status === "vehicle_removal_pending_payment") return "danger";
  return "default";
}

function statusLabel(status) {
  const labels = {
    vehicle_removal_pending_payment: "Pendiente pago",
    vehicle_removal_paid: "Pagado",
    vehicle_removal_assigned: "Asignado",
    vehicle_removal_completed: "Completado",
    vehicle_removal_cancelled: "Cancelado",
  };
  return labels[status] || status || "—";
}

function Stat({ title, value, tone = "default" }) {
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
      <div className="mt-2 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}

export default function OpsVehicleRemoval() {
  const [token] = useState(() => localStorage.getItem("ops_token") || "");
  const [status, setStatus] = useState("all");
  const [data, setData] = useState({ items: [], summary: {}, count: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [assigning, setAssigning] = useState("");
  const [completing, setCompleting] = useState("");
  const [noteCase, setNoteCase] = useState("");
  const [noteText, setNoteText] = useState("");

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      "X-Operator-Token": token,
    }),
    [token]
  );

  async function load() {
    if (!token) {
      setError("Falta token de operador. Entra primero por /ops.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await fetchJson(`${API}/ops/vehicle-removal?status=${encodeURIComponent(status)}&limit=200`, {
        headers: { "X-Operator-Token": token },
      });
      setData(res || { items: [], summary: {}, count: 0 });
    } catch (e) {
      setError(e.message || "No se pudo cargar OPS vehículos");
      setData({ items: [], summary: {}, count: 0 });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  async function markPaid(caseId) {
    if (!window.confirm("¿Marcar este caso como pagado manualmente? Úsalo solo si Stripe/webhook no lo actualizó.")) return;
    await fetchJson(`${API}/ops/vehicle-removal/${caseId}/mark-paid`, {
      method: "POST",
      headers: authHeaders,
    });
    await load();
  }

  async function assign(caseId) {
    const desguace_name = window.prompt("Nombre del desguace / CAT autorizado:");
    if (!desguace_name) return;

    const desguace_phone = window.prompt("Teléfono del desguace (opcional):") || "";
    const note = window.prompt("Nota interna (opcional):") || "";

    await fetchJson(`${API}/ops/vehicle-removal/${caseId}/assign`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ desguace_name, desguace_phone, note }),
    });
    setAssigning("");
    await load();
  }

  async function complete(caseId) {
    const certificate_ref = window.prompt("Referencia certificado / baja DGT (opcional):") || "";
    const note = window.prompt("Nota de cierre (opcional):") || "";

    await fetchJson(`${API}/ops/vehicle-removal/${caseId}/complete`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ certificate_ref, note }),
    });
    setCompleting("");
    await load();
  }

  async function addNote(caseId) {
    const note = noteText.trim();
    if (!note) return;
    await fetchJson(`${API}/ops/vehicle-removal/${caseId}/note`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ note }),
    });
    setNoteCase("");
    setNoteText("");
    await load();
  }

  const items = data.items || [];
  const summary = data.summary || {};

  return (
    <main className="min-h-screen bg-slate-50 p-5">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 rounded-[24px] bg-slate-950 p-5 text-white shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-[0.35em] text-slate-300">
                OPS · Vehículos
              </div>
              <h1 className="mt-2 text-3xl font-semibold">
                🚗 Eliminar coche · Gestión interna
              </h1>
              <p className="mt-2 text-sm text-slate-300">
                Control operativo de solicitudes, pagos, asignación a desguace y cierre con justificante.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                to="/ops"
                className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
              >
                ← Volver OPS
              </Link>
              <button
                onClick={load}
                disabled={loading}
                className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-60"
              >
                {loading ? "Cargando..." : "Refrescar"}
              </button>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="mb-5 grid gap-3 md:grid-cols-5">
          <Stat title="Total" value={summary.total ?? items.length} tone="default" />
          <Stat title="Pendiente pago" value={summary.pending_payment ?? 0} tone="danger" />
          <Stat title="Pagados" value={summary.paid ?? 0} tone="warn" />
          <Stat title="Asignados" value={summary.assigned ?? 0} tone="info" />
          <Stat title="Completados" value={summary.completed ?? 0} tone="success" />
        </div>

        <div className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-semibold text-slate-700">Estado:</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="all">Todos</option>
              <option value="vehicle_removal_pending_payment">Pendiente pago</option>
              <option value="vehicle_removal_paid">Pagado</option>
              <option value="vehicle_removal_assigned">Asignado</option>
              <option value="vehicle_removal_completed">Completado</option>
              <option value="vehicle_removal_cancelled">Cancelado</option>
            </select>
            {loading ? <span className="text-sm text-slate-500">Actualizando…</span> : null}
          </div>
        </div>

        <div className="space-y-4">
          {items.map((item) => (
            <section key={item.case_id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-slate-900">
                      {item.plate || "Matrícula pendiente"}
                    </h2>
                    <Pill tone={statusTone(item.status)}>{statusLabel(item.status)}</Pill>
                    <Pill tone={item.payment_status === "paid" ? "success" : "warn"}>
                      {item.payment_status === "paid" ? "Pagado" : "Pago no confirmado"}
                    </Pill>
                  </div>

                  <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
                    <div><b>Cliente:</b> {item.name || "—"}</div>
                    <div><b>Teléfono:</b> {item.phone || "—"}</div>
                    <div><b>Email:</b> {item.email || item.contact_email || "—"}</div>
                    <div><b>Ciudad:</b> {item.city || "—"}</div>
                    <div className="md:col-span-2"><b>Case ID:</b> <span className="break-all font-mono text-xs">{item.case_id}</span></div>
                    <div><b>Creado:</b> {fmtDate(item.created_at)}</div>
                    <div><b>Actualizado:</b> {fmtDate(item.updated_at)}</div>
                  </div>

                  {item.notes ? (
                    <div className="mt-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">
                      <b>Notas cliente:</b> {item.notes}
                    </div>
                  ) : null}

                  {item.desguace_name ? (
                    <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900">
                      <b>Desguace asignado:</b> {item.desguace_name}
                      {item.desguace_phone ? ` · ${item.desguace_phone}` : ""}
                      {item.desguace_email ? ` · ${item.desguace_email}` : ""}
                    </div>
                  ) : null}

                  {item.certificate_ref ? (
                    <div className="mt-3 rounded-2xl border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-900">
                      <b>Certificado / referencia:</b> {item.certificate_ref}
                    </div>
                  ) : null}

                  {noteCase === item.case_id ? (
                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
                      <textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        rows={3}
                        className="w-full rounded-xl border border-slate-300 p-3 text-sm"
                        placeholder="Nota interna..."
                      />
                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => addNote(item.case_id)}
                          className="rounded-xl bg-slate-900 px-3 py-2 text-sm font-semibold text-white"
                        >
                          Guardar nota
                        </button>
                        <button
                          onClick={() => {
                            setNoteCase("");
                            setNoteText("");
                          }}
                          className="rounded-xl border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="flex w-full flex-col gap-2 xl:w-[230px]">
                  {item.payment_status !== "paid" ? (
                    <button
                      onClick={() => markPaid(item.case_id)}
                      className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 hover:bg-amber-100"
                    >
                      💳 Marcar pagado
                    </button>
                  ) : null}

                  {item.status !== "vehicle_removal_completed" ? (
                    <button
                      onClick={() => assign(item.case_id)}
                      disabled={assigning === item.case_id}
                      className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      🏭 Asignar desguace
                    </button>
                  ) : null}

                  {item.status !== "vehicle_removal_completed" ? (
                    <button
                      onClick={() => complete(item.case_id)}
                      disabled={completing === item.case_id}
                      className="rounded-xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      ✅ Completar
                    </button>
                  ) : null}

                  <button
                    onClick={() => setNoteCase(noteCase === item.case_id ? "" : item.case_id)}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    📝 Nota interna
                  </button>
                </div>
              </div>
            </section>
          ))}

          {!items.length && !loading ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center text-slate-500">
              No hay solicitudes de eliminación de coche en este filtro.
            </div>
          ) : null}
        </div>
      </div>
    </main>
  );
}
