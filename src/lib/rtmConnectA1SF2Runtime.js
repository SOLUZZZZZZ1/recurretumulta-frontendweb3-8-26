import {
  createRtmConnectA1SReadClient,
  readRtmOperatorAuthStatus,
} from "./rtmConnectA1SReadClient.js";
import {
  RTM_CONNECT_A1S_BACKEND_COMMIT,
  RTM_CONNECT_A1S_BACKEND_CONTRACT_VERSION,
  RTM_CONNECT_A1S_BASE_COMMIT,
  RTM_CONNECT_A1S_STAGING_HOST,
} from "./rtmConnectA1SReadContract.js";
import {
  RTM_CONNECT_A1S_F2_BASE_ARCHIVE_SHA256,
  RTM_CONNECT_A1S_F2_BASE_COMMIT,
  RTM_CONNECT_A1S_F2_LOGIN_ROUTE,
  RTM_CONNECT_A1S_F2_LOGOUT_ROUTE,
  RTM_CONNECT_A1S_F2_QUEUE_MAX_ITEMS,
  RTM_CONNECT_A1S_F2_QUEUE_PAGE_SIZE,
  RtmConnectA1SF2ContractError,
  assertRtmConnectA1SF2LoginEnvelope,
  assertRtmConnectA1SF2LogoutEnvelope,
  buildRtmConnectA1SF2GateInput,
  evaluateRtmConnectA1SF2Gate,
  requireRtmConnectA1SF2Bearer,
  requireRtmConnectA1SF2Email,
  requireRtmConnectA1SF2Password,
} from "./rtmConnectA1SF2Contract.js";

export const RTM_CONNECT_A1S_F2_RUNTIME_VERSION =
  "rtm_connect_a1s_f2_runtime_v1_0";

const MAX_RESPONSE_CHARACTERS = 256_000;

export class RtmConnectA1SF2RuntimeError extends Error {
  constructor(code, message, status = null) {
    super(message);
    this.name = "RtmConnectA1SF2RuntimeError";
    this.code = code;
    this.status = status;
  }
}

function runtimeFail(code, message, status = null) {
  throw new RtmConnectA1SF2RuntimeError(code, message, status);
}

function requireFetch(fetchImpl) {
  if (typeof fetchImpl !== "function") {
    runtimeFail("a1s_f2.fetch_required", "Se requiere transporte fetch");
  }
  return fetchImpl;
}

function requireAbortSignal(signal) {
  if (signal === null || signal === undefined) return null;
  if (
    typeof signal !== "object" ||
    typeof signal.aborted !== "boolean" ||
    typeof signal.addEventListener !== "function"
  ) {
    runtimeFail("a1s_f2.abort_signal_invalid", "AbortSignal F2 no valido");
  }
  return signal;
}

async function readJsonResponse(response) {
  if (
    !response ||
    typeof response.ok !== "boolean" ||
    typeof response.status !== "number" ||
    typeof response.text !== "function"
  ) {
    runtimeFail("a1s_f2.response_invalid", "Respuesta HTTP F2 no valida");
  }
  const declared = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_CHARACTERS) {
    runtimeFail("a1s_f2.response_too_large", "Respuesta F2 demasiado grande", response.status);
  }
  const text = await response.text().catch(() => "");
  if (text.length > MAX_RESPONSE_CHARACTERS) {
    runtimeFail("a1s_f2.response_too_large", "Respuesta F2 demasiado grande", response.status);
  }
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    runtimeFail("a1s_f2.response_not_json", "Respuesta F2 no es JSON", response.status);
  }
  if (!response.ok) {
    runtimeFail(
      "a1s_f2.auth_failed",
      "La autenticacion individual no fue aceptada",
      response.status
    );
  }
  return payload;
}

async function postLogin(
  fetchImpl,
  { email, password, signal },
  onTokenCandidate = () => {}
) {
  const headers = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };
  const exactSignal = requireAbortSignal(signal);
  const options = {
    method: "POST",
    headers,
    body: JSON.stringify({
      email: requireRtmConnectA1SF2Email(email),
      password: requireRtmConnectA1SF2Password(password),
    }),
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
    referrerPolicy: "same-origin",
  };
  if (exactSignal) options.signal = exactSignal;
  let response;
  try {
    response = await requireFetch(fetchImpl)(RTM_CONNECT_A1S_F2_LOGIN_ROUTE, options);
  } catch {
    if (exactSignal?.aborted) runtimeFail("a1s_f2.request_aborted", "Peticion cancelada");
    runtimeFail("a1s_f2.transport_failed", "Transporte de autenticacion no disponible");
  }
  const payload = await readJsonResponse(response);
  if (typeof payload?.token === "string") {
    try {
      onTokenCandidate(requireRtmConnectA1SF2Bearer(payload.token));
    } catch {
      // El sobre exacto emitira el error contractual sin exponer el candidato.
    }
  }
  return assertRtmConnectA1SF2LoginEnvelope(payload);
}

async function postLogout(fetchImpl, bearerToken, signal = null) {
  const exactSignal = requireAbortSignal(signal);
  const options = {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${requireRtmConnectA1SF2Bearer(bearerToken)}`,
    },
    cache: "no-store",
    credentials: "same-origin",
    redirect: "error",
    referrerPolicy: "same-origin",
  };
  if (exactSignal) options.signal = exactSignal;
  let response;
  try {
    response = await requireFetch(fetchImpl)(RTM_CONNECT_A1S_F2_LOGOUT_ROUTE, options);
  } catch {
    if (exactSignal?.aborted) runtimeFail("a1s_f2.request_aborted", "Peticion cancelada");
    runtimeFail("a1s_f2.transport_failed", "No se pudo confirmar el cierre remoto");
  }
  return assertRtmConnectA1SF2LogoutEnvelope(await readJsonResponse(response));
}

export function buildRtmConnectA1SF2RuntimeBoundary({ env = null, location = null } = {}) {
  const input = buildRtmConnectA1SF2GateInput({ env, location });
  const gate = evaluateRtmConnectA1SF2Gate(input);
  return Object.freeze({
    gate,
    f1RuntimeContext: Object.freeze({
      hostname: RTM_CONNECT_A1S_STAGING_HOST,
      protocol: "https:",
      port: "",
      buildTarget: "a1s-synthetic-read",
      environment: "staging",
      uiEnabled: "1",
      operatorAuthEnabled: "1",
      documentInputPolicy: "synthetic_only",
      frontendBaseCommit: RTM_CONNECT_A1S_BASE_COMMIT,
      backendCommit: RTM_CONNECT_A1S_BACKEND_COMMIT,
      backendContractVersion: RTM_CONNECT_A1S_BACKEND_CONTRACT_VERSION,
      realDataAllowed: "0",
      externalEffectsAllowed: "0",
      providerAllowed: "0",
      administrationContactAllowed: "0",
      ocuContactAllowed: "0",
      b2Allowed: "0",
      productionAuthorized: "0",
    }),
    f2Identity: Object.freeze({
      baseCommit: RTM_CONNECT_A1S_F2_BASE_COMMIT,
      baseArchiveSha256: RTM_CONNECT_A1S_F2_BASE_ARCHIVE_SHA256,
    }),
  });
}

export function isRtmConnectA1SF2RouteEnabled(options = {}) {
  return buildRtmConnectA1SF2RuntimeBoundary(options).gate.allowed;
}

function indeterminateTraversal(reason, reportedTotal = null) {
  return Object.freeze({
    paginationVerified: false,
    snapshotGuaranteed: false,
    emptyStateAuthoritative: false,
    reason,
    items: Object.freeze([]),
    reportedTotal,
  });
}

export async function loadVerifiedRtmConnectA1SF2QueueTraversal(
  client,
  tenantId,
  filters = {}
) {
  const items = [];
  const taskIds = new Set();
  let offset = 0;
  let expectedTotal = null;
  const maxPages = Math.ceil(
    RTM_CONNECT_A1S_F2_QUEUE_MAX_ITEMS / RTM_CONNECT_A1S_F2_QUEUE_PAGE_SIZE
  );

  for (let page = 0; page < maxPages; page += 1) {
    const envelope = await client.tasks(tenantId, {
      status: filters.status || null,
      assigneeOperatorId: filters.assigneeOperatorId || null,
      overdueOnly: filters.overdueOnly === true,
      limit: RTM_CONNECT_A1S_F2_QUEUE_PAGE_SIZE,
      offset,
    });
    const total = envelope.pagination.total;
    if (expectedTotal === null) expectedTotal = total;
    if (
      total !== expectedTotal ||
      envelope.pagination.offset !== offset ||
      envelope.pagination.limit !== RTM_CONNECT_A1S_F2_QUEUE_PAGE_SIZE
    ) {
      return indeterminateTraversal("pagination_drift", total);
    }
    if (total > RTM_CONNECT_A1S_F2_QUEUE_MAX_ITEMS) {
      return indeterminateTraversal("queue_limit_exceeded", total);
    }
    for (const item of envelope.items) {
      if (taskIds.has(item.task_id)) {
        return indeterminateTraversal("duplicate_task", total);
      }
      taskIds.add(item.task_id);
      items.push(item);
    }
    if (items.length === total) {
      return Object.freeze({
        paginationVerified: true,
        snapshotGuaranteed: false,
        emptyStateAuthoritative: false,
        reason: null,
        items: Object.freeze(items),
        reportedTotal: total,
      });
    }
    if (
      !envelope.items.length ||
      envelope.items.length < RTM_CONNECT_A1S_F2_QUEUE_PAGE_SIZE ||
      items.length > total
    ) {
      return indeterminateTraversal("pagination_incomplete", total);
    }
    offset += envelope.items.length;
  }
  return indeterminateTraversal("page_limit_exceeded", expectedTotal);
}

function isContractFailure(error) {
  return (
    error instanceof RtmConnectA1SF2ContractError ||
    error?.name === "RtmConnectA1SContractError"
  );
}

function sanitizedReadFailure(error) {
  if (error instanceof RtmConnectA1SF2RuntimeError) return error;
  if (error instanceof RtmConnectA1SF2ContractError) return error;
  if (error?.code === "a1s.request_aborted") {
    return new RtmConnectA1SF2RuntimeError(
      "a1s_f2.request_aborted",
      "Peticion cancelada"
    );
  }
  if (error?.code === "a1s.transport_failed") {
    return new RtmConnectA1SF2RuntimeError(
      "a1s_f2.transport_failed",
      "Transporte de lectura no disponible"
    );
  }
  if (error?.status === 401) {
    return new RtmConnectA1SF2RuntimeError(
      "a1s_f2.session_invalid",
      "La sesion individual no es valida",
      401
    );
  }
  if (isContractFailure(error)) {
    return new RtmConnectA1SF2RuntimeError(
      "a1s_f2.response_contract_invalid",
      "La respuesta no cumple el contrato cerrado de lectura",
      error?.status ?? null
    );
  }
  return new RtmConnectA1SF2RuntimeError(
    "a1s_f2.read_failed",
    "No se pudo completar la lectura A1-S",
    typeof error?.status === "number" ? error.status : null
  );
}

function projectOperatorSession(me, tenants) {
  const operator = Object.freeze({
    display_name: me.operator.display_name,
    role_code: me.operator.role_code,
  });
  const visibleTenants = tenants.items.map((tenant) =>
    Object.freeze({
      tenant_id: tenant.tenant_id,
      display_name: tenant.display_name,
      role: tenant.role,
    })
  );
  return Object.freeze({
    operator,
    expiresAt: me.expires_at,
    tenants: Object.freeze(visibleTenants),
  });
}

function projectTaskDetail(envelope) {
  const task = envelope.task;
  const receipt = task.receipt_summary
    ? Object.freeze({
        documentSha256: task.receipt_summary.document_sha256,
        externalReference: task.receipt_summary.external_reference,
        packageSha256: task.receipt_summary.package_sha256,
        witnessedAt: task.receipt_summary.witnessed_at,
        createdAt: task.receipt_summary.created_at,
        syntheticOnly: true,
        officialReceipt: false,
      })
    : null;
  const artifacts = task.artifacts.map((artifact) =>
    Object.freeze({
      artifactCode: artifact.artifact_code,
      kind: artifact.kind,
      sha256: artifact.sha256,
      verifiedAt: artifact.verified_at,
      createdAt: artifact.created_at,
    })
  );
  const approvals = task.approvals.map((approval) =>
    Object.freeze({
      approvalType: approval.approval_type,
      decision: approval.decision,
      attestationSha256: approval.attestation_sha256,
      approvedAt: approval.approved_at,
    })
  );
  const events = task.events.map((event) =>
    Object.freeze({
      sequenceNumber: event.sequence_number,
      eventType: event.event_type,
      actorType: event.actor_type,
      fromStatus: event.from_status,
      toStatus: event.to_status,
      reasonCode: event.reason_code,
      payloadSha256: event.payload_sha256,
      createdAt: event.created_at,
    })
  );
  return Object.freeze({
    taskId: task.task_id,
    caseId: task.case_id,
    taskCode: task.task_code,
    status: task.status,
    dueAt: task.due_at,
    packageSha256: task.package_sha256,
    updatedAt: task.updated_at,
    artifacts: Object.freeze(artifacts),
    artifactsTruncated: task.artifacts_truncated,
    approvals: Object.freeze(approvals),
    receipt,
    events: Object.freeze(events),
    eventsTruncated: task.events_truncated,
    readOnly: true,
    workflowActions: Object.freeze([]),
    syntheticOnly: true,
  });
}

export function createRtmConnectA1SF2Session({
  fetchImpl,
  runtimeBoundary,
  readClientFactory = createRtmConnectA1SReadClient,
}) {
  const transport = requireFetch(fetchImpl);
  if (!runtimeBoundary?.gate?.allowed) {
    runtimeFail("a1s_f2.gate_blocked", "El gate F2 permanece cerrado");
  }

  let bearerToken = null;
  let sessionIdentity = null;
  let authBoundaryReady = false;
  let epoch = 0;
  let loginSerial = 0;
  let authStatusSerial = 0;
  let activeLogin = null;
  const activeControllers = new Set();

  function invalidateMemory({ resetAuth = true } = {}) {
    epoch += 1;
    loginSerial += 1;
    authStatusSerial += 1;
    activeLogin = null;
    for (const controller of activeControllers) controller.abort();
    activeControllers.clear();
    bearerToken = null;
    sessionIdentity = null;
    if (resetAuth) authBoundaryReady = false;
  }

  function startOperation(externalSignal = null) {
    const external = requireAbortSignal(externalSignal);
    const controller = new AbortController();
    const operationEpoch = epoch;
    const relayAbort = () => controller.abort();
    if (external?.aborted) controller.abort();
    else external?.addEventListener("abort", relayAbort, { once: true });
    activeControllers.add(controller);
    return Object.freeze({
      epoch: operationEpoch,
      signal: controller.signal,
      close() {
        activeControllers.delete(controller);
        external?.removeEventListener?.("abort", relayAbort);
      },
    });
  }

  function requireOperationActive(operation) {
    if (operation.signal.aborted || operation.epoch !== epoch) {
      runtimeFail("a1s_f2.request_aborted", "Peticion cancelada");
    }
  }

  function requireSession() {
    if (!bearerToken || !sessionIdentity) {
      runtimeFail("a1s_f2.session_required", "Sesion individual requerida", 401);
    }
    return sessionIdentity;
  }

  async function bootstrappedClient(signal, token, identity) {
    const client = readClientFactory({
      fetchImpl: transport,
      bearerToken: token,
      runtimeContext: runtimeBoundary.f1RuntimeContext,
      signal,
    });
    const me = await client.operatorMe();
    if (
      me.session_id !== identity.sessionId ||
      me.operator.id !== identity.operatorId ||
      me.expires_at !== identity.expiresAt ||
      me.absolute_expires_at !== identity.absoluteExpiresAt
    ) {
      runtimeFail("a1s_f2.session_identity_changed", "La identidad o el reloj de sesion ha cambiado", 401);
    }
    const tenants = await client.tenants();
    if (tenants.items_truncated) {
      runtimeFail(
        "a1s_f2.tenant_scope_truncated",
        "El alcance de tenants esta truncado y F2 se bloquea"
      );
    }
    return { client, me, tenants };
  }

  function shouldInvalidateFor(error) {
    return (
      error?.status === 401 ||
      error?.code === "a1s_f2.tenant_scope_truncated" ||
      isContractFailure(error) ||
      error?.name === "RtmConnectA1SContractError"
    );
  }

  return Object.freeze({
    async authStatus(signal = null) {
      const serial = ++authStatusSerial;
      const operation = startOperation(signal);
      authBoundaryReady = false;
      try {
        const status = await readRtmOperatorAuthStatus({
          fetchImpl: transport,
          runtimeContext: runtimeBoundary.f1RuntimeContext,
          signal: operation.signal,
        });
        requireOperationActive(operation);
        if (serial !== authStatusSerial) {
          runtimeFail("a1s_f2.request_aborted", "Comprobacion sustituida");
        }
        authBoundaryReady = true;
        return status;
      } catch (error) {
        if (serial === authStatusSerial) authBoundaryReady = false;
        throw sanitizedReadFailure(error);
      } finally {
        operation.close();
      }
    },

    async login({ email, password, signal = null }) {
      if (!authBoundaryReady) {
        runtimeFail(
          "a1s_f2.auth_status_required",
          "Debe verificarse el estado de autenticacion antes del login"
        );
      }
      if (activeLogin !== null) {
        runtimeFail("a1s_f2.login_in_progress", "Ya hay un login en curso");
      }
      if (bearerToken || sessionIdentity) {
        runtimeFail(
          "a1s_f2.session_already_active",
          "Debe cerrarse la sesion activa antes de iniciar otra"
        );
      }
      const operation = startOperation(signal);
      const serial = ++loginSerial;
      activeLogin = serial;
      let issuedToken = null;
      try {
        const login = await postLogin(
          transport,
          { email, password, signal: operation.signal },
          (token) => {
            issuedToken = token;
          }
        );
        requireOperationActive(operation);
        if (activeLogin !== serial) {
          runtimeFail("a1s_f2.request_aborted", "Login cancelado");
        }
        const candidateIdentity = Object.freeze({
          sessionId: login.sessionId,
          operatorId: login.operatorId,
          expiresAt: login.expiresAt,
          absoluteExpiresAt: login.absoluteExpiresAt,
        });
        const { me, tenants } = await bootstrappedClient(
          operation.signal,
          login.bearerToken,
          candidateIdentity
        );
        requireOperationActive(operation);
        if (activeLogin !== serial) {
          runtimeFail("a1s_f2.request_aborted", "Login cancelado");
        }
        bearerToken = login.bearerToken;
        sessionIdentity = candidateIdentity;
        return projectOperatorSession(me, tenants);
      } catch (error) {
        const tokenToClose = issuedToken;
        const ownsState =
          activeLogin === serial && operation.epoch === epoch;
        if (ownsState) invalidateMemory({ resetAuth: true });
        if (tokenToClose) {
          await postLogout(transport, tokenToClose).catch(() => null);
        }
        throw sanitizedReadFailure(error);
      } finally {
        operation.close();
        if (activeLogin === serial) activeLogin = null;
      }
    },

    async tenantOverview(tenantId, filters = {}, signal = null) {
      const identity = requireSession();
      const token = bearerToken;
      const operation = startOperation(signal);
      try {
        const { client, tenants } = await bootstrappedClient(
          operation.signal,
          token,
          identity
        );
        requireOperationActive(operation);
        if (!tenants.items.some((item) => item.tenant_id === tenantId)) {
          runtimeFail("a1s_f2.tenant_not_in_session", "Tenant fuera de la sesion");
        }
        await client.tenantContext(tenantId);
        requireOperationActive(operation);
        const queue = await loadVerifiedRtmConnectA1SF2QueueTraversal(
          client,
          tenantId,
          filters
        );
        requireOperationActive(operation);
        return Object.freeze({ queue });
      } catch (error) {
        if (shouldInvalidateFor(error)) invalidateMemory({ resetAuth: true });
        throw sanitizedReadFailure(error);
      } finally {
        operation.close();
      }
    },

    async taskDetail(tenantId, taskId, signal = null) {
      const identity = requireSession();
      const token = bearerToken;
      const operation = startOperation(signal);
      try {
        const { client, tenants } = await bootstrappedClient(
          operation.signal,
          token,
          identity
        );
        requireOperationActive(operation);
        if (!tenants.items.some((item) => item.tenant_id === tenantId)) {
          runtimeFail("a1s_f2.tenant_not_in_session", "Tenant fuera de la sesion");
        }
        const detail = projectTaskDetail(await client.task(tenantId, taskId));
        requireOperationActive(operation);
        return detail;
      } catch (error) {
        if (shouldInvalidateFor(error)) invalidateMemory({ resetAuth: true });
        throw sanitizedReadFailure(error);
      } finally {
        operation.close();
      }
    },

    async logout(signal = null) {
      const tokenToClose = bearerToken;
      invalidateMemory({ resetAuth: true });
      if (!tokenToClose) return Object.freeze({ ok: true, status: "already_local" });
      return postLogout(transport, tokenToClose, signal);
    },

    clear() {
      invalidateMemory({ resetAuth: true });
    },

    dispose() {
      invalidateMemory({ resetAuth: true });
    },

    hasSession() {
      return Boolean(bearerToken && sessionIdentity);
    },
  });
}
