const API_PREFIX = "/api";

const ACTIONS_WITH_REASON = new Set([
  "invalidate_validated_facts",
  "invalidate_family_resolution",
  "request_preview_changes",
]);

const MUTATING_ACTIONS = new Set([
  "run_reanalysis",
  "create_validated_facts_draft",
  "freeze_validated_facts",
  "invalidate_validated_facts",
  "resolve_family",
  "invalidate_family_resolution",
  "lock_family",
  "build_legal_preview",
  "submit_preview_review",
  "approve_preview",
  "request_preview_changes",
  "freeze_preview",
  "generate_resource",
  "approve_resource_submission",
]);

const READ_ONLY_ACTIONS = new Set([
  "preview_reanalysis_facts",
  "review_validated_facts",
  "review_family_conflict",
  "review_legal_preview",
  "inspect_workspace",
]);

const ACTION_ENDPOINT_PATTERNS = {
  run_reanalysis: /^\/ops\/cases\/[^/]+\/reanalyze$/,
  preview_reanalysis_facts: /^\/ops\/core\/cases\/[^/]+\/reanalysis\/facts-preview$/,
  create_validated_facts_draft: /^\/ops\/core\/cases\/[^/]+\/reanalysis\/facts-draft$/,
  review_validated_facts: /^\/ops\/core\/cases\/[^/]+\/validated-facts\/[^/]+$/,
  freeze_validated_facts: /^\/ops\/core\/cases\/[^/]+\/validated-facts\/[^/]+\/freeze$/,
  invalidate_validated_facts: /^\/ops\/core\/cases\/[^/]+\/validated-facts\/[^/]+\/invalidate$/,
  resolve_family: /^\/ops\/core\/cases\/[^/]+\/resolve-family$/,
  review_family_conflict: /^\/ops\/core\/cases\/[^/]+\/family-resolutions\/[^/]+$/,
  invalidate_family_resolution: /^\/ops\/core\/cases\/[^/]+\/family-resolutions\/[^/]+\/invalidate$/,
  lock_family: /^\/ops\/core\/cases\/[^/]+\/family-resolutions\/[^/]+\/lock$/,
  build_legal_preview: /^\/ops\/core\/cases\/[^/]+\/build-legal-preview$/,
  review_legal_preview: /^\/ops\/core\/cases\/[^/]+\/legal-previews\/[^/]+$/,
  submit_preview_review: /^\/ops\/core\/cases\/[^/]+\/legal-previews\/[^/]+\/submit-review$/,
  approve_preview: /^\/ops\/core\/cases\/[^/]+\/legal-previews\/[^/]+\/approve$/,
  request_preview_changes: /^\/ops\/core\/cases\/[^/]+\/legal-previews\/[^/]+\/request-changes$/,
  freeze_preview: /^\/ops\/core\/cases\/[^/]+\/legal-previews\/[^/]+\/freeze$/,
  generate_resource: /^\/ops\/core\/cases\/[^/]+\/legal-previews\/[^/]+\/generate$/,
  approve_resource_submission: /^\/ops\/core\/cases\/[^/]+\/generated-resources\/[^/]+\/approve-submission$/,
  inspect_workspace: /^\/ops\/core\/cases\/[^/]+\/workspace$/,
};

function stringifyDetail(detail) {
  if (!detail) return "";
  if (typeof detail === "string") return detail;
  if (typeof detail === "object") {
    return detail.message || detail.detail || JSON.stringify(detail);
  }
  return String(detail);
}

export function getOperatorToken() {
  return localStorage.getItem("ops_token") || "";
}

export function getOperatorActor() {
  return localStorage.getItem("ops_actor") || "ops:web";
}

export async function requestOpsJson(path, options = {}) {
  const token = options.token ?? getOperatorToken();
  if (!token) {
    throw new Error("Falta token de operador. Accede primero al panel OPS.");
  }

  const method = String(options.method || "GET").toUpperCase();
  const headers = {
    "X-Operator-Token": token,
    "X-Operator-Actor": options.actor || getOperatorActor(),
    ...(options.headers || {}),
  };

  const init = { method, headers };
  if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_PREFIX}${path}`, init);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = stringifyDetail(data?.detail) || data?.message;
    throw new Error(detail || `Error HTTP ${response.status}`);
  }
  return data;
}

export function normalizeReadiness(readiness) {
  if (!readiness || typeof readiness !== "object") return readiness;
  const blocking = Array.isArray(readiness.blocking_issues)
    ? readiness.blocking_issues.map((issue) => ({ ...issue, severity: "blocking" }))
    : [];
  const warnings = Array.isArray(readiness.warnings)
    ? readiness.warnings.map((issue) => ({ ...issue, severity: "warning" }))
    : [];
  const quote = readiness.quote && typeof readiness.quote === "object"
    ? {
      ...readiness.quote,
      amount_eur: Number.isFinite(Number(readiness.quote.amount_cents))
        ? Number(readiness.quote.amount_cents) / 100
        : undefined,
      code: readiness.quote.billing_code || readiness.quote.service_code,
    }
    : readiness.quote;

  return {
    ...readiness,
    quote,
    issues: [...blocking, ...warnings],
  };
}

export function normalizeWorkspacePayload(data) {
  if (!data || typeof data !== "object") return data;
  return {
    ...data,
    readiness: normalizeReadiness(data.readiness),
  };
}

export async function loadCoreWorkspace(caseId, options = {}) {
  const data = await requestOpsJson(
    `/ops/core/cases/${encodeURIComponent(caseId)}/workspace`,
    options,
  );
  return normalizeWorkspacePayload(data);
}

function normalizeEndpoint(endpoint) {
  const value = String(endpoint || "").trim();
  if (
    !value.startsWith("/") ||
    value.startsWith("//") ||
    value.includes("..") ||
    value.includes("?") ||
    value.includes("#")
  ) {
    throw new Error("El backend no ha proporcionado una ruta OPS válida.");
  }
  return value;
}

function assertActionAllowed(action) {
  const code = String(action?.code || "");
  if (!MUTATING_ACTIONS.has(code) && !READ_ONLY_ACTIONS.has(code)) {
    throw new Error(`La acción '${code || "desconocida"}' no está habilitada en el cliente CORE.`);
  }
  if (!action?.endpoint) {
    throw new Error("Esta etapa requiere una actuación externa o todavía no dispone de endpoint CORE.");
  }
  return code;
}

function assertEndpointForAction(code, endpoint) {
  const pattern = ACTION_ENDPOINT_PATTERNS[code];
  if (!pattern || !pattern.test(endpoint)) {
    throw new Error(`La ruta recibida no corresponde a la acción CORE '${code}'.`);
  }
}

export function validateCoreWorkspaceAction(action) {
  const code = assertActionAllowed(action);
  const endpoint = normalizeEndpoint(action.endpoint);
  assertEndpointForAction(code, endpoint);

  const expectedMethod = MUTATING_ACTIONS.has(code) ? "POST" : "GET";
  const declaredMethod = String(action.method || expectedMethod).toUpperCase();
  if (declaredMethod !== expectedMethod) {
    throw new Error(`Método inesperado para la acción CORE '${code}'.`);
  }

  return {
    code,
    endpoint,
    method: expectedMethod,
    mutating: MUTATING_ACTIONS.has(code),
    requiresReason: ACTIONS_WITH_REASON.has(code),
  };
}

export function buildCoreActionRequest(action, options = {}) {
  const validated = validateCoreWorkspaceAction(action);
  let body;

  if (validated.requiresReason) {
    const reason = String(options.reason || "").trim();
    if (reason.length < 3) {
      throw new Error("Indica un motivo de al menos 3 caracteres.");
    }
    body = { reason };
  } else if (validated.code === "create_validated_facts_draft") {
    body = { supersedes_id: options.supersedesId || null };
  } else if (validated.mutating) {
    body = {};
  }

  return {
    ...validated,
    body,
  };
}

export async function executeCoreWorkspaceAction(action, options = {}) {
  const request = buildCoreActionRequest(action, options);
  return requestOpsJson(request.endpoint, {
    method: request.method,
    body: request.body,
    token: options.token,
    actor: options.actor,
  });
}

function filenameFromDisposition(response, fallback) {
  const disposition = response.headers.get("content-disposition") || "";
  const utfMatch = disposition.match(/filename\*=UTF-8''([^;]+)/i);
  if (utfMatch?.[1]) return decodeURIComponent(utfMatch[1]);
  const plainMatch = disposition.match(/filename="?([^";]+)"?/i);
  return plainMatch?.[1] || fallback;
}

export async function downloadOpsDocument(documentRecord, options = {}) {
  const token = options.token ?? getOperatorToken();
  if (!token) throw new Error("Falta token de operador.");

  const endpoint = normalizeEndpoint(documentRecord?.download_endpoint);
  if (!/^\/ops\/documents\/[^/]+\/download$/.test(endpoint)) {
    throw new Error("Ruta de descarga no autorizada por el cliente OPS.");
  }

  const response = await fetch(`${API_PREFIX}${endpoint}`, {
    headers: { "X-Operator-Token": token },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(stringifyDetail(data?.detail) || "No se pudo descargar el documento.");
  }

  const blob = await response.blob();
  const fallback = `${documentRecord?.kind || "documento"}-${documentRecord?.id || "rtm"}`;
  const filename = filenameFromDisposition(response, fallback);
  const url = window.URL.createObjectURL(blob);
  const anchor = window.document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  window.document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export const OPS_CORE_CLIENT_VERSION = "rtm_ops_core_client_v1_3";
