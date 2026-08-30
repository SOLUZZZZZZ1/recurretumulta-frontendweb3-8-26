import { evaluateRtmPresenterBoundary } from "./rtmPresenterModel.js";

export const RTM_SIGNER_STATION_API_VERSION = "rtm.signer.station.api.client.v1";
export const RTM_SIGNER_STATION_API_PREFIX = "/api/ops/presenter/signer";

const MAX_JSON_CHARACTERS = 1_000_000;
const EXACT_UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

function safeUuid(value, field) {
  const exact = String(value || "").trim();
  if (!EXACT_UUID_PATTERN.test(exact)) {
    fail("signer.invalid_identifier", `${field} no es válido.`);
  }
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
  });
}
