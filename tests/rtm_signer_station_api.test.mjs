import assert from "node:assert/strict";
import test from "node:test";

import {
  createRtmSignerStationClient,
  newSignerCommandKey,
} from "../src/rtm-presenter/rtmSignerStationApi.js";


const DELIVERY_ID = "11111111-1111-4111-8111-111111111111";
const CLAIM_ID = "22222222-2222-4222-8222-222222222222";

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
