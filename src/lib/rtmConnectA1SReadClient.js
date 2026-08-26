import {
  RTM_CONNECT_A1S_AUTH_PREFIX,
  RTM_CONNECT_A1S_READ_PREFIX,
  assertOperatorAuthStatusEnvelope,
  assertOperatorMeEnvelope,
  assertPreparationOptionsEnvelope,
  assertReceiptOptionsEnvelope,
  assertTaskDetailEnvelope,
  assertTaskListEnvelope,
  assertTenantContextEnvelope,
  assertTenantListEnvelope,
  evaluateA1SFrontendGate,
  requireTaskStatus,
  requireUuid,
} from "./rtmConnectA1SReadContract.js";

export const RTM_CONNECT_A1S_READ_CLIENT_VERSION =
  "rtm_connect_a1s_read_client_v1_0";

const BEARER_PATTERN = /^[A-Za-z0-9._~-]{32,2048}$/;
const MAX_RESPONSE_CHARACTERS = 2_000_000;
const UUID_ROUTE =
  "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const SAFE_ROUTE_PATTERN = new RegExp(
  "^/api/ops/(?:auth/(?:status|me)|connect/human-filings" +
    "(?:/(?:tenants|context|preparation-options|" +
    UUID_ROUTE +
    ")(?:/receipt-options)?)?)(?:\\?[A-Za-z0-9%._~=&-]+)?$",
  "i"
);

export class RtmConnectA1SReadError extends Error {
  constructor(code, message, status = null) {
    super(message);
    this.name = "RtmConnectA1SReadError";
    this.code = code;
    this.status = status;
  }
}

function fail(code, message, status = null) {
  throw new RtmConnectA1SReadError(code, message, status);
}

function requireFetch(fetchImpl) {
  if (typeof fetchImpl !== "function") {
    fail("a1s.fetch_required", "Se requiere transporte fetch inyectado");
  }
  return fetchImpl;
}

function requireBearer(value) {
  if (typeof value !== "string" || !BEARER_PATTERN.test(value)) {
    fail("a1s.bearer_invalid", "Sesion Bearer individual no valida");
  }
  return value;
}

function requireAbortSignal(value) {
  if (value === null || value === undefined) return null;
  if (
    typeof value !== "object" ||
    typeof value.aborted !== "boolean" ||
    typeof value.addEventListener !== "function"
  ) {
    fail("a1s.abort_signal_invalid", "AbortSignal A1-S no valido");
  }
  return value;
}

function normalizedHost(value) {
  return String(value || "")
    .trim()
    .replace(/\.$/, "")
    .toLowerCase();
}

function requireRuntimeGate(runtimeContext) {
  if (
    !runtimeContext ||
    typeof runtimeContext !== "object" ||
    Array.isArray(runtimeContext)
  ) {
    fail("a1s.runtime_context_required", "Contexto runtime A1-S requerido");
  }

  const browserLocation = globalThis.location;
  if (browserLocation && typeof browserLocation === "object") {
    if (
      normalizedHost(browserLocation.hostname) !==
        normalizedHost(runtimeContext.hostname) ||
      String(browserLocation.protocol || "") !==
        String(runtimeContext.protocol || "") ||
      String(browserLocation.port || "") !== String(runtimeContext.port || "")
    ) {
      fail(
        "a1s.runtime_location_mismatch",
        "El contexto A1-S no coincide con la ubicacion del navegador"
      );
    }
  }

  const gate = evaluateA1SFrontendGate(runtimeContext);
  if (!gate.allowed) {
    fail(
      "a1s.frontend_gate_blocked",
      `Gate A1-S bloqueado: ${gate.blockers.join(",")}`
    );
  }
  return gate;
}

function safePath(path) {
  if (
    typeof path !== "string" ||
    !SAFE_ROUTE_PATTERN.test(path) ||
    path.includes("..") ||
    path.includes("\\") ||
    path.startsWith("//") ||
    /^[a-z][a-z0-9+.-]*:/i.test(path)
  ) {
    fail("a1s.route_forbidden", "Ruta A1-S fuera de la allowlist");
  }
  return path;
}

function encodeQuery(values) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === "") continue;
    params.set(key, String(value));
  }
  const query = params.toString();
  return query ? `?${query}` : "";
}

function normalizedErrorDetail(payload) {
  const detail = payload?.error?.message ?? payload?.detail;
  if (typeof detail === "string" && detail.trim()) return detail;
  if (detail && typeof detail === "object" && !Array.isArray(detail)) {
    if (typeof detail.message === "string" && detail.message.trim()) {
      return detail.message;
    }
  }
  if (Array.isArray(detail)) {
    const messages = detail
      .slice(0, 8)
      .map((item) => {
        if (!item || typeof item !== "object") return null;
        const location = Array.isArray(item.loc) ? item.loc.join(".") : "";
        const message = typeof item.msg === "string" ? item.msg : "";
        return [location, message].filter(Boolean).join(": ");
      })
      .filter(Boolean);
    if (messages.length) return messages.join("; ");
  }
  return "No se pudo completar la lectura A1-S";
}

async function readJsonResponse(response) {
  if (
    !response ||
    typeof response !== "object" ||
    typeof response.ok !== "boolean" ||
    typeof response.status !== "number" ||
    typeof response.text !== "function"
  ) {
    fail("a1s.response_invalid", "Respuesta HTTP A1-S no valida");
  }
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (
    Number.isFinite(declaredLength) &&
    declaredLength > MAX_RESPONSE_CHARACTERS
  ) {
    fail(
      "a1s.response_too_large",
      "Respuesta A1-S supera el limite de lectura",
      response.status
    );
  }
  const text = await response.text().catch(() => "");
  if (text.length > MAX_RESPONSE_CHARACTERS) {
    fail(
      "a1s.response_too_large",
      "Respuesta A1-S supera el limite de lectura",
      response.status
    );
  }
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    fail("a1s.invalid_json", "El backend A1-S no devolvio JSON valido", response.status);
  }
  if (!response.ok) {
    const detail = normalizedErrorDetail(payload);
    const code =
      payload?.error?.code ||
      payload?.detail?.code ||
      "a1s.read_failed";
    fail(
      String(code).slice(0, 128),
      detail.slice(0, 320),
      response.status
    );
  }
  return payload;
}

async function readRequest(fetchImpl, path, token = null, signal = null) {
  const headers = { Accept: "application/json" };
  if (token !== null) {
    headers.Authorization = `Bearer ${requireBearer(token)}`;
  }
  const exactSignal = requireAbortSignal(signal);
  const requestOptions = {
    method: "GET",
    headers,
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
    referrerPolicy: "same-origin",
  };
  if (exactSignal !== null) requestOptions.signal = exactSignal;
  let response;
  try {
    response = await requireFetch(fetchImpl)(safePath(path), requestOptions);
  } catch {
    if (exactSignal?.aborted) {
      fail("a1s.request_aborted", "Lectura A1-S cancelada");
    }
    fail("a1s.transport_failed", "Transporte A1-S no disponible");
  }
  return readJsonResponse(response);
}

export function createRtmConnectA1SReadClient({
  fetchImpl,
  bearerToken,
  runtimeContext,
  signal = null,
}) {
  const gate = requireRuntimeGate(runtimeContext);
  const transport = requireFetch(fetchImpl);
  const token = requireBearer(bearerToken);
  const abortSignal = requireAbortSignal(signal);
  let validatedOperatorId = null;
  let discoveredTenantIds = new Set();

  function requireValidatedOperator() {
    if (validatedOperatorId === null) {
      fail(
        "a1s.operator_session_not_validated",
        "Debe validarse /auth/me antes de leer A1-S"
      );
    }
    return validatedOperatorId;
  }

  function requireDiscoveredTenant(tenantId) {
    requireValidatedOperator();
    if (!discoveredTenantIds.has(tenantId)) {
      fail(
        "a1s.tenant_not_discovered",
        "El tenant no procede del bootstrap de la sesion"
      );
    }
    return tenantId;
  }

  return Object.freeze({
    gate,
    async operatorMe() {
      const session = assertOperatorMeEnvelope(
        await readRequest(
          transport,
          `${RTM_CONNECT_A1S_AUTH_PREFIX}/me`,
          token,
          abortSignal
        )
      );
      validatedOperatorId = session.operator.id;
      discoveredTenantIds = new Set();
      return session;
    },

    async tenants() {
      const operatorId = requireValidatedOperator();
      const envelope = assertTenantListEnvelope(
        await readRequest(
          transport,
          `${RTM_CONNECT_A1S_READ_PREFIX}/tenants`,
          token,
          abortSignal
        ),
        operatorId
      );
      discoveredTenantIds = new Set(
        envelope.items.map((item) => requireUuid(item.tenant_id, "tenant_id"))
      );
      return envelope;
    },

    async tenantContext(tenantId) {
      const exactTenantId = requireUuid(tenantId, "tenant_id");
      requireDiscoveredTenant(exactTenantId);
      const path =
        `${RTM_CONNECT_A1S_READ_PREFIX}/context` +
        encodeQuery({ tenant_id: exactTenantId });
      return assertTenantContextEnvelope(
        await readRequest(transport, path, token, abortSignal),
        exactTenantId,
        validatedOperatorId
      );
    },

    async preparationOptions(tenantId) {
      const exactTenantId = requireUuid(tenantId, "tenant_id");
      requireDiscoveredTenant(exactTenantId);
      const path =
        `${RTM_CONNECT_A1S_READ_PREFIX}/preparation-options` +
        encodeQuery({ tenant_id: exactTenantId });
      return assertPreparationOptionsEnvelope(
        await readRequest(transport, path, token, abortSignal),
        exactTenantId
      );
    },

    async tasks(
      tenantId,
      { status = null, assigneeOperatorId = null, overdueOnly = false, limit = 50, offset = 0 } = {}
    ) {
      const exactTenantId = requireUuid(tenantId, "tenant_id");
      requireDiscoveredTenant(exactTenantId);
      const exactStatus = status === null ? null : requireTaskStatus(status);
      const exactAssignee =
        assigneeOperatorId === null
          ? null
          : requireUuid(assigneeOperatorId, "assignee_operator_id");
      if (typeof overdueOnly !== "boolean") {
        fail("a1s.overdue_only_invalid", "overdueOnly debe ser booleano");
      }
      if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
        fail("a1s.limit_invalid", "limit debe estar entre 1 y 200");
      }
      if (!Number.isInteger(offset) || offset < 0) {
        fail("a1s.offset_invalid", "offset debe ser entero no negativo");
      }
      const path =
        RTM_CONNECT_A1S_READ_PREFIX +
        encodeQuery({
          tenant_id: exactTenantId,
          status: exactStatus,
          assignee_operator_id: exactAssignee,
          overdue_only: overdueOnly ? "true" : "false",
          limit,
          offset,
        });
      return assertTaskListEnvelope(
        await readRequest(transport, path, token, abortSignal),
        exactTenantId
      );
    },

    async task(tenantId, taskId) {
      const exactTenantId = requireUuid(tenantId, "tenant_id");
      requireDiscoveredTenant(exactTenantId);
      const exactTaskId = requireUuid(taskId, "task_id");
      const path =
        `${RTM_CONNECT_A1S_READ_PREFIX}/${encodeURIComponent(exactTaskId)}` +
        encodeQuery({ tenant_id: exactTenantId });
      return assertTaskDetailEnvelope(
        await readRequest(transport, path, token, abortSignal),
        exactTenantId,
        exactTaskId
      );
    },

    async receiptOptions(tenantId, taskId) {
      const exactTenantId = requireUuid(tenantId, "tenant_id");
      requireDiscoveredTenant(exactTenantId);
      const exactTaskId = requireUuid(taskId, "task_id");
      const path =
        `${RTM_CONNECT_A1S_READ_PREFIX}/${encodeURIComponent(exactTaskId)}` +
        "/receipt-options" +
        encodeQuery({ tenant_id: exactTenantId });
      return assertReceiptOptionsEnvelope(
        await readRequest(transport, path, token, abortSignal),
        exactTenantId,
        exactTaskId
      );
    },
  });
}

export async function readRtmOperatorAuthStatus({
  fetchImpl,
  runtimeContext,
  signal = null,
}) {
  requireRuntimeGate(runtimeContext);
  return assertOperatorAuthStatusEnvelope(
    await readRequest(
      requireFetch(fetchImpl),
      `${RTM_CONNECT_A1S_AUTH_PREFIX}/status`,
      null,
      requireAbortSignal(signal)
    )
  );
}
