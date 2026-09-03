import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useOpsAuth } from "../ops-auth/OpsAuthContext.jsx";

const API = "/api";

async function fetchJson(fetchImpl, url, options = {}) {
  const r = await fetchImpl(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail?.message || data?.detail || `Error HTTP ${r.status}`);
  return data;
}

function fmtDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString();
  } catch {
    return String(value);
  }
}

function confidenceNumber(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  return num <= 1 ? num : num / 100;
}

function confidenceLabel(value) {
  const num = confidenceNumber(value);
  if (num === null) return "—";
  return `${Math.round(num * 100)}%`;
}

function confidenceTone(value) {
  const num = confidenceNumber(value);
  if (num === null) return "warn";
  return num < 0.8 ? "warn" : "success";
}


function normalizeKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9]/g, "");
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
  return (
    s === "closed" ||
    s === "archived" ||
    s === "archived_test" ||
    s === "pending_client_data" ||
    s === "draft" ||
    s === "lead" ||
    s === "resolved" ||
    s === "estimado" ||
    s === "desestimado"
  );
}

function isOperativelyPending(item) {
  const payment = String(item?.payment_status || "").toLowerCase();
  if (payment && payment !== "paid") return false;
  if (payment !== "paid") return false;
  return !isPresentedStatus(item?.status) && !isClosedStatus(item?.status);
}

function logicalCaseKey(item) {
  const expediente = normalizeKey(item?.expediente_ref);
  const matricula = normalizeKey(item?.matricula || item?.plate || item?.vehicle_plate);
  const organismo = normalizeKey(item?.organismo || item?.entity || item?.destination);
  const email = normalizeKey(item?.contact_email);

  if (expediente || matricula || organismo) {
    return [expediente || "sinexp", matricula || "sinmat", organismo || "sinorg"].join("|");
  }

  return email ? `email:${email}` : `case:${item?.case_id}`;
}

function itemScoreForDedup(item) {
  let score = 0;

  if (item?.payment_status === "paid") score += 30;
  if (item?.authorized) score += 30;
  if (item?.has_generated_pdf) score += 10;
  if (item?.has_generated_docx) score += 10;
  if (item?.has_authorization_pdf) score += 5;
  if (String(item?.organismo || item?.entity || item?.destination || "").trim()) score += 5;

  const updated = new Date(item?.updated_at || item?.created_at || 0).getTime();
  if (Number.isFinite(updated)) score += Math.min(updated / 10000000000000, 10);

  return score;
}


function hideGroupsAlreadyPresentedOrClosed(items) {
  const raw = items || [];
  const finishedKeys = new Set();

  for (const item of raw) {
    if (isPresentedStatus(item?.status) || isClosedStatus(item?.status)) {
      finishedKeys.add(logicalCaseKey(item));
    }
  }

  return raw.filter((item) => {
    const key = logicalCaseKey(item);
    if (finishedKeys.has(key)) return false;
    return isOperativelyPending(item);
  });
}

function dedupeLogicalCases(items) {
  const grouped = new Map();

  for (const item of items || []) {
    const key = logicalCaseKey(item);
    const current = grouped.get(key);

    if (!current || itemScoreForDedup(item) >= itemScoreForDedup(current)) {
      grouped.set(key, item);
    }
  }

  return Array.from(grouped.values());
}

function hasAuthorizationEvidence(item) {
  return (
    !!item?.authorized ||
    !!item?.has_authorization_pdf ||
    !!item?.authorization_url ||
    !!item?.authorization_document_id
  );
}

function statusPillTone(status) {
  if (isPresentedStatus(status)) return "success";
  if (isClosedStatus(status)) return "default";
  const s = String(status || "").toLowerCase();
  if (s === "manual_review" || s === "ready_to_submit") return "warn";
  if (s === "pending_documents") return "danger";
  return "info";
}

function statusLabel(status) {
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

function classifyLane(item) {
  if (!isOperativelyPending(item)) return "NO_PENDIENTE";

  const tipo = String(item?.familia || item?.tipo_infraccion || "").trim().toLowerCase();
  const conf = confidenceNumber(item?.confidence);
  const authorized = !!item?.authorized;
  const paid = item?.payment_status === "paid";
  const hasPdf = !!item?.has_generated_pdf;
  const hasDocx = !!item?.has_generated_docx;
  const hasOrg = !!String(item?.entity || item?.organismo || item?.destination || "").trim();
  const reviewReason = !!item?.needs_operator_review || !!item?.manual_required || !!item?.has_generation_error;
  const isGeneric = ["generic", "otro", ""].includes(tipo);

  const automatic =
    !reviewReason &&
    !isGeneric &&
    authorized &&
    paid &&
    hasPdf &&
    hasDocx &&
    hasOrg &&
    conf !== null &&
    conf >= 0.8;

  return automatic ? "AUTOMATICO" : "MANUAL";
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

function StatBox({ title, value, tone = "default" }) {
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
    </div>
  );
}

function RowBool({ ok, yes = "Sí", no = "No" }) {
  return <Pill tone={ok ? "success" : "warn"}>{ok ? `✅ ${yes}` : `❌ ${no}`}</Pill>;
}

function QueueSection({ title, tone, items, emptyText }) {
  const toneBox = {
    success: "border-emerald-200 bg-emerald-50",
    danger: "border-rose-200 bg-rose-50",
  };

  return (
    <div className={`rounded-3xl border p-4 shadow-sm ${toneBox[tone] || "border-slate-200 bg-white"}`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        <Pill tone={tone === "success" ? "success" : "danger"}>{items.length}</Pill>
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          {emptyText}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => {
            const lane = classifyLane(item);
            const conf = confidenceLabel(item.confidence);
            const deadlineLabel =
              item.days_to_deadline === null || item.days_to_deadline === undefined
                ? "—"
                : item.days_to_deadline < 0
                  ? `Fuera de plazo (${Math.abs(item.days_to_deadline)} d)`
                  : `${item.days_to_deadline} d`;

            return (
              <div key={item.case_id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="break-all text-sm font-semibold text-slate-900">
                        {item.expediente_ref || item.case_id}
                      </div>
                      <Pill tone={lane === "AUTOMATICO" ? "success" : "danger"}>
                        {lane === "AUTOMATICO" ? "🟢 Automático" : "🔴 Manual"}
                      </Pill>
                      <Pill tone={statusPillTone(item.status)}>{statusLabel(item.status)}</Pill>
                    </div>

                    <div className="mt-2 grid gap-2 text-sm text-slate-700 md:grid-cols-2 xl:grid-cols-4">
                      <div><b>Case ID:</b> <span className="break-all">{item.case_id}</span></div>
                      <div><b>Familia:</b> {item.familia || item.tipo_infraccion || "—"}</div>
                      <div><b>Confianza:</b> <Pill tone={confidenceTone(item.confidence)}>{conf}</Pill></div>
                      <div><b>Plazo:</b> {deadlineLabel}</div>
                    </div>

                    <div className="mt-3 flex flex-wrap gap-2">
                      <RowBool ok={!!item.authorized} yes="Autorizado" no="Sin autorización" />
                      <RowBool ok={item.payment_status === "paid"} yes="Pagado" no="Sin pago" />
                      <RowBool ok={hasAuthorizationEvidence(item)} yes="Autorización registrada" no="Sin autorización" />
                      <RowBool ok={!!item.has_generated_pdf} yes="PDF generado" no="Sin PDF generado" />
                      <RowBool ok={!!item.has_generated_docx} yes="DOCX generado" no="Sin DOCX generado" />
                      <RowBool ok={!!String(item.entity || item.organismo || item.destination || "").trim()} yes="Organismo OK" no="Organismo dudoso" />
                      {item.has_generation_error ? <Pill tone="danger">❌ Error generación</Pill> : null}
                    </div>

                    <div className="mt-3 text-xs text-slate-500">
                      <b>Email:</b> {item.contact_email || "—"} · <b>Actualizado:</b> {fmtDate(item.updated_at)}
                    </div>
                  </div>

                  <div className="flex w-full flex-col gap-2 xl:w-[220px]">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                      <div><b>Prioridad:</b> {item.priority_score ?? 0}</div>
                      <div><b>Recomendación:</b> {lane === "AUTOMATICO" ? "Presentar rápido" : "Revisar operador"}</div>
                    </div>

                    <Link
                      to={`/ops/case/${encodeURIComponent(item.case_id)}`}
                      className={`rounded-xl px-4 py-3 text-center text-sm font-semibold text-white ${
                        lane === "AUTOMATICO"
                          ? "bg-emerald-600 hover:bg-emerald-700"
                          : "bg-amber-500 hover:bg-amber-600"
                      }`}
                    >
                      {lane === "AUTOMATICO" ? "🚀 Abrir automático" : "🔎 Abrir manual"}
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function OPSQueueSmart() {
  const { authFetch } = useOpsAuth();
  const [data, setData] = useState({ ok: true, count: 0, summary: {}, items: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(15);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetchJson(authFetch, `${API}/ops/queue-smart`);
      setData(res || { ok: true, count: 0, summary: {}, items: [] });
    } catch (e) {
      setError(e.message || "No se pudo cargar la cola inteligente");
      setData({ ok: true, count: 0, summary: {}, items: [] });
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    // 1) Solo trabajo operativo pendiente.
    // Si un expediente lógico ya tiene una versión presentada/cerrada,
    // ocultamos también sus duplicados antiguos en manual_review.
    const pendingOnly = hideGroupsAlreadyPresentedOrClosed(data?.items || []);

    // 2) Evitar duplicados lógicos: mismo expediente/matrícula/organismo.
    // Si hay varias versiones del mismo expediente, nos quedamos con la más completa/reciente.
    const deduped = dedupeLogicalCases(pendingOnly);

    if (!term) return deduped;

    return deduped.filter((item) => {
      const haystack = [
        item.case_id,
        item.expediente_ref,
        item.contact_email,
        item.status,
        item.next_action,
        item.familia,
        item.tipo_infraccion,
        item.entity,
        item.organismo,
        item.destination,
        item.matricula,
        item.plate,
        item.vehicle_plate,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [data, search]);


  const rawItems = data?.items || [];
  const rawPendingItems = useMemo(
    () => hideGroupsAlreadyPresentedOrClosed(rawItems),
    [rawItems]
  );

  const topNext = useMemo(
    () => {
      const candidates = (filteredItems || []).filter(isOperativelyPending);
      if (!candidates.length) return null;

      return [...candidates].sort((a, b) => {
        const ap = Number(a.priority || a.prioridad || 0);
        const bp = Number(b.priority || b.prioridad || 0);
        return bp - ap;
      })[0];
    },
    [filteredItems]
  );


  const presentedOrClosedCount = useMemo(
    () => rawItems.filter((item) => isPresentedStatus(item.status) || isClosedStatus(item.status)).length,
    [rawItems]
  );

  const duplicateHiddenCount = Math.max(0, rawPendingItems.length - filteredItems.length);

  const visibleItems = useMemo(
    () => (filteredItems || []).slice(0, visibleCount),
    [filteredItems, visibleCount]
  );

  const hasMoreItems = (filteredItems || []).length > visibleCount;


  const automaticItems = useMemo(
    () => filteredItems.filter((item) => classifyLane(item) === "AUTOMATICO"),
    [filteredItems]
  );

  const manualItems = useMemo(
    () => filteredItems.filter((item) => classifyLane(item) === "MANUAL"),
    [filteredItems]
  );

  return (
    <div className="sr-container" style={{ paddingTop: 18, paddingBottom: 40 }}>
      <div className="rounded-[22px] bg-slate-950 px-4 py-4 text-white shadow-xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.35em] text-slate-300">OPS · Cola inteligente</div>
            <h1 className="mt-1 text-2xl font-semibold">Separación visual automática / manual</h1>
            <p className="mt-2 text-xs text-slate-300">
              Casos limpios arriba para presentar rápido. Casos dudosos abajo para revisión manual.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={loadQueue}
              className="rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100"
            >
              {loading ? "Recargando..." : "Recargar"}
            </button>

            {topNext ? (
              <Link
                to={`/ops/case/${encodeURIComponent(topNext.case_id)}`}
                className="rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600"
              >
                ➡️ Siguiente caso
              </Link>
            ) : null}

            <Link
              to="/ops"
              className="rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
            >
              Volver
            </Link>
          </div>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
        <StatBox title="Pendientes reales" value={filteredItems.length} tone="info" />
        <StatBox title="Automáticos" value={automaticItems.length} tone="success" />
        <StatBox title="Manual" value={manualItems.length} tone="danger" />
        <StatBox title="Siguiente" value={topNext?.expediente_ref || topNext?.case_id || "Sin pendientes"} tone="warn" />
        <StatBox title="Presentados/cerrados fuera" value={presentedOrClosedCount} tone="success" />
        <StatBox title="Duplicados ocultos" value={duplicateHiddenCount} tone="warn" />
      </div>

      <div className="mt-3 rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-xs text-blue-800">
        Los expedientes presentados o cerrados quedan fuera del foco. Los duplicados lógicos se ocultan para evitar confusión operativa.
      </div>


      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
        <div className="text-slate-600">
          Mostrando primeros <strong>{Math.min(visibleCount, filteredItems.length)}</strong> de{" "}
          <strong>{filteredItems.length}</strong> expedientes pendientes reales.
        </div>

        <div className="flex gap-2 flex-wrap">
          {visibleCount > 15 ? (
            <button
              type="button"
              onClick={() => setVisibleCount(15)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Colapsar
            </button>
          ) : null}

          {hasMoreItems ? (
            <button
              type="button"
              onClick={() => setVisibleCount((v) => v + 15)}
              className="rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
            >
              ⬇ Ver más
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 px-4 py-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="text-sm font-semibold text-slate-900">Búsqueda rápida</div>
            <div className="text-xs text-slate-500">Expediente, email, familia u organismo</div>
          </div>

          <div className="w-full lg:w-[320px]">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none"
              placeholder="Buscar en cola..."
            />
          </div>
        </div>

        <div className="space-y-4 p-4">
          <QueueSection
            title="🟢 Casos automáticos"
            tone="success"
            items={automaticItems}
            emptyText="No hay casos limpios listos para automático."
          />

          <QueueSection
            title="🔴 Casos manuales"
            tone="danger"
            items={manualItems}
            emptyText="No hay casos pendientes de revisión manual."
          />
        </div>
      </div>
    </div>
  );
}
