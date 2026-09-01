import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import {
  createRtmSignerStationClient,
  newSignerCommandKey,
  parseRtmSignerStationDescriptorText,
} from "../src/rtm-presenter/rtmSignerStationApi.js";


const DELIVERY_ID = "11111111-1111-4111-8111-111111111111";
const CLAIM_ID = "22222222-2222-4222-8222-222222222222";
const INSTALLATION_ID = "33333333-3333-4333-8333-333333333333";
const INSTANCE_ID = "44444444-4444-4444-8444-444444444444";
const DEVICE_ID = "55555555-5555-4555-8555-555555555555";
const OPERATOR_ID = "66666666-6666-4666-8666-666666666666";
const WORKSPACE_ID = "77777777-7777-4777-8777-777777777777";
const RECOVERED_WORKSPACE_ID = "88888888-8888-4888-8888-888888888888";
const SOURCE_CLAIM_ID = "99999999-9999-4999-8999-999999999999";
const CASE_ID = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const PACKAGE_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const PROFILE_ID = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const PREPARED_BY_ID = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const PACKAGE_ITEM_ID = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
const DOCUMENT_VERSION_ID = "ffffffff-ffff-4fff-8fff-ffffffffffff";

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
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: () => null },
    text: async () => JSON.stringify(payload),
  };
}

function safeQueue() {
  return {
    ok: true,
    station_queue: {
      station_contract_version: "rtm_presenter_signer_station_v1_0",
      items: [],
      item_count: 0,
      local_activation_available: false,
      certificate_stored_by_rtm: false,
      browser_session_shared: false,
      external_effects_executed: false,
    },
  };
}

function signerTask() {
  const material = {
    delivery_id: DELIVERY_ID,
    case_id: CASE_ID,
    package_id: PACKAGE_ID,
    package_manifest_sha256: "c".repeat(64),
    destination_profile_id: PROFILE_ID,
    destination_profile_code: "reg.general",
    destination_profile_version: 1,
    destination_profile_sha256: "d".repeat(64),
    prepared_by_operator_id: PREPARED_BY_ID,
    prepared_at: "2026-09-01T08:00:00+00:00",
    destination_display_name: "Registro Electrónico General",
    portal_origin: "https://reg.example.test",
    representation_mode: "representative",
    portal_preparation: {
      form_code: "reg.general",
      fields: [
        {
          field_code: "subject",
          label: "Asunto",
          required: true,
          multiline: false,
          max_length: 120,
          step_order: 1,
          value: "Recurso sintético",
        },
      ],
    },
    items: [
      {
        package_item_id: PACKAGE_ITEM_ID,
        document_version_id: DOCUMENT_VERSION_ID,
        document_sha256: "e".repeat(64),
        item_order: 1,
        field_code: "document",
        portal_filename: "recurso-sintetico.pdf",
        media_type: "application/pdf",
        size_bytes: 2048,
      },
    ],
    document_count: 1,
  };
  return {
    ...material,
    task_fingerprint_sha256: createHash("sha256")
      .update(canonicalJson(material), "utf8")
      .digest("hex"),
  };
}

const TASK_FINGERPRINT = signerTask().task_fingerprint_sha256;

function safeClaim() {
  return {
    ok: true,
    claim: {
      claim_id: CLAIM_ID,
      local_activation_available: false,
      browser_open_available: false,
      certificate_stored_by_rtm: false,
      certificate_secret_allowed: false,
      browser_session_shared: false,
      external_effects_executed: false,
      task: signerTask(),
    },
  };
}

function installation() {
  return {
    installation_id: INSTALLATION_ID,
    operator_id: OPERATOR_ID,
    operator_device_id: DEVICE_ID,
    client_instance_id: INSTANCE_ID,
    client_binding_sha256: "a".repeat(64),
    station_label: "PC firma Ramon",
    platform: "windows",
    client_version: "1.0.0",
    status: "candidate",
    registered_at: "2026-09-01T08:00:00+00:00",
  };
}

function safeStation() {
  return {
    ok: true,
    storage_references_exposed: false,
    document_bytes_exposed: false,
    cookie_material_exposed: false,
    certificate_material_exposed: false,
    synthetic_only: true,
    station: {
      station_contract_version: "rtm_presenter_local_station_v1_0",
      installation: installation(),
      replayed: false,
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
  };
}

function safeWorkspace(state = "ready", attemptNumber = 1) {
  return {
    ok: true,
    storage_references_exposed: false,
    document_bytes_exposed: false,
    synthetic_only: true,
    workspace: {
      workspace_contract_version: "rtm_presenter_signer_workspace_v1_0",
      workspace_id: WORKSPACE_ID,
      state,
      attempt_number: attemptNumber,
      updated_at: "2026-09-01T08:05:00+00:00",
      replayed: false,
      claim_id: CLAIM_ID,
      claim_expires_at: "2026-09-01T08:30:00+00:00",
      installation: installation(),
      task: signerTask(),
      rtm_draft_persisted: true,
      reg_draft_persisted: false,
      reg_session_recovery_available: true,
      reg_session_expired: state === "reg_session_expired",
      managed_attestation_verified: false,
      local_activation_available: false,
      browser_open_available: false,
      document_bytes_available: false,
      certificate_stored_by_rtm: false,
      signature_automated: false,
      final_submit_automated: false,
      external_effects_executed: false,
      next_action:
        state === "reg_session_expired"
          ? "reauthenticate_reg_then_resume_from_rtm"
          : "authenticate_reg_manually_when_local_bridge_is_authorized",
      recovery_adopted: false,
    },
  };
}

function safeWorkspaceRecoveries(
  recoveryStatus = "adoptable_supersession"
) {
  const active = ["current_session", "adoptable_supersession", "blocked_active_claim"]
    .includes(recoveryStatus);
  return {
    ok: true,
    storage_references_exposed: false,
    document_bytes_exposed: false,
    cookie_material_exposed: false,
    certificate_material_exposed: false,
    synthetic_only: true,
    workspace_recoveries: {
      recovery_contract_version: "rtm_presenter_workspace_recovery_v1_0",
      installation_id: INSTALLATION_ID,
      items: [
        {
          workspace_id: WORKSPACE_ID,
          delivery_id: DELIVERY_ID,
          case_id: CASE_ID,
          package_id: PACKAGE_ID,
          claim_id: SOURCE_CLAIM_ID,
          state: "reg_session_expired",
          attempt_number: 1,
          updated_at: "2026-09-01T08:05:00+00:00",
          destination_display_name: "Registro Electrónico General",
          document_count: 3,
          task_fingerprint_sha256: TASK_FINGERPRINT,
          recovery_status: recoveryStatus,
          adoption_available: ["adoptable", "adoptable_supersession"].includes(
            recoveryStatus
          ),
          rtm_draft_persisted: true,
          reg_draft_persisted: false,
          browser_storage_required: false,
          document_bytes_available: false,
          external_effects_executed: false,
          ...(active
            ? { active_claim_expires_at: "2026-09-01T08:30:00+00:00" }
            : {}),
        },
      ],
      item_count: 1,
      metadata_only: true,
      browser_storage_required: false,
      document_bytes_available: false,
      cookie_material_available: false,
      certificate_material_available: false,
      external_effects_executed: false,
    },
  };
}

function adoptedWorkspace() {
  const payload = safeWorkspace("ready", 2);
  payload.cookie_material_exposed = false;
  payload.certificate_material_exposed = false;
  payload.workspace.workspace_id = RECOVERED_WORKSPACE_ID;
  payload.workspace.recovery_adopted = true;
  payload.workspace.recovered_from = {
    workspace_id: WORKSPACE_ID,
    claim_id: SOURCE_CLAIM_ID,
    attempt_number: 1,
  };
  return payload;
}

test("signer station queue is same-origin, no-store and bearer-bound", async () => {
  const calls = [];
  const client = createRtmSignerStationClient({
    fetchImpl: async (...args) => {
      calls.push(args);
      return jsonResponse(safeQueue());
    },
    getAuthHeaders: () => ({ Authorization: "Bearer synthetic-token" }),
  });

  const payload = await client.loadQueue({ limit: 25 });

  assert.equal(payload.station_queue.item_count, 0);
  assert.equal(calls.length, 1);
  assert.equal(calls[0][0], "/api/ops/presenter/signer/queue?limit=25");
  assert.equal(calls[0][1].method, "GET");
  assert.equal(calls[0][1].cache, "no-store");
  assert.equal(calls[0][1].credentials, "same-origin");
  assert.equal(calls[0][1].headers.Authorization, "Bearer synthetic-token");
});

test("claim, recover and release use separate explicit routes", async () => {
  const calls = [];
  const client = createRtmSignerStationClient({
    fetchImpl: async (path, options) => {
      calls.push([path, options]);
      if (path.endsWith("/release")) {
        return jsonResponse({
          ok: true,
          release: { external_effects_executed: false },
        });
      }
      return jsonResponse(safeClaim(), options.method === "POST" ? 201 : 200);
    },
  });

  await client.claimTask(DELIVERY_ID, {
    idempotencyKey: "signer-claim-command-0001",
  });
  await client.loadCurrentClaim(DELIVERY_ID);
  await client.releaseTask(DELIVERY_ID, CLAIM_ID, {
    idempotencyKey: "signer-release-command-0001",
  });

  assert.deepEqual(
    calls.map(([path, options]) => [path, options.method]),
    [
      [`/api/ops/presenter/signer/tasks/${DELIVERY_ID}/claim`, "POST"],
      [`/api/ops/presenter/signer/tasks/${DELIVERY_ID}/claim`, "GET"],
      [
        `/api/ops/presenter/signer/tasks/${DELIVERY_ID}/claims/${CLAIM_ID}/release`,
        "POST",
      ],
    ]
  );
  assert.equal(calls[0][1].headers["Idempotency-Key"], "signer-claim-command-0001");
  assert.equal(calls[2][1].headers["Idempotency-Key"], "signer-release-command-0001");
});

test("client rejects restricted material and optimistic activation flags", async () => {
  const exposed = createRtmSignerStationClient({
    fetchImpl: async () =>
      jsonResponse({ ...safeQueue(), b2_key: "forbidden-object" }),
  });
  await assert.rejects(() => exposed.loadQueue(), /material fuera/);

  const optimistic = createRtmSignerStationClient({
    fetchImpl: async () =>
      jsonResponse({
        ...safeQueue(),
        station_queue: {
          ...safeQueue().station_queue,
          local_activation_available: true,
        },
      }),
  });
  await assert.rejects(() => optimistic.loadQueue(), /frontera local cerrada/);
});

test("command keys require browser cryptographic randomness", () => {
  const key = newSignerCommandKey("signer-claim");
  assert.match(
    key,
    /^signer-claim-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
  );
});

test("browser accepts only the exact public candidate descriptor", () => {
  const descriptor = {
    descriptor_version: "rtm.local.signer.station.descriptor.v1",
    client_instance_id: INSTANCE_ID,
    client_binding_sha256: "a".repeat(64),
    station_label: "PC firma Ramon",
    platform: "windows",
    client_version: "1.0.0",
    synthetic_only: true,
    managed_attestation_verified: false,
    certificate_material_present: false,
    customer_data_present: false,
  };

  const parsed = parseRtmSignerStationDescriptorText(JSON.stringify(descriptor));
  assert.equal(parsed.clientInstanceId, INSTANCE_ID);
  assert.equal(parsed.stationLabel, "PC firma Ramon");
  assert.equal(parsed.managedAttestationVerified, false);

  assert.throws(
    () =>
      parseRtmSignerStationDescriptorText(
        JSON.stringify({ ...descriptor, station_token: "forbidden" })
      ),
    /campos inesperados/
  );
  assert.throws(
    () =>
      parseRtmSignerStationDescriptorText(
        JSON.stringify({ ...descriptor, certificate_material_present: true })
      ),
    /candidato Windows sintético/
  );
  assert.throws(
    () => parseRtmSignerStationDescriptorText("x".repeat(16_385)),
    /supera 16 KB/
  );
});

test("local Windows installation registers only a non-attested candidate", async () => {
  const calls = [];
  const client = createRtmSignerStationClient({
    fetchImpl: async (...args) => {
      calls.push(args);
      return jsonResponse(safeStation(), 201);
    },
  });

  const payload = await client.registerInstallation({
    clientInstanceId: INSTANCE_ID,
    clientBindingSha256: "a".repeat(64),
    stationLabel: "PC firma Ramon",
    platform: "windows",
    clientVersion: "1.0.0",
  });

  assert.equal(payload.station.managed_attestation_verified, false);
  assert.equal(payload.station.local_activation_available, false);
  assert.equal(calls[0][0], "/api/ops/presenter/signer/installations");
  assert.equal(calls[0][1].method, "POST");
  assert.deepEqual(JSON.parse(calls[0][1].body), {
    client_instance_id: INSTANCE_ID,
    client_binding_sha256: "a".repeat(64),
    station_label: "PC firma Ramon",
    platform: "windows",
    client_version: "1.0.0",
  });
});

test("registered installation is loaded through an exact metadata-only route", async () => {
  const calls = [];
  const client = createRtmSignerStationClient({
    fetchImpl: async (...args) => {
      calls.push(args);
      return jsonResponse(safeStation());
    },
  });

  await client.loadInstallation(INSTALLATION_ID);

  assert.equal(
    calls[0][0],
    `/api/ops/presenter/signer/installations/${INSTALLATION_ID}`
  );
  assert.equal(calls[0][1].method, "GET");
});

test("durable recovery is discovered by installation and adopted explicitly", async () => {
  const calls = [];
  const client = createRtmSignerStationClient({
    fetchImpl: async (path, options) => {
      calls.push([path, options]);
      return jsonResponse(
        path.includes("workspace-recoveries")
          ? safeWorkspaceRecoveries()
          : adoptedWorkspace()
      );
    },
    getAuthHeaders: () => ({ Authorization: "Bearer new-session-token" }),
  });

  const discovered = await client.discoverWorkspaceRecoveries(
    INSTALLATION_ID,
    { limit: 20 }
  );
  const item = discovered.workspace_recoveries.items[0];
  const recovered = await client.recoverWorkspace(
    item.delivery_id,
    INSTALLATION_ID,
    item.workspace_id,
    item.task_fingerprint_sha256,
    {
      sourceClaimId: item.claim_id,
      sourceAttemptNumber: item.attempt_number,
      idempotencyKey: "workspace-adoption-command-0001",
    }
  );

  assert.equal(item.recovery_status, "adoptable_supersession");
  assert.equal(item.adoption_available, true);
  assert.equal(recovered.workspace.workspace_id, RECOVERED_WORKSPACE_ID);
  assert.equal(recovered.workspace.recovered_from.workspace_id, WORKSPACE_ID);
  assert.deepEqual(
    calls.map(([path, options]) => [path, options.method]),
    [
      [
        `/api/ops/presenter/signer/installations/${INSTALLATION_ID}` +
          "/workspace-recoveries?limit=20",
        "GET",
      ],
      [
        `/api/ops/presenter/signer/tasks/${DELIVERY_ID}/workspace-recovery`,
        "POST",
      ],
    ]
  );
  assert.equal(calls[0][1].cache, "no-store");
  assert.equal(calls[1][1].headers.Authorization, "Bearer new-session-token");
  assert.equal(
    calls[1][1].headers["Idempotency-Key"],
    "workspace-adoption-command-0001"
  );
  assert.deepEqual(JSON.parse(calls[1][1].body), {
    installation_id: INSTALLATION_ID,
    source_workspace_id: WORKSPACE_ID,
    expected_task_fingerprint_sha256: TASK_FINGERPRINT,
  });
});

test("current-session recovery reopens the same durable workspace by explicit POST", async () => {
  const replay = safeWorkspace("reg_session_expired", 1);
  replay.cookie_material_exposed = false;
  replay.certificate_material_exposed = false;
  replay.workspace.workspace_id = WORKSPACE_ID;
  replay.workspace.recovery_adopted = false;
  const client = createRtmSignerStationClient({
    fetchImpl: async () => jsonResponse(replay),
  });

  const payload = await client.recoverWorkspace(
    DELIVERY_ID,
    INSTALLATION_ID,
    WORKSPACE_ID,
    TASK_FINGERPRINT,
    {
      sourceClaimId: CLAIM_ID,
      sourceAttemptNumber: 1,
      idempotencyKey: "workspace-reopen-command-0001",
    }
  );

  assert.equal(payload.workspace.workspace_id, WORKSPACE_ID);
  assert.equal(payload.workspace.recovery_adopted, false);
  assert.equal(payload.workspace.reg_session_expired, true);
});

test("recovery discovery and adoption reject expanded metadata or wrong lineage", async () => {
  const rollbackBlocked = safeWorkspaceRecoveries("blocked_session_rollback");
  const rollbackClient = createRtmSignerStationClient({
    fetchImpl: async () => jsonResponse(rollbackBlocked),
  });
  const rollback = await rollbackClient.discoverWorkspaceRecoveries(
    INSTALLATION_ID
  );
  assert.equal(
    rollback.workspace_recoveries.items[0].recovery_status,
    "blocked_session_rollback"
  );
  assert.equal(
    rollback.workspace_recoveries.items[0].adoption_available,
    false
  );

  const crossedDiscoveryEnvelope = safeWorkspaceRecoveries();
  crossedDiscoveryEnvelope.workspace = adoptedWorkspace().workspace;
  const crossedDiscoveryClient = createRtmSignerStationClient({
    fetchImpl: async () => jsonResponse(crossedDiscoveryEnvelope),
  });
  await assert.rejects(
    () => crossedDiscoveryClient.discoverWorkspaceRecoveries(INSTALLATION_ID),
    /ampliar el sobre de recuperación/
  );

  const expanded = safeWorkspaceRecoveries();
  expanded.workspace_recoveries.items[0].portal_fields = ["forbidden"];
  const expandedClient = createRtmSignerStationClient({
    fetchImpl: async () => jsonResponse(expanded),
  });
  await assert.rejects(
    () => expandedClient.discoverWorkspaceRecoveries(INSTALLATION_ID),
    /borrador recuperable no verificable/
  );

  const optimistic = safeWorkspaceRecoveries();
  optimistic.workspace_recoveries.browser_storage_required = true;
  const optimisticClient = createRtmSignerStationClient({
    fetchImpl: async () => jsonResponse(optimistic),
  });
  await assert.rejects(
    () => optimisticClient.discoverWorkspaceRecoveries(INSTALLATION_ID),
    /contrato durable y solo de metadatos/
  );

  const wrongLineage = adoptedWorkspace();
  wrongLineage.workspace.recovered_from.workspace_id =
    "aaaaaaaa-0000-4000-8000-000000000000";
  const wrongClient = createRtmSignerStationClient({
    fetchImpl: async () => jsonResponse(wrongLineage),
  });
  await assert.rejects(
    () =>
      wrongClient.recoverWorkspace(
        DELIVERY_ID,
        INSTALLATION_ID,
        WORKSPACE_ID,
        TASK_FINGERPRINT,
        {
          sourceClaimId: SOURCE_CLAIM_ID,
          sourceAttemptNumber: 1,
          idempotencyKey: "workspace-adoption-command-0001",
        }
      ),
    /borrador de origen solicitado/
  );

  const expandedTask = adoptedWorkspace();
  expandedTask.workspace.task.document_content_base64 = "forbidden";
  const expandedTaskClient = createRtmSignerStationClient({
    fetchImpl: async () => jsonResponse(expandedTask),
  });
  await assert.rejects(
    () =>
      expandedTaskClient.recoverWorkspace(
        DELIVERY_ID,
        INSTALLATION_ID,
        WORKSPACE_ID,
        TASK_FINGERPRINT,
        {
          sourceClaimId: SOURCE_CLAIM_ID,
          sourceAttemptNumber: 1,
          idempotencyKey: "workspace-adoption-command-0001",
        }
      ),
    /material fuera del puesto local/
  );

  const mutatedTask = adoptedWorkspace();
  mutatedTask.workspace.task.portal_preparation.fields[0].value =
    "Recurso sintético alterado";
  const mutatedTaskClient = createRtmSignerStationClient({
    fetchImpl: async () => jsonResponse(mutatedTask),
  });
  await assert.rejects(
    () =>
      mutatedTaskClient.recoverWorkspace(
        DELIVERY_ID,
        INSTALLATION_ID,
        WORKSPACE_ID,
        TASK_FINGERPRINT,
        {
          sourceClaimId: SOURCE_CLAIM_ID,
          sourceAttemptNumber: 1,
          idempotencyKey: "workspace-adoption-command-0001",
        }
      ),
    /huella criptográfica/
  );

  const selfLineage = adoptedWorkspace();
  selfLineage.workspace.recovered_from.workspace_id = RECOVERED_WORKSPACE_ID;
  const selfLineageClient = createRtmSignerStationClient({
    fetchImpl: async () => jsonResponse(selfLineage),
  });
  await assert.rejects(
    () =>
      selfLineageClient.recoverWorkspace(
        DELIVERY_ID,
        INSTALLATION_ID,
        WORKSPACE_ID,
        TASK_FINGERPRINT,
        {
          sourceClaimId: SOURCE_CLAIM_ID,
          sourceAttemptNumber: 1,
          idempotencyKey: "workspace-adoption-command-0001",
        }
      ),
    /linaje de recuperación imposible/
  );

  const jumpedAttempt = adoptedWorkspace();
  jumpedAttempt.workspace.attempt_number = 3;
  const jumpedAttemptClient = createRtmSignerStationClient({
    fetchImpl: async () => jsonResponse(jumpedAttempt),
  });
  await assert.rejects(
    () =>
      jumpedAttemptClient.recoverWorkspace(
        DELIVERY_ID,
        INSTALLATION_ID,
        WORKSPACE_ID,
        TASK_FINGERPRINT,
        {
          sourceClaimId: SOURCE_CLAIM_ID,
          sourceAttemptNumber: 1,
          idempotencyKey: "workspace-adoption-command-0001",
        }
      ),
    /borrador de origen solicitado/
  );

  const crossedWorkspaceEnvelope = adoptedWorkspace();
  crossedWorkspaceEnvelope.workspace_recoveries =
    safeWorkspaceRecoveries().workspace_recoveries;
  const crossedWorkspaceClient = createRtmSignerStationClient({
    fetchImpl: async () => jsonResponse(crossedWorkspaceEnvelope),
  });
  await assert.rejects(
    () =>
      crossedWorkspaceClient.recoverWorkspace(
        DELIVERY_ID,
        INSTALLATION_ID,
        WORKSPACE_ID,
        TASK_FINGERPRINT,
        {
          sourceClaimId: SOURCE_CLAIM_ID,
          sourceAttemptNumber: 1,
          idempotencyKey: "workspace-adoption-command-0001",
        }
      ),
    /ampliar el sobre de recuperación/
  );

  const wrongSourceClaim = adoptedWorkspace();
  wrongSourceClaim.workspace.recovered_from.claim_id =
    "abababab-abab-4bab-8bab-abababababab";
  const wrongSourceClaimClient = createRtmSignerStationClient({
    fetchImpl: async () => jsonResponse(wrongSourceClaim),
  });
  await assert.rejects(
    () =>
      wrongSourceClaimClient.recoverWorkspace(
        DELIVERY_ID,
        INSTALLATION_ID,
        WORKSPACE_ID,
        TASK_FINGERPRINT,
        {
          sourceClaimId: SOURCE_CLAIM_ID,
          sourceAttemptNumber: 1,
          idempotencyKey: "workspace-adoption-command-0001",
        }
      ),
    /borrador de origen solicitado/
  );
});

test("recovery validates idempotency before network and preserves backend conflict identity", async () => {
  let calls = 0;
  const invalidClient = createRtmSignerStationClient({
    fetchImpl: async () => {
      calls += 1;
      return jsonResponse(adoptedWorkspace(), 201);
    },
  });

  await assert.rejects(
    () =>
      invalidClient.recoverWorkspace(
        DELIVERY_ID,
        INSTALLATION_ID,
        WORKSPACE_ID,
        TASK_FINGERPRINT,
        {
          sourceClaimId: SOURCE_CLAIM_ID,
          sourceAttemptNumber: 1,
          idempotencyKey: "invalid key with spaces",
        }
      ),
    /clave válida/
  );
  assert.equal(calls, 0);

  const conflictClient = createRtmSignerStationClient({
    fetchImpl: async () =>
      jsonResponse(
        {
          detail: {
            ok: false,
            request_id: "request-recovery-conflict-01",
            error: {
              code: "presenter.signer_workspace_source_stale",
              message: "El borrador de origen ya no es el vigente",
              retryable: false,
            },
          },
        },
        409
      ),
  });

  await assert.rejects(
    () =>
      conflictClient.recoverWorkspace(
        DELIVERY_ID,
        INSTALLATION_ID,
        WORKSPACE_ID,
        TASK_FINGERPRINT,
        {
          sourceClaimId: SOURCE_CLAIM_ID,
          sourceAttemptNumber: 1,
          idempotencyKey: "workspace-adoption-command-0001",
        }
      ),
    (error) => {
      assert.equal(error.code, "presenter.signer_workspace_source_stale");
      assert.equal(error.status, 409);
      assert.equal(error.requestId, "request-recovery-conflict-01");
      assert.equal(error.retryable, false);
      assert.match(error.message, /ya no es el vigente/);
      return true;
    }
  );
});

test("recovered claim rejects shared browser session", async () => {
  const unsafe = safeClaim();
  unsafe.claim.browser_session_shared = true;
  const client = createRtmSignerStationClient({
    fetchImpl: async () => jsonResponse(unsafe),
  });

  await assert.rejects(
    () => client.loadCurrentClaim(DELIVERY_ID),
    /frontera local cerrada/
  );
});

test("recovery 401 invokes session cleanup", async () => {
  let unauthorized = 0;
  const client = createRtmSignerStationClient({
    fetchImpl: async () => jsonResponse({ detail: "Sesión no activa" }, 401),
    onUnauthorized: () => {
      unauthorized += 1;
    },
  });

  await assert.rejects(
    () => client.discoverWorkspaceRecoveries(INSTALLATION_ID),
    /Sesión no activa/
  );
  assert.equal(unauthorized, 1);
});

test("workspace preparation binds claim and installation without opening REG", async () => {
  const calls = [];
  const client = createRtmSignerStationClient({
    fetchImpl: async (...args) => {
      calls.push(args);
      return jsonResponse(safeWorkspace(), 201);
    },
  });

  const payload = await client.prepareWorkspace(
    DELIVERY_ID,
    CLAIM_ID,
    INSTALLATION_ID,
    { idempotencyKey: "workspace-prepare-command-0001" }
  );

  assert.equal(payload.workspace.rtm_draft_persisted, true);
  assert.equal(payload.workspace.reg_draft_persisted, false);
  assert.equal(payload.workspace.browser_open_available, false);
  assert.equal(
    calls[0][0],
    `/api/ops/presenter/signer/tasks/${DELIVERY_ID}/claims/${CLAIM_ID}/workspaces`
  );
  assert.equal(calls[0][1].headers["Idempotency-Key"], "workspace-prepare-command-0001");
});

test("REG expiry and resume use explicit recovery transitions", async () => {
  const calls = [];
  const client = createRtmSignerStationClient({
    fetchImpl: async (path, options) => {
      calls.push([path, options]);
      return jsonResponse(
        path.endsWith("/resume")
          ? safeWorkspace("ready", 2)
          : safeWorkspace("reg_session_expired", 1)
      );
    },
  });

  await client.markRegSessionExpired(
    DELIVERY_ID,
    CLAIM_ID,
    WORKSPACE_ID,
    INSTALLATION_ID,
    { idempotencyKey: "workspace-expired-command-0001" }
  );
  const resumed = await client.resumeWorkspace(
    DELIVERY_ID,
    CLAIM_ID,
    WORKSPACE_ID,
    INSTALLATION_ID,
    { idempotencyKey: "workspace-resume-command-0001" }
  );

  assert.deepEqual(
    calls.map(([path, options]) => [path, options.method]),
    [
      [
        `/api/ops/presenter/signer/tasks/${DELIVERY_ID}/claims/${CLAIM_ID}` +
          `/workspaces/${WORKSPACE_ID}/portal-session-expired`,
        "POST",
      ],
      [
        `/api/ops/presenter/signer/tasks/${DELIVERY_ID}/claims/${CLAIM_ID}` +
          `/workspaces/${WORKSPACE_ID}/resume`,
        "POST",
      ],
    ]
  );
  assert.equal(resumed.workspace.attempt_number, 2);
  assert.equal(resumed.workspace.task.task_fingerprint_sha256, TASK_FINGERPRINT);
});

test("workspace recovery rejects a fake REG draft or optimistic byte access", async () => {
  const fakeRegDraft = safeWorkspace();
  fakeRegDraft.workspace.reg_draft_persisted = true;
  const client = createRtmSignerStationClient({
    fetchImpl: async () => jsonResponse(fakeRegDraft),
  });
  await assert.rejects(
    () =>
      client.prepareWorkspace(DELIVERY_ID, CLAIM_ID, INSTALLATION_ID, {
        idempotencyKey: "workspace-prepare-command-0001",
      }),
    /borrador RTM/
  );

  const bytesOpen = safeWorkspace();
  bytesOpen.workspace.document_bytes_available = true;
  const blocked = createRtmSignerStationClient({
    fetchImpl: async () => jsonResponse(bytesOpen),
  });
  await assert.rejects(
    () =>
      blocked.prepareWorkspace(DELIVERY_ID, CLAIM_ID, INSTALLATION_ID, {
        idempotencyKey: "workspace-prepare-command-0001",
      }),
    /borrador RTM/
  );

  const wrongBinding = safeWorkspace();
  wrongBinding.workspace.claim_id = "88888888-8888-4888-8888-888888888888";
  const mismatched = createRtmSignerStationClient({
    fetchImpl: async () => jsonResponse(wrongBinding),
  });
  await assert.rejects(
    () =>
      mismatched.prepareWorkspace(DELIVERY_ID, CLAIM_ID, INSTALLATION_ID, {
        idempotencyKey: "workspace-prepare-command-0001",
      }),
    /no coincide con tarea, toma y puesto local/
  );

  const exposedEnvelope = safeWorkspace();
  exposedEnvelope.document_bytes_exposed = true;
  const exposed = createRtmSignerStationClient({
    fetchImpl: async () => jsonResponse(exposedEnvelope),
  });
  await assert.rejects(
    () =>
      exposed.prepareWorkspace(DELIVERY_ID, CLAIM_ID, INSTALLATION_ID, {
        idempotencyKey: "workspace-prepare-command-0001",
      }),
    /sobre sintético y solo de metadatos/
  );
});

test("installation input rejects malformed identity before network", async () => {
  let called = false;
  const client = createRtmSignerStationClient({
    fetchImpl: async () => {
      called = true;
      return jsonResponse(safeStation());
    },
  });

  await assert.rejects(
    () =>
      client.registerInstallation({
        clientInstanceId: INSTANCE_ID,
        clientBindingSha256: "bad",
        stationLabel: "PC firma Ramon",
        clientVersion: "1.0.0",
      }),
    /huella declarada/
  );
  assert.equal(called, false);
});
