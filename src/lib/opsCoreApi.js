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

export function loadCoreWorkspace(caseId, options = {}) {
  return requestOpsJson(
    `/ops/core/cases/${encodeURIComponent(caseId)}/workspace`,
    options,
  );
}

function normalizeEndpoint(endpoint) {
  const value = String(endpoint || "").trim();
  if (!value.startsWith("/")) {
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

export async function executeCoreWorkspaceAction(action, options = {}) {
  const code = assertActionAllowed(action);
  const endpoint = normalizeEndpoint(action.endpoint);
  const expectedMethod = MUTATING_ACTIONS.has(code) ? "POST" : "GET";
  const declaredMethod = String(action.method || expectedMethod).toUpperCase();

  if (declaredMethod !== expectedMethod) {
    throw new Error(`Método inesperado para la acción CORE '${code}'.`);
  }

  let body;
  if (ACTIONS_WITH_REASON.has(code)) {
    const reason = String(options.reason || "").trim();
    if (reason.length < 3) {
      throw new Error("Indica un motivo de al menos 3 caracteres.");
    }
    body = { reason };
  } else if (code === "create_validated_facts_draft") {
    body = { supersedes_id: options.supersedesId || null };
  } else if (expectedMethod === "POST") {
    body = {};
  }

  return requestOpsJson(endpoint, {
    method: expectedMethod,
    body,
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

export async function downloadOpsDocument(document, options = {}) {
  const token = options.token ?? getOperatorToken();
  if (!token) throw new Error("Falta token de operador.");

  const endpoint = normalizeEndpoint(document?.download_endpoint);
  if (!endpoint.startsWith("/ops/documents/")) {
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
  const fallback = `${document?.kind || "documento"}-${document?.id || "rtm"}`;
  const filename = filenameFromDisposition(response, fallback);
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}

export const OPS_CORE_CLIENT_VERSION = "rtm_ops_core_client_v1_0";
