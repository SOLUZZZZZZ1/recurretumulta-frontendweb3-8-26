import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getOperatorToken, requestOpsJson } from "../lib/opsCoreApi.js";

const PRESENTED = new Set([
  "submitted",
  "presentado_manual_ayuntamiento",
  "presentado_auto_dgt",
  "presentado_auto_registro",
]);

const CLOSED = new Set([
  "closed",
  "archived",
  "archived_test",
  "resolved",
  "estimado",
  "desestimado",
]);

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

function isFinished(status) {
  const value = normalize(status);
  return PRESENTED.has(value) || CLOSED.has(value) || value.startsWith("presentado");
}

function formatDate(value) {
  if (!value) return "—";
  try {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString("es-ES");
  } catch {
    return String(value);
  }
}

function daysLabel(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return "Plazo no resuelto";
  if (number < 0) return `Fuera de plazo (${Math.abs(number)} d)`;
  if (number === 0) return "Vence hoy";
  return `${number} día${number === 1 ? "" : "s"}`;
}

function priorityScore(item) {
  const score = Number(item?.priority_score ?? item?.priority ?? item?.prioridad ?? 0);
  return Number.isFinite(score) ? score : 0;
}

function needsPriorityReview(item) {
  const status = normalize(item?.status);
  return Boolean(
    item?.needs_operator_review ||
    item?.manual_required ||
    item?.has_generation_error ||
    status === "manual_review" ||
    status === "pending_documents" ||
    !item?.authorized ||
    item?.payment_status !== "paid"
  );
}

function logicalKey(item) {
  const reference = normalize(item?.expediente_ref).replace(/[^a-z0-9]/g, "");
  const plate = normalize(item?.matricula || item?.plate || item?.vehicle_plate).replace(/[^a-z0-9]/g, "");
  const organism = normalize(item?.organismo || item?.entity || item?.destination).replace(/[^a-z0-9]/g, "");
  if (reference || plate || organism) return `${reference}|${plate}|${organism}`;
  return `case:${item?.case_id}`;
}

function dedupe(items) {
  const grouped = new Map();
  for (const item of items || []) {
    const key = logicalKey(item);
    const current = grouped.get(key);
    const itemTime = new Date(item?.updated_at || item?.created_at || 0).getTime() || 0;
    const currentTime = new Date(current?.updated_at || current?.created_at || 0).getTime() || 0;
    if (!current || priorityScore(item) > priorityScore(current) || itemTime >= currentTime) {
      grouped.set(key, item);
    }
  }
  return [...grouped.values()];
}

function Pill({ children, tone = "default" }) {
  const tones = {
    default: "border-slate-200 bg-slate-100 text-slate-700",
    info: "border-blue-200 bg-blue-100 text-blue-800",
    warn: "border-amber-200 bg-amber-100 text-amber-800",
    danger: "border-rose-200 bg-rose-100 text-rose-800",
    success: "border-emerald-200 bg-emerald-100 text-emerald-800",
  };
  return <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${tones[tone] || tones.default}`}>{children}</span>;
}

function Stat({ label, value, tone = "default" }) {
  const backgrounds = {
    default: "border-slate-200 bg-white",
    info: "border-blue-200 bg-blue-50",
    warn: "border-amber-200 bg-amber-50",
    danger: "border-rose-200 bg-rose-50",
    success: "border-emerald-200 bg-emerald-50",
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${backgrounds[tone] || backgrounds.default}`}>
      <div className="text-[11px] uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-slate-950">{value}</div>
    </div>
  );
}

function CaseCard({ item, priority }) {
  const status = normalize(item?.status) || "sin_estado";
  const reference = item?.expediente_ref || item?.case_id;
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="break-all text-sm font-semibold text-slate-950">{reference}</h3>
            <Pill tone={priority ? "danger" : "info"}>{priority ? "Revisión prioritaria" : "Pendiente"}</Pill>
            <Pill>{status}</Pill>
          </div>
          <div className="mt-3 grid gap-2 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
            <div><b>Case ID:</b> <span className="break-all">{item?.case_id}</span></div>
            <div><b>Servicio:</b> {item?.department || item?.category || "—"}</div>
            <div><b>Organismo:</b> {item?.organismo || item?.entity || item?.destination || "—"}</div>
            <div><b>Plazo:</b> {daysLabel(item?.days_to_deadline)}</div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Pill tone={item?.payment_status === "paid" ? "success" : "warn"}>{item?.payment_status === "paid" ? "Pago confirmado" : "Pago pendiente"}</Pill>
            <Pill tone={item?.authorized ? "success" : "warn"}>{item?.authorized ? "Autorizado" : "Sin autorización"}</Pill>
            {item?.has_generation_error ? <Pill tone="danger">Incidencia de generación legacy</Pill> : null}
            {item?.needs_operator_review ? <Pill tone="warn">Revisión indicada</Pill> : null}
          </div>
          <div className="mt-3 text-xs text-slate-500">
            Actualizado: {formatDate(item?.updated_at)} · Prioridad orientativa: {priorityScore(item)}
          </div>
        </div>
        <div className="w-full xl:w-56">
          <Link
            to={`/ops/case/${encodeURIComponent(item?.case_id)}`}
            className="block rounded-xl bg-slate-950 px-4 py-3 text-center text-sm font-semibold text-white hover:bg-slate-800"
          >
            Abrir ficha RTM CORE
          </Link>
          <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-xs leading-5 text-blue-900">
            La ficha CORE decide la siguiente transición. Esta cola no clasifica ni autoriza Generate o presentación.
          </div>
        </div>
      </div>
    </article>
  );
}

function Group({ title, subtitle, items, priority }) {
  return (
    <section className={`rounded-3xl border p-4 ${priority ? "border-rose-200 bg-rose-50" : "border-blue-200 bg-blue-50"}`}>
      <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">{title}</h2>
          <p className="mt-1 text-xs text-slate-600">{subtitle}</p>
        </div>
        <Pill tone={priority ? "danger" : "info"}>{items.length}</Pill>
      </div>
      {!items.length ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">Sin expedientes en este grupo.</div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => <CaseCard key={item.case_id} item={item} priority={priority} />)}
        </div>
      )}
    </section>
  );
}

export default function OpsCoreQueue() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const token = getOperatorToken();

  async function loadQueue() {
    setLoading(true);
    setError("");
    try {
      const data = await requestOpsJson("/ops/queue-smart", { token });
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      setError(err?.message || "No se pudo cargar la bandeja OPS.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = useMemo(() => {
    const term = normalize(search);
    const rows = dedupe(items.filter((item) => !isFinished(item?.status)));
    const filtered = !term ? rows : rows.filter((item) => [
      item?.case_id,
      item?.expediente_ref,
      item?.contact_email,
      item?.organismo,
      item?.entity,
      item?.department,
      item?.category,
      item?.status,
      item?.matricula,
    ].filter(Boolean).join(" ").toLowerCase().includes(term));
    return filtered.sort((a, b) => {
      const reviewDiff = Number(needsPriorityReview(b)) - Number(needsPriorityReview(a));
      if (reviewDiff) return reviewDiff;
      const scoreDiff = priorityScore(b) - priorityScore(a);
      if (scoreDiff) return scoreDiff;
      return new Date(a?.updated_at || 0).getTime() - new Date(b?.updated_at || 0).getTime();
    });
  }, [items, search]);

  const priorityItems = pending.filter(needsPriorityReview);
  const remainingItems = pending.filter((item) => !needsPriorityReview(item));
  const finishedCount = items.filter((item) => isFinished(item?.status)).length;

  if (!token) {
    return (
      <div className="sr-container py-10">
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-6 text-rose-950">
          <h1 className="text-xl font-semibold">Falta acceso de operador</h1>
          <p className="mt-2 text-sm">Entra primero en el dashboard OPS con tu PIN.</p>
          <Link to="/ops" className="mt-4 inline-flex rounded-xl bg-slate-950 px-4 py-2.5 text-sm font-semibold text-white">Volver al panel OPS</Link>
        </div>
      </div>
    );
  }

  return (
    <main className="sr-container space-y-5 py-5 pb-16">
      <header className="rounded-[28px] bg-slate-950 p-6 text-white shadow-xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.35em] text-slate-400">RTM · Bandeja operativa</div>
            <h1 className="mt-2 text-2xl font-semibold">Priorización sin autoridad jurídica</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Esta bandeja solo ordena trabajo. Los hechos, la familia, la estrategia, Generate y la presentación se gobiernan dentro de cada ficha RTM CORE.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={loadQueue} className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 hover:bg-slate-100">
              {loading ? "Recargando…" : "Recargar"}
            </button>
            <Link to="/ops" className="rounded-xl border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">Dashboard</Link>
          </div>
        </div>
      </header>

      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-900">{error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Stat label="Pendientes visibles" value={pending.length} tone="info" />
        <Stat label="Revisión prioritaria" value={priorityItems.length} tone="danger" />
        <Stat label="Resto de pendientes" value={remainingItems.length} tone="success" />
        <Stat label="Presentados o cerrados" value={finishedCount} tone="default" />
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <label htmlFor="ops-core-search" className="text-xs font-semibold uppercase tracking-wide text-slate-500">Buscar expediente</label>
        <input
          id="ops-core-search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="mt-2 w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-blue-400"
          placeholder="Case ID, referencia, organismo, matrícula o estado…"
        />
      </section>

      <Group
        title="Revisión prioritaria"
        subtitle="Incidencias, datos pendientes o señales operativas que aconsejan abrir primero la ficha CORE."
        items={priorityItems}
        priority
      />
      <Group
        title="Resto de expedientes pendientes"
        subtitle="Orden orientativo; no equivale a aprobación, automatización ni aptitud para presentar."
        items={remainingItems}
      />
    </main>
  );
}
