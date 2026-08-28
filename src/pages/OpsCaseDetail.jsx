import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { derivePaymentDisplay } from "../lib/opsPayment.js";

const API = "/api";

const FAMILY_CONFIG = {
  traffic: {
    icon: "🚗",
    label: "Tráfico y vehículos",
    accent: "#2563eb",
    soft: "#eff6ff",
    border: "#bfdbfe",
    title: "Revisión del expediente de tráfico",
    text: "Comprueba la notificación, el hecho imputado, el organismo, los plazos, la autorización y las pruebas disponibles.",
    checklist: [
      "Identificar la infracción y el acto recurrible.",
      "Verificar fecha de notificación y plazo vigente.",
      "Comprobar organismo, matrícula y referencias.",
      "Revisar pruebas, hechos y estrategia jurídica.",
    ],
  },
  debt: {
    icon: "💳",
    label: "Deudas y morosidad",
    accent: "#7c3aed",
    soft: "#f5f3ff",
    border: "#ddd6fe",
    title: "Revisión de deuda o reclamación frente al acreedor",
    text: "Comprueba acreedor, origen de la deuda, factura o contrato, vencimiento, pagos, saldo pendiente y reclamaciones previas.",
    checklist: [
      "Identificar acreedor, contrato o factura.",
      "Verificar importe, vencimiento y saldo pendiente.",
      "Distinguir deuda real, discutida, pagada o prescrita.",
      "Definir requerimiento, oposición o estrategia de reclamación.",
    ],
  },
  administration: {
    icon: "🏛️",
    label: "Administración pública",
    accent: "#c2410c",
    soft: "#fff7ed",
    border: "#fed7aa",
    title: "Revisión del acto administrativo",
    text: "Comprueba órgano, tipo de acto, notificación, vía procedente, plazo y documentación acreditativa.",
    checklist: [
      "Identificar órgano, acto y número de expediente.",
      "Verificar notificación y plazo de actuación.",
      "Determinar recurso, alegación o trámite procedente.",
      "Preparar control de presentación y seguimiento.",
    ],
  },
  travel: {
    icon: "✈️",
    label: "Viajes",
    accent: "#0891b2",
    soft: "#ecfeff",
    border: "#a5f3fc",
    title: "Revisión de la incidencia de viaje",
    text: "Comprueba reserva, transportista o proveedor, fechas, incidencia, comunicaciones, alternativa ofrecida y gastos acreditados.",
    checklist: [
      "Identificar reserva, vuelo, viaje o alojamiento.",
      "Verificar incidencia, fecha y aviso recibido.",
      "Revisar alternativa, gastos y reclamación previa.",
      "Determinar compensación, reembolso o daños.",
    ],
  },
  claims: {
    icon: "📣",
    label: "Reclamaciones y consumo",
    accent: "#059669",
    soft: "#ecfdf5",
    border: "#bbf7d0",
    title: "Revisión de la reclamación de consumo",
    text: "Comprueba proveedor, producto o servicio, contrato, factura, reclamación previa, respuesta y solución solicitada.",
    checklist: [
      "Identificar empresa, contrato y servicio.",
      "Ordenar facturas, cobros y comunicaciones.",
      "Comprobar reclamación previa y respuesta.",
      "Definir devolución, baja, cumplimiento o indemnización.",
    ],
  },
  other: {
    icon: "📂",
    label: "Otros / por clasificar",
    accent: "#475569",
    soft: "#f8fafc",
    border: "#e2e8f0",
    title: "Revisión inicial del expediente",
    text: "Ordena la documentación, confirma los datos mínimos y determina la familia jurídica antes de continuar.",
    checklist: [
      "Comprobar identidad, autorización y documento principal.",
      "Identificar relación jurídica y partes.",
      "Detectar plazos, importes y comunicaciones relevantes.",
      "Resolver familia y asignar especialista.",
    ],
  },
};

const CASE_TYPE_LABELS = {
  fine: "Recurrir una multa",
  vehicle_removal: "Eliminar un vehículo",
  other_traffic: "Otro trámite de tráfico",
  asnef_equifax: "ASNEF / Equifax",
  creditor_claim: "Reclamación frente al acreedor",
  other_debt: "Otro asunto de deuda",
  aeat: "Hacienda / AEAT",
  social_security: "Seguridad Social",
  town_hall: "Ayuntamiento",
  general_administration: "Otro organismo público",
  airline: "Aerolínea",
  flight_cancelled: "Vuelo cancelado",
  flight_delayed: "Vuelo retrasado",
  baggage: "Equipaje",
  consumer: "Consumo",
  other_claim: "Otra reclamación",
};

const STATUS_LABELS = {
  authorization_pending: "Pendiente de autorización",
  documents_pending: "Documentación pendiente",
  pending_documents: "Documentación pendiente",
  documents_received: "Documentación recibida",
  uploaded: "Documentación recibida",
  ready_for_review_payment: "Preparado para pagar la revisión",
  ready_to_pay: "Pendiente de pago",
  manual_review: "Revisión manual",
  analyzed: "Analizado",
  generated: "Documento generado",
  final_ready: "Documento final preparado",
  ready_to_submit: "Listo para presentar",
  submitted: "Presentado",
  presentado_manual_ayuntamiento: "Presentado manualmente",
  presentado_auto_dgt: "Presentado automáticamente",
  closed: "Cerrado",
  archived: "Archivado",
  resolved: "Resuelto",
  estimado: "Estimado",
  desestimado: "Desestimado",
};

const STAGE_LABELS = {
  intake_incomplete: "Completar entrada del expediente",
  study_payment_pending: "Pago del estudio pendiente",
  authorization_required: "Autorización pendiente",
  reanalysis_required: "Lectura documental pendiente",
  validated_facts_pending: "Hechos validados pendientes",
  service_fact_extraction_pending: "Extracción documental pendiente",
  service_facts_preview_pending: "Revisión de extracción pendiente",
  validated_facts_review: "Revisión de hechos",
  family_resolution_pending: "Resolución de familia pendiente",
  family_operator_review: "Familia pendiente de revisión OPS",
  family_lock_pending: "Bloqueo de familia pendiente",
  legal_preview_pending: "Previa Jurídica pendiente",
  initial_direction_review: "Revisión del primer rumbo",
  legal_preview_draft: "Previa Jurídica en borrador",
  legal_preview_ops_review: "Previa Jurídica en revisión OPS",
  legal_preview_freeze_pending: "Congelación de la Previa pendiente",
  generate_pending: "Generate preparado",
  resource_approval_pending: "Aprobación final pendiente",
  presentation_ready: "Presentación preparada",
  submitted_followup: "Seguimiento posterior",
  case_closed: "Expediente cerrado",
};

const EXTERNAL_KINDS = [
  ["documento_externo", "Documento externo"],
  ["requerimiento", "Requerimiento"],
  ["resolucion", "Resolución"],
  ["prueba_externa", "Prueba o justificante"],
  ["contestacion_ayuntamiento", "Contestación recibida"],
  ["justificante_presentacion", "Justificante de presentación"],
  ["instancia_firmada", "Instancia firmada"],
  ["csv_registro", "CSV / registro"],
];

const INTERNAL_KEYS =
  /(^|_)(b2|bucket|storage|secret|token|presign|signed_url|download_url|internal_path|object_key|key)$/i;

const normalize = (value) => String(value || "").trim().toLowerCase();

function canonicalFamily(data = {}) {
  const values = [data.department, data.category, data.case_type]
    .map(normalize)
    .filter(Boolean);

  for (const code of values) {
    if (["traffic", "trafico", "fine", "multa", "vehicle_removal"].includes(code)) return "traffic";
    if (["debt", "deuda", "deudas", "morosidad", "asnef", "creditor_claim"].includes(code)) return "debt";
    if (["administration", "administracion", "admin", "aeat", "town_hall", "social_security"].includes(code))
      return "administration";
    if (["travel", "viajes", "airline", "flight", "flight_cancelled", "flight_delayed", "baggage"].includes(code))
      return "travel";
    if (["claims", "claim", "reclamaciones", "consumer", "consumo", "telecommunications"].includes(code))
      return "claims";
  }
  return "other";
}

function apiUrl(path) {
  const clean = String(path || "").trim();
  if (clean.startsWith("/api/")) return clean;
  return `${API}${clean.startsWith("/") ? clean : `/${clean}`}`;
}

async function readJson(response) {
  const text = await response.text().catch(() => "");
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!response.ok) {
    const detail =
      data?.detail?.message ||
      data?.detail ||
      data?.message ||
      data?.raw ||
      `HTTP ${response.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }
  return data;
}

async function apiJson(path, options = {}) {
  return readJson(await fetch(apiUrl(path), options));
}

async function apiBlob(path, options = {}) {
  const response = await fetch(apiUrl(path), options);
  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `HTTP ${response.status}`);
  }
  return response.blob();
}

function fmtDate(value) {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString("es-ES");
  } catch {
    return String(value);
  }
}

function prettyBytes(value) {
  const bytes = Number(value || 0);
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function money(cents, currency = "EUR") {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: currency || "EUR",
  }).format(Number(cents || 0) / 100);
}

const statusLabel = (value) =>
  STATUS_LABELS[normalize(value)] || value || "Sin estado";

const stageLabel = (value) =>
  STAGE_LABELS[normalize(value)] || value || "Pendiente de determinar";

const caseTypeLabel = (value) =>
  CASE_TYPE_LABELS[normalize(value)] || value || "Sin clasificar";

function maskIdentity(value) {
  const text = String(value || "").trim();
  if (!text) return "—";
  if (text.length <= 4) return "••••";
  return `${text.slice(0, 2)}${"•".repeat(Math.max(2, text.length - 4))}${text.slice(-2)}`;
}

function documentLabel(kind = "") {
  const key = normalize(kind);
  if (key === "identity_front") return "Documento de identidad · frontal";
  if (key === "identity_back") return "Documento de identidad · reverso";
  if (key.includes("authorization_signed")) return "Autorización firmada";
  if (key.includes("authorization")) return "Autorización";
  if (key.includes("original")) return "Documento principal";
  if (key.includes("justificante")) return "Justificante de presentación";
  if (key.includes("resolucion")) return "Resolución";
  if (key.includes("requerimiento")) return "Requerimiento";
  if (key.includes("contestacion")) return "Contestación recibida";
  if (key.includes("prueba")) return "Prueba externa";
  if (key.includes("generated") || key.includes("recurso"))
    return "Documento jurídico generado";
  if (key.includes("csv")) return "CSV / registro";
  return kind || "Documento";
}

function documentIcon(doc = {}) {
  const kind = normalize(doc.kind);
  const mime = normalize(doc.mime);
  if (kind.includes("identity")) return "🪪";
  if (kind.includes("authoriz")) return "✍️";
  if (kind.includes("original")) return "📄";
  if (kind.includes("resolucion")) return "⚖️";
  if (kind.includes("requerimiento")) return "📨";
  if (kind.includes("generated") || kind.includes("recurso")) return "🧾";
  if (mime.includes("image")) return "🖼️";
  if (mime.includes("word")) return "📝";
  return "📎";
}

function sanitizePayload(value, depth = 0) {
  if (depth > 5) return "…";
  if (Array.isArray(value))
    return value.map((item) => sanitizePayload(item, depth + 1));
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, child] of Object.entries(value)) {
    if (INTERNAL_KEYS.test(key)) continue;
    result[key] = sanitizePayload(child, depth + 1);
  }
  return result;
}

function collectDocumentNames(events = []) {
  const names = new Map();
  function walk(value) {
    if (Array.isArray(value)) return value.forEach(walk);
    if (!value || typeof value !== "object") return;
    const id = value.document_id || value.id;
    const filename = value.filename || value.name;
    if (id && filename) names.set(String(id), String(filename));
    Object.values(value).forEach(walk);
  }
  events.forEach((event) => walk(event?.payload));
  return names;
}

function suggestedForZip(doc = {}) {
  const kind = normalize(doc.kind);
  return (
    kind.includes("identity") ||
    kind.includes("authorization") ||
    kind.includes("original") ||
    kind.includes("generated") ||
    kind.includes("recurso") ||
    kind.includes("justificante") ||
    kind.includes("resolucion")
  );
}

const authorityLatest = (workspace, key) =>
  workspace?.authority?.[key]?.latest_active || null;

function Panel({ children, style = {}, className = "" }) {
  return (
    <section
      className={className}
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 22,
        padding: 20,
        boxShadow: "0 10px 30px rgba(15,23,42,.06)",
        ...style,
      }}
    >
      {children}
    </section>
  );
}

function Badge({ children, tone = "default" }) {
  const tones = {
    default: ["#f1f5f9", "#475569", "#e2e8f0"],
    info: ["#dbeafe", "#1d4ed8", "#bfdbfe"],
    success: ["#dcfce7", "#166534", "#bbf7d0"],
    warn: ["#fef3c7", "#92400e", "#fde68a"],
    danger: ["#fee2e2", "#991b1b", "#fecaca"],
    purple: ["#ede9fe", "#6d28d9", "#ddd6fe"],
  };
  const [background, color, border] = tones[tone] || tones.default;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        borderRadius: 999,
        border: `1px solid ${border}`,
        background,
        color,
        fontSize: 12,
        fontWeight: 900,
      }}
    >
      {children}
    </span>
  );
}

function Metric({ label, value, detail }) {
  return (
    <div
      style={{
        border: "1px solid #e2e8f0",
        borderRadius: 16,
        padding: 14,
        background: "#f8fafc",
      }}
    >
      <div style={{ color: "#64748b", fontSize: 12, fontWeight: 800 }}>
        {label}
      </div>
      <div
        style={{
          color: "#0f172a",
          fontSize: 23,
          fontWeight: 950,
          marginTop: 4,
          overflowWrap: "anywhere",
        }}
      >
        {value}
      </div>
      {detail ? (
        <div style={{ color: "#64748b", fontSize: 12, marginTop: 5 }}>
          {detail}
        </div>
      ) : null}
    </div>
  );
}

function CheckItem({ ok, label, detail, pending = false }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: 12,
        borderRadius: 14,
        border: "1px solid #e2e8f0",
        background: "#fff",
      }}
    >
      <Badge tone={ok ? "success" : pending ? "warn" : "default"}>
        {ok ? "✓" : pending ? "…" : "○"}
      </Badge>
      <div>
        <div style={{ fontWeight: 900, color: "#0f172a" }}>{label}</div>
        {detail ? (
          <div style={{ marginTop: 3, color: "#64748b", fontSize: 13 }}>
            {detail}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function MessageBox({ message, debug }) {
  if (!message && !debug) return null;
  const success = String(message || "").startsWith("✅");
  return (
    <div style={{ display: "grid", gap: 8, marginTop: 16 }}>
      {message ? (
        <div
          role="alert"
          style={{
            padding: 14,
            borderRadius: 14,
            border: success
              ? "1px solid #bbf7d0"
              : "1px solid #fecaca",
            background: success ? "#ecfdf5" : "#fef2f2",
            color: success ? "#166534" : "#991b1b",
            fontWeight: 850,
          }}
        >
          {message}
        </div>
      ) : null}
      {debug ? (
        <details style={{ color: "#64748b", fontSize: 12 }}>
          <summary>Detalle técnico</summary>
          <div style={{ marginTop: 7, wordBreak: "break-word" }}>{debug}</div>
        </details>
      ) : null}
    </div>
  );
}

function DocumentRow({
  doc,
  filename,
  selected,
  onToggle,
  onDownload,
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: 14,
        padding: 14,
        border: selected
          ? "1px solid #60a5fa"
          : "1px solid #e2e8f0",
        borderRadius: 16,
        background: selected ? "#eff6ff" : "#fff",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: 12,
          minWidth: 0,
        }}
      >
        <input
          type="checkbox"
          checked={selected}
          onChange={() => onToggle(doc)}
          title="Incluir en ZIP"
          style={{ width: 18, height: 18, marginTop: 8, flexShrink: 0 }}
        />
        <div
          style={{
            width: 42,
            height: 42,
            display: "grid",
            placeItems: "center",
            borderRadius: 13,
            background: "#f1f5f9",
            fontSize: 21,
            flexShrink: 0,
          }}
        >
          {documentIcon(doc)}
        </div>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 900, color: "#0f172a" }}>
            {documentLabel(doc.kind)}
          </div>
          {filename ? (
            <div
              style={{
                marginTop: 3,
                color: "#334155",
                fontSize: 13,
                overflowWrap: "anywhere",
              }}
            >
              {filename}
            </div>
          ) : null}
          <div style={{ marginTop: 4, color: "#64748b", fontSize: 12 }}>
            {doc.mime || "application/octet-stream"} ·{" "}
            {prettyBytes(doc.size_bytes)} · {fmtDate(doc.created_at)}
          </div>
          <div style={{ marginTop: 4, color: "#94a3b8", fontSize: 11 }}>
            Documento {String(doc.id || "").slice(-8) || "sin identificador"}
          </div>
        </div>
      </div>
      <button
        type="button"
        className="sr-btn-secondary"
        onClick={() => onDownload(doc, filename)}
      >
        Descargar
      </button>
    </div>
  );
}

function TimelineItem({ event }) {
  const payload = sanitizePayload(event?.payload || {});
  const hasPayload =
    payload &&
    typeof payload === "object" &&
    Object.keys(payload).length > 0;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "30px 1fr", gap: 10 }}>
      <div
        style={{
          width: 28,
          height: 28,
          display: "grid",
          placeItems: "center",
          borderRadius: 999,
          background: "#e2e8f0",
          color: "#475569",
          fontWeight: 900,
        }}
      >
        •
      </div>
      <div
        style={{
          border: "1px solid #e2e8f0",
          borderRadius: 14,
          padding: 12,
          background: "#fff",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div style={{ fontWeight: 900, color: "#0f172a" }}>
            {event?.type || "Evento"}
          </div>
          <div style={{ color: "#64748b", fontSize: 12 }}>
            {fmtDate(event?.created_at)}
          </div>
        </div>
        {hasPayload ? (
          <details style={{ marginTop: 7 }}>
            <summary
              style={{ cursor: "pointer", color: "#2563eb", fontWeight: 800 }}
            >
              Ver detalle seguro
            </summary>
            <pre
              style={{
                marginTop: 8,
                padding: 10,
                borderRadius: 10,
                background: "#f8fafc",
                color: "#334155",
                fontSize: 11,
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {JSON.stringify(payload, null, 2)}
            </pre>
          </details>
        ) : null}
      </div>
    </div>
  );
}

export default function OpsCaseDetail() {
  const { caseId } = useParams();
  const token = localStorage.getItem("ops_token") || "";

  const [workspace, setWorkspace] = useState(null);
  const [paymentRecord, setPaymentRecord] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [events, setEvents] = useState([]);
  const [followups, setFollowups] = useState([]);
  const [selectedDocIds, setSelectedDocIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [debug, setDebug] = useState("");
  const [zipLoading, setZipLoading] = useState(false);

  const [followupTitle, setFollowupTitle] = useState("");
  const [followupDueAt, setFollowupDueAt] = useState("");
  const [followupDescription, setFollowupDescription] = useState("");
  const [followupCreating, setFollowupCreating] = useState(false);

  const [externalKind, setExternalKind] = useState("documento_externo");
  const [externalNote, setExternalNote] = useState("");
  const [externalFile, setExternalFile] = useState(null);
  const [externalUploading, setExternalUploading] = useState(false);

  const headers = useMemo(
    () => (token ? { "X-Operator-Token": token } : {}),
    [token]
  );

  const load = useCallback(async () => {
    if (!token || !caseId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setMessage("");
    setDebug("");

    const [ws, payment, ds, es, fs] = await Promise.allSettled([
      apiJson(`/ops/core/cases/${caseId}/workspace`, { headers }),
      apiJson(`/billing/status/${caseId}`),
      apiJson(`/ops/cases/${caseId}/documents`, { headers }),
      apiJson(`/ops/cases/${caseId}/events`, { headers }),
      apiJson(`/ops/cases/${caseId}/followups`, { headers }),
    ]);

    const nextWorkspace = ws.status === "fulfilled" ? ws.value : null;
    const nextDocuments =
      ds.status === "fulfilled"
        ? ds.value?.documents || ds.value?.items || []
        : nextWorkspace?.documents || [];
    const nextEvents =
      es.status === "fulfilled"
        ? es.value?.events || es.value?.items || []
        : nextWorkspace?.timeline || [];
    const nextFollowups =
      fs.status === "fulfilled"
        ? fs.value?.followups || fs.value?.items || []
        : [];

    setWorkspace(nextWorkspace);
    setPaymentRecord(payment.status === "fulfilled" ? payment.value : null);
    setDocuments(nextDocuments);
    setEvents(nextEvents);
    setFollowups(nextFollowups);
    setSelectedDocIds((current) => {
      const valid = current.filter((id) =>
        nextDocuments.some((doc) => String(doc.id) === id)
      );
      if (valid.length) return valid;
      return nextDocuments
        .filter((doc) => doc.id && suggestedForZip(doc))
        .map((doc) => String(doc.id));
    });

    const partial = [
      ["Espacio jurídico", ws],
      ["Estado de pago", payment],
      ["Documentos", ds],
      ["Eventos", es],
      ["Seguimientos", fs],
    ]
      .filter(([, result]) => result.status === "rejected")
      .map(
        ([label, result]) =>
          `${label}: ${result.reason?.message || "Error de carga"}`
      );

    if (ws.status === "rejected") {
      setMessage("❌ No se pudo cargar el espacio jurídico del expediente.");
    }
    if (partial.length) {
      setDebug(partial.join(" | "));
    }
    setLoading(false);
  }, [caseId, headers, token]);

  useEffect(() => {
    load();
  }, [load]);

  const caseData = workspace?.case || {};
  const identity = caseData.identity || {};
  const readiness = workspace?.readiness || {};
  const quote = readiness.quote || {};
  const nextStep = workspace?.next_step || {};
  const familyKey = canonicalFamily(caseData);
  const family = FAMILY_CONFIG[familyKey] || FAMILY_CONFIG.other;
  const stagingHost =
    typeof window !== "undefined" &&
    window.location.hostname.includes("frontend-staging");

  const latestFacts = authorityLatest(workspace, "validated_facts");
  const latestFamily = authorityLatest(workspace, "family_resolution");
  const latestPreview = authorityLatest(workspace, "legal_preview");
  const latestResource = authorityLatest(workspace, "generated_resource");
  const resolution = latestFamily?.resolution || {};

  const documentKinds = useMemo(
    () => new Set(documents.map((doc) => normalize(doc.kind))),
    [documents]
  );
  const filenameMap = useMemo(() => collectDocumentNames(events), [events]);

  const {
    known: paymentKnown,
    paid,
    label: paymentLabel,
    tone: paymentTone,
  } = derivePaymentDisplay(paymentRecord, caseData);
  const factsFrozen = Boolean(latestFacts?.frozen);
  const familyResolved = normalize(resolution.status) === "resolved";
  const familyLocked = Boolean(latestFamily?.locked);
  const previewStatus = normalize(latestPreview?.status);
  const resourceStatus = normalize(latestResource?.status);
  const previewFrozen = previewStatus === "frozen";
  const presentationReady =
    resourceStatus === "final_ready" && Boolean(latestResource?.approved_at);

  const progress = {
    identity:
      documentKinds.has("identity_front") &&
      documentKinds.has("identity_back"),
    authorization:
      Boolean(caseData.authorized) &&
      [...documentKinds].some((kind) =>
        kind.includes("authorization_signed")
      ),
    mainDocument: [...documentKinds].some((kind) =>
      kind.includes("original")
    ),
  };

  function toggleDocument(doc) {
    const id = String(doc?.id || "");
    if (!id) return;
    setSelectedDocIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  async function downloadDocument(doc, filename) {
    setMessage("");
    setDebug("");
    try {
      if (!doc?.id)
        throw new Error("Documento sin identificador de descarga.");
      const blob = await apiBlob(`/ops/documents/${doc.id}/download`, {
        headers,
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download =
        filename || documentLabel(doc.kind).replace(/\s+/g, "_");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } catch (error) {
      setMessage("❌ No se pudo descargar el documento.");
      setDebug(error?.message || "");
    }
  }

  async function downloadZip() {
    setZipLoading(true);
    setMessage("");
    setDebug("");
    try {
      const path = selectedDocIds.length
        ? `/ops/cases/${caseId}/zip-selected`
        : `/ops/cases/${caseId}/zip`;
      const options = selectedDocIds.length
        ? {
            method: "POST",
            headers: { ...headers, "Content-Type": "application/json" },
            body: JSON.stringify({ document_ids: selectedDocIds }),
          }
        : { headers };
      const blob = await apiBlob(path, options);
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = objectUrl;
      link.download = `expediente_${caseId}${
        selectedDocIds.length ? "_seleccion" : ""
      }.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
    } catch (error) {
      setMessage("❌ No se pudo preparar el ZIP.");
      setDebug(error?.message || "");
    } finally {
      setZipLoading(false);
    }
  }

  async function createFollowup() {
    if (!followupTitle.trim() || !followupDueAt.trim()) {
      setMessage("❌ Indica título y fecha del seguimiento.");
      return;
    }
    setFollowupCreating(true);
    setMessage("");
    setDebug("");
    try {
      const formData = new FormData();
      formData.append("kind", "seguimiento_manual");
      formData.append("title", followupTitle.trim());
      formData.append("due_at", followupDueAt.trim());
      if (followupDescription.trim())
        formData.append("description", followupDescription.trim());

      await apiJson(`/ops/cases/${caseId}/followups`, {
        method: "POST",
        headers,
        body: formData,
      });
      setFollowupTitle("");
      setFollowupDueAt("");
      setFollowupDescription("");
      setMessage("✅ Seguimiento creado.");
      await load();
    } catch (error) {
      setMessage("❌ No se pudo crear el seguimiento.");
      setDebug(error?.message || "");
    } finally {
      setFollowupCreating(false);
    }
  }

  async function resolveFollowup(followupId) {
    setMessage("");
    setDebug("");
    try {
      const formData = new FormData();
      formData.append("note", "Resuelto desde OPS CORE");
      await apiJson(
        `/ops/cases/${caseId}/followups/${followupId}/resolve`,
        { method: "POST", headers, body: formData }
      );
      setMessage("✅ Seguimiento resuelto.");
      await load();
    } catch (error) {
      setMessage("❌ No se pudo resolver el seguimiento.");
      setDebug(error?.message || "");
    }
  }

  async function uploadExternalDocument() {
    if (!externalFile) {
      setMessage("❌ Selecciona un documento externo.");
      return;
    }
    setExternalUploading(true);
    setMessage("");
    setDebug("");
    try {
      const formData = new FormData();
      formData.append("file", externalFile);
      formData.append("kind", externalKind);
      if (externalNote.trim())
        formData.append("note", externalNote.trim());

      await apiJson(`/ops/cases/${caseId}/upload-external-document`, {
        method: "POST",
        headers,
        body: formData,
      });
      setExternalFile(null);
      setExternalNote("");
      setMessage("✅ Documento externo incorporado.");
      await load();
    } catch (error) {
      setMessage("❌ No se pudo incorporar el documento externo.");
      setDebug(error?.message || "");
    } finally {
      setExternalUploading(false);
    }
  }

  if (!token) {
    return (
      <main className="sr-container ops-case-main">
        <Panel>
          <h1 className="sr-h2">Acceso de operador necesario</h1>
          <p className="sr-p">Entra primero en OPS.</p>
          <a href="/ops" className="sr-btn-primary">
            Ir al acceso OPS
          </a>
        </Panel>
      </main>
    );
  }

  if (loading && !workspace) {
    return (
      <main className="sr-container ops-case-main">
        <Panel>Cargando espacio jurídico del expediente…</Panel>
      </main>
    );
  }

  if (!workspace) {
    return (
      <main className="sr-container ops-case-main">
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <a href="/ops" className="sr-btn-secondary">
            ← Volver al panel
          </a>
          <Link to="/ops/followups" className="sr-btn-secondary">
            ⏰ Todos los seguimientos
          </Link>
          <button
            type="button"
            className="sr-btn-secondary"
            onClick={load}
            disabled={loading}
          >
            {loading ? "Actualizando…" : "↻ Actualizar"}
          </button>
        </div>

        <header
          style={{
            marginTop: 16,
            padding: 22,
            borderRadius: 24,
            background: "#020617",
            color: "#fff",
            boxShadow: "0 18px 45px rgba(15,23,42,.22)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 18,
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: "#94a3b8",
                  fontSize: 11,
                  fontWeight: 900,
                  letterSpacing: ".24em",
                }}
              >
                RTM · EXPEDIENTE EN MODO SEGURO
              </div>
              <h1
                style={{
                  margin: "9px 0 4px",
                  fontSize: "clamp(25px,4vw,37px)",
                  overflowWrap: "anywhere",
                }}
              >
                Expediente {caseId}
              </h1>
              <div style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
                El espacio jurídico no está disponible; no se infieren datos.
              </div>
            </div>
            <div
              style={{
                display: "flex",
                gap: 8,
                flexWrap: "wrap",
                alignContent: "flex-start",
              }}
            >
              {stagingHost ? (
                <Badge tone="purple">STAGING AISLADO</Badge>
              ) : null}
              <Badge tone={paymentTone}>{paymentLabel}</Badge>
            </div>
          </div>
        </header>

        <MessageBox message={message} debug={debug} />

        <Panel
          className="mt-4"
          style={{
            background: paid
              ? "#f0fdf4"
              : paymentKnown
              ? "#fffbeb"
              : "#fef2f2",
            borderColor: paid
              ? "#bbf7d0"
              : paymentKnown
              ? "#fde68a"
              : "#fecaca",
          }}
        >
          <h2 className="sr-h3" style={{ marginTop: 0 }}>
            Estado de pago independiente
          </h2>
          <div style={{ marginTop: 10 }}>
            <Badge tone={paymentTone}>{paymentLabel}</Badge>
          </div>
          <p className="sr-p" style={{ marginBottom: 0 }}>
            {paid
              ? "RTM tiene el pago registrado. Este expediente debe permanecer en la cola de pagados pendientes de revisión aunque falle el espacio jurídico."
              : paymentKnown
              ? "RTM no tiene un pago registrado para este expediente."
              : "No se ha podido consultar el pago. OPS no debe tratar el expediente como pagado ni como impagado hasta recuperar ese dato."}
          </p>
          {paymentRecord ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))",
                gap: 10,
                marginTop: 14,
              }}
            >
              <Metric
                label="Fecha del pago"
                value={paymentRecord.paid_at ? fmtDate(paymentRecord.paid_at) : "—"}
              />
              <Metric
                label="Producto"
                value={paymentRecord.product_code || "—"}
              />
              <Metric
                label="Estado operativo"
                value={statusLabel(paymentRecord.status)}
              />
            </div>
          ) : null}
        </Panel>

        <Panel className="mt-4">
          <h2 className="sr-h3" style={{ marginTop: 0 }}>
            Protección operativa activa
          </h2>
          <p className="sr-p" style={{ marginBottom: 0 }}>
            Mientras el espacio jurídico no cargue, OPS oculta la cadena de
            control y las acciones CORE. Así evita presentar estados, importes
            o pasos inventados como si fueran datos reales.
          </p>
        </Panel>
      </main>
    );
  }

  return (
    <main className="sr-container ops-case-main">
      <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
        <a href="/ops" className="sr-btn-secondary">
          ← Volver al panel
        </a>
        <Link to="/ops/queue-smart" className="sr-btn-secondary">
          Cola técnica
        </Link>
        <Link to="/ops/followups" className="sr-btn-secondary">
          ⏰ Todos los seguimientos
        </Link>
        <button
          type="button"
          className="sr-btn-secondary"
          onClick={load}
          disabled={loading}
        >
          {loading ? "Actualizando…" : "↻ Actualizar"}
        </button>
      </div>

      <header
        style={{
          marginTop: 16,
          padding: 22,
          borderRadius: 24,
          background: "#020617",
          color: "#fff",
          boxShadow: "0 18px 45px rgba(15,23,42,.22)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: 18,
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: "#94a3b8",
                fontSize: 11,
                fontWeight: 900,
                letterSpacing: ".24em",
              }}
            >
              RTM · ESPACIO JURÍDICO CORE
            </div>
            <h1
              style={{
                margin: "9px 0 4px",
                fontSize: "clamp(25px,4vw,37px)",
                overflowWrap: "anywhere",
              }}
            >
              Expediente {caseId}
            </h1>
            <div style={{ color: "#cbd5e1", lineHeight: 1.6 }}>
              {family.icon} {family.label} ·{" "}
              {caseTypeLabel(caseData.case_type)}
            </div>
          </div>
          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
              alignContent: "flex-start",
            }}
          >
            {stagingHost ? (
              <Badge tone="purple">STAGING AISLADO</Badge>
            ) : null}
            <Badge tone={paymentTone}>{paymentLabel}</Badge>
            <Badge tone="info">{statusLabel(caseData.status)}</Badge>
            <Badge tone="purple">{stageLabel(nextStep.stage)}</Badge>
          </div>
        </div>
      </header>

      <MessageBox message={message} debug={debug} />

      <Panel
        className="mt-4"
        style={{ background: family.soft, borderColor: family.border }}
      >
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
          <div style={{ fontSize: 34 }}>{family.icon}</div>
          <div>
            <h2 className="sr-h3" style={{ margin: 0 }}>
              {family.title}
            </h2>
            <p className="sr-p" style={{ margin: "7px 0 0" }}>
              {family.text}
            </p>
            <div style={{ display: "grid", gap: 7, marginTop: 13 }}>
              {family.checklist.map((item) => (
                <div
                  key={item}
                  style={{ display: "flex", gap: 8, color: "#334155" }}
                >
                  <span style={{ color: family.accent, fontWeight: 950 }}>
                    •
                  </span>
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(180px,1fr))",
          gap: 12,
          marginTop: 16,
        }}
      >
        <Metric
          label="Documentos"
          value={documents.length}
          detail="Sin rutas internas de almacenamiento"
        />
        <Metric label="Eventos" value={events.length} />
        <Metric
          label="Hechos"
          value={
            latestFacts
              ? factsFrozen
                ? "Congelados"
                : "Borrador"
              : "Pendientes"
          }
        />
        <Metric
          label="Familia jurídica"
          value={resolution.family || "Pendiente"}
          detail={resolution.specialist || "Sin especialista"}
        />
        <Metric
          label="Previa Jurídica"
          value={latestPreview?.status || "Pendiente"}
        />
        <Metric
          label="Documento final"
          value={latestResource?.status || "Pendiente"}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))",
          gap: 16,
          marginTop: 16,
        }}
      >
        <Panel>
          <h2 className="sr-h3" style={{ marginTop: 0 }}>
            Cadena de control
          </h2>
          <div style={{ display: "grid", gap: 9, marginTop: 12 }}>
            <CheckItem
              ok={Boolean(readiness.ready)}
              label="Entrada documental completa"
              detail={
                readiness.ready
                  ? "Datos, identidad, autorización y documento principal disponibles."
                  : "Existen bloqueos en la entrada."
              }
            />
            <CheckItem
              ok={progress.identity}
              label="Documento de identidad"
              detail="Frontal y reverso registrados."
            />
            <CheckItem
              ok={progress.authorization}
              label="Autorización firmada"
              detail={
                caseData.authorized
                  ? "Autorización registrada."
                  : "Autorización pendiente."
              }
            />
            <CheckItem
              ok={progress.mainDocument}
              label="Documento principal"
              detail="Documento original almacenado."
            />
            <CheckItem
              ok={paid}
              pending={paymentKnown && !paid}
              label="Pago del estudio inicial"
              detail={
                paid
                  ? "Pago confirmado por el backend."
                  : paymentKnown
                  ? `No consta pago · ${money(
                      quote.amount_cents,
                      quote.currency
                    )}`
                  : "Estado de pago no disponible."
              }
            />
            <CheckItem
              ok={Boolean(latestFacts)}
              pending={paid && !latestFacts}
              label="Hechos validados"
              detail={
                latestFacts
                  ? factsFrozen
                    ? "Versión congelada."
                    : "Pendiente de congelar."
                  : "No existen todavía."
              }
            />
            <CheckItem
              ok={familyResolved && familyLocked}
              pending={Boolean(latestFamily) && !familyLocked}
              label="Familia y especialista"
              detail={
                familyResolved
                  ? `${resolution.family || "Familia"} · ${
                      resolution.specialist || "Especialista pendiente"
                    }`
                  : "Pendiente de resolver."
              }
            />
            <CheckItem
              ok={previewFrozen}
              pending={Boolean(latestPreview) && !previewFrozen}
              label="Previa Jurídica"
              detail={
                latestPreview
                  ? `Estado: ${latestPreview.status}`
                  : "Pendiente de crear y revisar."
              }
            />
            <CheckItem
              ok={resourceStatus === "final_ready"}
              pending={previewFrozen && !latestResource}
              label="Generate"
              detail={
                latestResource
                  ? `Estado: ${latestResource.status}`
                  : "No se ha generado documento final."
              }
            />
          </div>
        </Panel>

        <Panel>
          <h2 className="sr-h3" style={{ marginTop: 0 }}>
            Siguiente paso autorizado
          </h2>
          <div
            style={{
              marginTop: 10,
              padding: 15,
              borderRadius: 16,
              background: family.soft,
              border: `1px solid ${family.border}`,
            }}
          >
            <div
              style={{
                fontSize: 12,
                fontWeight: 900,
                color: "#64748b",
                textTransform: "uppercase",
              }}
            >
              Etapa CORE
            </div>
            <div
              style={{
                marginTop: 5,
                color: "#0f172a",
                fontSize: 19,
                fontWeight: 950,
              }}
            >
              {stageLabel(nextStep.stage)}
            </div>
          </div>

          {paymentKnown && !paid ? (
            <div
              style={{
                marginTop: 12,
                padding: 14,
                borderRadius: 14,
                background: "#fffbeb",
                border: "1px solid #fde68a",
                color: "#92400e",
                lineHeight: 1.55,
              }}
            >
              No consta el pago del estudio. OPS no debe ejecutar extracción
              jurídica, resolver familia, crear Previa ni generar documentos.
            </div>
          ) : null}

          {!paymentKnown ? (
            <div
              style={{
                marginTop: 12,
                padding: 14,
                borderRadius: 14,
                background: "#fef2f2",
                border: "1px solid #fecaca",
                color: "#991b1b",
                lineHeight: 1.55,
              }}
            >
              No se ha podido verificar el pago. OPS debe detener cualquier
              actuación hasta recuperar el estado real.
            </div>
          ) : null}

          <div style={{ display: "grid", gap: 9, marginTop: 13 }}>
            {(nextStep.actions || []).length ? (
              nextStep.actions.map((action) => (
                <div
                  key={`${action.code}-${action.endpoint || "none"}`}
                  style={{
                    padding: 12,
                    borderRadius: 14,
                    border: "1px solid #e2e8f0",
                    background: "#fff",
                  }}
                >
                  <div style={{ fontWeight: 900, color: "#0f172a" }}>
                    {action.label || action.code}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 7,
                      flexWrap: "wrap",
                      marginTop: 8,
                    }}
                  >
                    {action.method ? (
                      <Badge tone="info">{action.method}</Badge>
                    ) : null}
                    {action.requires_confirmation ? (
                      <Badge tone="warn">Requiere confirmación</Badge>
                    ) : null}
                    {action.requires_reason ? (
                      <Badge tone="warn">Requiere motivo</Badge>
                    ) : null}
                  </div>
                </div>
              ))
            ) : (
              <div style={{ color: "#64748b" }}>
                El backend no propone ninguna actuación adicional.
              </div>
            )}
          </div>

          {paid ? (
            <div style={{ marginTop: 14 }}>
              <Link
                to={`/ops/review/${encodeURIComponent(caseId)}`}
                className="sr-btn-primary"
              >
                Abrir revisión jurídica CORE
              </Link>
            </div>
          ) : null}
        </Panel>
      </div>

      <Panel className="mt-4">
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2 className="sr-h3" style={{ margin: 0 }}>
              Documentos del expediente
            </h2>
            <p className="sr-p" style={{ margin: "5px 0 0" }}>
              Descarga protegida; no se muestran bucket, claves ni rutas.
            </p>
          </div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button"
              className="sr-btn-secondary"
              onClick={() =>
                setSelectedDocIds(
                  documents
                    .filter((doc) => doc.id)
                    .map((doc) => String(doc.id))
                )
              }
            >
              Seleccionar todos
            </button>
            <button
              type="button"
              className="sr-btn-secondary"
              onClick={() => setSelectedDocIds([])}
            >
              Limpiar
            </button>
            <button
              type="button"
              className="sr-btn-primary"
              onClick={downloadZip}
              disabled={zipLoading}
            >
              {zipLoading
                ? "Preparando ZIP…"
                : selectedDocIds.length
                ? `ZIP selección (${selectedDocIds.length})`
                : "ZIP expediente"}
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gap: 10, marginTop: 14 }}>
          {documents.length ? (
            documents.map((doc) => (
              <DocumentRow
                key={doc.id || `${doc.kind}-${doc.created_at}`}
                doc={doc}
                filename={filenameMap.get(String(doc.id)) || ""}
                selected={selectedDocIds.includes(String(doc.id))}
                onToggle={toggleDocument}
                onDownload={downloadDocument}
              />
            ))
          ) : (
            <div
              style={{
                padding: 18,
                borderRadius: 14,
                border: "1px dashed #cbd5e1",
                color: "#64748b",
              }}
            >
              No hay documentos registrados.
            </div>
          )}
        </div>
      </Panel>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit,minmax(340px,1fr))",
          gap: 16,
          marginTop: 16,
        }}
      >
        <Panel>
          <h2 className="sr-h3" style={{ marginTop: 0 }}>
            Datos del expediente
          </h2>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            {[
              ["Interesado", identity.full_name || "—"],
              ["Documento", maskIdentity(identity.dni_nie)],
              ["Email", identity.email || "—"],
              ["Teléfono", identity.phone || "—"],
              ["Organismo / contraparte", caseData.organismo || "Pendiente"],
              ["Referencia externa", caseData.expediente_ref || "Pendiente"],
              ["Estado", statusLabel(caseData.status)],
              ["Pago", paymentLabel],
            ].map(([label, value]) => (
              <div
                key={label}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(130px,.6fr) 1fr",
                  gap: 12,
                  paddingBottom: 9,
                  borderBottom: "1px solid #e2e8f0",
                }}
              >
                <strong style={{ color: "#334155" }}>{label}</strong>
                <span
                  style={{ color: "#64748b", overflowWrap: "anywhere" }}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>
        </Panel>

        <Panel>
          <h2 className="sr-h3" style={{ marginTop: 0 }}>
            Añadir documentación externa
          </h2>
          <p className="sr-p">
            Incorpora resoluciones, respuestas, requerimientos o pruebas
            recibidas posteriormente.
          </p>
          <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
            <select
              value={externalKind}
              onChange={(event) => setExternalKind(event.target.value)}
              className="border rounded px-3 py-2 text-sm"
            >
              {EXTERNAL_KINDS.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              value={externalNote}
              onChange={(event) => setExternalNote(event.target.value)}
              placeholder="Nota del documento (opcional)"
              className="border rounded px-3 py-2 text-sm"
            />
            <input
              type="file"
              onChange={(event) =>
                setExternalFile(event.target.files?.[0] || null)
              }
            />
            <button
              type="button"
              className="sr-btn-primary"
              onClick={uploadExternalDocument}
              disabled={externalUploading}
            >
              {externalUploading ? "Subiendo…" : "Adjuntar documento"}
            </button>
          </div>
        </Panel>
      </div>

      <Panel className="mt-4">
        <h2 className="sr-h3" style={{ marginTop: 0 }}>
          Seguimientos
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))",
            gap: 10,
            marginTop: 12,
          }}
        >
          <input
            value={followupTitle}
            onChange={(event) => setFollowupTitle(event.target.value)}
            placeholder="Título del seguimiento"
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            type="datetime-local"
            value={followupDueAt}
            onChange={(event) => setFollowupDueAt(event.target.value)}
            className="border rounded px-3 py-2 text-sm"
          />
          <input
            value={followupDescription}
            onChange={(event) =>
              setFollowupDescription(event.target.value)
            }
            placeholder="Descripción / nota"
            className="border rounded px-3 py-2 text-sm"
          />
        </div>
        <button
          type="button"
          className="sr-btn-primary"
          style={{ marginTop: 10 }}
          onClick={createFollowup}
          disabled={followupCreating}
        >
          {followupCreating ? "Creando…" : "Crear seguimiento"}
        </button>

        <div style={{ display: "grid", gap: 9, marginTop: 14 }}>
          {followups.length ? (
            followups.map((followup) => (
              <div
                key={followup.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: 12,
                  flexWrap: "wrap",
                  padding: 13,
                  border: "1px solid #e2e8f0",
                  borderRadius: 14,
                }}
              >
                <div>
                  <div style={{ fontWeight: 900 }}>{followup.title}</div>
                  <div
                    style={{
                      marginTop: 3,
                      color: "#64748b",
                      fontSize: 13,
                    }}
                  >
                    Vence: {fmtDate(followup.due_at)}
                  </div>
                  {followup.description ? (
                    <div style={{ marginTop: 5, color: "#334155" }}>
                      {followup.description}
                    </div>
                  ) : null}
                </div>
                {normalize(followup.status) !== "resolved" ? (
                  <button
                    type="button"
                    className="sr-btn-secondary"
                    onClick={() => resolveFollowup(followup.id)}
                  >
                    Marcar resuelto
                  </button>
                ) : (
                  <Badge tone="success">Resuelto</Badge>
                )}
              </div>
            ))
          ) : (
            <div
              style={{
                padding: 15,
                border: "1px dashed #cbd5e1",
                borderRadius: 14,
                color: "#64748b",
              }}
            >
              No hay seguimientos registrados.
            </div>
          )}
        </div>
      </Panel>

      <Panel className="mt-4">
        <h2 className="sr-h3" style={{ marginTop: 0 }}>
          Timeline jurídico
        </h2>
        <p className="sr-p">
          Detalles filtrados para no exponer rutas internas de Backblaze.
        </p>
        <div style={{ display: "grid", gap: 10, marginTop: 13 }}>
          {events.length ? (
            events.map((event, index) => (
              <TimelineItem
                key={`${event.type}-${event.created_at}-${index}`}
                event={event}
              />
            ))
          ) : (
            <div style={{ color: "#64748b" }}>
              No hay eventos registrados.
            </div>
          )}
        </div>
      </Panel>

      {presentationReady ? (
        <Panel
          className="mt-4"
          style={{ background: "#f0fdf4", borderColor: "#bbf7d0" }}
        >
          <h2 className="sr-h3" style={{ marginTop: 0 }}>
            Presentación autorizada
          </h2>
          <p className="sr-p" style={{ marginBottom: 0 }}>
            El documento final está aprobado. El canal concreto debe
            ejecutarse o registrarse desde el módulo especializado.
          </p>
        </Panel>
      ) : null}
    </main>
  );
}
