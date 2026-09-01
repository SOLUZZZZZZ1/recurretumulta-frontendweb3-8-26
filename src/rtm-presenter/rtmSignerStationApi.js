import { evaluateRtmPresenterBoundary } from "./rtmPresenterModel.js";

export const RTM_SIGNER_STATION_API_VERSION = "rtm.signer.station.api.client.v1";
export const RTM_SIGNER_STATION_API_PREFIX = "/api/ops/presenter/signer";
export const RTM_LOCAL_STATION_CONTRACT_VERSION = "rtm_presenter_local_station_v1_0";
export const RTM_SIGNER_WORKSPACE_CONTRACT_VERSION =
  "rtm_presenter_signer_workspace_v1_0";
export const RTM_WORKSPACE_RECOVERY_CONTRACT_VERSION =
  "rtm_presenter_workspace_recovery_v1_0";
export const RTM_LOCAL_STATION_DESCRIPTOR_VERSION =
  "rtm.local.signer.station.descriptor.v1";

const MAX_JSON_CHARACTERS = 1_000_000;
const MAX_DESCRIPTOR_CHARACTERS = 16_384;
const EXACT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CLIENT_VERSION_PATTERN =
  /^[0-9]+[.][0-9]+[.][0-9]+(?:[-+][A-Za-z0-9.-]+)?$/;
const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{15,127}$/;
const CODE_PATTERN = /^[a-z][a-z0-9._-]{1,127}$/;
const MEDIA_TYPE_PATTERN =
  /^[a-z0-9][a-z0-9.+-]*\/[a-z0-9][a-z0-9.+-]{0,126}$/;
const ISO_TIMESTAMP_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;
const RECOVERY_STATUSES = new Set([
  "current_session",
  "adoptable",
  "adoptable_supersession",
  "blocked_active_claim",
  "blocked_session_rollback",
]);
const RECOVERY_ITEM_KEYS = new Set([
  "workspace_id",
  "delivery_id",
  "case_id",
  "package_id",
  "claim_id",
  "state",
  "attempt_number",
  "updated_at",
  "destination_display_name",
  "document_count",
  "task_fingerprint_sha256",
  "recovery_status",
  "adoption_available",
  "rtm_draft_persisted",
  "reg_draft_persisted",
  "browser_storage_required",
  "document_bytes_available",
  "external_effects_executed",
  "active_claim_expires_at",
]);
const INSTALLATION_KEYS = new Set([
  "installation_id",
  "operator_id",
  "operator_device_id",
  "client_instance_id",
  "client_binding_sha256",
  "station_label",
  "platform",
  "client_version",
  "status",
  "registered_at",
]);
const WORKSPACE_KEYS = new Set([
  "workspace_contract_version",
  "workspace_id",
  "state",
  "attempt_number",
  "updated_at",
  "replayed",
  "claim_id",
  "claim_expires_at",
  "installation",
  "task",
  "rtm_draft_persisted",
  "reg_draft_persisted",
  "reg_session_recovery_available",
  "reg_session_expired",
  "managed_attestation_verified",
  "local_activation_available",
  "browser_open_available",
  "document_bytes_available",
  "certificate_stored_by_rtm",
  "signature_automated",
  "final_submit_automated",
  "external_effects_executed",
  "next_action",
  "recovery_adopted",
  "recovered_from",
]);
const REQUIRED_WORKSPACE_KEYS = new Set(
  [...WORKSPACE_KEYS].filter((key) => key !== "recovered_from")
);
const SIGNER_TASK_KEYS = new Set([
  "delivery_id",
  "case_id",
  "package_id",
  "package_manifest_sha256",
  "destination_profile_id",
  "destination_profile_code",
  "destination_profile_version",
  "destination_profile_sha256",
  "prepared_by_operator_id",
  "prepared_at",
  "destination_display_name",
  "portal_origin",
  "representation_mode",
  "portal_preparation",
  "items",
  "document_count",
  "task_fingerprint_sha256",
]);
const PORTAL_PREPARATION_KEYS = new Set(["form_code", "fields"]);
const PORTAL_FIELD_KEYS = new Set([
  "field_code",
  "label",
  "required",
  "multiline",
  "max_length",
  "step_order",
  "value",
]);
const TASK_ITEM_KEYS = new Set([
  "package_item_id",
  "document_version_id",
  "document_sha256",
  "item_order",
  "field_code",
  "portal_filename",
  "media_type",
  "size_bytes",
]);
const RECOVERY_COLLECTION_KEYS = new Set([
  "recovery_contract_version",
  "installation_id",
  "items",
  "item_count",
  "metadata_only",
  "browser_storage_required",
  "document_bytes_available",
  "cookie_material_available",
  "certificate_material_available",
  "external_effects_executed",
]);
const RECOVERY_ENVELOPE_BASE_KEYS = [
  "ok",
  "request_id",
  "storage_references_exposed",
  "document_bytes_exposed",
  "cookie_material_exposed",
  "certificate_material_exposed",
  "synthetic_only",
];
const RECOVERY_DISCOVERY_ENVELOPE_KEYS = new Set([
  ...RECOVERY_ENVELOPE_BASE_KEYS,
  "workspace_recoveries",
]);
const RECOVERY_WORKSPACE_ENVELOPE_KEYS = new Set([
  ...RECOVERY_ENVELOPE_BASE_KEYS,
  "workspace",
]);
const RECOVERED_FROM_KEYS = new Set([
  "workspace_id",
  "claim_id",
  "attempt_number",
]);
const FORBIDDEN_KEYS = new Set([
  "b2_bucket",
  "b2_key",
  "storage_key",
  "presigned_url",
  "password",
  "secret",
  "access_token",
  "refresh_token",
  "cookie",
  "certificate",
  "certificate_bytes",
  "document_content_base64",
  "document_content",
  "document_bytes",
  "file_bytes",
  "raw_bytes",
  "content_base64",
  "blob",
  "private_key",
  "raw_pairing_code",
  "station_token",
]);

export class RtmSignerStationApiError extends Error {
  constructor(
    code,
    message,
    status = null,
    requestId = null,
    retryable = null
  ) {
    super(message);
    this.name = "RtmSignerStationApiError";
    this.code = code;
    this.status = status;
    this.requestId = requestId;
    this.retryable = retryable;
  }
}

function fail(
  code,
  message,
  status = null,
  requestId = null,
  retryable = null
) {
  throw new RtmSignerStationApiError(
    code,
    message,
    status,
    requestId,
    retryable
  );
}

function hasExactKeys(value, allowed, required = allowed) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const keys = Object.keys(value);
  return (
    keys.every((key) => allowed.has(key)) &&
    [...required].every((key) => Object.hasOwn(value, key))
  );
}

function validTimestamp(value) {
  return (
    typeof value === "string" &&
    ISO_TIMESTAMP_PATTERN.test(value) &&
    !Number.isNaN(Date.parse(value))
  );
}

function canonicalJson(value) {
  if (value === null) return "null";
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  }
  if (typeof value === "string" || typeof value === "boolean") {
    return JSON.stringify(value);
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return JSON.stringify(value);
  }
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(",")}}`;
  }
  fail(
    "signer.task_fingerprint_unavailable",
    "La tarea contiene material que no puede canonizarse."
  );
}

async function canonicalTaskSha256(task) {
  const subtle = globalThis.crypto?.subtle;
  const Encoder = globalThis.TextEncoder;
  if (!subtle || typeof subtle.digest !== "function" || typeof Encoder !== "function") {
    fail(
      "signer.task_fingerprint_unavailable",
      "El navegador no puede verificar la huella criptográfica de la tarea."
    );
  }
  const material = Object.fromEntries(
    Object.entries(task).filter(([key]) => key !== "task_fingerprint_sha256")
  );
  let digest;
  try {
    digest = await subtle.digest(
      "SHA-256",
      new Encoder().encode(canonicalJson(material))
    );
  } catch {
    fail(
      "signer.task_fingerprint_unavailable",
      "No se pudo verificar la huella criptográfica de la tarea."
    );
  }
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

function exactUuid(value, field) {
  const exact = String(value || "").trim();
  if (!EXACT_UUID_PATTERN.test(exact)) {
    fail("signer.invalid_identifier", `${field} no es válido.`);
  }
  return exact.toLowerCase();
}

function safeUuid(value, field) {
  const exact = exactUuid(value, field);
  return encodeURIComponent(exact);
}

function requireHeaders(getAuthHeaders) {
  const value = getAuthHeaders?.() || {};
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail("signer.auth_headers_invalid", "La sesión de firmante no es válida.");
  }
  return { ...value };
}

function requestOptions(getAuthHeaders, options = {}) {
  return {
    ...options,
    headers: {
      Accept: "application/json",
      ...requireHeaders(getAuthHeaders),
      ...(options.headers || {}),
    },
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
    referrerPolicy: "same-origin",
  };
}

function assertNoRestrictedMaterial(value) {
  const pending = [value];
  while (pending.length) {
    const current = pending.pop();
    if (!current || typeof current !== "object") continue;
    if (Array.isArray(current)) {
      pending.push(...current);
      continue;
    }
    for (const [key, child] of Object.entries(current)) {
      if (FORBIDDEN_KEYS.has(key.toLowerCase())) {
        fail(
          "signer.response_boundary_invalid",
          "La respuesta intentó exponer material fuera del puesto local."
        );
      }
      pending.push(child);
    }
  }
}

async function readJson(response) {
  const declared = Number(response?.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > MAX_JSON_CHARACTERS) {
    fail("signer.response_too_large", "La respuesta es demasiado grande.");
  }
  const text = await response.text().catch(() => "");
  if (text.length > MAX_JSON_CHARACTERS) {
    fail("signer.response_too_large", "La respuesta es demasiado grande.");
  }
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    fail(
      "signer.response_not_json",
      "El puesto local recibió una respuesta no válida.",
      response.status
    );
  }
  if (!response.ok) {
    const remoteError = payload?.detail?.error || payload?.error;
    const detail =
      remoteError?.message ||
      payload?.detail?.message ||
      payload?.detail ||
      remoteError;
    const remoteCode =
      typeof remoteError?.code === "string" && remoteError.code.trim()
        ? remoteError.code.trim().slice(0, 120)
        : "signer.request_failed";
    const requestId =
      typeof payload?.detail?.request_id === "string"
        ? payload.detail.request_id.slice(0, 120)
        : typeof payload?.request_id === "string"
          ? payload.request_id.slice(0, 120)
          : null;
    const retryable =
      typeof remoteError?.retryable === "boolean"
        ? remoteError.retryable
        : null;
    fail(
      remoteCode,
      typeof detail === "string" && detail.trim()
        ? detail.slice(0, 320)
        : "No se pudo completar la operación del puesto local.",
      response.status,
      requestId,
      retryable
    );
  }
  assertNoRestrictedMaterial(payload);
  return payload;
}

function validateSafetyFlags(value, label) {
  if (
    !value ||
    typeof value !== "object" ||
    value.local_activation_available !== false ||
    value.certificate_stored_by_rtm !== false ||
    value.browser_session_shared !== false ||
    value.external_effects_executed !== false
  ) {
    fail(
      "signer.response_contract_invalid",
      `${label} no conserva la frontera local cerrada.`
    );
  }
  return value;
}

function validateMetadataOnlyEnvelope(value, label) {
  if (
    !value ||
    typeof value !== "object" ||
    value.storage_references_exposed !== false ||
    value.document_bytes_exposed !== false ||
    value.synthetic_only !== true
  ) {
    fail(
      "signer.response_envelope_invalid",
      `${label} no conserva el sobre sintético y solo de metadatos.`
    );
  }
  return value;
}

function validateRecoveryEnvelope(value, label, allowedKeys) {
  validateMetadataOnlyEnvelope(value, label);
  if (
    value.ok !== true ||
    !hasExactKeys(
      value,
      allowedKeys,
      new Set([...allowedKeys].filter((key) => key !== "request_id"))
    ) ||
    value.cookie_material_exposed !== false ||
    value.certificate_material_exposed !== false
  ) {
    fail(
      "signer.workspace_recovery_envelope_invalid",
      `${label} intentó ampliar el sobre de recuperación.`
    );
  }
  return value;
}

function validateInstallationPayload(value, label = "El puesto local") {
  if (
    !value ||
    typeof value !== "object" ||
    value.station_contract_version !== RTM_LOCAL_STATION_CONTRACT_VERSION ||
    value.candidate_registered !== true ||
    value.managed_attestation_verified !== false ||
    value.local_activation_available !== false ||
    value.browser_open_available !== false ||
    value.document_bytes_available !== false ||
    value.certificate_stored_by_rtm !== false ||
    value.certificate_secret_allowed !== false ||
    value.signature_automated !== false ||
    value.final_submit_automated !== false ||
    value.external_effects_executed !== false
  ) {
    fail(
      "signer.installation_contract_invalid",
      `${label} no conserva la frontera candidata y cerrada.`
    );
  }
  const installation = value.installation;
  if (
    !hasExactKeys(installation, INSTALLATION_KEYS) ||
    installation.platform !== "windows" ||
    installation.status !== "candidate" ||
    !SHA256_PATTERN.test(String(installation.client_binding_sha256 || "")) ||
    !CLIENT_VERSION_PATTERN.test(String(installation.client_version || "")) ||
    String(installation.client_version || "").length > 48 ||
    String(installation.station_label || "").trim().length < 3 ||
    String(installation.station_label || "").trim().length > 80 ||
    /[\u0000-\u001f]/.test(String(installation.station_label || "")) ||
    !validTimestamp(installation.registered_at)
  ) {
    fail(
      "signer.installation_contract_invalid",
      `${label} devolvió una identidad local no válida.`
    );
  }
  exactUuid(installation.installation_id, "installationId");
  exactUuid(installation.operator_id, "operatorId");
  exactUuid(installation.operator_device_id, "operatorDeviceId");
  exactUuid(installation.client_instance_id, "clientInstanceId");
  return value;
}

async function validateSignerTaskPayload(task, label = "La tarea") {
  if (!hasExactKeys(task, SIGNER_TASK_KEYS)) {
    fail(
      "signer.task_contract_invalid",
      `${label} contiene campos inesperados o incompletos.`
    );
  }
  for (const [field, value] of [
    ["deliveryId", task.delivery_id],
    ["caseId", task.case_id],
    ["packageId", task.package_id],
    ["destinationProfileId", task.destination_profile_id],
    ["preparedByOperatorId", task.prepared_by_operator_id],
  ]) {
    exactUuid(value, field);
  }
  if (
    !SHA256_PATTERN.test(String(task.package_manifest_sha256 || "")) ||
    !SHA256_PATTERN.test(String(task.destination_profile_sha256 || "")) ||
    !SHA256_PATTERN.test(String(task.task_fingerprint_sha256 || "")) ||
    !CODE_PATTERN.test(String(task.destination_profile_code || "")) ||
    !Number.isInteger(task.destination_profile_version) ||
    task.destination_profile_version < 1 ||
    !validTimestamp(task.prepared_at) ||
    typeof task.destination_display_name !== "string" ||
    task.destination_display_name.trim().length < 2 ||
    task.destination_display_name.length > 240 ||
    !["self", "representative"].includes(task.representation_mode) ||
    !Number.isInteger(task.document_count) ||
    task.document_count < 1 ||
    !Array.isArray(task.items) ||
    task.items.length !== task.document_count ||
    task.items.length > 32
  ) {
    fail(
      "signer.task_contract_invalid",
      `${label} no conserva los identificadores y metadatos exactos.`
    );
  }
  try {
    const origin = new URL(task.portal_origin);
    if (
      origin.protocol !== "https:" ||
      origin.username ||
      origin.password ||
      origin.origin !== task.portal_origin
    ) {
      throw new Error("origin");
    }
  } catch {
    fail(
      "signer.task_contract_invalid",
      `${label} devolvió un origen de sede no válido.`
    );
  }

  const preparation = task.portal_preparation;
  if (
    !hasExactKeys(preparation, PORTAL_PREPARATION_KEYS) ||
    !CODE_PATTERN.test(String(preparation.form_code || "")) ||
    !Array.isArray(preparation.fields) ||
    preparation.fields.length < 1 ||
    preparation.fields.length > 32
  ) {
    fail(
      "signer.task_contract_invalid",
      `${label} devolvió una hoja de sede no válida.`
    );
  }
  const fieldCodes = new Set();
  preparation.fields.forEach((field, index) => {
    if (
      !hasExactKeys(field, PORTAL_FIELD_KEYS) ||
      !CODE_PATTERN.test(String(field.field_code || "")) ||
      fieldCodes.has(field.field_code) ||
      typeof field.label !== "string" ||
      field.label.trim().length < 2 ||
      field.label.length > 120 ||
      typeof field.required !== "boolean" ||
      typeof field.multiline !== "boolean" ||
      !Number.isInteger(field.max_length) ||
      field.max_length < 1 ||
      field.max_length > 12_000 ||
      field.step_order !== index + 1 ||
      typeof field.value !== "string" ||
      field.value.length > field.max_length ||
      (field.required && !field.value.trim()) ||
      (!field.multiline && field.value.includes("\n")) ||
      /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(field.value)
    ) {
      fail(
        "signer.task_contract_invalid",
        `${label} devolvió un campo de sede no verificable.`
      );
    }
    fieldCodes.add(field.field_code);
  });

  const versionIds = new Set();
  task.items.forEach((item, index) => {
    if (!hasExactKeys(item, TASK_ITEM_KEYS)) {
      fail(
        "signer.task_contract_invalid",
        `${label} devolvió metadatos documentales expandidos.`
      );
    }
    exactUuid(item.package_item_id, "packageItemId");
    const versionId = exactUuid(item.document_version_id, "documentVersionId");
    if (
      versionIds.has(versionId) ||
      !SHA256_PATTERN.test(String(item.document_sha256 || "")) ||
      item.item_order !== index + 1 ||
      !CODE_PATTERN.test(String(item.field_code || "")) ||
      typeof item.portal_filename !== "string" ||
      !item.portal_filename ||
      item.portal_filename.length > 180 ||
      /[\\/\u0000-\u001f]/.test(item.portal_filename) ||
      !MEDIA_TYPE_PATTERN.test(String(item.media_type || "")) ||
      !Number.isInteger(item.size_bytes) ||
      item.size_bytes < 1 ||
      item.size_bytes > 25 * 1024 * 1024
    ) {
      fail(
        "signer.task_contract_invalid",
        `${label} devolvió un documento no verificable.`
      );
    }
    versionIds.add(versionId);
  });
  if ((await canonicalTaskSha256(task)) !== task.task_fingerprint_sha256) {
    fail(
      "signer.task_fingerprint_mismatch",
      `${label} no coincide con su huella criptográfica.`
    );
  }
  return task;
}

async function validateWorkspacePayload(value, label = "La tarea recuperable") {
  if (
    !hasExactKeys(value, WORKSPACE_KEYS, REQUIRED_WORKSPACE_KEYS) ||
    value.workspace_contract_version !== RTM_SIGNER_WORKSPACE_CONTRACT_VERSION ||
    !["ready", "reg_session_expired"].includes(value.state) ||
    !Number.isInteger(value.attempt_number) ||
    value.attempt_number < 1 ||
    value.rtm_draft_persisted !== true ||
    value.reg_draft_persisted !== false ||
    value.reg_session_recovery_available !== true ||
    value.managed_attestation_verified !== false ||
    value.local_activation_available !== false ||
    value.browser_open_available !== false ||
    value.document_bytes_available !== false ||
    value.certificate_stored_by_rtm !== false ||
    value.signature_automated !== false ||
    value.final_submit_automated !== false ||
    value.external_effects_executed !== false ||
    typeof value.replayed !== "boolean" ||
    typeof value.recovery_adopted !== "boolean" ||
    !validTimestamp(value.updated_at) ||
    !validTimestamp(value.claim_expires_at) ||
    value.next_action !==
      (value.state === "reg_session_expired"
        ? "reauthenticate_reg_then_resume_from_rtm"
        : "authenticate_reg_manually_when_local_bridge_is_authorized")
  ) {
    fail(
      "signer.workspace_contract_invalid",
      `${label} no conserva el borrador RTM y la frontera cerrada.`
    );
  }
  if (
    value.reg_session_expired !== (value.state === "reg_session_expired") ||
    !value.task ||
    typeof value.task !== "object" ||
    !SHA256_PATTERN.test(String(value.task.task_fingerprint_sha256 || ""))
  ) {
    fail(
      "signer.workspace_contract_invalid",
      `${label} devolvió un estado de recuperación incoherente.`
    );
  }
  exactUuid(value.workspace_id, "workspaceId");
  exactUuid(value.claim_id, "claimId");
  await validateSignerTaskPayload(value.task, label);
  validateInstallationPayload(
    {
      station_contract_version: RTM_LOCAL_STATION_CONTRACT_VERSION,
      installation: value.installation,
      candidate_registered: true,
      managed_attestation_verified: false,
      local_activation_available: false,
      browser_open_available: false,
      document_bytes_available: false,
      certificate_stored_by_rtm: false,
      certificate_secret_allowed: false,
      signature_automated: false,
      final_submit_automated: false,
      external_effects_executed: false,
    },
    label
  );
  const hasRecoveredFrom = Object.hasOwn(value, "recovered_from");
  if (hasRecoveredFrom !== value.recovery_adopted) {
    fail(
      "signer.workspace_contract_invalid",
      `${label} devolvió un linaje de recuperación incoherente.`
    );
  }
  if (hasRecoveredFrom) {
    if (!hasExactKeys(value.recovered_from, RECOVERED_FROM_KEYS)) {
      fail(
        "signer.workspace_contract_invalid",
        `${label} expandió el linaje de recuperación.`
      );
    }
    const sourceWorkspaceId = exactUuid(
      value.recovered_from.workspace_id,
      "sourceWorkspaceId"
    );
    const sourceClaimId = exactUuid(
      value.recovered_from.claim_id,
      "sourceClaimId"
    );
    if (
      sourceWorkspaceId === value.workspace_id ||
      sourceClaimId === value.claim_id ||
      !Number.isInteger(value.recovered_from.attempt_number) ||
      value.recovered_from.attempt_number < 1 ||
      value.recovered_from.attempt_number >= value.attempt_number
    ) {
      fail(
        "signer.workspace_contract_invalid",
        `${label} devolvió un linaje de recuperación imposible.`
      );
    }
  }
  return value;
}

function validateWorkspaceRecoveryCollection(value) {
  if (
    !value ||
    typeof value !== "object" ||
    value.recovery_contract_version !==
      RTM_WORKSPACE_RECOVERY_CONTRACT_VERSION ||
    !hasExactKeys(value, RECOVERY_COLLECTION_KEYS) ||
    !Array.isArray(value.items) ||
    value.items.length > 50 ||
    value.item_count !== value.items.length ||
    value.metadata_only !== true ||
    value.browser_storage_required !== false ||
    value.document_bytes_available !== false ||
    value.cookie_material_available !== false ||
    value.certificate_material_available !== false ||
    value.external_effects_executed !== false
  ) {
    fail(
      "signer.workspace_recovery_contract_invalid",
      "La búsqueda recuperable no conserva el contrato durable y solo de metadatos."
    );
  }
  exactUuid(value.installation_id, "installationId");
  const workspaceIds = new Set();
  const deliveryIds = new Set();
  for (const item of value.items) {
    if (
      !item ||
      typeof item !== "object" ||
      Array.isArray(item) ||
      Object.keys(item).some((key) => !RECOVERY_ITEM_KEYS.has(key)) ||
      !["ready", "reg_session_expired"].includes(item.state) ||
      !Number.isInteger(item.attempt_number) ||
      item.attempt_number < 1 ||
      !Number.isInteger(item.document_count) ||
      item.document_count < 1 ||
      !validTimestamp(item.updated_at) ||
      typeof item.destination_display_name !== "string" ||
      !item.destination_display_name.trim() ||
      item.destination_display_name.length > 240 ||
      !SHA256_PATTERN.test(String(item.task_fingerprint_sha256 || "")) ||
      !RECOVERY_STATUSES.has(item.recovery_status) ||
      item.adoption_available !==
        ["adoptable", "adoptable_supersession"].includes(
          item.recovery_status
        ) ||
      item.rtm_draft_persisted !== true ||
      item.reg_draft_persisted !== false ||
      item.browser_storage_required !== false ||
      item.document_bytes_available !== false ||
      item.external_effects_executed !== false ||
      (Object.hasOwn(item, "active_claim_expires_at") &&
        !validTimestamp(item.active_claim_expires_at))
    ) {
      fail(
        "signer.workspace_recovery_item_invalid",
        "La búsqueda devolvió un borrador recuperable no verificable."
      );
    }
    const workspaceId = exactUuid(item.workspace_id, "workspaceId");
    const deliveryId = exactUuid(item.delivery_id, "deliveryId");
    exactUuid(item.case_id, "caseId");
    exactUuid(item.package_id, "packageId");
    exactUuid(item.claim_id, "claimId");
    if (workspaceIds.has(workspaceId) || deliveryIds.has(deliveryId)) {
      fail(
        "signer.workspace_recovery_item_invalid",
        "La búsqueda devolvió borradores recuperables duplicados."
      );
    }
    workspaceIds.add(workspaceId);
    deliveryIds.add(deliveryId);
  }
  return value;
}

export function parseRtmSignerStationDescriptorText(rawText) {
  const text = String(rawText || "");
  if (!text || text.length > MAX_DESCRIPTOR_CHARACTERS) {
    fail(
      "signer.station_descriptor_too_large",
      "El descriptor del puesto no es válido o supera 16 KB."
    );
  }
  let value;
  try {
    value = JSON.parse(text);
  } catch {
    fail(
      "signer.station_descriptor_not_json",
      "El descriptor del puesto no contiene JSON válido."
    );
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(
      "signer.station_descriptor_invalid",
      "El descriptor del puesto no es válido."
    );
  }
  const exactKeys = new Set([
    "descriptor_version",
    "client_instance_id",
    "client_binding_sha256",
    "station_label",
    "platform",
    "client_version",
    "synthetic_only",
    "managed_attestation_verified",
    "certificate_material_present",
    "customer_data_present",
  ]);
  if (
    Object.keys(value).length !== exactKeys.size ||
    Object.keys(value).some((key) => !exactKeys.has(key))
  ) {
    fail(
      "signer.station_descriptor_fields_invalid",
      "El descriptor contiene campos inesperados o incompletos."
    );
  }
  const clientInstanceId = exactUuid(
    value.client_instance_id,
    "clientInstanceId"
  );
  const clientBindingSha256 = String(
    value.client_binding_sha256 || ""
  ).toLowerCase();
  const stationLabel = String(value.station_label || "")
    .trim()
    .replace(/\s+/g, " ");
  const platform = String(value.platform || "").toLowerCase();
  const clientVersion = String(value.client_version || "");
  if (
    value.descriptor_version !== RTM_LOCAL_STATION_DESCRIPTOR_VERSION ||
    !SHA256_PATTERN.test(clientBindingSha256) ||
    stationLabel.length < 3 ||
    stationLabel.length > 80 ||
    /[\u0000-\u001f]/.test(stationLabel) ||
    platform !== "windows" ||
    !CLIENT_VERSION_PATTERN.test(clientVersion) ||
    clientVersion.length > 48 ||
    value.synthetic_only !== true ||
    value.managed_attestation_verified !== false ||
    value.certificate_material_present !== false ||
    value.customer_data_present !== false
  ) {
    fail(
      "signer.station_descriptor_invalid",
      "El descriptor no acredita un candidato Windows sintético y cerrado."
    );
  }
  return Object.freeze({
    descriptorVersion: RTM_LOCAL_STATION_DESCRIPTOR_VERSION,
    clientInstanceId,
    clientBindingSha256,
    stationLabel,
    platform,
    clientVersion,
    syntheticOnly: true,
    managedAttestationVerified: false,
    certificateMaterialPresent: false,
    customerDataPresent: false,
  });
}

export function newSignerCommandKey(prefix = "signer-command") {
  const safePrefix = String(prefix || "signer-command")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, "-")
    .slice(0, 40);
  const random = globalThis.crypto?.randomUUID?.();
  if (!random) {
    fail(
      "signer.secure_random_unavailable",
      "El navegador no puede crear una orden idempotente segura."
    );
  }
  return `${safePrefix}-${random}`;
}

export function createRtmSignerStationClient({
  fetchImpl = globalThis.fetch?.bind(globalThis),
  getAuthHeaders = () => ({}),
  onUnauthorized = () => {},
  environment = "staging",
  syntheticOnly = true,
} = {}) {
  if (typeof fetchImpl !== "function") {
    fail("signer.fetch_required", "No hay transporte seguro disponible.");
  }
  const boundary = evaluateRtmPresenterBoundary({ environment, syntheticOnly });
  if (!boundary.allowed) {
    fail(
      "signer.boundary_blocked",
      "El puesto local solo está disponible en STAGING sintético."
    );
  }

  async function jsonRequest(path, options = {}) {
    let response;
    try {
      response = await fetchImpl(path, requestOptions(getAuthHeaders, options));
    } catch {
      if (options.signal?.aborted) {
        fail("signer.request_aborted", "Operación cancelada.");
      }
      fail("signer.transport_failed", "No se puede alcanzar el puesto local.");
    }
    if (response?.status === 401) {
      try {
        onUnauthorized();
      } catch {
        // La limpieza local no debe sustituir el error HTTP original.
      }
    }
    return readJson(response);
  }

  return Object.freeze({
    boundary,

    async loadQueue({ signal = null, limit = 50 } = {}) {
      if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
        fail("signer.queue_limit_invalid", "El límite de cola no es válido.");
      }
      const payload = await jsonRequest(
        `${RTM_SIGNER_STATION_API_PREFIX}/queue?limit=${limit}`,
        { method: "GET", signal }
      );
      validateSafetyFlags(payload?.station_queue, "La cola");
      return payload;
    },

    async claimTask(deliveryId, { signal = null, idempotencyKey = "" } = {}) {
      const id = safeUuid(deliveryId, "deliveryId");
      if (String(idempotencyKey).length < 16) {
        fail(
          "signer.idempotency_key_required",
          "La toma exige una clave idempotente válida."
        );
      }
      const payload = await jsonRequest(
        `${RTM_SIGNER_STATION_API_PREFIX}/tasks/${id}/claim`,
        {
          method: "POST",
          headers: { "Idempotency-Key": String(idempotencyKey) },
          signal,
        }
      );
      const claim = payload?.claim;
      if (
        !claim ||
        claim.local_activation_available !== false ||
        claim.browser_open_available !== false ||
        claim.certificate_stored_by_rtm !== false ||
        claim.browser_session_shared !== false ||
        claim.external_effects_executed !== false
      ) {
        fail(
          "signer.response_contract_invalid",
          "La toma no conserva la frontera local cerrada."
        );
      }
      await validateSignerTaskPayload(claim.task, "La toma");
      return payload;
    },

    async loadCurrentClaim(deliveryId, { signal = null } = {}) {
      const id = safeUuid(deliveryId, "deliveryId");
      const payload = await jsonRequest(
        `${RTM_SIGNER_STATION_API_PREFIX}/tasks/${id}/claim`,
        { method: "GET", signal }
      );
      const claim = payload?.claim;
      if (
        !claim ||
        claim.local_activation_available !== false ||
        claim.browser_open_available !== false ||
        claim.certificate_stored_by_rtm !== false ||
        claim.browser_session_shared !== false ||
        claim.external_effects_executed !== false
      ) {
        fail(
          "signer.response_contract_invalid",
          "La toma recuperada no conserva la frontera local cerrada."
        );
      }
      await validateSignerTaskPayload(claim.task, "La toma recuperada");
      return payload;
    },

    async releaseTask(
      deliveryId,
      claimId,
      { signal = null, idempotencyKey = "" } = {}
    ) {
      const delivery = safeUuid(deliveryId, "deliveryId");
      const claim = safeUuid(claimId, "claimId");
      if (String(idempotencyKey).length < 16) {
        fail(
          "signer.idempotency_key_required",
          "La liberación exige una clave idempotente válida."
        );
      }
      const payload = await jsonRequest(
        `${RTM_SIGNER_STATION_API_PREFIX}/tasks/${delivery}/claims/${claim}/release`,
        {
          method: "POST",
          headers: { "Idempotency-Key": String(idempotencyKey) },
          signal,
        }
      );
      if (payload?.release?.external_effects_executed !== false) {
        fail(
          "signer.response_contract_invalid",
          "La liberación devolvió un estado no permitido."
        );
      }
      return payload;
    },

    async registerInstallation(
      {
        clientInstanceId,
        clientBindingSha256,
        stationLabel,
        platform = "windows",
        clientVersion,
      },
      { signal = null } = {}
    ) {
      const instance = exactUuid(clientInstanceId, "clientInstanceId");
      const binding = String(clientBindingSha256 || "").trim().toLowerCase();
      const label = String(stationLabel || "").trim().replace(/\s+/g, " ");
      const version = String(clientVersion || "").trim();
      if (!SHA256_PATTERN.test(binding)) {
        fail("signer.binding_invalid", "La huella declarada del cliente no es válida.");
      }
      if (label.length < 3 || label.length > 80 || /[\u0000-\u001f]/.test(label)) {
        fail("signer.station_label_invalid", "El nombre del puesto no es válido.");
      }
      if (platform !== "windows") {
        fail("signer.platform_invalid", "Este corte solo admite el puesto Windows.");
      }
      if (!CLIENT_VERSION_PATTERN.test(version) || version.length > 48) {
        fail("signer.client_version_invalid", "La versión del cliente no es válida.");
      }
      const payload = await jsonRequest(`${RTM_SIGNER_STATION_API_PREFIX}/installations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_instance_id: instance,
          client_binding_sha256: binding,
          station_label: label,
          platform,
          client_version: version,
        }),
        signal,
      });
      validateMetadataOnlyEnvelope(payload, "El alta del puesto local");
      validateInstallationPayload(payload?.station);
      const registered = payload.station.installation;
      if (
        registered.client_instance_id !== instance ||
        registered.client_binding_sha256 !== binding ||
        registered.station_label !== label ||
        registered.platform !== platform ||
        registered.client_version !== version
      ) {
        fail(
          "signer.installation_binding_mismatch",
          "El alta devolvió otro candidato local."
        );
      }
      return payload;
    },

    async loadInstallation(installationId, { signal = null } = {}) {
      const installation = safeUuid(installationId, "installationId");
      const payload = await jsonRequest(
        `${RTM_SIGNER_STATION_API_PREFIX}/installations/${installation}`,
        { method: "GET", signal }
      );
      validateMetadataOnlyEnvelope(payload, "La consulta del puesto local");
      validateInstallationPayload(payload?.station);
      if (payload.station.installation.installation_id !== installation) {
        fail(
          "signer.installation_binding_mismatch",
          "La consulta devolvió otro candidato local."
        );
      }
      return payload;
    },

    async discoverWorkspaceRecoveries(
      installationId,
      { signal = null, limit = 20 } = {}
    ) {
      const installation = safeUuid(installationId, "installationId");
      if (!Number.isInteger(limit) || limit < 1 || limit > 50) {
        fail(
          "signer.workspace_recovery_limit_invalid",
          "El límite de recuperación no es válido."
        );
      }
      const payload = await jsonRequest(
        `${RTM_SIGNER_STATION_API_PREFIX}/installations/${installation}` +
          `/workspace-recoveries?limit=${limit}`,
        { method: "GET", signal }
      );
      validateRecoveryEnvelope(
        payload,
        "La búsqueda recuperable",
        RECOVERY_DISCOVERY_ENVELOPE_KEYS
      );
      validateWorkspaceRecoveryCollection(payload?.workspace_recoveries);
      if (payload.workspace_recoveries.installation_id !== installation) {
        fail(
          "signer.workspace_recovery_binding_mismatch",
          "La búsqueda recuperable pertenece a otro puesto local."
        );
      }
      return payload;
    },

    async recoverWorkspace(
      deliveryId,
      installationId,
      sourceWorkspaceId,
      expectedTaskFingerprintSha256,
      {
        sourceClaimId,
        sourceAttemptNumber,
        signal = null,
        idempotencyKey = "",
      } = {}
    ) {
      const delivery = safeUuid(deliveryId, "deliveryId");
      const installation = exactUuid(installationId, "installationId");
      const sourceWorkspace = exactUuid(sourceWorkspaceId, "sourceWorkspaceId");
      const sourceClaim = exactUuid(sourceClaimId, "sourceClaimId");
      if (!Number.isInteger(sourceAttemptNumber) || sourceAttemptNumber < 1) {
        fail(
          "signer.workspace_recovery_attempt_invalid",
          "La recuperación exige el intento exacto del borrador de origen."
        );
      }
      const fingerprint = String(expectedTaskFingerprintSha256 || "")
        .trim()
        .toLowerCase();
      if (!SHA256_PATTERN.test(fingerprint)) {
        fail(
          "signer.workspace_recovery_fingerprint_invalid",
          "La recuperación exige la huella exacta de la tarea."
        );
      }
      if (!IDEMPOTENCY_KEY_PATTERN.test(String(idempotencyKey))) {
        fail(
          "signer.idempotency_key_required",
          "La adopción recuperable exige una clave válida."
        );
      }
      const payload = await jsonRequest(
        `${RTM_SIGNER_STATION_API_PREFIX}/tasks/${delivery}/workspace-recovery`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": String(idempotencyKey),
          },
          body: JSON.stringify({
            installation_id: installation,
            source_workspace_id: sourceWorkspace,
            expected_task_fingerprint_sha256: fingerprint,
          }),
          signal,
        }
      );
      validateRecoveryEnvelope(
        payload,
        "La adopción recuperable",
        RECOVERY_WORKSPACE_ENVELOPE_KEYS
      );
      await validateWorkspacePayload(payload?.workspace);
      validateWorkspaceBinding(payload.workspace, {
        deliveryId: delivery,
        claimId: payload.workspace.claim_id,
        installationId: installation,
      });
      if (payload.workspace.task.task_fingerprint_sha256 !== fingerprint) {
        fail(
          "signer.workspace_recovery_binding_mismatch",
          "La recuperación devolvió otra huella de tarea."
        );
      }
      const sameWorkspace = payload.workspace.workspace_id === sourceWorkspace;
      const recoveredFrom = payload.workspace.recovered_from;
      const recoveryAdopted = payload.workspace.recovery_adopted;
      if (
        typeof recoveryAdopted !== "boolean" ||
        (!sameWorkspace && recoveryAdopted !== true) ||
        (recoveryAdopted === false && recoveredFrom !== undefined) ||
        (sameWorkspace &&
          (payload.workspace.claim_id !== sourceClaim ||
            payload.workspace.attempt_number !== sourceAttemptNumber)) ||
        (recoveryAdopted === true &&
          (!recoveredFrom ||
            !Number.isInteger(recoveredFrom.attempt_number) ||
            recoveredFrom.attempt_number < 1 ||
            recoveredFrom.attempt_number >= payload.workspace.attempt_number ||
            (!sameWorkspace &&
              (recoveredFrom.workspace_id !== sourceWorkspace ||
                recoveredFrom.claim_id !== sourceClaim ||
                recoveredFrom.attempt_number !== sourceAttemptNumber ||
                payload.workspace.attempt_number !== sourceAttemptNumber + 1))))
      ) {
        fail(
          "signer.workspace_recovery_binding_mismatch",
          "La recuperación no acredita el borrador de origen solicitado."
        );
      }
      return payload;
    },

    async prepareWorkspace(
      deliveryId,
      claimId,
      installationId,
      { signal = null, idempotencyKey = "" } = {}
    ) {
      const delivery = safeUuid(deliveryId, "deliveryId");
      const claim = safeUuid(claimId, "claimId");
      const installation = exactUuid(installationId, "installationId");
      if (String(idempotencyKey).length < 16) {
        fail("signer.idempotency_key_required", "La preparación exige una clave válida.");
      }
      const payload = await jsonRequest(
        `${RTM_SIGNER_STATION_API_PREFIX}/tasks/${delivery}/claims/${claim}/workspaces`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Idempotency-Key": String(idempotencyKey),
          },
          body: JSON.stringify({ installation_id: installation }),
          signal,
        }
      );
      validateMetadataOnlyEnvelope(payload, "La preparación recuperable");
      await validateWorkspacePayload(payload?.workspace);
      validateWorkspaceBinding(payload.workspace, {
        deliveryId: delivery,
        claimId: claim,
        installationId: installation,
      });
      return payload;
    },

    async loadWorkspace(
      deliveryId,
      claimId,
      workspaceId,
      installationId,
      { signal = null } = {}
    ) {
      const delivery = safeUuid(deliveryId, "deliveryId");
      const claim = safeUuid(claimId, "claimId");
      const workspace = safeUuid(workspaceId, "workspaceId");
      const installation = safeUuid(installationId, "installationId");
      const payload = await jsonRequest(
        `${RTM_SIGNER_STATION_API_PREFIX}/tasks/${delivery}/claims/${claim}` +
          `/workspaces/${workspace}?installation_id=${installation}`,
        { method: "GET", signal }
      );
      validateMetadataOnlyEnvelope(payload, "La consulta recuperable");
      await validateWorkspacePayload(payload?.workspace);
      validateWorkspaceBinding(payload.workspace, {
        deliveryId: delivery,
        claimId: claim,
        workspaceId: workspace,
        installationId: installation,
      });
      return payload;
    },

    async markRegSessionExpired(
      deliveryId,
      claimId,
      workspaceId,
      installationId,
      { signal = null, idempotencyKey = "" } = {}
    ) {
      return transitionWorkspace("portal-session-expired", {
        deliveryId,
        claimId,
        workspaceId,
        installationId,
        signal,
        idempotencyKey,
      });
    },

    async resumeWorkspace(
      deliveryId,
      claimId,
      workspaceId,
      installationId,
      { signal = null, idempotencyKey = "" } = {}
    ) {
      return transitionWorkspace("resume", {
        deliveryId,
        claimId,
        workspaceId,
        installationId,
        signal,
        idempotencyKey,
      });
    },
  });

  async function transitionWorkspace(
    action,
    {
      deliveryId,
      claimId,
      workspaceId,
      installationId,
      signal,
      idempotencyKey,
    }
  ) {
    if (!["portal-session-expired", "resume"].includes(action)) {
      fail("signer.workspace_action_invalid", "La transición local no es válida.");
    }
    const delivery = safeUuid(deliveryId, "deliveryId");
    const claim = safeUuid(claimId, "claimId");
    const workspace = safeUuid(workspaceId, "workspaceId");
    const installation = exactUuid(installationId, "installationId");
    if (String(idempotencyKey).length < 16) {
      fail("signer.idempotency_key_required", "La recuperación exige una clave válida.");
    }
    const payload = await jsonRequest(
      `${RTM_SIGNER_STATION_API_PREFIX}/tasks/${delivery}/claims/${claim}` +
        `/workspaces/${workspace}/${action}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": String(idempotencyKey),
        },
        body: JSON.stringify({ installation_id: installation }),
        signal,
      }
    );
    validateMetadataOnlyEnvelope(payload, "La transición recuperable");
    await validateWorkspacePayload(payload?.workspace);
    validateWorkspaceBinding(payload.workspace, {
      deliveryId: delivery,
      claimId: claim,
      workspaceId: workspace,
      installationId: installation,
    });
    return payload;
  }

  function validateWorkspaceBinding(
    workspace,
    { deliveryId, claimId, workspaceId = "", installationId }
  ) {
    if (
      workspace.claim_id !== claimId ||
      workspace.task?.delivery_id !== deliveryId ||
      workspace.installation?.installation_id !== installationId ||
      (workspaceId && workspace.workspace_id !== workspaceId)
    ) {
      fail(
        "signer.workspace_binding_mismatch",
        "La respuesta recuperable no coincide con tarea, toma y puesto local."
      );
    }
  }
}
