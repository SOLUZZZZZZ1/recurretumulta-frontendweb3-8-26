export const RTM_CONNECT_A1S_FRONTEND_CONTRACT_VERSION =
  "rtm.connect.frontend.a1s.read.v1";

export const RTM_CONNECT_A1S_BACKEND_CONTRACT_VERSION =
  "rtm.connect.a1s.human_filing.v1";

export const RTM_CONNECT_A1S_BASE_COMMIT =
  "92aeac70f93d7f1df645019b0e7f3d83b230ea4d";

export const RTM_CONNECT_A1S_BACKEND_COMMIT =
  "eb5ead955ba54bcb829c56ee9afdc5c939ec36da";

export const RTM_CONNECT_A1S_READ_PREFIX =
  "/api/ops/connect/human-filings";

export const RTM_CONNECT_A1S_AUTH_PREFIX = "/api/ops/auth";

export const RTM_CONNECT_A1S_STAGING_HOST =
  "recurretumulta-frontend-staging.vercel.app";

export const RTM_CONNECT_A1S_TASK_STATUSES = Object.freeze([
  "prepared",
  "assigned",
  "reviewing",
  "ready_for_release",
  "released",
  "in_progress",
  "awaiting_receipt",
  "outcome_unknown",
  "reconciling",
  "receipt_submitted",
  "verified",
  "completed",
  "manual_review",
  "permanent_failed",
]);

export const RTM_CONNECT_A1S_READ_ROUTE_NAMES = Object.freeze([
  "operator_auth_status",
  "operator_me",
  "tenants",
  "tenant_context",
  "preparation_options",
  "task_list",
  "task_detail",
  "receipt_options",
]);

export const RTM_CONNECT_A1S_F1_INVARIANTS = Object.freeze({
  syntheticOnly: true,
  readOnly: true,
  productionAuthorized: false,
  mutationsAvailable: false,
  externalEffectsAllowed: false,
  realDataAllowed: false,
  providerAllowed: false,
  administrationContactAllowed: false,
  ocuContactAllowed: false,
  b2Allowed: false,
  legacyTokenReuseAllowed: false,
  persistentBearerStorageAllowed: false,
  directBackendOriginAllowed: false,
});

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const TASK_CODE_PATTERN = /^rtm-a1s-human-[0-9a-f]{24}$/;
const SYNTHETIC_REFERENCE_PATTERN = /^a1s-synthetic-[0-9a-f]{24}$/;
const FORBIDDEN_PRODUCTION_HOSTS = new Set([
  "recurretumulta.eu",
  "www.recurretumulta.eu",
]);
const TASK_STATUS_SET = new Set(RTM_CONNECT_A1S_TASK_STATUSES);
const MEMBERSHIP_ROLE_SET = new Set([
  "requester",
  "executor",
  "releaser",
  "verifier",
  "supervisor",
]);
const PERMISSION_SET = new Set([
  "connect.human_filing.read",
  "connect.human_filing.prepare",
  "connect.human_filing.assign",
  "connect.human_filing.execute",
  "connect.human_filing.release",
  "connect.human_filing.verify",
  "connect.human_filing.reconcile",
  "connect.human_filing.supervise",
]);
const ELIGIBLE_ACTION_SET = new Set([
  "read",
  "prepare",
  "assign",
  "execute",
  "release",
  "verify",
  "reconcile",
  "supervise",
]);
const DETAIL_ACTION_HINT_SET = new Set([
  "assign_human_filing",
  "begin_review",
  "attest_review",
  "preapprove_verifier",
  "release_human_filing",
  "begin_execution",
  "record_outcome",
  "submit_receipt_fixture",
  "verify_receipt_and_complete",
  "begin_human_reconciliation",
  "resolve_human_reconciliation",
  "escalate_to_manual_review",
]);
const FIXED_CHECKLIST = Object.freeze([
  "confirm_synthetic_case_binding",
  "confirm_frozen_core_authority",
  "confirm_synthetic_representation",
  "confirm_exact_package_hash",
  "simulate_human_filing_without_external_contact",
  "capture_synthetic_receipt",
  "verify_receipt_with_independent_principal",
]);
const TASK_PROJECTION_KEYS = Object.freeze([
  "task_id",
  "tenant_id",
  "case_binding_id",
  "case_id",
  "representation_evidence_id",
  "action_id",
  "attempt_id",
  "connector_id",
  "authorization_id",
  "authorization_version",
  "task_code",
  "status",
  "version",
  "status_version",
  "requester_membership_id",
  "requester_principal_id",
  "requester_operator_id",
  "assignee_operator_id",
  "assignee_membership_id",
  "assignee_principal_id",
  "release_operator_id",
  "release_membership_id",
  "release_principal_id",
  "verified_by_operator_id",
  "verified_by_membership_id",
  "verified_by_principal_id",
  "due_at",
  "package_sha256",
  "review_attestation_sha256",
  "release_attestation_sha256",
  "verification_attestation_sha256",
  "external_reference",
  "created_at",
  "updated_at",
  "replayed",
]);

const UNSAFE_TRUE_CLAIMS = new Set([
  "administration_contacted",
  "b2_used",
  "external_effects_executed",
  "legal_submission_executed",
  "network_used",
  "production_authorized",
  "production_safe",
  "provider_contacted",
  "real_data_used",
  "routes_published",
  "workers_started",
]);
const UNSAFE_NORMALIZED_TRUE_CLAIMS = new Set([
  "administrationcontacted",
  "b2used",
  "externaleffectsallowed",
  "externaleffectsexecuted",
  "legalsubmissionexecuted",
  "networkused",
  "productionauthorized",
  "productionsafe",
  "providercontacted",
  "realdatallowed",
  "realdataallowed",
  "realdataused",
  "routespublished",
  "workersstarted",
]);

export class RtmConnectA1SContractError extends Error {
  constructor(code, message) {
    super(message);
    this.name = "RtmConnectA1SContractError";
    this.code = code;
  }
}

function contractError(code, message) {
  throw new RtmConnectA1SContractError(code, message);
}

export function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function requirePlainObject(value, field) {
  if (!isPlainObject(value)) {
    contractError("a1s.invalid_object", `${field} no es un objeto A1-S valido`);
  }
  return value;
}

function requireString(value, field, { allowEmpty = false } = {}) {
  if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
    contractError("a1s.invalid_string", `${field} no es texto valido`);
  }
  return value;
}

function requireBoolean(value, field) {
  if (typeof value !== "boolean") {
    contractError("a1s.invalid_boolean", `${field} no es booleano`);
  }
  return value;
}

function requirePositiveInteger(value, field) {
  if (!Number.isInteger(value) || value < 1) {
    contractError("a1s.invalid_integer", `${field} no es entero positivo`);
  }
  return value;
}

function requireStringArray(value, field) {
  if (!Array.isArray(value)) {
    contractError("a1s.invalid_string_list", `${field} no es una lista`);
  }
  value.forEach((item, index) =>
    requireString(item, `${field}[${index}]`)
  );
  return value;
}

function requireEnum(value, field, allowed) {
  requireString(value, field);
  if (!allowed.has(value)) {
    contractError("a1s.invalid_enum", `${field} queda fuera de la allowlist`);
  }
  return value;
}

function requireEnumArray(value, field, allowed) {
  requireStringArray(value, field);
  value.forEach((item, index) =>
    requireEnum(item, `${field}[${index}]`, allowed)
  );
  return value;
}

function requireExactKeys(value, allowedKeys, field) {
  const object = requirePlainObject(value, field);
  const allowed = new Set(allowedKeys);
  const unexpected = Object.keys(object).filter((key) => !allowed.has(key));
  if (unexpected.length) {
    contractError(
      "a1s.unexpected_field",
      `${field} contiene campos no admitidos: ${unexpected.sort().join(",")}`
    );
  }
  return object;
}

function requireOptionalUuid(value, field) {
  if (value === null || value === undefined) return null;
  return requireUuid(value, field);
}

function requireOptionalSha256(value, field) {
  if (value === null || value === undefined) return null;
  return requireSha256(value, field);
}

function requireUtcTimestamp(value, field, { optional = false } = {}) {
  if ((value === null || value === undefined) && optional) return null;
  requireString(value, field);
  if (
    !/(?:Z|\+00:00)$/i.test(value) ||
    Number.isNaN(Date.parse(value))
  ) {
    contractError("a1s.invalid_timestamp", `${field} no es fecha UTC valida`);
  }
  return value;
}

export function requireUuid(value, field = "uuid") {
  if (typeof value !== "string" || !UUID_PATTERN.test(value)) {
    contractError("a1s.invalid_uuid", `${field} no es UUID valido`);
  }
  return value.toLowerCase();
}

export function requireSha256(value, field = "sha256") {
  if (typeof value !== "string" || !SHA256_PATTERN.test(value)) {
    contractError("a1s.invalid_sha256", `${field} no es SHA-256 canonico`);
  }
  return value;
}

export function requireTaskStatus(value, field = "status") {
  if (typeof value !== "string" || !TASK_STATUS_SET.has(value)) {
    contractError("a1s.invalid_status", `${field} no es estado A1-S admitido`);
  }
  return value;
}

function walkRuntimeClaims(value, path = "$", depth = 0) {
  if (depth > 16) {
    contractError("a1s.payload_too_deep", "Respuesta A1-S demasiado profunda");
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      walkRuntimeClaims(item, `${path}[${index}]`, depth + 1)
    );
    return;
  }
  if (!isPlainObject(value)) return;

  for (const [key, item] of Object.entries(value)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, "").toLowerCase();
    if (
      (UNSAFE_TRUE_CLAIMS.has(key) ||
        UNSAFE_NORMALIZED_TRUE_CLAIMS.has(normalizedKey)) &&
      item === true
    ) {
      contractError(
        "a1s.unsafe_runtime_claim",
        `${path}.${key} contradice el aislamiento sintetico`
      );
    }
    if (normalizedKey === "syntheticonly" && item !== true) {
      contractError(
        "a1s.synthetic_claim_invalid",
        `${path}.synthetic_only debe ser true`
      );
    }
    if (normalizedKey === "liveverdict" && item !== "no_go") {
      contractError(
        "a1s.live_verdict_invalid",
        `${path}.live_verdict debe permanecer no_go`
      );
    }
    if (
      ["dataclass", "environment", "runtimeenvironment"].includes(
        normalizedKey
      ) &&
      typeof item === "string" &&
      ["production", "live", "real"].includes(item.trim().toLowerCase())
    ) {
      contractError(
        "a1s.production_context_invalid",
        `${path}.${key} contradice staging sintetico`
      );
    }
    walkRuntimeClaims(item, `${path}.${key}`, depth + 1);
  }
}

export function assertSafeA1SEnvelope(
  value,
  { requireSyntheticBoundary = true } = {}
) {
  const envelope = requirePlainObject(value, "response");
  if (envelope.ok !== true) {
    contractError("a1s.response_not_ok", "La respuesta A1-S no confirma ok=true");
  }
  walkRuntimeClaims(envelope);
  if (
    requireSyntheticBoundary &&
    (envelope.synthetic_only !== true ||
      envelope.read_only !== true ||
      envelope.live_verdict !== "no_go")
  ) {
    contractError(
      "a1s.synthetic_boundary_missing",
      "La respuesta generica no acredita la frontera sintetica read_only/no_go"
    );
  }
  return envelope;
}

function assertBackendReadEnvelope(value, payloadKeys, field) {
  const envelope = assertSafeA1SEnvelope(value, {
    requireSyntheticBoundary: false,
  });
  requireExactKeys(envelope, ["ok", "request_id", ...payloadKeys], field);
  requireString(envelope.request_id, `${field}.request_id`);
  return envelope;
}

function normalizeHostname(value) {
  return String(value || "")
    .trim()
    .replace(/\.$/, "")
    .toLowerCase();
}

export function evaluateA1SFrontendGate(input = {}) {
  const blockers = [];
  const hostname = normalizeHostname(input.hostname);
  const exactStagingHost = hostname === RTM_CONNECT_A1S_STAGING_HOST;

  if (FORBIDDEN_PRODUCTION_HOSTS.has(hostname)) {
    blockers.push("production_hostname_forbidden");
  }
  if (!exactStagingHost) {
    blockers.push("hostname_not_allowlisted");
  }
  if (input.protocol !== "https:") {
    blockers.push("https_required");
  }
  if (input.port !== "" && input.port !== undefined && input.port !== null) {
    blockers.push("unexpected_port");
  }
  if (input.buildTarget !== "a1s-synthetic-read") {
    blockers.push("build_target_not_exact");
  }
  if (input.environment !== "staging") {
    blockers.push("environment_not_staging");
  }
  if (input.uiEnabled !== "1") {
    blockers.push("ui_not_explicitly_enabled");
  }
  if (input.operatorAuthEnabled !== "1") {
    blockers.push("operator_auth_not_explicitly_enabled");
  }
  if (input.documentInputPolicy !== "synthetic_only") {
    blockers.push("document_policy_not_synthetic_only");
  }
  if (input.frontendBaseCommit !== RTM_CONNECT_A1S_BASE_COMMIT) {
    blockers.push("frontend_base_commit_not_exact");
  }
  if (input.backendCommit !== RTM_CONNECT_A1S_BACKEND_COMMIT) {
    blockers.push("backend_commit_not_exact");
  }
  if (
    input.backendContractVersion !==
    RTM_CONNECT_A1S_BACKEND_CONTRACT_VERSION
  ) {
    blockers.push("backend_contract_not_exact");
  }

  const requiredFalseFlags = {
    realDataAllowed: "real_data_not_explicitly_blocked",
    externalEffectsAllowed: "external_effects_not_explicitly_blocked",
    providerAllowed: "provider_not_explicitly_blocked",
    administrationContactAllowed:
      "administration_contact_not_explicitly_blocked",
    ocuContactAllowed: "ocu_contact_not_explicitly_blocked",
    b2Allowed: "b2_not_explicitly_blocked",
    productionAuthorized: "production_not_explicitly_blocked",
  };
  for (const [field, blocker] of Object.entries(requiredFalseFlags)) {
    if (input[field] !== "0") blockers.push(blocker);
  }

  return Object.freeze({
    allowed: blockers.length === 0,
    blockers: Object.freeze(blockers),
    hostname,
    exactStagingHost,
    localDevelopment: false,
    readOnly: true,
    syntheticOnly: true,
    mutationsAvailable: false,
    liveVerdict: "no_go",
  });
}

export function assertTenantListEnvelope(value, expectedOperatorId = null) {
  const envelope = assertBackendReadEnvelope(
    value,
    ["items", "items_limit", "items_truncated", "read_only"],
    "tenant_list"
  );
  if (envelope.read_only !== true || !Array.isArray(envelope.items)) {
    contractError(
      "a1s.invalid_tenant_list",
      "La lista de tenants no es read_only"
    );
  }
  const items = envelope.items.map((item, index) => {
    const tenant = requireExactKeys(
      item,
      [
        "tenant_id",
        "tenant_code",
        "display_name",
        "membership_id",
        "principal_id",
        "operator_id",
        "role",
        "permissions",
        "version",
      ],
      `items[${index}]`
    );
    requireUuid(tenant.tenant_id, `items[${index}].tenant_id`);
    requireUuid(tenant.membership_id, `items[${index}].membership_id`);
    requireUuid(tenant.principal_id, `items[${index}].principal_id`);
    requireUuid(tenant.operator_id, `items[${index}].operator_id`);
    if (
      expectedOperatorId !== null &&
      requireUuid(tenant.operator_id, `items[${index}].operator_id`) !==
        requireUuid(expectedOperatorId, "expected_operator_id")
    ) {
      contractError(
        "a1s.operator_mismatch",
        "El tenant pertenece a otro operador"
      );
    }
    requireString(tenant.display_name, `items[${index}].display_name`);
    requireEnum(tenant.role, `items[${index}].role`, MEMBERSHIP_ROLE_SET);
    requireString(tenant.tenant_code, `items[${index}].tenant_code`);
    requireEnumArray(
      tenant.permissions,
      `items[${index}].permissions`,
      PERMISSION_SET
    );
    requirePositiveInteger(tenant.version, `items[${index}].version`);
    return tenant;
  });
  requirePositiveInteger(envelope.items_limit, "items_limit");
  requireBoolean(envelope.items_truncated, "items_truncated");
  if (items.length > envelope.items_limit) {
    contractError("a1s.items_limit_inconsistent", "items supera items_limit");
  }
  return { ...envelope, items };
}

export function assertTenantContextEnvelope(
  value,
  expectedTenantId,
  expectedOperatorId = null
) {
  const envelope = assertBackendReadEnvelope(
    value,
    [
      "tenant_id",
      "current_membership",
      "participants",
      "participants_limit",
      "participants_truncated",
      "read_only",
    ],
    "tenant_context"
  );
  const tenantId = requireUuid(envelope.tenant_id, "tenant_id");
  if (tenantId !== requireUuid(expectedTenantId, "expected_tenant_id")) {
    contractError("a1s.tenant_mismatch", "El contexto pertenece a otro tenant");
  }
  if (envelope.read_only !== true || !Array.isArray(envelope.participants)) {
    contractError(
      "a1s.invalid_tenant_context",
      "El contexto tenant no es read_only"
    );
  }
  const membership = requireExactKeys(
    envelope.current_membership,
    [
      "membership_id",
      "principal_id",
      "operator_id",
      "role",
      "permissions",
      "version",
    ],
    "current_membership"
  );
  requireUuid(membership.membership_id, "current_membership.membership_id");
  requireUuid(membership.principal_id, "current_membership.principal_id");
  requireUuid(membership.operator_id, "current_membership.operator_id");
  if (
    expectedOperatorId !== null &&
    requireUuid(membership.operator_id, "current_membership.operator_id") !==
      requireUuid(expectedOperatorId, "expected_operator_id")
  ) {
    contractError(
      "a1s.operator_mismatch",
      "La membership actual pertenece a otro operador"
    );
  }
  requireEnum(membership.role, "current_membership.role", MEMBERSHIP_ROLE_SET);
  requireEnumArray(
    membership.permissions,
    "current_membership.permissions",
    PERMISSION_SET
  );
  requirePositiveInteger(membership.version, "current_membership.version");
  const participants = envelope.participants.map((item, index) => {
    const participant = requireExactKeys(
      item,
      [
        "membership_id",
        "principal_id",
        "operator_id",
        "display_name",
        "role",
        "eligible_for",
        "version",
      ],
      `participants[${index}]`
    );
    requireUuid(
      participant.membership_id,
      `participants[${index}].membership_id`
    );
    requireUuid(
      participant.principal_id,
      `participants[${index}].principal_id`
    );
    requireUuid(
      participant.operator_id,
      `participants[${index}].operator_id`
    );
    requireString(
      participant.display_name,
      `participants[${index}].display_name`
    );
    requireEnum(
      participant.role,
      `participants[${index}].role`,
      MEMBERSHIP_ROLE_SET
    );
    requireEnumArray(
      participant.eligible_for,
      `participants[${index}].eligible_for`,
      ELIGIBLE_ACTION_SET
    );
    requirePositiveInteger(
      participant.version,
      `participants[${index}].version`
    );
    return participant;
  });
  requirePositiveInteger(envelope.participants_limit, "participants_limit");
  requireBoolean(envelope.participants_truncated, "participants_truncated");
  if (participants.length > envelope.participants_limit) {
    contractError(
      "a1s.participants_limit_inconsistent",
      "participants supera participants_limit"
    );
  }
  return { ...envelope, participants };
}

export function assertPreparationOptionsEnvelope(value, expectedTenantId) {
  const envelope = assertBackendReadEnvelope(
    value,
    [
      "tenant_id",
      "options",
      "options_limit",
      "options_truncated",
      "read_only",
    ],
    "preparation_options"
  );
  if (
    requireUuid(envelope.tenant_id, "tenant_id") !==
    requireUuid(expectedTenantId, "expected_tenant_id")
  ) {
    contractError(
      "a1s.tenant_mismatch",
      "Las opciones pertenecen a otro tenant"
    );
  }
  if (envelope.read_only !== true || !Array.isArray(envelope.options)) {
    contractError(
      "a1s.invalid_preparation_options",
      "Las opciones de preparacion no son read_only"
    );
  }
  const options = envelope.options.map((item, index) => {
    const option = requireExactKeys(
      item,
      ["case_binding", "representation", "action", "authorization"],
      `options[${index}]`
    );
    const binding = requireExactKeys(
      option.case_binding,
      ["id", "case_id", "code", "case_snapshot_sha256", "version"],
      `options[${index}].case_binding`
    );
    requireUuid(binding.id, `options[${index}].case_binding.id`);
    requireUuid(binding.case_id, `options[${index}].case_binding.case_id`);
    requireString(binding.code, `options[${index}].case_binding.code`);
    requireSha256(
      binding.case_snapshot_sha256,
      `options[${index}].case_binding.case_snapshot_sha256`
    );
    requirePositiveInteger(
      binding.version,
      `options[${index}].case_binding.version`
    );

    const representation = requireExactKeys(
      option.representation,
      ["id", "code", "kind", "evidence_sha256", "expires_at", "version"],
      `options[${index}].representation`
    );
    requireUuid(representation.id, `options[${index}].representation.id`);
    requireString(representation.code, `options[${index}].representation.code`);
    requireString(representation.kind, `options[${index}].representation.kind`);
    requireSha256(
      representation.evidence_sha256,
      `options[${index}].representation.evidence_sha256`
    );
    requireUtcTimestamp(
      representation.expires_at,
      `options[${index}].representation.expires_at`,
      { optional: true }
    );
    requirePositiveInteger(
      representation.version,
      `options[${index}].representation.version`
    );

    const action = requireExactKeys(
      option.action,
      ["id", "version", "request_sha256", "document_hashes"],
      `options[${index}].action`
    );
    requireUuid(action.id, `options[${index}].action.id`);
    requirePositiveInteger(action.version, `options[${index}].action.version`);
    requireSha256(
      action.request_sha256,
      `options[${index}].action.request_sha256`
    );
    if (
      !Array.isArray(action.document_hashes) ||
      action.document_hashes.length < 1 ||
      action.document_hashes.length > 8
    ) {
      contractError(
        "a1s.invalid_document_hashes",
        `options[${index}].action.document_hashes no es lista no vacia`
      );
    }
    const documentHashes = action.document_hashes.map((hash, hashIndex) =>
      requireSha256(
        hash,
        `options[${index}].action.document_hashes[${hashIndex}]`
      )
    );
    if (new Set(documentHashes).size !== documentHashes.length) {
      contractError(
        "a1s.duplicate_document_hash",
        `options[${index}].action.document_hashes contiene duplicados`
      );
    }

    const authorization = requireExactKeys(
      option.authorization,
      ["id", "version", "expires_at"],
      `options[${index}].authorization`
    );
    requireUuid(authorization.id, `options[${index}].authorization.id`);
    requirePositiveInteger(
      authorization.version,
      `options[${index}].authorization.version`
    );
    requireUtcTimestamp(
      authorization.expires_at,
      `options[${index}].authorization.expires_at`,
      { optional: true }
    );
    return option;
  });
  requirePositiveInteger(envelope.options_limit, "options_limit");
  requireBoolean(envelope.options_truncated, "options_truncated");
  if (options.length > envelope.options_limit) {
    contractError(
      "a1s.options_limit_inconsistent",
      "options supera options_limit"
    );
  }
  return { ...envelope, options };
}

export function assertTaskProjection(value, expectedTenantId = null) {
  const task = requireExactKeys(value, TASK_PROJECTION_KEYS, "task");
  requireUuid(task.task_id, "task.task_id");
  const tenantId = requireUuid(task.tenant_id, "task.tenant_id");
  if (
    expectedTenantId !== null &&
    tenantId !== requireUuid(expectedTenantId, "expected_tenant_id")
  ) {
    contractError("a1s.tenant_mismatch", "La tarea pertenece a otro tenant");
  }
  requireUuid(task.case_binding_id, "task.case_binding_id");
  requireUuid(task.case_id, "task.case_id");
  requireUuid(
    task.representation_evidence_id,
    "task.representation_evidence_id"
  );
  requireUuid(task.action_id, "task.action_id");
  requireUuid(task.attempt_id, "task.attempt_id");
  requireUuid(task.connector_id, "task.connector_id");
  requireUuid(task.authorization_id, "task.authorization_id");
  requirePositiveInteger(
    task.authorization_version,
    "task.authorization_version"
  );
  requireSha256(task.package_sha256, "task.package_sha256");
  requireTaskStatus(task.status, "task.status");
  if (
    typeof task.task_code !== "string" ||
    !TASK_CODE_PATTERN.test(task.task_code)
  ) {
    contractError("a1s.invalid_task_code", "task.task_code no es A1-S");
  }
  requirePositiveInteger(task.version, "task.version");
  requirePositiveInteger(task.status_version, "task.status_version");
  if (task.version !== task.status_version) {
    contractError(
      "a1s.status_version_mismatch",
      "task.version y task.status_version no coinciden"
    );
  }
  for (const field of [
    "requester_membership_id",
    "requester_principal_id",
    "requester_operator_id",
    "assignee_operator_id",
    "assignee_membership_id",
    "assignee_principal_id",
    "release_operator_id",
    "release_membership_id",
    "release_principal_id",
    "verified_by_operator_id",
    "verified_by_membership_id",
    "verified_by_principal_id",
  ]) {
    requireOptionalUuid(task[field], `task.${field}`);
  }
  for (const [label, fields] of [
    [
      "requester",
      [
        "requester_membership_id",
        "requester_principal_id",
        "requester_operator_id",
      ],
    ],
    [
      "assignee",
      [
        "assignee_operator_id",
        "assignee_membership_id",
        "assignee_principal_id",
      ],
    ],
    [
      "release",
      [
        "release_operator_id",
        "release_membership_id",
        "release_principal_id",
      ],
    ],
    [
      "verifier",
      [
        "verified_by_operator_id",
        "verified_by_membership_id",
        "verified_by_principal_id",
      ],
    ],
  ]) {
    const present = fields.filter((field) => task[field] !== null).length;
    if ((label === "requester" && present !== fields.length) ||
        (label !== "requester" && present !== 0 && present !== fields.length)) {
      contractError(
        "a1s.participant_identity_incomplete",
        `La identidad ${label} no esta ligada de forma completa`
      );
    }
  }
  for (const field of [
    "review_attestation_sha256",
    "release_attestation_sha256",
    "verification_attestation_sha256",
  ]) {
    requireOptionalSha256(task[field], `task.${field}`);
  }
  requireUtcTimestamp(task.due_at, "task.due_at");
  requireUtcTimestamp(task.created_at, "task.created_at");
  requireUtcTimestamp(task.updated_at, "task.updated_at");
  if (
    Date.parse(task.due_at) <= Date.parse(task.created_at) ||
    Date.parse(task.updated_at) < Date.parse(task.created_at)
  ) {
    contractError(
      "a1s.task_clock_invalid",
      "La cronologia de la tarea A1-S no es coherente"
    );
  }
  requireBoolean(task.replayed, "task.replayed");
  if (
    task.external_reference !== null &&
    task.external_reference !== undefined &&
    !SYNTHETIC_REFERENCE_PATTERN.test(task.external_reference)
  ) {
    contractError(
      "a1s.invalid_external_reference",
      "task.external_reference no es sintetica"
    );
  }
  walkRuntimeClaims(task, "$.task");
  return task;
}

export function assertTaskListEnvelope(value, expectedTenantId) {
  const envelope = assertBackendReadEnvelope(
    value,
    ["items", "pagination"],
    "task_list"
  );
  if (!Array.isArray(envelope.items) || !isPlainObject(envelope.pagination)) {
    contractError("a1s.invalid_task_list", "La cola A1-S no es valida");
  }
  const items = envelope.items.map((item) =>
    assertTaskProjection(item, expectedTenantId)
  );
  const { limit, offset, total } = envelope.pagination;
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 200 ||
    !Number.isInteger(offset) ||
    offset < 0 ||
    !Number.isInteger(total) ||
    total < 0
  ) {
    contractError("a1s.invalid_pagination", "Paginacion A1-S no valida");
  }
  requireExactKeys(
    envelope.pagination,
    ["limit", "offset", "total"],
    "pagination"
  );
  if (
    items.length > limit ||
    (items.length > 0 && (offset >= total || offset + items.length > total))
  ) {
    contractError(
      "a1s.pagination_inconsistent",
      "La pagina A1-S contradice limit, offset o total"
    );
  }
  return { ...envelope, items };
}

function assertSyntheticPackageManifest(value, task) {
  const manifest = requireExactKeys(
    value,
    [
      "contract_version",
      "task_id",
      "tenant_id",
      "case_binding_id",
      "representation_evidence_id",
      "action_id",
      "attempt_id",
      "authorization_id",
      "authorization_version",
      "case_snapshot_sha256",
      "representation_evidence_sha256",
      "request_sha256",
      "document_hashes",
      "destination_ref",
      "due_at",
      "checklist",
      "created_by_operator_id",
      "created_at",
      "synthetic_marker",
      "synthetic_only",
      "network_used",
      "b2_used",
      "provider_contacted",
      "legal_submission_executed",
      "storage_backend",
    ],
    "task.package_manifest"
  );
  if (manifest.contract_version !== RTM_CONNECT_A1S_BACKEND_CONTRACT_VERSION) {
    contractError(
      "a1s.package_contract_invalid",
      "task.package_manifest.contract_version no coincide"
    );
  }
  for (const [field, expected] of [
    ["task_id", task.task_id],
    ["tenant_id", task.tenant_id],
    ["case_binding_id", task.case_binding_id],
    ["representation_evidence_id", task.representation_evidence_id],
    ["action_id", task.action_id],
    ["attempt_id", task.attempt_id],
    ["authorization_id", task.authorization_id],
  ]) {
    if (
      requireUuid(manifest[field], `task.package_manifest.${field}`) !==
      requireUuid(expected, `task.${field}`)
    ) {
      contractError(
        "a1s.package_identity_mismatch",
        `task.package_manifest.${field} no coincide con la tarea`
      );
    }
  }
  if (
    requirePositiveInteger(
      manifest.authorization_version,
      "task.package_manifest.authorization_version"
    ) !== task.authorization_version
  ) {
    contractError(
      "a1s.package_authorization_mismatch",
      "La version autorizada del paquete no coincide"
    );
  }
  for (const field of [
    "case_snapshot_sha256",
    "representation_evidence_sha256",
    "request_sha256",
  ]) {
    requireSha256(manifest[field], `task.package_manifest.${field}`);
  }
  if (
    !Array.isArray(manifest.document_hashes) ||
    manifest.document_hashes.length < 1 ||
    manifest.document_hashes.length > 8
  ) {
    contractError(
      "a1s.package_document_hashes_invalid",
      "El paquete no contiene entre 1 y 8 hashes"
    );
  }
  const hashes = manifest.document_hashes.map((hash, index) =>
    requireSha256(hash, `task.package_manifest.document_hashes[${index}]`)
  );
  if (new Set(hashes).size !== hashes.length) {
    contractError(
      "a1s.package_document_hashes_duplicate",
      "El paquete contiene hashes duplicados"
    );
  }
  if (manifest.destination_ref !== "synthetic-a1s-administration") {
    contractError(
      "a1s.package_destination_invalid",
      "El destino del paquete no es sintetico"
    );
  }
  requireUtcTimestamp(manifest.due_at, "task.package_manifest.due_at");
  requireUtcTimestamp(manifest.created_at, "task.package_manifest.created_at");
  if (Date.parse(manifest.due_at) !== Date.parse(task.due_at)) {
    contractError(
      "a1s.package_due_at_mismatch",
      "La fecha limite del paquete no coincide con la tarea"
    );
  }
  requireUuid(
    manifest.created_by_operator_id,
    "task.package_manifest.created_by_operator_id"
  );
  if (
    requireUuid(
      manifest.created_by_operator_id,
      "task.package_manifest.created_by_operator_id"
    ) !== requireUuid(task.requester_operator_id, "task.requester_operator_id")
  ) {
    contractError(
      "a1s.package_creator_mismatch",
      "El creador del paquete no coincide con el solicitante"
    );
  }
  if (
    !Array.isArray(manifest.checklist) ||
    manifest.checklist.length !== FIXED_CHECKLIST.length ||
    manifest.checklist.some((item, index) => item !== FIXED_CHECKLIST[index])
  ) {
    contractError(
      "a1s.package_checklist_invalid",
      "El checklist sintetico del paquete no coincide"
    );
  }
  if (
    manifest.synthetic_marker !== "RTM_A1S_SYNTHETIC_ONLY" ||
    manifest.synthetic_only !== true ||
    manifest.network_used !== false ||
    manifest.b2_used !== false ||
    manifest.provider_contacted !== false ||
    manifest.legal_submission_executed !== false
  ) {
    contractError(
      "a1s.package_boundary_invalid",
      "El paquete contradice la frontera sintetica"
    );
  }
  if (
    manifest.storage_backend !== undefined &&
    manifest.storage_backend !== "database_manifest_only"
  ) {
    contractError(
      "a1s.package_storage_invalid",
      "El paquete declara almacenamiento no admitido"
    );
  }
  return manifest;
}

function assertApprovalSummaries(value) {
  if (!Array.isArray(value) || value.length > 2) {
    contractError("a1s.approvals_invalid", "Aprobaciones A1-S no validas");
  }
  const approvals = value.map((item, index) => {
    const approval = requireExactKeys(
      item,
      [
        "approval_id",
        "approval_type",
        "decision",
        "principal_id",
        "operator_id",
        "attestation_sha256",
        "artifact_id",
        "approved_at",
      ],
      `task.approvals[${index}]`
    );
    for (const field of [
      "approval_id",
      "principal_id",
      "operator_id",
      "artifact_id",
    ]) {
      requireUuid(approval[field], `task.approvals[${index}].${field}`);
    }
    requireEnum(
      approval.approval_type,
      `task.approvals[${index}].approval_type`,
      new Set(["verification_preapproval", "release"])
    );
    if (approval.decision !== "approved_frozen") {
      contractError(
        "a1s.approval_decision_invalid",
        "La aprobacion no esta congelada"
      );
    }
    requireSha256(
      approval.attestation_sha256,
      `task.approvals[${index}].attestation_sha256`
    );
    requireUtcTimestamp(
      approval.approved_at,
      `task.approvals[${index}].approved_at`
    );
    return approval;
  });
  if (new Set(approvals.map((item) => item.approval_type)).size !== approvals.length) {
    contractError(
      "a1s.approvals_duplicate",
      "La tarea contiene aprobaciones duplicadas"
    );
  }
  return approvals;
}

function assertArtifactSummaries(value) {
  if (!Array.isArray(value) || value.length > 200) {
    contractError("a1s.artifacts_invalid", "Artefactos A1-S no validos");
  }
  const kinds = new Set([
    "authority_snapshot",
    "representation_evidence",
    "filing_package",
    "human_review_attestation",
    "release_attestation",
    "verification_preapproval_attestation",
    "synthetic_submission_report",
    "synthetic_receipt",
    "verification_attestation",
    "reconciliation_attestation",
  ]);
  return value.map((item, index) => {
    const artifact = requireExactKeys(
      item,
      [
        "artifact_id",
        "artifact_code",
        "kind",
        "media_type",
        "sha256",
        "submitted_by_principal_id",
        "submitted_by_operator_id",
        "verified_by_principal_id",
        "verified_by_operator_id",
        "verified_at",
        "version",
        "created_at",
      ],
      `task.artifacts[${index}]`
    );
    for (const field of [
      "artifact_id",
      "submitted_by_principal_id",
      "submitted_by_operator_id",
    ]) {
      requireUuid(artifact[field], `task.artifacts[${index}].${field}`);
    }
    requireOptionalUuid(
      artifact.verified_by_principal_id,
      `task.artifacts[${index}].verified_by_principal_id`
    );
    requireOptionalUuid(
      artifact.verified_by_operator_id,
      `task.artifacts[${index}].verified_by_operator_id`
    );
    requireString(artifact.artifact_code, `task.artifacts[${index}].artifact_code`);
    requireEnum(artifact.kind, `task.artifacts[${index}].kind`, kinds);
    if (artifact.media_type !== "application/json") {
      contractError("a1s.artifact_media_invalid", "Artefacto no JSON");
    }
    requireSha256(artifact.sha256, `task.artifacts[${index}].sha256`);
    requireUtcTimestamp(
      artifact.verified_at,
      `task.artifacts[${index}].verified_at`,
      { optional: true }
    );
    requirePositiveInteger(artifact.version, `task.artifacts[${index}].version`);
    requireUtcTimestamp(
      artifact.created_at,
      `task.artifacts[${index}].created_at`
    );
    return artifact;
  });
}

function assertReceiptSummary(value) {
  if (value === null) return null;
  const receipt = requireExactKeys(
    value,
    [
      "artifact_id",
      "document_id",
      "document_sha256",
      "external_reference",
      "package_sha256",
      "witnessed_at",
      "created_at",
    ],
    "task.receipt_summary"
  );
  requireUuid(receipt.artifact_id, "task.receipt_summary.artifact_id");
  requireUuid(receipt.document_id, "task.receipt_summary.document_id");
  requireSha256(
    receipt.document_sha256,
    "task.receipt_summary.document_sha256"
  );
  requireSha256(receipt.package_sha256, "task.receipt_summary.package_sha256");
  if (!SYNTHETIC_REFERENCE_PATTERN.test(receipt.external_reference)) {
    contractError(
      "a1s.receipt_reference_invalid",
      "La referencia del recibo no es sintetica"
    );
  }
  requireUtcTimestamp(receipt.witnessed_at, "task.receipt_summary.witnessed_at");
  requireUtcTimestamp(receipt.created_at, "task.receipt_summary.created_at");
  return receipt;
}

function assertEventSummaries(value) {
  if (!Array.isArray(value) || value.length > 200) {
    contractError("a1s.events_invalid", "Eventos A1-S no validos");
  }
  return value.map((item, index) => {
    const event = requireExactKeys(
      item,
      [
        "event_id",
        "sequence_number",
        "event_type",
        "actor_type",
        "principal_id",
        "operator_id",
        "from_status",
        "to_status",
        "reason_code",
        "payload_sha256",
        "created_at",
      ],
      `task.events[${index}]`
    );
    requireUuid(event.event_id, `task.events[${index}].event_id`);
    requirePositiveInteger(
      event.sequence_number,
      `task.events[${index}].sequence_number`
    );
    requireString(event.event_type, `task.events[${index}].event_type`);
    if (!event.event_type.startsWith("human_filing.")) {
      contractError("a1s.event_type_invalid", "Evento fuera de A1-S");
    }
    requireEnum(
      event.actor_type,
      `task.events[${index}].actor_type`,
      new Set(["operator", "connect", "core", "system"])
    );
    requireOptionalUuid(event.principal_id, `task.events[${index}].principal_id`);
    requireOptionalUuid(event.operator_id, `task.events[${index}].operator_id`);
    if (event.from_status !== null) {
      requireTaskStatus(event.from_status, `task.events[${index}].from_status`);
    }
    if (event.to_status !== null) {
      requireTaskStatus(event.to_status, `task.events[${index}].to_status`);
    }
    requireString(event.reason_code, `task.events[${index}].reason_code`);
    requireSha256(event.payload_sha256, `task.events[${index}].payload_sha256`);
    requireUtcTimestamp(event.created_at, `task.events[${index}].created_at`);
    return event;
  });
}

export function assertTaskDetailEnvelope(
  value,
  expectedTenantId,
  expectedTaskId = null
) {
  const envelope = assertBackendReadEnvelope(value, ["task"], "task_detail");
  const rawTask = requireExactKeys(
    envelope.task,
    [
      ...TASK_PROJECTION_KEYS,
      "package_manifest",
      "approvals",
      "artifacts_truncated",
      "artifacts",
      "receipt_summary",
      "events_truncated",
      "events",
      "summary_limit",
      "allowed_actions",
      "allowed_actions_authoritative",
      "commands_revalidate",
    ],
    "task"
  );
  const projection = Object.fromEntries(
    TASK_PROJECTION_KEYS.map((key) => [key, rawTask[key]])
  );
  const task = assertTaskProjection(projection, expectedTenantId);
  if (
    expectedTaskId !== null &&
    requireUuid(task.task_id, "task.task_id") !==
      requireUuid(expectedTaskId, "expected_task_id")
  ) {
    contractError("a1s.task_mismatch", "El detalle pertenece a otra tarea");
  }
  if (
    rawTask.allowed_actions_authoritative !== false ||
    rawTask.commands_revalidate !== true ||
    !Array.isArray(rawTask.allowed_actions)
  ) {
    contractError(
      "a1s.invalid_action_hints",
      "Las ayudas de acciones no respetan la autoridad backend"
    );
  }
  requireEnumArray(
    rawTask.allowed_actions,
    "task.allowed_actions",
    DETAIL_ACTION_HINT_SET
  );
  const packageManifest = assertSyntheticPackageManifest(
    rawTask.package_manifest,
    task
  );
  const approvals = assertApprovalSummaries(rawTask.approvals);
  const artifacts = assertArtifactSummaries(rawTask.artifacts);
  const receiptSummary = assertReceiptSummary(rawTask.receipt_summary);
  const events = assertEventSummaries(rawTask.events);
  requireBoolean(rawTask.artifacts_truncated, "task.artifacts_truncated");
  requireBoolean(rawTask.events_truncated, "task.events_truncated");
  const summaryLimit = requirePositiveInteger(
    rawTask.summary_limit,
    "task.summary_limit"
  );
  if (artifacts.length > summaryLimit || events.length > summaryLimit) {
    contractError(
      "a1s.summary_limit_inconsistent",
      "Los resumenes de detalle superan summary_limit"
    );
  }
  return {
    ...envelope,
    task: {
      ...task,
      package_manifest: packageManifest,
      approvals,
      artifacts_truncated: rawTask.artifacts_truncated,
      artifacts,
      receipt_summary: receiptSummary,
      events_truncated: rawTask.events_truncated,
      events,
      summary_limit: summaryLimit,
      allowed_actions: [],
      allowed_actions_authoritative: false,
      commands_revalidate: true,
    },
  };
}

export function assertReceiptOptionsEnvelope(
  value,
  expectedTenantId,
  expectedTaskId
) {
  const envelope = assertBackendReadEnvelope(
    value,
    [
      "tenant_id",
      "task_id",
      "options",
      "options_limit",
      "options_truncated",
      "read_only",
    ],
    "receipt_options"
  );
  if (
    requireUuid(envelope.tenant_id, "tenant_id") !==
    requireUuid(expectedTenantId, "expected_tenant_id")
  ) {
    contractError(
      "a1s.tenant_mismatch",
      "Las opciones de recibo pertenecen a otro tenant"
    );
  }
  if (
    requireUuid(envelope.task_id, "task_id") !==
    requireUuid(expectedTaskId, "expected_task_id")
  ) {
    contractError(
      "a1s.task_mismatch",
      "Las opciones de recibo pertenecen a otra tarea"
    );
  }
  if (envelope.read_only !== true || !Array.isArray(envelope.options)) {
    contractError(
      "a1s.invalid_receipt_options",
      "Las opciones de recibo no son read_only"
    );
  }
  const options = envelope.options.map((item, index) => {
    const option = requireExactKeys(
      item,
      ["document_id", "document_sha256", "kind", "media_type", "size_bytes"],
      `options[${index}]`
    );
    requireUuid(option.document_id, `options[${index}].document_id`);
    requireSha256(
      option.document_sha256,
      `options[${index}].document_sha256`
    );
    if (option.kind !== "rtm_connect_a1s_synthetic_receipt_fixture") {
      contractError(
        "a1s.receipt_kind_invalid",
        `options[${index}].kind no es fixture sintetico A1-S`
      );
    }
    if (option.media_type !== "application/json") {
      contractError(
        "a1s.receipt_media_type_invalid",
        `options[${index}].media_type no es JSON`
      );
    }
    if (
      !Number.isInteger(option.size_bytes) ||
      option.size_bytes < 1 ||
      option.size_bytes > 65536
    ) {
      contractError(
        "a1s.receipt_size_invalid",
        `options[${index}].size_bytes queda fuera del contrato`
      );
    }
    return option;
  });
  requirePositiveInteger(envelope.options_limit, "options_limit");
  requireBoolean(envelope.options_truncated, "options_truncated");
  if (options.length > envelope.options_limit) {
    contractError(
      "a1s.options_limit_inconsistent",
      "options supera options_limit"
    );
  }
  return { ...envelope, options };
}

export function assertOperatorAuthStatusEnvelope(value) {
  const envelope = requireExactKeys(
    value,
    [
      "ok",
      "version",
      "individual_login_enabled",
      "configuration_valid",
      "staging_only",
      "legacy_login_unchanged",
      "operator_creation_available",
    ],
    "auth_status"
  );
  if (
    envelope.ok !== true ||
    envelope.staging_only !== true ||
    envelope.operator_creation_available !== false
  ) {
    contractError(
      "a1s.operator_auth_boundary_invalid",
      "La autenticacion individual no confirma frontera staging"
    );
  }
  requireBoolean(
    envelope.individual_login_enabled,
    "individual_login_enabled"
  );
  requireBoolean(envelope.configuration_valid, "configuration_valid");
  requireString(envelope.version, "version");
  if (envelope.legacy_login_unchanged !== true) {
    contractError(
      "a1s.operator_auth_boundary_invalid",
      "La autenticacion individual altera el login legado"
    );
  }
  if (
    envelope.individual_login_enabled !== true ||
    envelope.configuration_valid !== true
  ) {
    contractError(
      "a1s.operator_auth_unavailable",
      "La autenticacion individual A1-S no esta operativa"
    );
  }
  return envelope;
}

export function assertOperatorMeEnvelope(value) {
  const envelope = requireExactKeys(
    value,
    ["ok", "session_id", "operator", "expires_at", "absolute_expires_at"],
    "operator_me"
  );
  if (envelope.ok !== true) {
    contractError("a1s.operator_session_invalid", "Sesion individual no valida");
  }
  requireUuid(envelope.session_id, "session_id");
  requireUtcTimestamp(envelope.expires_at, "expires_at");
  requireUtcTimestamp(envelope.absolute_expires_at, "absolute_expires_at");
  const operator = requireExactKeys(
    envelope.operator,
    [
      "id",
      "email",
      "display_name",
      "role_code",
      "permissions",
      "must_change_password",
      "mfa_required",
    ],
    "operator"
  );
  requireUuid(operator.id, "operator.id");
  requireString(operator.email, "operator.email");
  requireString(operator.display_name, "operator.display_name");
  if (operator.role_code !== null && operator.role_code !== undefined) {
    requireString(operator.role_code, "operator.role_code");
  }
  if (
    operator.must_change_password !== false ||
    operator.mfa_required !== false
  ) {
    contractError(
      "a1s.operator_session_not_operational",
      "La sesion individual no puede operar A1-S"
    );
  }
  requireStringArray(operator.permissions, "operator.permissions");
  if (operator.permissions.length > 64) {
    contractError(
      "a1s.operator_permissions_invalid",
      "La sesion declara demasiados permisos"
    );
  }
  return {
    ok: true,
    session_id: requireUuid(envelope.session_id, "session_id"),
    operator: {
      id: requireUuid(operator.id, "operator.id"),
      display_name: operator.display_name,
      role_code: operator.role_code ?? null,
      must_change_password: false,
      mfa_required: false,
    },
    expires_at: envelope.expires_at,
    absolute_expires_at: envelope.absolute_expires_at,
  };
}
