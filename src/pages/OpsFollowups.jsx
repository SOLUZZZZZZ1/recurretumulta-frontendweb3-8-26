import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";

const API = "/api";
const DAY_MS = 24 * 60 * 60 * 1000;

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.detail || `Error ${response.status}`);
  return data;
}

function fmt(value) {
  if (!value) return "Sin fecha";
  try {
    return new Date(value).toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Sin fecha";
  }
}

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function isPending(item) {
  return normalize(item?.status) === "pending";
}

function isResolved(item) {
  return normalize(item?.status) === "resolved";
}

function dueTime(item) {
  const value = item?.due_at ? new Date(item.due_at).getTime() : Number.NaN;
  return Number.isFinite(value) ? value : null;
}

function isOverdue(item) {
  const due = dueTime(item);
  return isPending(item) && due !== null && due < Date.now();
}

function isNextSevenDays(item) {
  const due = dueTime(item);
  const now = Date.now();
  return isPending(item) && due !== null && due >= now && due <= now + 7 * DAY_MS;
}

function caseLink(item) {
  const department = normalize(item?.department);
  const caseType = normalize(item?.case_type);
  if (department === "traffic" && caseType === "vehicle_removal") {
    return `/ops/vehicle-removal?case_id=${encodeURIComponent(item.case_id)}`;
  }
  return `/ops/case/${encodeURIComponent(item.case_id)}`;
}

function familyLabel(item) {
  const labels = {
    traffic: "Tráfico y vehículos",
    debt: "Deudas y morosidad",
    administration: "Administración pública",
    claims: "Viajes y reclamaciones",
    other: "Otros / por clasificar",
  };
  return labels[normalize(item?.department)] || "Otros / por clasificar";
}

function Pill({ children, tone = "default" }) {
  const tones = {
    default: "border-slate-200 bg-slate-100 text-slate-700",
    danger: "border-rose-200 bg-rose-50 text-rose-800",
    warn: "border-amber-200 bg-amber-50 text-amber-900",
    success: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-blue-200 bg-blue-50 text-blue-800",
  };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${tones[tone] || tones.default}`}>
      {children}
    </span>
  );
}

function Stat({ label, value, tone = "default", onClick, active = false }) {
  const tones = {
    default: "border-slate-200 bg-white",
    danger: "border-rose-200 bg-rose-50",
    warn: "border-amber-200 bg-amber-50",
    success: "border-emerald-200 bg-emerald-50",
    info: "border-blue-200 bg-blue-50",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-0.5 ${tones[tone]} ${
        active ? "ring-2 ring-slate-900 ring-offset-2" : ""
      }`}
    >
      <div className="text-2xl font-black text-slate-950">{value}</div>
      <div className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-600">{label}</div>
    </button>
  );
}

export default function OpsFollowups() {
  const [searchParams] = useSearchParams();
  const [token] = useState(() => localStorage.getItem("ops_token") || "");
  const [items, setItems] = useState([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [scope, setScope] = useState(() => (searchParams.get("scope") === "due" ? "due" : "all"));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const authed = token.trim().length > 10;

  const load = useCallback(async () => {
    if (!authed) return;
    setLoading(true);
    setError("");
    try {
      const result = await fetchJson(`${API}/ops/followups?status=all&limit=500`, {
        headers: { "X-Operator-Token": token },
      });
      setItems(result.items || []);
    } catch (err) {
      setError(err.message || "No se pudieron cargar los seguimientos");
    } finally {
      setLoading(false);
    }
  }, [authed, token]);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  const stats = useMemo(() => {
    const pending = items.filter(isPending);
    return {
      total: items.length,
      pending: pending.length,
      overdue: pending.filter(isOverdue).length,
      nextSeven: pending.filter(isNextSevenDays).length,
      resolved: items.filter(isResolved).length,
    };
  }, [items]);

  const filtered = useMemo(() => {
    const query = normalize(search);
    return items.filter((item) => {
      if (status === "pending" && !isPending(item)) return false;
      if (status === "resolved" && !isResolved(item)) return false;
      if (scope === "overdue" && !isOverdue(item)) return false;
      if (scope === "next7" && !isNextSevenDays(item)) return false;
      if (scope === "due" && !isOverdue(item) && !isNextSevenDays(item)) return false;
      if (scope === "no_date" && (!isPending(item) || dueTime(item) !== null)) return false;
      if (!query) return true;

      return [
        item.contact_name,
        item.contact_email,
        item.case_id,
        item.expediente_ref,
        item.organismo,
        item.matricula,
        item.title,
        item.description,
        item.kind,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [items, scope, search, status]);

  if (!authed) {
    return (
      <main className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-xl rounded-3xl border border-slate-200 bg-white p-6 shadow-xl">
          <h1 className="text-2xl font-black text-slate-950">Acceso de operador necesario</h1>
          <p className="mt-2 text-sm text-slate-600">Entra primero en OPS para consultar la bandeja global de seguimientos.</p>
          <Link to="/ops" className="mt-5 inline-flex rounded-xl bg-slate-950 px-4 py-3 text-sm font-bold text-white">
            Volver a OPS
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 p-4 md:p-6">
      <div className="mx-auto max-w-[1500px]">
        <header className="rounded-[28px] bg-slate-950 p-5 text-white shadow-xl">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-[.35em] text-slate-400">RTM · OPS CORE</div>
              <h1 className="mt-1 text-3xl font-black">Seguimientos</h1>
              <p className="mt-2 text-sm text-slate-300">Todos los avisos operativos, con acceso directo a su expediente.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/ops" className="rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-slate-950">
                ← Volver al panel
              </Link>
              <button
                type="button"
                onClick={load}
                disabled={loading}
                className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
              >
                {loading ? "Cargando…" : "↻ Actualizar"}
              </button>
            </div>
          </div>
        </header>

        {error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-semibold text-rose-800">{error}</div>
        ) : null}

        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Stat label="Todos" value={stats.total} onClick={() => { setStatus("all"); setScope("all"); }} active={status === "all" && scope === "all"} />
          <Stat label="Pendientes" value={stats.pending} tone="info" onClick={() => { setStatus("pending"); setScope("all"); }} active={status === "pending" && scope === "all"} />
          <Stat label="Vencidos" value={stats.overdue} tone="danger" onClick={() => { setStatus("pending"); setScope("overdue"); }} active={scope === "overdue"} />
          <Stat label="Próximos 7 días" value={stats.nextSeven} tone="warn" onClick={() => { setStatus("pending"); setScope("next7"); }} active={scope === "next7"} />
          <Stat label="Resueltos" value={stats.resolved} tone="success" onClick={() => { setStatus("resolved"); setScope("all"); }} active={status === "resolved" && scope === "all"} />
        </section>

        <section className="mt-5 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="grid gap-3 lg:grid-cols-[1.5fr_.6fr_.6fr]">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Buscar seguimientos"
              placeholder="Buscar cliente, referencia, organismo, matrícula, título o Case ID…"
              className="rounded-xl border border-slate-200 px-4 py-3"
            />
            <select aria-label="Filtrar por estado" value={status} onChange={(event) => setStatus(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-3">
              <option value="all">Todos los estados</option>
              <option value="pending">Pendientes</option>
              <option value="resolved">Resueltos</option>
            </select>
            <select aria-label="Filtrar por vencimiento" value={scope} onChange={(event) => setScope(event.target.value)} className="rounded-xl border border-slate-200 px-3 py-3">
              <option value="all">Cualquier fecha</option>
              <option value="due">Vencidos y próximos</option>
              <option value="overdue">Solo vencidos</option>
              <option value="next7">Próximos 7 días</option>
              <option value="no_date">Pendientes sin fecha</option>
            </select>
          </div>
          <div className="mt-3 text-sm text-slate-500">{filtered.length} seguimientos visibles · {items.length} cargados</div>
        </section>

        <section className="mt-5 space-y-3">
          {!filtered.length ? (
            <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-500">
              No hay seguimientos con estos filtros.
            </div>
          ) : (
            filtered.map((item) => {
              const overdue = isOverdue(item);
              const upcoming = isNextSevenDays(item);
              return (
                <article
                  key={item.id}
                  style={{ contentVisibility: "auto", containIntrinsicSize: "190px" }}
                  className={`rounded-3xl border bg-white p-5 shadow-sm ${overdue ? "border-rose-300" : upcoming ? "border-amber-300" : "border-slate-200"}`}
                >
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-black text-slate-950">{item.title || "Seguimiento sin título"}</h2>
                        {overdue ? <Pill tone="danger">VENCIDO</Pill> : null}
                        {upcoming ? <Pill tone="warn">PRÓXIMO</Pill> : null}
                        {isResolved(item) ? <Pill tone="success">RESUELTO</Pill> : null}
                        {isPending(item) && !overdue && !upcoming ? <Pill tone="info">PENDIENTE</Pill> : null}
                      </div>
                      <div className="mt-2 text-sm font-bold text-slate-800">
                        {item.contact_name || item.contact_email || "Cliente sin identificar"}
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-600">{familyLabel(item)}</div>
                      {item.description ? <p className="mt-3 text-sm text-slate-700">{item.description}</p> : null}
                      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                        <span>Fecha: <b className="text-slate-700">{fmt(item.due_at)}</b></span>
                        {item.expediente_ref ? <span>Ref: <b className="text-slate-700">{item.expediente_ref}</b></span> : null}
                        {item.organismo ? <span>Organismo: <b className="text-slate-700">{item.organismo}</b></span> : null}
                        {item.matricula ? <span>Matrícula: <b className="text-slate-700">{item.matricula}</b></span> : null}
                      </div>
                      <div className="mt-2 break-all text-[11px] text-slate-400">Case ID: {item.case_id}</div>
                    </div>
                    <Link to={caseLink(item)} className="inline-flex shrink-0 justify-center rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">
                      Abrir expediente
                    </Link>
                  </div>
                </article>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
