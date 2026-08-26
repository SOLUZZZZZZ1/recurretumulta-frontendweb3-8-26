import {
  RTM_CONNECT_A1S_BACKEND_COMMIT,
  RTM_CONNECT_A1S_BACKEND_CONTRACT_VERSION,
  RTM_CONNECT_A1S_BASE_COMMIT,
  RTM_CONNECT_A1S_STAGING_HOST,
  isPlainObject,
  requireUuid,
} from "./rtmConnectA1SReadContract.js";

export const RTM_CONNECT_A1S_F2_CONTRACT_VERSION =
  "rtm.connect.frontend.a1s.synthetic_read_session.v1";

export const RTM_CONNECT_A1S_F2_BASE_COMMIT =
  "47fbb165c16f93217b0f0e445631258fbfbe3f18";

export const RTM_CONNECT_A1S_F2_BASE_ARCHIVE_SHA256 =
  "4a1c42178e00429c914b04c4498bcc13987ef1b4f6b62e3d47c7ca422a32abe8";

export const RTM_CONNECT_A1S_F2_PRIVATE_ROUTE = "/ops/connect/a1s";
export const RTM_CONNECT_A1S_F2_LOGIN_ROUTE = "/api/ops/auth/login";
export const RTM_CONNECT_A1S_F2_LOGOUT_ROUTE = "/api/ops/auth/logout";

export const RTM_CONNECT_A1S_F2_QUEUE_PAGE_SIZE = 200;
export const RTM_CONNECT_A1S_F2_QUEUE_MAX_ITEMS = 2000;

const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const BEARER_PATTERN = /^[A-Za-z0-9._~-]{32,2048}$/;
const DEVICE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{24,200}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export class RtmConnectA1SF2ContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RtmConnectA1SF2ContractError";
    this.code = code;
  }
}

function fail(code, message) {
  throw new RtmConnectA1SF2ContractError(code, message);
}

function exactObject(value, keys, field) {
  if (!isPlainObject(value)) {
    fail("a1s_f2.invalid_object", `${field} no es un objeto valido`);
  }
  const expected = new Set(keys);
  const unexpected = Object.keys(value).filter((key) => !expected.has(key));
  const missing = keys.filter((key) => !Object.prototype.hasOwnProperty.call(value, key));
  if (unexpected.length || missing.length) {
    fail(
      "a1s_f2.unexpected_fields",
      `${field} no coincide con el contrato exacto`
    );
  }
  return value;
}

function requiredText(value, field, { max = 512 } = {}) {
  if (typeof value !== "string" || !value.trim() || value.length > max) {
    fail("a1s_f2.invalid_text", `${field} no es texto valido`);
  }
  return value;
}

function requiredBoolean(value, field) {
  if (typeof value !== "boolean") {
    fail("a1s_f2.invalid_boolean", `${field} no es booleano`);
  }
  return value;
}

function requiredUtcTimestamp(value, field) {
  requiredText(value, field, { max: 64 });
  if (!/(?:Z|\+00:00)$/i.test(value) || Number.isNaN(Date.parse(value))) {
    fail("a1s_f2.invalid_timestamp", `${field} no es fecha UTC valida`);
  }
  return value;
}

function requiredStringArray(value, field) {
  if (!Array.isArray(value) || value.length > 64) {
    fail("a1s_f2.invalid_list", `${field} no es una lista valida`);
  }
  value.forEach((item, index) => requiredText(item, `${field}[${index}]`, { max: 160 }));
  return value;
}

export function requireRtmConnectA1SF2Email(value) {
  if (typeof value !== "string") {
    fail("a1s_f2.invalid_email", "El correo de operador no es valido");
  }
  const email = requiredText(value.trim(), "email", { max: 320 });
  if (email.length < 3 || !EMAIL_PATTERN.test(email)) {
    fail("a1s_f2.invalid_email", "El correo de operador no es valido");
  }
  return email;
}

export function requireRtmConnectA1SF2Password(value) {
  if (typeof value !== "string" || value.length < 1 || value.length > 256) {
    fail("a1s_f2.invalid_password", "La contrasena de operador no es valida");
  }
  return value;
}

export function requireRtmConnectA1SF2Bearer(value) {
  if (typeof value !== "string" || !BEARER_PATTERN.test(value)) {
    fail("a1s_f2.invalid_bearer", "La sesion individual no es valida");
  }
  return value;
}

export function requireRtmConnectA1SF2DeviceToken(value, { optional = true } = {}) {
  if ((value === null || value === undefined || value === "") && optional) return null;
  if (typeof value !== "string" || !DEVICE_TOKEN_PATTERN.test(value)) {
    fail("a1s_f2.invalid_device_token", "El token de dispositivo no es valido");
  }
  return value;
}

function assertOperationalOperator(value, field) {
  const operator = exactObject(
    value,
    [
      "id",
      "email",
      "display_name",
      "role_code",
      "permissions",
      "must_change_password",
      "mfa_required",
    ],
    field
  );
  requireUuid(operator.id, `${field}.id`);
  requireRtmConnectA1SF2Email(operator.email);
  requiredText(operator.display_name, `${field}.display_name`, { max: 240 });
  if (operator.role_code !== null) {
    requiredText(operator.role_code, `${field}.role_code`, { max: 120 });
  }
  requiredStringArray(operator.permissions, `${field}.permissions`);
  requiredBoolean(operator.must_change_password, `${field}.must_change_password`);
  requiredBoolean(operator.mfa_required, `${field}.mfa_required`);
  if (operator.must_change_password || operator.mfa_required) {
    fail(
      "a1s_f2.operator_not_operational",
      "La cuenta requiere una fase de seguridad no disponible en F2"
    );
  }
  return operator;
}

export function assertRtmConnectA1SF2LoginEnvelope(value) {
  const envelope = exactObject(
    value,
    [
      "ok",
      "token_type",
      "token",
      "session_id",
      "expires_at",
      "absolute_expires_at",
      "device_token",
      "device_id",
      "operator",
      "request_id",
      "legacy_login_unchanged",
    ],
    "login"
  );
  if (
    envelope.ok !== true ||
    envelope.token_type !== "bearer" ||
    envelope.legacy_login_unchanged !== true
  ) {
    fail("a1s_f2.login_boundary_invalid", "El login no confirma la frontera F2");
  }
  const bearerToken = requireRtmConnectA1SF2Bearer(envelope.token);
  const sessionId = requireUuid(envelope.session_id, "login.session_id");
  const expiresAt = requiredUtcTimestamp(envelope.expires_at, "login.expires_at");
  const absoluteExpiresAt = requiredUtcTimestamp(
    envelope.absolute_expires_at,
    "login.absolute_expires_at"
  );
  if (Date.parse(expiresAt) > Date.parse(absoluteExpiresAt)) {
    fail("a1s_f2.session_clock_invalid", "La caducidad de sesion no es coherente");
  }
  if (Date.parse(expiresAt) <= Date.now() || Date.parse(absoluteExpiresAt) <= Date.now()) {
    fail("a1s_f2.session_expired", "La sesion emitida ya esta caducada");
  }
  requireRtmConnectA1SF2DeviceToken(envelope.device_token);
  requireUuid(envelope.device_id, "login.device_id");
  const operator = assertOperationalOperator(envelope.operator, "login.operator");
  requiredText(envelope.request_id, "login.request_id", { max: 120 });
  return Object.freeze({
    bearerToken,
    sessionId,
    expiresAt,
    absoluteExpiresAt,
    operatorId: operator.id,
  });
}

export function assertRtmConnectA1SF2LogoutEnvelope(value) {
  const envelope = exactObject(value, ["ok", "status", "request_id"], "logout");
  if (envelope.ok !== true || envelope.status !== "closed") {
    fail("a1s_f2.logout_invalid", "El cierre de sesion no fue confirmado");
  }
  requiredText(envelope.request_id, "logout.request_id", { max: 120 });
  return Object.freeze({ ok: true, status: "closed" });
}

function normalizedHostname(value) {
  return String(value || "").trim().replace(/\.$/, "").toLowerCase();
}

export function evaluateRtmConnectA1SF2Gate(input = {}) {
  const blockers = [];
  const hostname = normalizedHostname(input.hostname);
  const exact = (field, expected, blocker) => {
    if (input[field] !== expected) blockers.push(blocker);
  };

  if (hostname !== RTM_CONNECT_A1S_STAGING_HOST) {
    blockers.push("hostname_not_exact_staging");
  }
  exact("protocol", "https:", "https_required");
  if (input.port !== "") {
    blockers.push("unexpected_port");
  }
  exact("environment", "staging", "environment_not_staging");
  exact("buildTarget", "a1s-synthetic-read", "build_target_not_exact");
  exact("uiEnabled", "1", "ui_not_explicitly_enabled");
  exact("operatorAuthEnabled", "1", "operator_auth_not_enabled");
  exact("documentInputPolicy", "synthetic_only", "document_policy_not_synthetic_only");
  exact("f2BaseCommit", RTM_CONNECT_A1S_F2_BASE_COMMIT, "f2_base_commit_not_exact");
  exact(
    "f2BaseArchiveSha256",
    RTM_CONNECT_A1S_F2_BASE_ARCHIVE_SHA256,
    "f2_base_archive_not_exact"
  );
  exact("f1BaseCommit", RTM_CONNECT_A1S_BASE_COMMIT, "f1_contract_base_not_exact");
  exact("backendCommit", RTM_CONNECT_A1S_BACKEND_COMMIT, "backend_commit_not_exact");
  exact(
    "backendContractVersion",
    RTM_CONNECT_A1S_BACKEND_CONTRACT_VERSION,
    "backend_contract_not_exact"
  );
  exact("lawyerReview", "approved", "lawyer_review_not_approved");
  exact("dpoReview", "approved", "dpo_review_not_approved");
  exact("authenticatedSmoke", "passed", "authenticated_smoke_not_passed");
  exact(
    "operatorPrivacyNotice",
    "published",
    "operator_privacy_notice_not_published"
  );
  exact(
    "stagingAccessProtection",
    "verified",
    "staging_access_protection_not_verified"
  );
  exact("backendProxyAudit", "passed", "backend_proxy_audit_not_passed");

  const falseFlags = [
    ["realCaseDataAllowed", "real_case_data_not_blocked"],
    ["externalEffectsAllowed", "external_effects_not_blocked"],
    ["providerAllowed", "provider_not_blocked"],
    ["administrationContactAllowed", "administration_contact_not_blocked"],
    ["ocuContactAllowed", "ocu_contact_not_blocked"],
    ["b2Allowed", "b2_not_blocked"],
    ["productionAuthorized", "production_not_blocked"],
    ["mutationsAllowed", "mutations_not_blocked"],
  ];
  falseFlags.forEach(([field, blocker]) => exact(field, "0", blocker));

  return Object.freeze({
    allowed: blockers.length === 0,
    blockers: Object.freeze([...new Set(blockers)]),
    hostname,
    privateRoute: RTM_CONNECT_A1S_F2_PRIVATE_ROUTE,
    syntheticCaseDataOnly: true,
    readOnly: true,
    mutationsAvailable: false,
    productionAuthorized: false,
    liveVerdict: "no_go",
  });
}

function envText(source, name) {
  return String(source?.[name] ?? "").trim();
}

export function buildRtmConnectA1SF2GateInput({ env = null, location = null } = {}) {
  const source = env || import.meta.env || {};
  const browserLocation =
    location || (typeof window !== "undefined" ? window.location : null) || {};
  return Object.freeze({
    hostname: normalizedHostname(browserLocation.hostname),
    protocol: String(browserLocation.protocol || ""),
    port: String(browserLocation.port || ""),
    environment: envText(source, "VITE_RTM_ENV"),
    buildTarget: envText(source, "VITE_RTM_CONNECT_A1S_BUILD_TARGET"),
    uiEnabled: envText(source, "VITE_RTM_ENABLE_CONNECT_A1S_F2"),
    operatorAuthEnabled: envText(source, "VITE_RTM_ENABLE_OPERATOR_AUTH_V1"),
    documentInputPolicy: envText(source, "VITE_RTM_DOCUMENT_INPUT_POLICY"),
    f2BaseCommit: envText(source, "VITE_RTM_CONNECT_A1S_F2_BASE_COMMIT"),
    f2BaseArchiveSha256: envText(
      source,
      "VITE_RTM_CONNECT_A1S_F2_BASE_ARCHIVE_SHA256"
    ),
    f1BaseCommit: envText(source, "VITE_RTM_CONNECT_A1S_F1_BASE_COMMIT"),
    backendCommit: envText(source, "VITE_RTM_CONNECT_A1S_BACKEND_COMMIT"),
    backendContractVersion: envText(
      source,
      "VITE_RTM_CONNECT_A1S_BACKEND_CONTRACT_VERSION"
    ),
    lawyerReview: envText(source, "VITE_RTM_CONNECT_A1S_LAWYER_REVIEW"),
    dpoReview: envText(source, "VITE_RTM_CONNECT_A1S_DPO_REVIEW"),
    authenticatedSmoke: envText(source, "VITE_RTM_CONNECT_A1S_AUTHENTICATED_SMOKE"),
    operatorPrivacyNotice: envText(
      source,
      "VITE_RTM_CONNECT_A1S_OPERATOR_PRIVACY_NOTICE"
    ),
    stagingAccessProtection: envText(
      source,
      "VITE_RTM_CONNECT_A1S_STAGING_ACCESS_PROTECTION"
    ),
    backendProxyAudit: envText(
      source,
      "VITE_RTM_CONNECT_A1S_BACKEND_PROXY_AUDIT"
    ),
    realCaseDataAllowed: envText(
      source,
      "VITE_RTM_CONNECT_A1S_REAL_CASE_DATA_ALLOWED"
    ),
    externalEffectsAllowed: envText(
      source,
      "VITE_RTM_CONNECT_A1S_EXTERNAL_EFFECTS_ALLOWED"
    ),
    providerAllowed: envText(source, "VITE_RTM_CONNECT_A1S_PROVIDER_ALLOWED"),
    administrationContactAllowed: envText(
      source,
      "VITE_RTM_CONNECT_A1S_ADMINISTRATION_ALLOWED"
    ),
    ocuContactAllowed: envText(source, "VITE_RTM_CONNECT_A1S_OCU_ALLOWED"),
    b2Allowed: envText(source, "VITE_RTM_CONNECT_A1S_B2_ALLOWED"),
    productionAuthorized: envText(
      source,
      "VITE_RTM_CONNECT_A1S_PRODUCTION_AUTHORIZED"
    ),
    mutationsAllowed: envText(source, "VITE_RTM_CONNECT_A1S_MUTATIONS_ALLOWED"),
  });
}

export function isRtmConnectA1SF2RouteEnabled(options = {}) {
  return evaluateRtmConnectA1SF2Gate(
    buildRtmConnectA1SF2GateInput(options)
  ).allowed;
}

export const a1sF2PrivateRoute = RTM_CONNECT_A1S_F2_PRIVATE_ROUTE;
export default isRtmConnectA1SF2RouteEnabled;

export function requireRtmConnectA1SF2Sha256(value, field = "sha256") {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    fail("a1s_f2.invalid_sha256", `${field} no es SHA-256 canonico`);
  }
  return value;
}
