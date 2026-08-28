import assert from "node:assert/strict";
import test from "node:test";

import {
  createSyntheticTicketBroker,
} from "../lib/ticket-client.js";
import { sha256Hex } from "../lib/policy.js";
import {
  syntheticPackageDefinition,
} from "../lib/synthetic-package.js";

test("synthetic tickets are one-use, ordered and return only an in-memory Blob", async () => {
  const broker = await createSyntheticTicketBroker(
    syntheticPackageDefinition("http://localhost:8765")
  );
  assert.deepEqual(
    broker.package.fields.map((field) => field.order),
    [1, 2, 3]
  );
  assert.equal(broker.remainingTickets(), 3);

  const field = broker.package.fields[0];
  const redeemed = await broker.redeem({
    ticket: field.ticket,
    slotId: field.slotId,
    targetOrigin: broker.package.targetOrigin,
  });
  assert.ok(redeemed.blob instanceof Blob);
  assert.equal(redeemed.filename, field.filename);
  assert.equal(await sha256Hex(redeemed.blob), field.sha256);
  assert.equal(broker.remainingTickets(), 2);

  await assert.rejects(
    broker.redeem({
      ticket: field.ticket,
      slotId: field.slotId,
      targetOrigin: broker.package.targetOrigin,
    }),
    /ticket_invalid_or_consumed/
  );
  broker.close();
  assert.equal(broker.remainingTickets(), 0);
});

test("a context mismatch consumes the ticket and discloses no document", async () => {
  const broker = await createSyntheticTicketBroker(
    syntheticPackageDefinition("http://localhost:8765")
  );
  const field = broker.package.fields[1];
  await assert.rejects(
    broker.redeem({
      ticket: field.ticket,
      slotId: "fine",
      targetOrigin: broker.package.targetOrigin,
    }),
    /ticket_context_mismatch/
  );
  await assert.rejects(
    broker.redeem({
      ticket: field.ticket,
      slotId: field.slotId,
      targetOrigin: broker.package.targetOrigin,
    }),
    /ticket_invalid_or_consumed/
  );
  broker.close();
});

test("an unapproved origin also consumes the attempted ticket", async () => {
  const broker = await createSyntheticTicketBroker(
    syntheticPackageDefinition("http://localhost:8765")
  );
  const field = broker.package.fields[2];
  await assert.rejects(
    broker.redeem({
      ticket: field.ticket,
      slotId: field.slotId,
      targetOrigin: "https://example.com",
    }),
    /portal_origin_not_allowed/
  );
  await assert.rejects(
    broker.redeem({
      ticket: field.ticket,
      slotId: field.slotId,
      targetOrigin: broker.package.targetOrigin,
    }),
    /ticket_invalid_or_consumed/
  );
  broker.close();
});

test("expired tickets are consumed and their document is never returned", async () => {
  let now = 1_000_000;
  const broker = await createSyntheticTicketBroker(
    syntheticPackageDefinition("http://localhost:8765"),
    { ttlMs: 1_000, clock: () => now }
  );
  const field = broker.package.fields[0];
  now += 1_000;

  await assert.rejects(
    broker.redeem({
      ticket: field.ticket,
      slotId: field.slotId,
      targetOrigin: broker.package.targetOrigin,
    }),
    /ticket_expired/
  );
  await assert.rejects(
    broker.redeem({
      ticket: field.ticket,
      slotId: field.slotId,
      targetOrigin: broker.package.targetOrigin,
    }),
    /ticket_invalid_or_consumed/
  );
  broker.close();
});

test("an expiry sweep removes every stale ticket without a redemption attempt", async () => {
  let now = 2_000_000;
  const broker = await createSyntheticTicketBroker(
    syntheticPackageDefinition("http://localhost:8765"),
    { ttlMs: 1_000, clock: () => now }
  );
  const ticket = broker.package.fields[0].ticket;
  now += 1_000;

  assert.equal(broker.remainingTickets(), 0);
  await assert.rejects(
    broker.redeem({
      ticket,
      slotId: broker.package.fields[0].slotId,
      targetOrigin: broker.package.targetOrigin,
    }),
    /ticket_invalid_or_consumed/
  );
  broker.close();
});

test("a broken runtime clock closes the whole broker fail-closed", async () => {
  let now = 3_000_000;
  const broker = await createSyntheticTicketBroker(
    syntheticPackageDefinition("http://localhost:8765"),
    { ttlMs: 1_000, clock: () => now }
  );
  const field = broker.package.fields[0];
  now = Number.NaN;

  await assert.rejects(
    broker.redeem({
      ticket: field.ticket,
      slotId: field.slotId,
      targetOrigin: broker.package.targetOrigin,
    }),
    /ticket_clock_invalid/
  );
  assert.equal(broker.remainingTickets(), 0);
});
