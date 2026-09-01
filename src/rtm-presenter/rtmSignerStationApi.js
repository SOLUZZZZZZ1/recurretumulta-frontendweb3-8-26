import { evaluateRtmPresenterBoundary } from "./rtmPresenterModel.js";

export const RTM_SIGNER_STATION_API_VERSION = "rtm.signer.station.api.client.v1";
export const RTM_SIGNER_STATION_API_PREFIX = "/api/ops/presenter/signer";
export const RTM_LOCAL_STATION_CONTRACT_VERSION = "rtm_presenter_local_station_v1_0";
export const RTM_SIGNER_WORKSPACE_CONTRACT_VERSION =
  "rtm_presenter_signer_workspace_v1_0";
export const RTM_LOCAL_STATION_DESCRIPTOR_VERSION =
  "rtm.local.signer.station.descriptor.v1";

const MAX_JSON_CHARACTERS = 1_000_000;
const MAX_DESCRIPTOR_CHARACTERS = 16_384;
const EXACT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CLIENT_VERSION_PATTERN =
  /^[0-9]+[.][0-9]+[.][0-9]+(?:[-+][A-Za-z0-9.-]+)?$/;
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
  "private_key",
  "raw_pairing_code",
  "station_token",
]);

export class RtmSignerStationApiError extends Error {
  constructor(code, message, status = null) {
    super(message);
    this.name = "RtmSignerStationApiError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, message, status = null) {
  throw new RtmSignerStationApiError(code, message, status);
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
    const detail =
      payload?.detail?.error?.message ||
      payload?.detail?.message ||
      payload?.detail ||
      payload?.error?.message;
    fail(
      "signer.request_failed",
      typeof detail === "string" && detail.trim()
        ? detail.slice(0, 320)
        : "No se pudo completar la operación del puesto local.",
      response.status
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
    !installation ||
    typeof installation !== "object" ||
    installation.platform !== "windows" ||
    installation.status !== "candidate" ||
    !SHA256_PATTERN.test(String(installation.client_binding_sha256 || "")) ||
    !CLIENT_VERSION_PATTERN.test(String(installation.client_version || "")) ||
    String(installation.client_version || "").length > 48 ||
    String(installation.station_label || "").trim().length < 3
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

function validateWorkspacePayload(value, label = "La tarea recuperable") {
  if (
    !value ||
    typeof value !== "object" ||
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
    value.external_effects_executed !== false
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
        claim.external_effects_executed !== false
      ) {
        fail(
          "signer.response_contract_invalid",
          "La toma recuperada no conserva la frontera local cerrada."
        );
      }
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
      validateWorkspacePayload(payload?.workspace);
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
      validateWorkspacePayload(payload?.workspace);
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
    validateWorkspacePayload(payload?.workspace);
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
