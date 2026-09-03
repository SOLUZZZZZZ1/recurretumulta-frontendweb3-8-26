export const OPS_AUTH_STATUS_ROUTE = "/api/ops/auth/status";
export const OPS_AUTH_LOGIN_ROUTE = "/api/ops/auth/login";
export const OPS_AUTH_LOGOUT_ROUTE = "/api/ops/auth/logout";

const BEARER_PATTERN = /^[A-Za-z0-9._~-]{32,2048}$/;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const AUTH_CODE_PATTERN = /^[a-z][a-z0-9._-]{1,127}$/;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const CONTROL_CHARACTER_PATTERN = /[\u0000-\u001f\u007f]/;
const MAX_AUTH_JSON_CHARACTERS = 65_536;
const OPS_AUTHENTICATED_PATH_PREFIXES = Object.freeze(["/api/ops/"]);
const INVALID_INTERNAL_URL_CHARACTERS = /[\u0000-\u001f\u007f]/;
const ENCODED_PATH_SEPARATOR = /%(?:2f|5c)/i;

export class OpsAuthError extends Error {
  constructor(code, message, status = null) {
    super(message);
    this.name = "OpsAuthError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, message, status = null) {
  throw new OpsAuthError(code, message, status);
}

function requireFetch(fetchImpl) {
  if (typeof fetchImpl !== "function") {
    fail("ops_auth.fetch_required", "No hay transporte seguro disponible.");
  }
  return fetchImpl;
}

function requireEmail(value) {
  const email = String(value || "").trim();
  if (email.length < 3 || email.length > 320 || !EMAIL_PATTERN.test(email)) {
    fail("ops_auth.email_invalid", "El email de operador no es válido.");
  }
  return email;
}

function requirePassword(value) {
  if (
    typeof value !== "string" ||
    value.length < 1 ||
    value.length > 256 ||
    value.includes("\0")
  ) {
    fail("ops_auth.password_invalid", "La contraseña de operador no es válida.");
  }
  return value;
}

export function requireOpsBearer(value) {
  if (typeof value !== "string" || !BEARER_PATTERN.test(value)) {
    fail("ops_auth.bearer_invalid", "La sesión individual no es válida.", 401);
  }
  return value;
}

export function buildOpsAuthenticatedRequest({
  url,
  bearerToken,
  options = {},
} = {}) {
  const rawPath = typeof url === "string" ? url.split(/[?#]/, 1)[0] : "";
  if (
    typeof url !== "string" ||
    !url.startsWith("/api/") ||
    INVALID_INTERNAL_URL_CHARACTERS.test(url) ||
    rawPath.includes("\\") ||
    ENCODED_PATH_SEPARATOR.test(rawPath) ||
    !options ||
    typeof options !== "object" ||
    Array.isArray(options)
  ) {
    fail(
      "ops_auth.api_route_required",
      "La sesión individual solo puede usarse con rutas internas de RTM."
    );
  }

  let target;
  let decodedPath;
  try {
    target = new URL(url, "https://rtm.invalid");
    decodedPath = decodeURIComponent(target.pathname);
  } catch {
    fail("ops_auth.api_route_invalid", "La ruta interna no es válida.");
  }
  if (
    target.origin !== "https://rtm.invalid" ||
    !OPS_AUTHENTICATED_PATH_PREFIXES.some((prefix) =>
      target.pathname.startsWith(prefix)
    ) ||
    target.username ||
    target.password ||
    target.hash ||
    /[\\\u0000-\u001f\u007f]/.test(decodedPath) ||
    decodedPath.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    fail("ops_auth.api_route_invalid", "La ruta interna no es válida.");
  }

  const headers = new Headers(options.headers || {});
  headers.delete("Authorization");
  headers.delete("X-Operator-Token");
  headers.delete("X-Operator-Actor");
  headers.delete("X-RTM-Device");
  headers.set("Authorization", `Bearer ${requireOpsBearer(bearerToken)}`);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");

  return {
    url,
    options: {
      ...options,
      headers,
      cache: "no-store",
      credentials: "same-origin",
      mode: "same-origin",
      redirect: "error",
      referrerPolicy: "same-origin",
    },
  };
}

function publicHttpMessage(status, operation) {
  if (status === 401) return "El email o la contraseña no son correctos.";
  if (status === 403) return "Esta cuenta no tiene acceso a OPS.";
  if (status === 429) return "Demasiados intentos. Espera antes de probar de nuevo.";
  if (status === 503) return "El acceso individual de OPS no está disponible.";
  return operation === "status"
    ? "No se pudo comprobar el acceso individual de OPS."
    : "No se pudo iniciar la sesión individual de OPS.";
}

async function readJson(response, operation) {
  if (!response || typeof response.ok !== "boolean") {
    fail("ops_auth.response_invalid", "El servicio de identidad no respondió correctamente.");
  }
  const text = await response.text().catch(() => "");
  if (text.length > MAX_AUTH_JSON_CHARACTERS) {
    fail(
      "ops_auth.response_too_large",
      "El servicio de identidad devolvió una respuesta demasiado grande.",
      response.status ?? null
    );
  }
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    fail(
      "ops_auth.response_not_json",
      "El servicio de identidad devolvió una respuesta no válida.",
      response.status ?? null
    );
  }
  if (!response.ok) {
    fail(
      `ops_auth.${operation}_rejected`,
      publicHttpMessage(response.status, operation),
      response.status ?? null
    );
  }
  return payload;
}

function baseOptions(signal = null) {
  const options = {
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
    referrerPolicy: "same-origin",
  };
  if (signal) options.signal = signal;
  return options;
}

export async function readOpsAuthStatus({
  signal = null,
  fetchImpl = globalThis.fetch?.bind(globalThis),
} = {}) {
  let response;
  try {
    response = await requireFetch(fetchImpl)(OPS_AUTH_STATUS_ROUTE, {
      ...baseOptions(signal),
      method: "GET",
      headers: { Accept: "application/json" },
    });
  } catch {
    if (signal?.aborted) fail("ops_auth.request_aborted", "Operación cancelada.");
    fail("ops_auth.transport_failed", "No se pudo conectar con el servicio de identidad.");
  }
  const payload = await readJson(response, "status");
  if (
    payload?.ok !== true ||
    typeof payload?.individual_login_enabled !== "boolean" ||
    payload?.configuration_valid !== true ||
    payload?.staging_only !== true ||
    payload?.shared_ops_login_accepted !== false
  ) {
    fail(
      "ops_auth.status_contract_invalid",
      "El estado del acceso individual no cumple el contrato de staging."
    );
  }
  return Object.freeze({
    individualLoginEnabled: payload.individual_login_enabled,
    configurationValid: payload.configuration_valid,
    sharedOpsLoginAccepted: false,
  });
}

async function closeTokenCandidate(token, fetchImpl) {
  if (!BEARER_PATTERN.test(String(token || ""))) return;
  await fetchImpl(OPS_AUTH_LOGOUT_ROUTE, {
    ...baseOptions(),
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`,
    },
  }).catch(() => {});
}

function validateOperator(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("ops_auth.operator_invalid", "El servidor no identificó al operador.");
  }
  const email = typeof value.email === "string" ? value.email.trim() : "";
  const displayName =
    typeof value.display_name === "string" ? value.display_name.trim() : "";
  const roleCode = typeof value.role_code === "string" ? value.role_code : "";
  const permissions = Array.isArray(value.permissions) ? value.permissions : [];
  const permissionsAreExact =
    permissions.length <= 64 &&
    permissions.every(
      (permission) =>
        typeof permission === "string" && AUTH_CODE_PATTERN.test(permission)
    ) &&
    new Set(permissions).size === permissions.length;
  if (
    typeof value.id !== "string" ||
    !UUID_PATTERN.test(value.id) ||
    !email ||
    email.length > 320 ||
    email !== value.email ||
    !EMAIL_PATTERN.test(email) ||
    !displayName ||
    displayName.length > 160 ||
    CONTROL_CHARACTER_PATTERN.test(displayName) ||
    !AUTH_CODE_PATTERN.test(roleCode) ||
    !permissionsAreExact ||
    typeof value.must_change_password !== "boolean" ||
    value.mfa_required !== false
  ) {
    fail(
      "ops_auth.operator_contract_invalid",
      "La cuenta requiere controles de identidad que OPS todavía no puede completar."
    );
  }
  return Object.freeze({
    id: value.id,
    email,
    displayName,
    roleCode,
    permissions: Object.freeze([...permissions]),
    mustChangePassword: value.must_change_password,
    mfaRequired: value.mfa_required,
  });
}

function validateSessionTimestamp(value, field) {
  if (
    typeof value !== "string" ||
    value.length > 64 ||
    !ISO_TIMESTAMP_PATTERN.test(value) ||
    !Number.isFinite(Date.parse(value))
  ) {
    fail(
      "ops_auth.login_contract_invalid",
      `El servidor devolvió una fecha de ${field} no válida.`
    );
  }
  return value;
}

export async function loginOpsOperator({
  email,
  password,
  signal = null,
  fetchImpl = globalThis.fetch?.bind(globalThis),
} = {}) {
  const exactFetch = requireFetch(fetchImpl);
  const submittedEmail = requireEmail(email);
  const submittedPassword = requirePassword(password);
  let response;
  try {
    response = await exactFetch(OPS_AUTH_LOGIN_ROUTE, {
      ...baseOptions(signal),
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: submittedEmail, password: submittedPassword }),
    });
  } catch {
    if (signal?.aborted) fail("ops_auth.request_aborted", "Operación cancelada.");
    fail("ops_auth.transport_failed", "No se pudo conectar con el servicio de identidad.");
  }

  const payload = await readJson(response, "login");
  const tokenCandidate = typeof payload?.token === "string" ? payload.token : "";
  try {
    if (
      payload?.ok !== true ||
      payload?.token_type !== "bearer" ||
      payload?.shared_ops_login_accepted !== false ||
      typeof payload?.token !== "string" ||
      typeof payload?.session_id !== "string" ||
      !UUID_PATTERN.test(payload.session_id) ||
      typeof payload?.device_id !== "string" ||
      !UUID_PATTERN.test(payload.device_id) ||
      typeof payload?.expires_at !== "string" ||
      typeof payload?.absolute_expires_at !== "string"
    ) {
      fail(
        "ops_auth.login_contract_invalid",
        "El servidor no devolvió una sesión individual válida."
      );
    }
    const bearerToken = requireOpsBearer(tokenCandidate);
    const operator = validateOperator(payload.operator);
    const expiresAt = validateSessionTimestamp(payload.expires_at, "caducidad");
    const absoluteExpiresAt = validateSessionTimestamp(
      payload.absolute_expires_at,
      "caducidad absoluta"
    );
    const now = Date.now();
    if (
      Date.parse(expiresAt) <= now ||
      Date.parse(absoluteExpiresAt) <= now ||
      Date.parse(expiresAt) > Date.parse(absoluteExpiresAt)
    ) {
      fail(
        "ops_auth.login_contract_invalid",
        "La caducidad de la sesión individual no es coherente."
      );
    }
    return Object.freeze({
      bearerToken,
      sessionId: payload.session_id,
      deviceId: payload.device_id,
      expiresAt,
      absoluteExpiresAt,
      operator,
    });
  } catch (error) {
    await closeTokenCandidate(tokenCandidate, exactFetch);
    throw error;
  }
}

export async function logoutOpsOperator({
  bearerToken,
  signal = null,
  keepalive = false,
  fetchImpl = globalThis.fetch?.bind(globalThis),
} = {}) {
  const token = requireOpsBearer(bearerToken);
  let response;
  try {
    response = await requireFetch(fetchImpl)(OPS_AUTH_LOGOUT_ROUTE, {
      ...baseOptions(signal),
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
      },
      keepalive,
    });
  } catch {
    if (signal?.aborted) fail("ops_auth.request_aborted", "Operación cancelada.");
    fail("ops_auth.logout_transport_failed", "No se pudo confirmar el cierre remoto.");
  }
  const payload = await readJson(response, "logout");
  if (payload?.ok !== true || payload?.status !== "closed") {
    fail("ops_auth.logout_contract_invalid", "El servidor no confirmó el cierre de sesión.");
  }
  return Object.freeze({ closed: true });
}
