import assert from "node:assert/strict";
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
      task: { delivery_id: DELIVERY_ID, items: [] },
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
      task: {
        delivery_id: DELIVERY_ID,
        task_fingerprint_sha256: "b".repeat(64),
        portal_preparation: { fields: [] },
        items: [],
      },
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
    },
  };
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
  assert.equal(resumed.workspace.task.task_fingerprint_sha256, "b".repeat(64));
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
