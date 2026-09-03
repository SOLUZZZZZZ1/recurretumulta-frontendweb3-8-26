import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useParams } from "react-router-dom";
import { isCurrentOpsCaseRequest } from "../lib/opsCaseRequestGuard.js";
import { useOpsAuth } from "../ops-auth/OpsAuthContext.jsx";

const API = "/api";
const JSON_HEADERS = Object.freeze({ "Content-Type": "application/json" });
const EMPTY_CASE_LIST = Object.freeze([]);
const INTERNAL_KEYS = new Set([
  "access_token", "b2", "b2_bucket", "b2_key", "bucket", "document_url",
  "download_endpoint", "download_url", "internal_path", "key", "object_key",
  "file_name", "filename", "original_bucket", "original_filename", "original_key",
  "presign", "presigned_url", "secret",
  "signed_url", "source_bucket", "source_key", "source_keys", "storage",
  "storage_bucket", "storage_coordinates", "storage_key", "storage_locator",
  "storage_path", "token",
]);

const normalizePayloadKey = (key) =>
  String(key || "")
    .trim()
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();

const isInternalKey = (key) => {
  const normalized = normalizePayloadKey(key);
  return (
    INTERNAL_KEYS.has(normalized) ||
    /(^|_)(?:access|auth|bearer|refresh|session)?_?token(?:_|$)/.test(normalized) ||
    /(^|_)(?:api|encryption|private|secret|signing)?_?key(?:_|$)/.test(normalized) ||
    /(^|_)(?:secret|presign|presigned)(?:_|$)/.test(normalized) ||
    /(^|_)(?:b2|bucket)(?:_|$)/.test(normalized) ||
    /(^|_)(?:object|storage|internal|source|original)_(?:bucket|coordinates|key|keys|locator|path|paths|uri|url)(?:_|$)/.test(normalized) ||
    /(^|_)(?:content|document|download|file|presigned|signed|upload)_(?:endpoint|path|route|uri|url)(?:_|$)/.test(normalized)
  );
};

const INTERNAL_VALUE =
  /(?:^(?:b2|gs|s3):\/\/|\/(?:home|tmp|var|workspace)\/|[?&](?:x-amz|x-goog)-(?:credential|signature)=)/i;

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

async function fetchJson(fetchImpl, url, options = {}) {
  const r = await fetchImpl(url, options);
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

function sanitizePayload(value, depth = 0) {
  if (depth > 5) return "…";
  if (Array.isArray(value)) {
    return value.map((item) => sanitizePayload(item, depth + 1));
  }
  if (typeof value === "string" && INTERNAL_VALUE.test(value)) {
    return "[dato interno oculto]";
  }
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (isInternalKey(key)) continue;
    result[key] = sanitizePayload(child, depth + 1);
  }
  return result;
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
    documentsComplete: hasRecurso && hasAutorizacion && hasOriginal,
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

function CustodyBadge() {
  return (
    <span className="inline-flex rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800">
      Custodiado en RTM
    </span>
  );
}

function pickLatestAiEvent(events) {
  return [...(events || [])].find((event) => event?.type === "ai_expediente_result") || null;
}

export default function OpsCaseDetailPro() {
  const { authFetch, canSupervise } = useOpsAuth();
  const canManageLegacy = canSupervise;
  const { caseId } = useParams();

  const [documentsState, setDocuments] = useState([]);
  const [eventsState, setEvents] = useState([]);
  const [aiResultState, setAiResult] = useState(null);
  const [detailState, setDetail] = useState(null);
  const [loadedCaseId, setLoadedCaseId] = useState("");
  const [openEvent, setOpenEvent] = useState(null);

  const [loading, setLoading] = useState(false);
  const [busyManual, setBusyManual] = useState(false);
  const [error, setError] = useState("");
  const [planningMsg, setPlanningMsg] = useState("");

  const [beforeDeadlineEdit, setBeforeDeadlineEdit] = useState("");
  const [afterDeadlineEdit, setAfterDeadlineEdit] = useState("");
  const [beforeTextEdit, setBeforeTextEdit] = useState("");
  const [afterTextEdit, setAfterTextEdit] = useState("");
  const [channelEdit, setChannelEdit] = useState("");
  const [entityEdit, setEntityEdit] = useState("");
  const [destinationEdit, setDestinationEdit] = useState("");
  const [addressEdit, setAddressEdit] = useState("");

  const checkPdf = false;
  const [checkHecho, setCheckHecho] = useState(false);
  const [checkFamilia, setCheckFamilia] = useState(false);
  const [checkPlazos, setCheckPlazos] = useState(false);
  const [checkCanal, setCheckCanal] = useState(false);

  const manualLockRef = useRef(false);
  const activeCaseIdRef = useRef(caseId || "");
  const loadedCaseIdRef = useRef("");
  const loadAbortRef = useRef(null);
  const loadGenerationRef = useRef(0);
  const mutationAbortRef = useRef(null);
  const mutationGenerationRef = useRef(0);

  const caseProjectionReady = Boolean(caseId) && loadedCaseId === caseId;
  const documents = caseProjectionReady ? documentsState : EMPTY_CASE_LIST;
  const events = caseProjectionReady ? eventsState : EMPTY_CASE_LIST;
  const aiResult = caseProjectionReady ? aiResultState : null;
  const detail = caseProjectionReady ? detailState : null;

  useLayoutEffect(() => {
    activeCaseIdRef.current = caseId || "";
    loadedCaseIdRef.current = "";
    setLoadedCaseId("");
    loadAbortRef.current?.abort();
    loadAbortRef.current = null;
    loadGenerationRef.current += 1;
    mutationAbortRef.current?.abort();
    mutationAbortRef.current = null;
    mutationGenerationRef.current += 1;
    manualLockRef.current = false;
    setDocuments([]);
    setEvents([]);
    setAiResult(null);
    setDetail(null);
    setOpenEvent(null);
    setError("");
    setPlanningMsg("");
    setBeforeDeadlineEdit("");
    setAfterDeadlineEdit("");
    setBeforeTextEdit("");
    setAfterTextEdit("");
    setChannelEdit("");
    setEntityEdit("");
    setDestinationEdit("");
    setAddressEdit("");
    setCheckHecho(false);
    setCheckFamilia(false);
    setCheckPlazos(false);
    setCheckCanal(false);
    setBusyManual(false);
    setLoading(Boolean(caseId));

    return () => {
      activeCaseIdRef.current = "";
      loadedCaseIdRef.current = "";
      loadAbortRef.current?.abort();
      mutationAbortRef.current?.abort();
      loadGenerationRef.current += 1;
      mutationGenerationRef.current += 1;
      manualLockRef.current = false;
    };
  }, [caseId]);

  const loadCase = useCallback(async ({ silent = false } = {}) => {
    const requestedCaseId = caseId || "";
    if (!requestedCaseId) {
      setLoading(false);
      return;
    }
    loadAbortRef.current?.abort();
    const controller = new AbortController();
    loadAbortRef.current = controller;
    const requestGeneration = loadGenerationRef.current + 1;
    loadGenerationRef.current = requestGeneration;
    const isCurrentLoad = () =>
      isCurrentOpsCaseRequest({
        requestedCaseId,
        activeCaseId: activeCaseIdRef.current,
        requestGeneration,
        activeGeneration: loadGenerationRef.current,
        signal: controller.signal,
      });

    if (!silent) {
      setError("");
    }
    if (!silent) setLoading(true);

    try {
      const docsRes = await fetchJson(authFetch, `${API}/ops/cases/${encodeURIComponent(requestedCaseId)}/documents`, { signal: controller.signal });
      const evRes = await fetchJson(authFetch, `${API}/ops/cases/${encodeURIComponent(requestedCaseId)}/events`, { signal: controller.signal });
      const detailRes = await fetchJson(authFetch, `${API}/ops/cases/${encodeURIComponent(requestedCaseId)}`, { signal: controller.signal });
      const overridesRes = await fetchJson(authFetch, `${API}/ops/cases/${encodeURIComponent(requestedCaseId)}/ai-overrides`, { signal: controller.signal });

      if (!isCurrentLoad()) return;

      const docs = docsRes.documents || docsRes.items || [];
      const evs = sanitizePayload(evRes.events || evRes.items || []);
      const safeDetail = sanitizePayload(detailRes || null);
      const aiEvent = pickLatestAiEvent(evs);
      const payload = sanitizePayload({
        ...(aiEvent?.payload || {}),
        ai_overrides: overridesRes?.overrides || safeDetail?.ai_overrides || {},
      });

      setDocuments(docs);
      setEvents(evs);
      setDetail(safeDetail);
      setAiResult(payload);
      loadedCaseIdRef.current = requestedCaseId;
      setLoadedCaseId(requestedCaseId);

    } catch (e) {
      if (isCurrentLoad() && !silent) {
        setError(e.message || "Error cargando expediente");
        setDocuments([]);
        setEvents([]);
        setAiResult(null);
        setDetail(null);
      }
    } finally {
      if (loadAbortRef.current === controller) {
        loadAbortRef.current = null;
        if (!silent) setLoading(false);
      }
    }
  }, [authFetch, caseId]);

  useEffect(() => {
    void loadCase();
  }, [loadCase]);

  function confirmPlanningInMemory() {
    if (!canManageLegacy) {
      setError("Fase de acceso individual: esta vista es de consulta para el operador.");
      return;
    }
    if (
      !caseProjectionReady ||
      loadedCaseIdRef.current !== activeCaseIdRef.current ||
      loading ||
      busyManual
    ) return;
    setPlanningMsg("✅ Cambios aplicados solo en esta vista; no se guardan en el dispositivo.");
  }

  async function manual() {
    if (!canManageLegacy) return setError("Fase de acceso individual: la edición CORE está pendiente.");
    const requestedCaseId = loadedCaseIdRef.current;
    if (
      !caseProjectionReady ||
      !requestedCaseId ||
      requestedCaseId !== activeCaseIdRef.current ||
      loading ||
      manualLockRef.current
    ) return;
    manualLockRef.current = true;
    mutationAbortRef.current?.abort();
    const controller = new AbortController();
    mutationAbortRef.current = controller;
    const requestGeneration = mutationGenerationRef.current + 1;
    mutationGenerationRef.current = requestGeneration;
    const isCurrentMutation = () =>
      isCurrentOpsCaseRequest({
        requestedCaseId,
        activeCaseId: activeCaseIdRef.current,
        requestGeneration,
        activeGeneration: mutationGenerationRef.current,
        signal: controller.signal,
      }) && loadedCaseIdRef.current === requestedCaseId;

    setError("");
    setBusyManual(true);
    try {
      await fetchJson(authFetch, `${API}/ops/cases/${encodeURIComponent(requestedCaseId)}/manual`, {
        method: "POST",
        headers: JSON_HEADERS,
        body: JSON.stringify({ motivo: "Revisión manual desde PRO" }),
        signal: controller.signal,
      });
      if (!isCurrentMutation()) return;
      await loadCase({ silent: true });
      if (!isCurrentMutation()) return;
      alert("Expediente enviado a revisión manual");
    } catch (e) {
      if (!isCurrentMutation()) return;
      setError(e.message || "Error enviando a revisión manual");
    } finally {
      if (mutationAbortRef.current === controller) {
        mutationAbortRef.current = null;
        manualLockRef.current = false;
        setBusyManual(false);
      }
    }
  }

  const ai = useMemo(() => readAi(aiResult), [aiResult]);
  const deadlines = useMemo(() => extractDeadlines(aiResult, detail, events), [aiResult, detail, events]);
  const sendInfo = useMemo(() => extractSendInfo(aiResult, detail, events), [aiResult, detail, events]);
  const autoDelivery = useMemo(() => resolveAutomaticDelivery(aiResult, detail, sendInfo), [aiResult, detail, sendInfo]);
  const packageStatus = useMemo(() => buildPackageStatus(documents), [documents]);
  const presenterAvailable =
    detail?.actions?.presenter_available === true;
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
    setBeforeDeadlineEdit(fmtDateOnly(deadlines.beforeDate));
    setAfterDeadlineEdit(fmtDateOnly(deadlines.afterDate));
    setBeforeTextEdit(deadlines.beforeText || "");
    setAfterTextEdit(deadlines.afterText || "");
    setChannelEdit(sendInfo.channel || "");
    setEntityEdit(sendInfo.entity || "");
    setDestinationEdit(sendInfo.destination || "");
    setAddressEdit(sendInfo.address || "");
  }, [caseId, deadlines.beforeDate, deadlines.afterDate, deadlines.beforeText, deadlines.afterText, sendInfo.channel, sendInfo.entity, sendInfo.destination, sendInfo.address]);


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
  const familyTone = ai.familia ? "info" : "default";
  const actionTone = toneForAction(ai.accion);
  const checklistOk = [checkPdf, checkHecho, checkFamilia, checkPlazos, checkCanal].filter(Boolean).length;
  const checklistTotal = 5;
  const latestThreeDocs = documents.slice(0, 3);
  const caseControlsDisabled =
    !canManageLegacy || !caseProjectionReady || loading || busyManual;

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
            <button className="min-w-[118px] rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-slate-100 disabled:opacity-60" onClick={() => loadCase()} disabled={loading}>
              {loading ? "Recargando..." : "Recargar"}
            </button>
            <button
              type="button"
              className="min-w-[190px] cursor-not-allowed rounded-xl bg-slate-600 px-4 py-2.5 text-sm font-semibold text-white opacity-70"
              disabled
              title="El reanálisis se habilitará cuando esta vista use el flujo CORE auditado."
            >
              Reanálisis CORE pendiente
            </button>
            <button
              type="button"
              className="min-w-[190px] cursor-not-allowed rounded-xl bg-slate-600 px-4 py-2.5 text-sm font-semibold text-white opacity-70"
              disabled
              aria-describedby="core-edit-blocked-reason"
            >
              Edición CORE pendiente
            </button>
            <button
              type="button"
              className="min-w-[160px] rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
              disabled
              aria-describedby="approval-blocked-reason"
            >
              Aprobación CORE pendiente
            </button>
            <button className="min-w-[118px] rounded-xl border border-slate-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50" onClick={manual} disabled={caseControlsDisabled}>
              {busyManual ? "Enviando..." : "Manual"}
            </button>
            <Link to={`/ops/case/${caseId}`} className="min-w-[118px] rounded-xl bg-slate-800 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-slate-700">
              Volver
            </Link>
          </div>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {planningMsg ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{planningMsg}</div> : null}
      {!canManageLegacy ? <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-900">Fase de acceso individual: esta vista es de consulta para el operador. La edición y regeneración CORE siguen pendientes.</div> : null}

      <p id="approval-blocked-reason" className="mt-3 text-xs font-semibold text-slate-600">
        La aprobación desde este puente se ha retirado. Se habilitará mediante un
        flujo CORE auditado y ligado al hash del PDF.
      </p>
      <p id="core-edit-blocked-reason" className="mt-1 text-xs font-semibold text-slate-600">
        Guardado, corrección y regeneración permanecen deshabilitados para todos
        los roles hasta que estén disponibles en el flujo CORE.
      </p>

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
                disabled
                title="La apertura de sedes reales está cerrada en este staging sintético."
                className="cursor-not-allowed rounded-xl bg-slate-500 px-4 py-2.5 text-sm font-semibold text-white opacity-70"
              >
                Abrir sede · activación pendiente
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
          <InfoPill tone={packageStatus.documentsComplete ? "info" : "warn"}>
            {packageStatus.documentsComplete
              ? "DOCUMENTACIÓN COMPLETA · REVISIÓN PENDIENTE"
              : "DOCUMENTACIÓN INCOMPLETA"}
          </InfoPill>
          <p className="mt-2 text-xs font-semibold text-slate-600">
            La presencia de los tres documentos no acredita que el recurso sea
            correcto, esté aprobado ni listo para presentar.
          </p>
        </div>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Familia" value={`${infractionEmoji(ai.familia)} ${infractionLabel(ai.familia)}`} tone={familyTone} compact />
        <StatCard title="Confianza" value={confianzaPct} compact />
        <StatCard title="Admisibilidad" value={ai.admisibilidad || "—"} tone={aiTone} compact />
        <StatCard title="Acción" value={shortText(ai.accion, 42)} tone={actionTone} compact />
        <StatCard title="Documentos" value={String(documents.length)} compact />
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_1fr]">
        <Section title="Resultado IA" right={<div className="flex items-center gap-2"><InfoPill tone={familyTone}>{infractionEmoji(ai.familia)} {infractionLabel(ai.familia)}</InfoPill><InfoPill tone={aiTone}>{ai.admisibilidad || "—"}</InfoPill></div>}>
          {!aiResult ? <p className="text-slate-500">No hay resultado IA todavía.</p> : (
            <div className="space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-[11px] uppercase tracking-wide text-slate-400">Hecho imputado</div>
                <textarea value={ai.hecho || ""} readOnly aria-describedby="core-result-read-only" className="mt-2 min-h-[90px] w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 p-3 text-sm font-semibold leading-6 text-slate-900 outline-none" />
                <div id="core-result-read-only" className="mt-2 text-xs text-slate-500">Consulta únicamente. La corrección se habilitará en el flujo CORE auditado.</div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Familia</div>
                  <select value={ai.familia || ""} disabled className="mt-2 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 p-3 text-sm font-semibold text-slate-900 outline-none">
                    <option value="">Selecciona familia</option>
                    {FAMILY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>
                  <div className="mt-2 text-xs text-slate-500">Consulta únicamente; no guarda ni regenera desde este puente.</div>
                </div>

                <div className="rounded-2xl border border-slate-200 p-4">
                  <div className="text-[11px] uppercase tracking-wide text-slate-400">Corrección</div>
                  <input value="Edición CORE pendiente" readOnly className="mt-2 w-full cursor-not-allowed rounded-xl border border-slate-200 bg-slate-100 p-3 text-sm font-semibold text-slate-700 outline-none" />
                  <div className="mt-2 text-xs text-slate-500">No se enviará ningún cambio desde esta vista.</div>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <button type="button" disabled aria-describedby="core-edit-blocked-reason" className="cursor-not-allowed rounded-xl bg-slate-500 px-4 py-3 text-sm font-semibold text-white opacity-70">
                  Familia + regenerar · CORE pendiente
                </button>
                <button type="button" disabled aria-describedby="core-edit-blocked-reason" className="cursor-not-allowed rounded-xl bg-slate-500 px-4 py-3 text-sm font-semibold text-white opacity-70">
                  Hecho + regenerar · CORE pendiente
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
                  <div className="mt-2">{d.id ? <CustodyBadge /> : null}</div>
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Section title="Plazos" right={<InfoPill tone="warn">simulación local</InfoPill>}>
          <p id="planning-local-only" className="mb-3 text-xs font-semibold text-slate-600">
            {canManageLegacy
              ? "Los cambios de esta sección son una simulación: no se guardan y se perderán al salir."
              : "Consulta únicamente. La edición de plazos se habilitará en el flujo CORE auditado."}
          </p>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Plazo antes del recurso</div>
              <input value={beforeDeadlineEdit} onChange={(e) => setBeforeDeadlineEdit(e.target.value)} type="date" disabled={caseControlsDisabled} aria-describedby="planning-local-only" className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-100" />
              <textarea value={beforeTextEdit} onChange={(e) => setBeforeTextEdit(e.target.value)} disabled={caseControlsDisabled} aria-describedby="planning-local-only" className="mt-2 min-h-[72px] w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-100" placeholder="Notas de plazo previo..." />
            </div>
            <div className="rounded-2xl border border-slate-200 p-4">
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Plazo después del recurso</div>
              <input value={afterDeadlineEdit} onChange={(e) => setAfterDeadlineEdit(e.target.value)} type="date" disabled={caseControlsDisabled} aria-describedby="planning-local-only" className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-100" />
              <textarea value={afterTextEdit} onChange={(e) => setAfterTextEdit(e.target.value)} disabled={caseControlsDisabled} aria-describedby="planning-local-only" className="mt-2 min-h-[72px] w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-100" placeholder="Notas de plazo posterior..." />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={confirmPlanningInMemory} disabled={caseControlsDisabled} aria-describedby="planning-local-only" className="rounded-xl bg-amber-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:bg-slate-400">
              Aplicar plazos en esta vista
            </button>
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Último envío registrado: {deadlines.submittedAt ? fmt(deadlines.submittedAt) : "todavía no enviado"}.
            </div>
          </div>
        </Section>

        <Section title="Envío de recursos" right={<InfoPill tone="info">consulta / simulación</InfoPill>}>
          <div className="space-y-3">
            <div className="rounded-2xl border border-slate-200 p-4">
              <p className="mb-3 text-xs font-semibold text-slate-600" aria-describedby="planning-local-only">
                {canManageLegacy
                  ? "La selección de canal es una simulación local y no se guarda."
                  : "El canal registrado se muestra en modo consulta; su edición CORE está pendiente."}
              </p>
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Canal de envío</div>
              <select value={channelEdit} onChange={(e) => setChannelEdit(e.target.value)} disabled={caseControlsDisabled} aria-describedby="planning-local-only" className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-100">
                <option value="">Selecciona canal</option>
                {SEND_CHANNEL_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>

              <div className="mt-4 text-[11px] uppercase tracking-wide text-slate-400">Entidad / organismo</div>
              <select value={entityEdit} onChange={(e) => setEntityEdit(e.target.value)} disabled={caseControlsDisabled} aria-describedby="planning-local-only" className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-100">
                <option value="">Selecciona entidad</option>
                {ENTITY_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
              </select>

              <div className="mt-4 text-[11px] uppercase tracking-wide text-slate-400">Dirección / canal mostrado</div>
              <input value={destinationEdit} onChange={(e) => setDestinationEdit(e.target.value)} disabled={caseControlsDisabled} aria-describedby="planning-local-only" className="mt-2 w-full rounded-xl border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-900 outline-none disabled:cursor-not-allowed disabled:bg-slate-100" placeholder="Ej. DGT / Ayuntamiento / Registro electrónico" />

              <textarea value={addressEdit} onChange={(e) => setAddressEdit(e.target.value)} disabled={caseControlsDisabled} aria-describedby="planning-local-only" className="mt-2 min-h-[84px] w-full rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-700 outline-none disabled:cursor-not-allowed disabled:bg-slate-100" placeholder="Dirección o instrucciones de envío..." />

              <button type="button" onClick={confirmPlanningInMemory} disabled={caseControlsDisabled} aria-describedby="planning-local-only" className="mt-3 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-400">
                Aplicar envío en esta vista
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
              <div className="text-[11px] uppercase tracking-wide text-slate-400">Presentación controlada</div>
              <p className="mt-2 text-sm text-slate-700">
                Los documentos permanecen en RTM. En este staging, el Presentador
                prepara y congela el paquete; el puente remoto de adjuntos sigue
                cerrado hasta disponer de una extensión gestionada y atestada.
              </p>
              {presenterAvailable ? (
                <Link
                  to={`/ops/case/${encodeURIComponent(caseId)}/presenter`}
                  className="mt-3 inline-flex w-full justify-center rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Preparar en RTM Presenter
                </Link>
              ) : (
                <div className="mt-3 rounded-xl bg-slate-100 px-4 py-3 text-center text-xs font-semibold text-slate-600">
                  Presenter no está habilitado para este expediente.
                </div>
              )}
              {!packageStatus.documentsComplete ? (
                <div className="mt-2 text-xs text-amber-600">
                  Falta documentación para enviar el recurso.
                </div>
              ) : (
                <div className="mt-2 text-xs font-semibold text-blue-700">
                  Documentación presente; la revisión humana y la preparación
                  controlada siguen siendo obligatorias.
                </div>
              )}
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
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
              <div className="font-semibold">📬 Justificante de presentación</div>
              <p className="mt-2">
                El justificante se incorpora desde RTM Presenter después de la
                presentación. Esta vista no admite cargas paralelas sin el recibo
                individual y el hash de la versión presentada.
              </p>
            </div>
          </div>
        </Section>
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Section title="Checklist local de revisión" right={<InfoPill tone={checklistOk === checklistTotal ? "success" : "warn"}>{checklistOk}/{checklistTotal}</InfoPill>}>
          <p id="checklist-local-only" className="mb-3 text-xs font-semibold text-slate-600">
            {canManageLegacy
              ? "Esta lista sirve como apoyo temporal: no se guarda y se perderá al salir."
              : "Consulta únicamente. La confirmación auditada se habilitará en CORE."}
          </p>
          <div className="space-y-2.5">
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm"><input type="checkbox" checked={checkPdf} disabled aria-describedby="secure-pdf-review-reason" className="mt-1" /><div><div className="font-semibold text-slate-900">Revisión del PDF pendiente de evidencia</div><div id="secure-pdf-review-reason" className="text-xs text-slate-500">Se habilitará al existir un visor interno con recibo individual, hash y auditoría.</div></div></label>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-3 py-3 text-sm"><input type="checkbox" checked={checkHecho} onChange={() => setCheckHecho(!checkHecho)} disabled={caseControlsDisabled} aria-describedby="checklist-local-only" className="mt-1" /><div><div className="font-semibold text-slate-900">El hecho denunciado es correcto y limpio</div><div className="text-xs text-slate-500">Debe reflejar la conducta real sin ruido OCR.</div></div></label>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-3 py-3 text-sm"><input type="checkbox" checked={checkFamilia} onChange={() => setCheckFamilia(!checkFamilia)} disabled={caseControlsDisabled} aria-describedby="checklist-local-only" className="mt-1" /><div><div className="font-semibold text-slate-900">La familia jurídica es la correcta</div><div className="text-xs text-slate-500">Semáforo, velocidad, móvil, etc.</div></div></label>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-3 py-3 text-sm"><input type="checkbox" checked={checkPlazos} onChange={() => setCheckPlazos(!checkPlazos)} disabled={caseControlsDisabled} aria-describedby="checklist-local-only" className="mt-1" /><div><div className="font-semibold text-slate-900">He revisado los plazos del expediente</div><div className="text-xs text-slate-500">Plazo inicial y, si aplica, plazo post-presentación.</div></div></label>
            <label className="flex items-start gap-3 rounded-2xl border border-slate-200 px-3 py-3 text-sm"><input type="checkbox" checked={checkCanal} onChange={() => setCheckCanal(!checkCanal)} disabled={caseControlsDisabled} aria-describedby="checklist-local-only" className="mt-1" /><div><div className="font-semibold text-slate-900">Sé por qué canal se va a presentar</div><div className="text-xs text-slate-500">DGT, sede electrónica, registro, CSV, etc.</div></div></label>
          </div>
        </Section>

        <Section title="Guía rápida operador">
          <div className="space-y-3 text-sm text-slate-700">
            <div className="rounded-2xl border border-slate-200 p-3"><div className="font-semibold text-slate-900">Orden correcto del trabajo</div><ul className="mt-2 list-disc space-y-1 pl-5 text-xs"><li>Revisar el hecho denunciado y la familia detectada.</li><li>Revisar el último PDF dentro de RTM antes de aprobar.</li><li>Comprobar plazos antes y después del recurso.</li><li>Preparar la presentación desde RTM cuando todo esté correcto.</li></ul></div>
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
                      <div className="mt-1 text-xs font-medium text-emerald-700">Custodia interna · sin rutas de almacenamiento</div>
                      <div className="mt-1 text-xs text-slate-500">{d.mime || "—"} · {d.size_bytes ? `${d.size_bytes} bytes` : "—"} · {fmt(d.created_at)}</div>
                    </div>
                    {d.id ? <CustodyBadge /> : null}
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
                      <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-700">{JSON.stringify(sanitizePayload(e.payload || {}), null, 2)}</pre>
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
              <pre className="overflow-x-auto whitespace-pre-wrap break-words text-[11px] leading-5 text-slate-700">{JSON.stringify(sanitizePayload(aiResult), null, 2)}</pre>
            </div>
          </details>
        </div>
      ) : null}
    </div>
  );
}
