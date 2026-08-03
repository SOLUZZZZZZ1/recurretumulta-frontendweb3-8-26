import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";

const API = "/api";

const FAMILY_OPTIONS = [
  { value: "velocidad", label: "⚡ Velocidad" },
  { value: "movil", label: "📱 Móvil" },
  { value: "auriculares", label: "🎧 Auriculares" },
  { value: "cinturon", label: "🪢 Cinturón" },
  { value: "semaforo", label: "🚦 Semáforo" },
  { value: "marcas_viales", label: "🛣️ Marcas viales" },
  { value: "casco", label: "🪖 Casco" },
  { value: "seguro", label: "🛡️ Seguro" },
  { value: "itv", label: "🧰 ITV" },
  { value: "condiciones_vehiculo", label: "🚗 Condiciones vehículo" },
  { value: "carril", label: "↔️ Carril" },
  { value: "atencion", label: "👀 Atención" },
];

const SEND_CHANNEL_OPTIONS = [
  { value: "ventanilla_electronica", label: "Ventanilla electrónica" },
  { value: "registro_electronico", label: "Registro electrónico" },
  { value: "sede_dgt", label: "Sede DGT" },
  { value: "sede_municipal", label: "Sede municipal" },
  { value: "correo_administrativo", label: "Correo administrativo" },
  { value: "presencial_registro", label: "Presentación presencial en registro" },
  { value: "csv_notificacion", label: "Validación por CSV / expediente" },
  { value: "manual_otro", label: "Otro canal manual" },
];

const ENTITY_OPTIONS = [
  { value: "dgt", label: "Dirección General de Tráfico (DGT)" },
  { value: "jefatura_trafico", label: "Jefatura Provincial de Tráfico" },
  { value: "ayuntamiento", label: "Ayuntamiento" },
  { value: "policia_local", label: "Policía Local" },
  { value: "guardia_urbana", label: "Guardia Urbana" },
  { value: "diputacion", label: "Diputación" },
  { value: "cabildo", label: "Cabildo" },
  { value: "consell", label: "Consell / Consejo Insular" },
  { value: "generalitat", label: "Generalitat / Comunidad Autónoma" },
  { value: "ministerio_interior", label: "Ministerio del Interior" },
  { value: "guardia_civil", label: "Guardia Civil" },
  { value: "otra_entidad", label: "Otra entidad" },
];

async function fetchJson(url, options = {}) {
  const r = await fetch(url, options);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data?.detail || `Error HTTP ${r.status}`);
  return data;
}

function fmt(d) {
  if (!d) return "—";
  try { return new Date(d).toLocaleString(); } catch { return String(d); }
}

function fmtDateOnly(d) {
  if (!d) return "";
  try {
    const dt = new Date(d);
    if (Number.isNaN(dt.getTime())) return "";
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth() + 1).padStart(2, "0");
    const dd = String(dt.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  } catch {
    return "";
  }
}

function firstNonEmpty(...values) {
  for (const v of values) {
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
}

function getByPath(obj, path) {
  try {
    return path.split(".").reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
  } catch {
    return undefined;
  }
}

function deepFindFirst(obj, wantedKeys) {
  const seen = new Set();
  function walk(node) {
    if (node == null || typeof node !== "object" || seen.has(node)) return undefined;
    seen.add(node);
    if (Array.isArray(node)) {
      for (const item of node) {
        const found = walk(item);
        if (found !== undefined && found !== null && String(found).trim() !== "") return found;
      }
      return undefined;
    }
    for (const key of wantedKeys) {
      if (Object.prototype.hasOwnProperty.call(node, key)) {
        const value = node[key];
        if (value !== undefined && value !== null && String(value).trim() !== "") return value;
      }
    }
    for (const value of Object.values(node)) {
      const found = walk(value);
      if (found !== undefined && found !== null && String(found).trim() !== "") return found;
    }
    return undefined;
  }
  return walk(obj);
}

function compactAction(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.action || value.accion || value.name || value.title || JSON.stringify(value);
  return String(value);
}

function normalizeAction(value) {
  if (!value) return "";
  if (typeof value === "object") return value.action || value.accion || value.name || value.title || JSON.stringify(value);
  const text = String(value);
  try {
    const parsed = JSON.parse(text);
    if (parsed && typeof parsed === "object") return parsed.action || parsed.accion || parsed.name || parsed.title || text;
  } catch {}
  return text;
}

function shortText(value, max = 72) {
  const text = String(value || "").trim();
  if (!text) return "—";
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

function infractionLabel(value) {
  const map = {
    velocidad: "Velocidad",
    movil: "Móvil",
    auriculares: "Auriculares",
    cinturon: "Cinturón",
    semaforo: "Semáforo",
    marcas_viales: "Marcas viales",
    casco: "Casco",
    seguro: "Seguro",
    itv: "ITV",
    condiciones_vehiculo: "Condiciones vehículo",
    carril: "Carril",
    atencion: "Atención",
  };
  return map[value] || value || "—";
}

function infractionEmoji(value) {
  const map = {
    velocidad: "⚡",
    movil: "📱",
    auriculares: "🎧",
    cinturon: "🪢",
    semaforo: "🚦",
    marcas_viales: "🛣️",
    casco: "🪖",
    seguro: "🛡️",
    itv: "🧰",
    condiciones_vehiculo: "🚗",
    carril: "↔️",
    atencion: "👀",
  };
  return map[value] || "📄";
}

function toneForAction(value) {
  const v = String(value || "").toUpperCase();
  if (v.includes("ALEGACIONES") || v.includes("RECURSO")) return "info";
  if (v.includes("ARCHIVO")) return "success";
  return "default";
}

function readAi(ai) {
  if (!ai || typeof ai !== "object") {
    return { familia: "", confianza: "", hecho: "", admisibilidad: "", accion: "" };
  }

  const familia = firstNonEmpty(
    ai.ai_overrides?.familia,
    getByPath(ai, "classifier_result.family"),
    getByPath(ai, "classifier_result.familia"),
    ai.familia,
    ai.family,
    ai.familia_resuelta,
    ai.tipo_infraccion,
    deepFindFirst(ai, ["family", "familia", "familia_correcta", "detected_family"])
  );

  const confianza = firstNonEmpty(
    getByPath(ai, "classifier_result.confidence"),
    getByPath(ai, "classifier_result.score"),
    ai.confianza,
    ai.confidence,
    ai.tipo_infraccion_confidence,
    deepFindFirst(ai, ["confidence", "confianza", "score", "probability"])
  );

  const hecho = firstNonEmpty(
    ai.ai_overrides?.hecho,
    getByPath(ai, "arguments.hecho"),
    getByPath(ai, "arguments.hecho_imputado"),
    ai.hecho,
    ai.hecho_para_recurso,
    ai.hecho_imputado,
    deepFindFirst(ai, ["hecho", "hecho_imputado", "fact", "facts", "literal", "descripcion"])
  );

  const admisibilidad = firstNonEmpty(
    getByPath(ai, "admissibility.admissibility"),
    ai.admissibility,
    ai.admisibilidad,
    deepFindFirst(ai, ["admissibility", "admisibilidad", "status"])
  );

  const accion = firstNonEmpty(
    getByPath(ai, "phase.recommended_action.action"),
    getByPath(ai, "recommended_action.action"),
    ai.recommended_action,
    ai.accion_recomendada,
    ai.accion_panel,
    deepFindFirst(ai, ["recommended_action", "accion_recomendada", "action"])
  );

  return {
    familia: typeof familia === "object" ? JSON.stringify(familia) : String(familia || ""),
    confianza: typeof confianza === "object" ? "" : String(confianza || ""),
    hecho: typeof hecho === "object" ? JSON.stringify(hecho) : String(hecho || ""),
    admisibilidad: typeof admisibilidad === "object" ? "" : String(admisibilidad || ""),
    accion: normalizeAction(compactAction(accion)),
  };
}

function extractDeadlines(ai, detail, events) {
  const beforeDate = firstNonEmpty(
    getByPath(ai, "deadlines.before_resource_deadline"),
    getByPath(detail, "deadlines.before_resource_deadline"),
    deepFindFirst(ai, ["before_resource_deadline"]),
    deepFindFirst(detail, ["before_resource_deadline"])
  );
  const afterDate = firstNonEmpty(
    getByPath(ai, "deadlines.after_resource_deadline"),
    getByPath(detail, "deadlines.after_resource_deadline"),
    deepFindFirst(ai, ["after_resource_deadline"]),
    deepFindFirst(detail, ["after_resource_deadline"])
  );
  const beforeText = firstNonEmpty(
    getByPath(ai, "deadlines.before_text"),
    getByPath(detail, "deadlines.before_text"),
    deepFindFirst(ai, ["before_text"]),
    deepFindFirst(detail, ["before_text"])
  );
  const afterText = firstNonEmpty(
    getByPath(ai, "deadlines.after_text"),
    getByPath(detail, "deadlines.after_text"),
    deepFindFirst(ai, ["after_text"]),
    deepFindFirst(detail, ["after_text"])
  );
  const lastSubmitted = [...(events || [])].find((e) => e?.type === "submitted_to_dgt");
  const submittedAt = lastSubmitted?.payload?.submitted_at || lastSubmitted?.created_at || "";
  return { beforeDate, afterDate, beforeText, afterText, submittedAt };
}

function extractSendInfo(ai, detail, events) {
  const destination = firstNonEmpty(
    getByPath(ai, "delivery.destination"),
    getByPath(detail, "delivery.destination"),
    deepFindFirst(ai, ["destination"]),
    deepFindFirst(detail, ["destination"])
  );
  const address = firstNonEmpty(
    getByPath(ai, "delivery.address"),
    getByPath(detail, "delivery.address"),
    deepFindFirst(ai, ["address"]),
    deepFindFirst(detail, ["address"])
  );
  const channel = firstNonEmpty(
    getByPath(ai, "delivery.channel"),
    getByPath(detail, "delivery.channel"),
    deepFindFirst(ai, ["channel"]),
    deepFindFirst(detail, ["channel"])
  );
  const entity = firstNonEmpty(
    getByPath(ai, "delivery.entity"),
    getByPath(detail, "delivery.entity"),
    deepFindFirst(ai, ["entity"]),
    deepFindFirst(detail, ["entity"])
  );
  const submittedEvents = (events || []).filter((e) => e?.type === "submitted_to_dgt");
  return {
    destination,
    address,
    channel,
    entity,
    submissions: submittedEvents.map((e, idx) => ({
      id: `${e?.type || "submit"}-${idx}`,
      submittedAt: e?.payload?.submitted_at || e?.created_at || "",
      dgtId: e?.payload?.dgt_id || "",
      documentUrl: e?.payload?.document_url || "",
      mode: e?.payload?.mode || "",
    })),
  };
}



function resolveAutomaticDelivery(ai, detail, sendInfo) {
  const generatedDestination = firstNonEmpty(
    getByPath(ai, "delivery.destination_text"),
    getByPath(ai, "raw_result.delivery.destination_text"),
    ""
  );

  const rawOrganismo = firstNonEmpty(
    generatedDestination,
    sendInfo?.entity,
    getByPath(detail, "organismo"),
    getByPath(ai, "raw_result.classify.global_refs.main_organism"),
    getByPath(ai, "raw_result.classify.documents.0.issuer_org"),
    getByPath(ai, "raw_result.draft.variables_usadas.organismo"),
    getByPath(ai, "variables_usadas.organismo"),
    ""
  );

  const organismo = String(rawOrganismo || "").trim();
  const low = organismo.toLowerCase();
  const source = generatedDestination ? "generate" : "analysis";

  if (low.includes("trafico") || low.includes("tráfico") || low.includes("dgt") || low.includes("jefatura")) {
    return {
      destination: organismo || "Dirección General de Tráfico",
      channel: "Sede DGT",
      address: "https://sede.dgt.gob.es",
      tone: "info",
      mode: "automatico",
      source,
    };
  }

  if (
    low.includes("ayuntamiento") ||
    low.includes("ajuntament") ||
    low.includes("policia local") ||
    low.includes("policía local") ||
    low.includes("guardia urbana")
  ) {
    return {
      destination: organismo || "Organismo municipal",
      channel: "Sede municipal / registro",
      address: "",
      tone: "warn",
      mode: "manual",
      source,
    };
  }

  if (organismo) {
    return {
      destination: organismo,
      channel: "Revisar canal",
      address: "",
      tone: "warn",
      mode: "manual",
      source,
    };
  }

  return {
    destination: "Destino no detectado",
    channel: "Revisión manual",
    address: "",
    tone: "warn",
    mode: "manual",
    source: "unknown",
  };
}

function buildPackageStatus(documents) {
  const docs = Array.isArray(documents) ? documents : [];
  const lowerKinds = docs.map((d) => String(d?.kind || "").toLowerCase());

  const hasRecurso = lowerKinds.some((k) => k.endsWith("_pdf") || (k.includes("pdf") && !k.includes("authorization") && !k.includes("autoriz")));
  const hasAutorizacion = lowerKinds.some((k) => k.includes("authorization") || k.includes("autoriz"));
  const hasOriginal = lowerKinds.some((k) => k.includes("original"));

  return {
    hasRecurso,
    hasAutorizacion,
    hasOriginal,
    ready: hasRecurso && hasAutorizacion && hasOriginal,
  };
}

function StatCard({ title, value, tone = "default", compact = false }) {
  const tones = {
    default: "border-slate-200 bg-white",
    success: "border-emerald-200 bg-emerald-50",
    warn: "border-amber-200 bg-amber-50",
    info: "border-blue-200 bg-blue-50",
  };
  return (
    <div className={`rounded-2xl border px-4 py-3 shadow-sm ${tones[tone] || tones.default}`}>
      <div className="text-[11px] uppercase tracking-wide opacity-70">{title}</div>
      <div className={`mt-2 font-semibold break-words ${compact ? "text-sm leading-5" : "text-lg leading-tight"}`}>
        {value || "—"}
      </div>
    </div>
  );
}

function Section({ title, children, right = null }) {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function InfoPill({ children, tone = "default" }) {
  const tones = {
    default: "bg-slate-100 text-slate-700",
    success: "bg-emerald-100 text-emerald-700",
    warn: "bg-amber-100 text-amber-700",
    info: "bg-blue-100 text-blue-700",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${tones[tone] || tones.default}`}>{children}</span>;
}

function DownloadButton({ docId }) {
  const token = localStorage.getItem("ops_token") || "";
  async function handleDownload() {
    try {
      const res = await fetch(`${API}/ops/documents/${encodeURIComponent(docId)}/download`, {
        headers: { "X-Operator-Token": token },
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.detail || "Error descargando documento");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "documento";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      alert(e.message || "Error descargando documento");
    }
  }
  return (
    <button type="button" onClick={handleDownload} className="inline-flex rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50">
      Descargar
    </button>
  );
}

export default function OpsCaseDetailPro() {
  const { caseId } = useParams();

  const [documents, setDocuments] = useState([]);
  const [events, setEvents] = useState([]);
  const [aiResult, setAiResult] = useState(null);
  const [detail, setDetail] = useState(null);
  const [openEvent, setOpenEvent] = useState(null);

  const [loading, setLoading] = useState(false);
  const [runningAI, setRunningAI] = useState(false);
  const [busyApprove, setBusyApprove] = useState(false);
  const [busyManual, setBusyManual] = useState(false);
  const [busySave, setBusySave] = useState(false);
  const [busyFamilyRegenerate, setBusyFamilyRegenerate] = useState(false);
  const [busyHechoRegenerate, setBusyHechoRegenerate] = useState(false);
  const [busySubmit, setBusySubmit] = useState(false);
  const [pollingMsg, setPollingMsg] = useState("");
  const [error, setError] = useState("");
  const [saveMsg, setSaveMsg] = useState("");
  const [planningMsg, setPlanningMsg] = useState("");

  const [hechoEdit, setHechoEdit] = useState("");
  const [familiaEdit, setFamiliaEdit] = useState("");
  const [saveReason, setSaveReason] = useState("Corrección operador");
  const [selectedDocumentId, setSelectedDocumentId] = useState("");
  const [submitForce, setSubmitForce] = useState(false);
  const [receiptFile, setReceiptFile] = useState(null);

  const [beforeDeadlineEdit, setBeforeDeadlineEdit] = useState("");
  const [afterDeadlineEdit, setAfterDeadlineEdit] = useState("");
  const [beforeTextEdit, setBeforeTextEdit] = useState("");
  const [afterTextEdit, setAfterTextEdit] = useState("");
  const [channelEdit, setChannelEdit] = useState("");
  const [entityEdit, setEntityEdit] = useState("");
  const [destinationEdit, setDestinationEdit] = useState("");
  const [addressEdit, setAddressEdit] = useState("");

  const [checkPdf, setCheckPdf] = useState(false);
  const [checkHecho, setCheckHecho] = useState(false);
  const [checkFamilia, setCheckFamilia] = useState(false);
  const [checkPlazos, setCheckPlazos] = useState(false);
  const [checkCanal, setCheckCanal] = useState(false);

  const pollTimerRef = useRef(null);

  const token = localStorage.getItem("ops_token") || "";
  const headers = { "X-Operator-Token": token };
  const plannerStorageKey = `ops_case_planning_${caseId}`;

  function clearPollTimer() {
    if (pollTimerRef.current) {
      clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }

  function pickLatestAiEvent(evs) {
    return [...(evs || [])].find((e) => e?.type === "ai_expediente_result") || null;
  }

  async function loadCase({ silent = false } = {}) {
    if (!silent) {
      setError("");
      setSaveMsg("");
    }
    if (!token) {
      setError("Falta token de operador. Accede primero al panel OPS y entra con PIN.");
      return;
    }
    if (!silent) setLoading(true);

    try {
      const docsRes = await fetchJson(`${API}/ops/cases/${encodeURIComponent(caseId)}/documents`, { headers });
      const evRes = await fetchJson(`${API}/ops/cases/${encodeURIComponent(caseId)}/events`, { headers });
      const detailRes = await fetchJson(`${API}/ops/cases/${encodeURIComponent(caseId)}`, { headers });
      const overridesRes = await fetchJson(`${API}/ops/cases/${encodeURIComponent(caseId)}/ai-overrides`, { headers });

      const docs = docsRes.documents || docsRes.items || [];
      const evs = evRes.events || evRes.items || [];
      const aiEvent = pickLatestAiEvent(evs);
      const payload = { ...(aiEvent?.payload || {}), ai_overrides: overridesRes?.overrides || detailRes?.ai_overrides || {} };

      setDocuments(docs);
      setEvents(evs);
      setDetail(detailRes || null);
      setAiResult(payload);

      if ((!selectedDocumentId || !docs.some((d) => d?.id === selectedDocumentId)) && docs.length) {
        const preferred = docs.find((d) => String(d?.kind || "").toLowerCase().includes("pdf")) || docs[0];
        setSelectedDocumentId(preferred?.id || "");
      }
    } catch (e) {
      if (!silent) {
        setError(e.message || "Error cargando expediente");
        setDocuments([]);
        setEvents([]);
        setAiResult(null);
        setDetail(null);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    loadCase();
    return () => clearPollTimer();
  }, [caseId]);

  async function pollForAiResult() {
    clearPollTimer();
    const start = Date.now();
    const maxMs = 180000;
    const intervalMs = 6000;

    async function step() {
      await loadCase({ silent: true });
      if (Date.now() - start > maxMs) {
        setPollingMsg("");
        setError("La IA parece haber tardado demasiado. Recarga el expediente para comprobar si terminó.");
        clearPollTimer();
        return;
      }
      setPollingMsg("La IA sigue procesando. Comprobando resultado…");
      pollTimerRef.current = setTimeout(step, intervalMs);
    }

    await step();
  }

  async function runAI() {
    setError("");
    setSaveMsg("");
    setPollingMsg("");
    if (!token) return setError("Falta token de operador.");

    setRunningAI(true);
    try {
      await fetchJson(`${API}/ai/expediente/run`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ case_id: caseId }),
      });
      await loadCase();
      setPollingMsg("✅ IA completada.");
      setTimeout(() => setPollingMsg(""), 2500);
    } catch (e) {
      const msg = e.message || "";
      const is502 = msg.includes("502") || msg.includes("Error HTTP 502");
      if (is502) {
        setPollingMsg("La IA sigue ejecutándose. Comprobando resultado…");
        await pollForAiResult();
      } else {
        setError(msg || "Error ejecutando IA");
      }
    } finally {
      setRunningAI(false);
    }
  }

  async function saveAiChanges() {
    setError("");
    setSaveMsg("");
    if (!token) return setError("Falta token de operador.");
    if (!saveReason || saveReason.trim().length < 3) return setError("Indica un motivo de al menos 3 caracteres.");
    setBusySave(true);
    try {
      await fetchJson(`${API}/ops/cases/${encodeURIComponent(caseId)}/save-ai-overrides`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ familia: familiaEdit || null, hecho: hechoEdit || null, motivo: saveReason }),
      });
      await loadCase({ silent: true });
      setSaveMsg("✅ Cambios IA guardados en backend.");
      setTimeout(() => setSaveMsg(""), 3500);
    } catch (e) {
      setError(e.message || "Error guardando cambios IA");
    } finally {
      setBusySave(false);
    }
  }

  async function regenerateFamily() {
    setError("");
    setSaveMsg("");
    if (!token) return setError("Falta token de operador.");
    if (!familiaEdit) return setError("Selecciona una familia.");
    if (!saveReason || saveReason.trim().length < 3) return setError("Indica un motivo de al menos 3 caracteres.");
    setBusyFamilyRegenerate(true);
    try {
      await fetchJson(`${API}/ops/cases/${encodeURIComponent(caseId)}/override-family-and-regenerate`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ familia: familiaEdit, motivo: saveReason }),
      });
      await loadCase();
      setSaveMsg("✅ Familia guardada y recurso regenerado.");
      setTimeout(() => setSaveMsg(""), 3500);
    } catch (e) {
      setError(e.message || "Error regenerando por familia");
    } finally {
      setBusyFamilyRegenerate(false);
    }
  }

  async function regenerateHecho() {
    setError("");
    setSaveMsg("");
    if (!token) return setError("Falta token de operador.");
    if (!hechoEdit || hechoEdit.trim().length < 5) return setError("El hecho debe tener al menos 5 caracteres.");
    if (!saveReason || saveReason.trim().length < 3) return setError("Indica un motivo de al menos 3 caracteres.");
    setBusyHechoRegenerate(true);
    try {
      await fetchJson(`${API}/ops/cases/${encodeURIComponent(caseId)}/rewrite-hecho-and-regenerate`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ hecho: hechoEdit, motivo: saveReason, familia: familiaEdit || null }),
      });
      await loadCase();
      setSaveMsg("✅ Hecho guardado y recurso regenerado.");
      setTimeout(() => setSaveMsg(""), 3500);
    } catch (e) {
      setError(e.message || "Error regenerando por hecho");
    } finally {
      setBusyHechoRegenerate(false);
    }
  }

  function savePlanningLocal() {
    try {
      const payload = {
        beforeDeadlineEdit,
        afterDeadlineEdit,
        beforeTextEdit,
        afterTextEdit,
        channelEdit,
        entityEdit,
        destinationEdit,
        addressEdit,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(plannerStorageKey, JSON.stringify(payload));
      setPlanningMsg("✅ Plazos y envío guardados en este navegador.");
      setTimeout(() => setPlanningMsg(""), 3000);
    } catch {
      setError("No se pudo guardar en local.");
    }
  }

  async function submitResource() {
    setError("");
    setSaveMsg("");
    if (!token) return setError("Falta token de operador.");
    if (!packageStatus.ready) return setError("El paquete de envío está incompleto.");
    if (!selectedDocumentId) return setError("Selecciona un documento para enviar.");

    setBusySubmit(true);
    try {
      savePlanningLocal();
      const documentUrl = `${API}/ops/documents/${encodeURIComponent(selectedDocumentId)}/download`;
      await fetchJson(`${API}/ops/cases/${encodeURIComponent(caseId)}/submit`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ document_url: documentUrl, force: submitForce }),
      });
      await loadCase();
      setSaveMsg("✅ Recurso enviado y guardado en historial.");
      setTimeout(() => setSaveMsg(""), 3500);
    } catch (e) {
      setError(e.message || "Error enviando recurso");
    } finally {
      setBusySubmit(false);
    }
  }

  async function approve() {
    setError("");
    if (!token) return setError("Falta token de operador.");
    setBusyApprove(true);
    try {
      await fetchJson(`${API}/ops/cases/${encodeURIComponent(caseId)}/approve`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ note: "Aprobado desde PRO" }),
      });
      await loadCase();
      alert("Expediente aprobado");
    } catch (e) {
      setError(e.message || "Error aprobando expediente");
    } finally {
      setBusyApprove(false);
    }
  }

  async function manual() {
    setError("");
    if (!token) return setError("Falta token de operador.");
    setBusyManual(true);
    try {
      await fetchJson(`${API}/ops/cases/${encodeURIComponent(caseId)}/manual`, {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: "Revisión manual desde PRO" }),
      });
      await loadCase();
      alert("Expediente enviado a revisión manual");
    } catch (e) {
      setError(e.message || "Error enviando a revisión manual");
    } finally {
      setBusyManual(false);
    }
  }

  const ai = useMemo(() => readAi(aiResult), [aiResult]);
  const deadlines = useMemo(() => extractDeadlines(aiResult, detail, events), [aiResult, detail, events]);
  const sendInfo = useMemo(() => extractSendInfo(aiResult, detail, events), [aiResult, detail, events]);
  const autoDelivery = useMemo(() => resolveAutomaticDelivery(aiResult, detail, sendInfo), [aiResult, detail, sendInfo]);
  const packageStatus = useMemo(() => buildPackageStatus(documents), [documents]);
  const recursoDoc = useMemo(
    () => documents.find((d) => {
      const kind = String(d?.kind || "").toLowerCase();
      return (kind.endsWith("_pdf") || kind.includes("pdf")) && !kind.includes("authorization") && !kind.includes("autoriz");
    }) || null,
    [documents]
  );
  const autorizacionDoc = useMemo(
    () => documents.find((d) => {
      const kind = String(d?.kind || "").toLowerCase();
      return kind.includes("authorization") || kind.includes("autoriz");
    }) || null,
    [documents]
  );
  const originalDoc = useMemo(
    () => documents.find((d) => {
      const kind = String(d?.kind || "").toLowerCase();
      return kind.includes("original");
    }) || null,
    [documents]
  );

  useEffect(() => {
    if (recursoDoc?.id && selectedDocumentId !== recursoDoc.id) {
      setSelectedDocumentId(recursoDoc.id);
    }
  }, [recursoDoc, selectedDocumentId]);


  useEffect(() => {
    setHechoEdit(ai.hecho || "");
    setFamiliaEdit(ai.familia || "");
  }, [ai.hecho, ai.familia]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(plannerStorageKey);
      const local = raw ? JSON.parse(raw) : {};
      setBeforeDeadlineEdit(local.beforeDeadlineEdit || fmtDateOnly(deadlines.beforeDate));
      setAfterDeadlineEdit(local.afterDeadlineEdit || fmtDateOnly(deadlines.afterDate));
      setBeforeTextEdit(local.beforeTextEdit || deadlines.beforeText || "");
      setAfterTextEdit(local.afterTextEdit || deadlines.afterText || "");
      setChannelEdit(local.channelEdit || sendInfo.channel || "");
      setEntityEdit(local.entityEdit || sendInfo.entity || "");
      setDestinationEdit(local.destinationEdit || sendInfo.destination || "");
      setAddressEdit(local.addressEdit || sendInfo.address || "");
    } catch {
      setBeforeDeadlineEdit(fmtDateOnly(deadlines.beforeDate));
      setAfterDeadlineEdit(fmtDateOnly(deadlines.afterDate));
      setBeforeTextEdit(deadlines.beforeText || "");
      setAfterTextEdit(deadlines.afterText || "");
      setChannelEdit(sendInfo.channel || "");
      setEntityEdit(sendInfo.entity || "");
      setDestinationEdit(sendInfo.destination || "");
      setAddressEdit(sendInfo.address || "");
    }
  }, [plannerStorageKey, deadlines.beforeDate, deadlines.afterDate, deadlines.beforeText, deadlines.afterText, sendInfo.channel, sendInfo.entity, sendInfo.destination, sendInfo.address]);


  useEffect(() => {
    if (!entityEdit) return;

    const entityMap = {
      dgt: { destination: "DGT - Dirección General de Tráfico", address: "https://sede.dgt.gob.es", channel: "sede_dgt" },
      jefatura_trafico: { destination: "Jefatura Provincial de Tráfico", address: "https://sede.dgt.gob.es", channel: "sede_dgt" },
      ayuntamiento: { destination: "Ayuntamiento", address: "Sede electrónica municipal", channel: "sede_municipal" },
      policia_local: { destination: "Policía Local", address: "Registro del Ayuntamiento", channel: "registro_electronico" },
      guardia_urbana: { destination: "Guardia Urbana", address: "Registro municipal", channel: "registro_electronico" },
      diputacion: { destination: "Diputación", address: "Sede electrónica de la Diputación", channel: "registro_electronico" },
      cabildo: { destination: "Cabildo", address: "Sede electrónica del Cabildo", channel: "registro_electronico" },
      consell: { destination: "Consell / Consejo Insular", address: "Sede electrónica del Consell", channel: "registro_electronico" },
      generalitat: { destination: "Generalitat / Comunidad Autónoma", address: "Sede electrónica autonómica", channel: "registro_electronico" },
      ministerio_interior: { destination: "Ministerio del Interior", address: "Registro electrónico general", channel: "registro_electronico" },
      guardia_civil: { destination: "Guardia Civil", address: "Registro oficial / unidad correspondiente", channel: "presencial_registro" },
      otra_entidad: { destination: "Otra entidad", address: "", channel: "manual_otro" },
    };

    const next = entityMap[entityEdit];
    if (!next) return;

    setDestinationEdit(next.destination || "");
    setAddressEdit(next.address || "");
    setChannelEdit(next.channel || "");
  }, [entityEdit]);

  useEffect(() => {
    if (!channelEdit) return;
    if (entityEdit) return;

    const channelMap = {
      ventanilla_electronica: { destination: "Presentación por ventanilla electrónica", address: "Ventanilla electrónica del organismo competente" },
      registro_electronico: { destination: "Registro electrónico", address: "Registro electrónico de la administración competente" },
      sede_dgt: { destination: "Sede DGT", address: "https://sede.dgt.gob.es" },
      sede_municipal: { destination: "Sede municipal", address: "Sede electrónica municipal" },
      correo_administrativo: { destination: "Correo administrativo", address: "Oficina de Correos / correo administrativo" },
      presencial_registro: { destination: "Presentación presencial en registro", address: "Registro presencial" },
      csv_notificacion: { destination: "Validación por CSV / expediente", address: "Localizador CSV / expediente" },
      manual_otro: { destination: "Canal manual", address: "" },
    };

    const next = channelMap[channelEdit];
    if (!next) return;

    if (!destinationEdit) setDestinationEdit(next.destination || "");
    if (!addressEdit) setAddressEdit(next.address || "");
  }, [channelEdit, entityEdit, destinationEdit, addressEdit]);

  const latestAiEvent = useMemo(() => pickLatestAiEvent(events), [events]);

  const confianzaNum = Number(ai.confianza);
  const confianzaPct = Number.isFinite(confianzaNum)
    ? (confianzaNum <= 1 ? `${Math.round(confianzaNum * 100)}%` : `${Math.round(confianzaNum)}%`)
    : ai.confianza || "—";

  const aiTone = ai.admisibilidad === "ADMISSIBLE" ? "success" : ai.admisibilidad === "NOT_ADMISSIBLE" ? "warn" : "default";
  const familyTone = familiaEdit ? "info" : "default";
  const actionTone = toneForAction(ai.accion);
  const checklistOk = [checkPdf, checkHecho, checkFamilia, checkPlazos, checkCanal].filter(Boolean).length;
  const checklistTotal = 5;
  const latestThreeDocs = documents.slice(0, 3);

  return (
    <div className="sr-container" style={{ paddingTop: 18, paddingBottom: 40 }}>
      <div className="rounded-[22px] bg-slate-950 px-4 py-4 text-white shadow-xl">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.35em] text-slate-300">Modo operador PRO</div>
            <h1 className="mt-1 text-2xl font-semibold">Panel de validación</h1>
            <p className="mt-2 text-xs text-slate-300 break-all">Expediente: {caseId}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="min-w-[118px] rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100" onClick={() => loadCase()}>
              {loading ? "Recargando..." : "Recargar"}
            </button>
            <button className="min-w-[146px] rounded-xl bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 disabled:opacity-50" onClick={runAI} disabled={runningAI}>
              {runningAI ? "Ejecutando IA..." : "Ejecutar IA"}
            </button>
            <button className="min-w-[146px] rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50" onClick={saveAiChanges} disabled={busySave}>
              {busySave ? "Guardando..." : "Guardar cambios IA"}
            </button>
            <button className="min-w-[118px] rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50" onClick={approve} disabled={busyApprove}>
              {busyApprove ? "Aprobando..." : "Aprobar"}
            </button>
            <button className="min-w-[118px] rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50" onClick={manual} disabled={busyManual}>
              {busyManual ? "Enviando..." : "Manual"}
            </button>
            <Link to={`/ops/case/${caseId}`} className="min-w-[118px] rounded-xl bg-slate-800 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-slate-700">
              Volver
            </Link>
          </div>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {pollingMsg ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{pollingMsg}</div> : null}
      {saveMsg ? <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">{saveMsg}</div> : null}
      {planningMsg ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{planningMsg}</div> : null}

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 shadow-sm">
        <b>Última IA ejecutada:</b> {latestAiEvent ? fmt(latestAiEvent.created_at) : "—"}
      </div>

      <div className={`mt-4 rounded-2xl border px-4 py-4 shadow-sm ${autoDelivery.tone === "info" ? "border-blue-200 bg-blue-50" : "border-amber-200 bg-amber-50"}`}>
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wide text-slate-500">Destino automático del recurso</div>
            <div className="mt-1 text-base font-semibold text-slate-900">{autoDelivery.destination}</div>
            <div className="mt-2 text-sm text-slate-700"><b>Canal:</b> {autoDelivery.channel}</div>
            <div className="mt-1 break-all text-sm text-slate-700"><b>URL:</b> {autoDelivery.address || "Revisión manual / sede específica"}</div>
          </div>
          <div className="flex flex-wrap gap-2">
            <InfoPill tone={autoDelivery.mode === "automatico" ? "success" : "warn"}>
              {autoDelivery.mode === "automatico" ? "🟢 Destino detectado" : "🔴 Revisar destino"}
            </InfoPill>
            <InfoPill tone={autoDelivery.source === "generate" ? "success" : autoDelivery.source === "analysis" ? "default" : "warn"}>
              Fuente: {autoDelivery.source === "generate" ? "generate" : autoDelivery.source === "analysis" ? "análisis" : "sin detectar"}
            </InfoPill>
            {autoDelivery.address ? (
              <button
                type="button"
                onClick={() => window.open(autoDelivery.address, "_blank")}
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                🌐 Abrir sede
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
        <div className="text-[11px] uppercase tracking-wide text-slate-500">Paquete de envío</div>
        <div className="mt-3 grid gap-2 text-sm text-slate-800 md:grid-cols-3">
          <div>{packageStatus.hasRecurso ? "✔" : "❌"} Recurso generado</div>
          <div>{packageStatus.hasAutorizacion ? "✔" : "❌"} Autorización</div>
          <div>{packageStatus.hasOriginal ? "✔" : "❌"} Multa original</div>
        </div>
        <div className="mt-3">
          <InfoPill tone={packageStatus.ready ? "success" : "warn"}>
            {packageStatus.ready ? "LISTO PARA ENVIAR" : "INCOMPLETO"}
          </InfoPill>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Familia" value={`${infractionEmoji(familiaEdit)} ${infractionLabel(familiaEdit)}`} tone={familyTone} compact />
        <StatCard title="Confianza" value={confianzaPct} compact />
        <StatCard title="Admisibilidad" value={ai.admisibilidad || "—"} tone={aiTone} compact />
        <StatCard title="Acción" value={shortText(ai.accion, 42)} tone={actionTone} compact />
        <StatCard title="Documentos" value={String(documents.length)} compact />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Section title="Resultado IA" right={<div className="flex items-center gap-2"><InfoPill tone={familyTone}>{infractionEmoji(familiaEdit)} {infractionLabel(familiaEdit)}</InfoPill><InfoPill tone={aiTone}>{ai.admisibilidad || "—"}</InfoPill></div>}>
          {!aiResult ? <p className="text-slate-500">No hay resultado IA todavía.</p> : (
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Hecho imputado</div>
                <textarea value={hechoEdit} onChange={(e) => setHechoEdit(e.target.value)} className="mt-2 min-h-[90px] w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold leading-6 text-slate-900 outline-none" />
                <div className="mt-2 text-xs text-slate-500">Puedes corregir el hecho y guardarlo o regenerar directamente.</div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Familia</div>
                  <select value={familiaEdit} onChange={(e) => setFamiliaEdit(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 outline-none">
                    <option value="">Selecciona familia</option>
                    {FAMILY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                  <div className="mt-2 text-xs text-slate-500">Esta familia se guarda en servidor y puede regenerar recurso.</div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Motivo del cambio</div>
                  <input value={saveReason} onChange={(e) => setSaveReason(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 outline-none" placeholder="Ej.: OCR defectuoso / familia corregida por operador" />
                  <div className="mt-2 text-xs text-slate-500">Se guarda auditado en evento y en interested_data.</div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button type="button" onClick={regenerateFamily} disabled={busyFamilyRegenerate} className="rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50">
                  {busyFamilyRegenerate ? "Regenerando familia..." : "Familia + regenerar"}
                </button>
                <button type="button" onClick={regenerateHecho} disabled={busyHechoRegenerate} className="rounded-xl bg-fuchsia-600 px-4 py-3 text-sm font-semibold text-white hover:bg-fuchsia-700 disabled:opacity-50">
                  {busyHechoRegenerate ? "Regenerando hecho..." : "Hecho + regenerar"}
                </button>
              </div>

              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Acción recomendada</div>
                <div className="mt-2 max-h-24 overflow-auto text-sm font-medium leading-6 text-slate-900">{ai.accion || "—"}</div>
              </div>
            </div>
          )}
        </Section>

        <Section title="Último regenerado">
          {documents.length === 0 ? <p className="text-slate-500">No hay documentos.</p> : (
            <div className="space-y-2.5">
              {latestThreeDocs.map((d, i) => (
                <div key={d?.id || i} className="rounded-2xl border border-slate-200 p-3">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">
                    {(d.kind || "documento").includes("pdf") ? "PDF" : (d.kind || "documento").includes("docx") ? "DOCX" : "DOC"}
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-900">{d.kind || "documento"}</div>
                  <div className="mt-1 text-xs text-slate-500">{fmt(d.created_at)}</div>
                  <div className="mt-2">{d.id ? <DownloadButton docId={d.id} /> : null}</div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Section title="Plazos" right={<InfoPill tone="warn">antes / después</InfoPill>}>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Plazo antes del recurso</div>
              <input value={beforeDeadlineEdit} onChange={(e) => setBeforeDeadlineEdit(e.target.value)} type="date" className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 outline-none" />
              <textarea value={beforeTextEdit} onChange={(e) => setBeforeTextEdit(e.target.value)} className="mt-2 min-h-[72px] w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 outline-none" placeholder="Notas de plazo previo..." />
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Plazo después del recurso</div>
              <input value={afterDeadlineEdit} onChange={(e) => setAfterDeadlineEdit(e.target.value)} type="date" className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 outline-none" />
              <textarea value={afterTextEdit} onChange={(e) => setAfterTextEdit(e.target.value)} className="mt-2 min-h-[72px] w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 outline-none" placeholder="Notas de plazo posterior..." />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={savePlanningLocal} className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600">
              Guardar plazos
            </button>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Último envío registrado: {deadlines.submittedAt ? fmt(deadlines.submittedAt) : "todavía no enviado"}.
            </div>
          </div>
        </Section>

        <Section title="Envío de recursos" right={<InfoPill tone="info">historial guardado</InfoPill>}>
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Canal de envío</div>
              <select value={channelEdit} onChange={(e) => setChannelEdit(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 outline-none">
                <option value="">Selecciona canal</option>
                {SEND_CHANNEL_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>

              <div className="mt-4 text-[11px] uppercase tracking-wide text-slate-400">Entidad / organismo</div>
              <select value={entityEdit} onChange={(e) => setEntityEdit(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 outline-none">
                <option value="">Selecciona entidad</option>
                {ENTITY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>

              <div className="mt-4 text-[11px] uppercase tracking-wide text-slate-400">Dirección / canal mostrado</div>
              <input value={destinationEdit} onChange={(e) => setDestinationEdit(e.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 outline-none" placeholder="Ej. DGT / Ayuntamiento / Registro electrónico" />

              <textarea value={addressEdit} onChange={(e) => setAddressEdit(e.target.value)} className="mt-2 min-h-[84px] w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 outline-none" placeholder="Dirección o instrucciones de envío..." />

              <button type="button" onClick={savePlanningLocal} className="mt-3 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
                Guardar envío
              </button>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                <div className="font-semibold text-slate-900">Adjuntos previstos en el envío</div>
                <div className="mt-2 space-y-1">
                  <div>{recursoDoc ? "✔" : "❌"} Recurso: {recursoDoc ? `${recursoDoc.kind || "pdf"} · ${fmt(recursoDoc.created_at)}` : "Falta"}</div>
                  <div>{autorizacionDoc ? "✔" : "❌"} Autorización: {autorizacionDoc ? `${autorizacionDoc.kind || "authorization_pdf"} · ${fmt(autorizacionDoc.created_at)}` : "Falta"}</div>
                  <div>{originalDoc ? "✔" : "❌"} Multa original: {originalDoc ? `${originalDoc.kind || "original"} · ${fmt(originalDoc.created_at)}` : "Falta"}</div>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Documento a enviar</div>
              <select
                value={selectedDocumentId}
                onChange={(e) => setSelectedDocumentId(e.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 outline-none"
              >
                <option value="">Selecciona documento</option>
                {documents.map((d, i) => (
                  <option key={d?.id || i} value={d?.id || ""}>
                    {(d.kind || "documento")} · {fmt(d.created_at)}
                  </option>
                ))}
              </select>

              <label className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                <input type="checkbox" checked={submitForce} onChange={() => setSubmitForce(!submitForce)} />
                Forzar envío aunque no esté en ready_to_submit
              </label>

              <button
                type="button"
                onClick={submitResource}
                disabled={busySubmit || !packageStatus.ready}
                className="mt-3 w-full rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              >
                {busySubmit ? "Enviando paquete..." : "Enviar paquete completo"}
              </button>
              {!packageStatus.ready ? (
                <div className="mt-2 text-xs text-amber-600">
                  Falta documentación para enviar el recurso.
                </div>
              ) : null}
            </div>

            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Historial de envíos</div>
              {sendInfo.submissions.length === 0 ? (
                <div className="mt-2 text-sm text-slate-500">No hay envíos registrados todavía.</div>
              ) : (
                <div className="mt-2 space-y-2">
                  {sendInfo.submissions.map((s) => (
                    <div key={s.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                      <div className="font-semibold text-slate-900">{fmt(s.submittedAt)}</div>
                      <div className="mt-1 text-xs text-slate-500">ID externo: {s.dgtId || "—"}</div>
                      <div className="mt-1 text-xs text-slate-500">Modo: {s.mode || "—"}</div>
                      <div className="mt-1 break-all text-xs text-slate-500">{s.documentUrl || "—"}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <div className="text-sm font-semibold mb-3">📬 Subir justificante de envío (REG)</div>

              <input
                type="file"
                accept=".pdf,application/pdf"
                onChange={(e) => setReceiptFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-xl file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200"
              />

              <button
                type="button"
                onClick={async () => {
                  try {
                    setError("");
                    setSaveMsg("");
                    if (!receiptFile) {
                      setError("Selecciona primero el justificante en PDF.");
                      return;
                    }

                    const fd = new FormData();
                    fd.append("file", receiptFile);

                    const res = await fetch(`/api/cases/${caseId}/upload-receipt`, {
                      method: "POST",
                      body: fd,
                    });

                    const data = await res.json().catch(() => ({}));
                    if (!res.ok) {
                      throw new Error(data?.detail || "No se pudo subir el justificante");
                    }

                    setSaveMsg("✅ Justificante guardado correctamente.");
                    setReceiptFile(null);
                    await loadCase({ silent: true });
                    window.location.reload();
                  } catch (e) {
                    setError(e.message || "Error subiendo justificante");
                  }
                }}
                className="mt-3 rounded-xl bg-emerald-600 px-4 py-2 text-white hover:bg-emerald-700"
              >
                Subir justificante
              </button>
            </div>
          </div>
        </Section>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Section title="Checklist antes de aprobar" right={<InfoPill tone={checklistOk === checklistTotal ? "success" : "warn"}>{checklistOk}/{checklistTotal}</InfoPill>}>
          <div className="space-y-2.5">
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-3 py-3 text-sm"><input type="checkbox" checked={checkPdf} onChange={() => setCheckPdf(!checkPdf)} className="mt-1" /><div><div className="font-semibold text-slate-900">He leído el último PDF regenerado</div><div className="text-xs text-slate-500">Nunca aprobar sin abrir el PDF final.</div></div></label>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-3 py-3 text-sm"><input type="checkbox" checked={checkHecho} onChange={() => setCheckHecho(!checkHecho)} className="mt-1" /><div><div className="font-semibold text-slate-900">El hecho denunciado es correcto y limpio</div><div className="text-xs text-slate-500">Debe reflejar la conducta real sin ruido OCR.</div></div></label>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-3 py-3 text-sm"><input type="checkbox" checked={checkFamilia} onChange={() => setCheckFamilia(!checkFamilia)} className="mt-1" /><div><div className="font-semibold text-slate-900">La familia jurídica es la correcta</div><div className="text-xs text-slate-500">Semáforo, velocidad, móvil, etc.</div></div></label>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-3 py-3 text-sm"><input type="checkbox" checked={checkPlazos} onChange={() => setCheckPlazos(!checkPlazos)} className="mt-1" /><div><div className="font-semibold text-slate-900">He revisado los plazos del expediente</div><div className="text-xs text-slate-500">Plazo inicial y, si aplica, plazo post-presentación.</div></div></label>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-3 py-3 text-sm"><input type="checkbox" checked={checkCanal} onChange={() => setCheckCanal(!checkCanal)} className="mt-1" /><div><div className="font-semibold text-slate-900">Sé por qué canal se va a presentar</div><div className="text-xs text-slate-500">DGT, sede electrónica, registro, CSV, etc.</div></div></label>
          </div>
        </Section>

        <Section title="Guía rápida operador">
          <div className="space-y-3 text-sm text-slate-700">
            <div className="rounded-2xl border border-slate-200 p-3"><div className="font-semibold text-slate-900">Orden correcto del trabajo</div><ul className="mt-2 list-disc space-y-1 pl-5 text-xs"><li>Revisar el hecho denunciado y la familia detectada.</li><li>Descargar y leer el último PDF regenerado antes de aprobar.</li><li>Comprobar plazos antes y después del recurso.</li><li>Seleccionar canal, entidad y enviar cuando todo esté correcto.</li></ul></div>
            <div className="rounded-2xl border border-slate-200 p-3"><div className="font-semibold text-slate-900">Cuándo tocar el hecho imputado</div><ul className="mt-2 list-disc space-y-1 pl-5 text-xs"><li>Si ves ruido OCR o texto mezclado.</li><li>Si el hecho está jurídicamente bien pero mal redactado.</li><li>Si quieres una versión más limpia para revisión interna.</li></ul></div>
            <div className="rounded-2xl border border-slate-200 p-3"><div className="font-semibold text-slate-900">Cuándo usar Manual</div><ul className="mt-2 list-disc space-y-1 pl-5 text-xs"><li>Cuando la familia no convence.</li><li>Cuando el PDF final no refleja bien el caso.</li><li>Cuando falte prueba, plazo o canal claro de presentación.</li></ul></div>
          </div>
        </Section>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Section title={`Documentos (${documents.length})`}>
          {documents.length === 0 ? <p className="text-slate-500">No hay documentos.</p> : (
            <div className="space-y-2.5">
              {documents.map((d, i) => (
                <div key={d?.id || i} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-slate-900">{d.kind || "documento"}</div>
                      <div className="mt-1 text-xs text-slate-500 break-all">{d.bucket || d.b2_bucket || "—"}/{d.key || d.b2_key || "—"}</div>
                      <div className="mt-1 text-xs text-slate-500">{d.mime || "—"} · {d.size_bytes ? `${d.size_bytes} bytes` : "—"} · {fmt(d.created_at)}</div>
                    </div>
                    {d.id ? <DownloadButton docId={d.id} /> : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title={`Eventos (${events.length})`}>
          {events.length === 0 ? <p className="text-slate-500">No hay eventos.</p> : (
            <div className="space-y-2.5">
              {events.map((e, i) => (
                <div key={`${e?.type || "evento"}-${i}`} className="rounded-2xl border border-slate-200 p-3">
                  <button type="button" onClick={() => setOpenEvent(openEvent === i ? null : i)} className="w-full text-left">
                    <div className="text-sm font-semibold text-slate-900">{e.type || "evento"}</div>
                    <div className="mt-1 text-xs text-slate-500">{fmt(e.created_at)}</div>
                    <div className="mt-2 text-xs text-blue-600">{openEvent === i ? "Ocultar detalle" : "Ver detalle"}</div>
                  </button>
                  {openEvent === i ? (
                    <div className="mt-3 rounded-2xl bg-slate-50 p-3">
                      <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-700">{JSON.stringify(e.payload || {}, null, 2)}</pre>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      {aiResult ? (
        <div className="mt-5">
          <details className="rounded-3xl border border-slate-200 bg-white shadow-sm">
            <summary className="cursor-pointer list-none px-4 py-3 text-base font-semibold text-slate-900">Payload IA bruto</summary>
            <div className="border-t border-slate-100 p-4">
              <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-700">{JSON.stringify(aiResult, null, 2)}</pre>
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}
