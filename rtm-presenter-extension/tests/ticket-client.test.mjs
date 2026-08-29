import assert from "node:assert/strict";
import test from "node:test";

import { createSyntheticTicketBroker } from "../lib/ticket-client.js";
import { sha256Hex } from "../lib/policy.js";
import { syntheticWorkspaceDefinition } from "../lib/synthetic-workspace.js";

const origin = "http://localhost:8765";
const intentId = `syn_intent_${"a".repeat(32)}`;

function context(broker, overrides = {}) {
  const document = broker.workspace.documents[0];
  return {
    intentId,
    slotId: "fine",
    documentId: document.documentId,
    targetOrigin: origin,
    operatorId: broker.workspace.operatorId,
    sessionId: broker.workspace.sessionId,
    ...overrides,
  };
}

test("a loose document ticket is issued on demand, one-use and in-memory", async () => {
  const broker = await createSyntheticTicketBroker(syntheticWorkspaceDefinition(origin));
  assert.equal(broker.remainingTickets(), 0);
  assert.equal(broker.workspace.documents.length, 4);
  assert.equal(broker.workspace.portalFields.length, 3);
  const request = context(broker);
  const capability = broker.issue(request);
  assert.equal(broker.remainingTickets(), 1);
  const redeemed = await broker.redeem({ ...request, ticket: capability.ticket });
  assert.ok(redeemed.blob instanceof Blob);
  assert.equal(await sha256Hex(redeemed.blob), broker.workspace.documents[0].sha256);
  assert.equal(redeemed.version, broker.workspace.documents[0].version);
  assert.equal(broker.remainingTickets(), 0);
  await assert.rejects(
    broker.redeem({ ...request, ticket: capability.ticket }),
    /ticket_invalid_or_consumed/
  );
  assert.throws(() => broker.issue(request), /intent_ticket_already_issued/);
  broker.close();
});

test("context mismatch consumes before validation and discloses no bytes", async () => {
  const broker = await createSyntheticTicketBroker(syntheticWorkspaceDefinition(origin));
  const request = context(broker);
  const capability = broker.issue(request);
  await assert.rejects(
    broker.redeem({ ...request, sessionId: "WRONG", ticket: capability.ticket }),
    /ticket_context_mismatch/
  );
  await assert.rejects(
    broker.redeem({ ...request, ticket: capability.ticket }),
    /ticket_invalid_or_consumed/
  );
  broker.close();
});

test("wrong document for a verified field is blocked before ticket issue", async () => {
  const broker = await createSyntheticTicketBroker(syntheticWorkspaceDefinition(origin));
  const identity = broker.workspace.documents.find((document) => document.purpose === "identity");
  assert.throws(
    () => broker.issue(context(broker, { documentId: identity.documentId })),
    /document_not_compatible_with_field/
  );
  assert.equal(broker.remainingTickets(), 0);
  broker.close();
});

test("expired tickets remain unavailable", async () => {
  let now = 1_000_000;
  const broker = await createSyntheticTicketBroker(syntheticWorkspaceDefinition(origin), {
    ttlMs: 1_000,
    clock: () => now,
  });
  const request = context(broker);
  const capability = broker.issue(request);
  now += 1_000;
  await assert.rejects(
    broker.redeem({ ...request, ticket: capability.ticket }),
    /ticket_expired/
  );
  assert.equal(broker.remainingTickets(), 0);
  broker.close();
});

test("a broken clock closes broker fail-closed", async () => {
  let now = 2_000_000;
  const broker = await createSyntheticTicketBroker(syntheticWorkspaceDefinition(origin), {
    ttlMs: 1_000,
    clock: () => now,
  });
  const request = context(broker);
  const capability = broker.issue(request);
  now = Number.NaN;
  await assert.rejects(
    broker.redeem({ ...request, ticket: capability.ticket }),
    /ticket_clock_invalid/
  );
  assert.equal(broker.remainingTickets(), 0);
});
