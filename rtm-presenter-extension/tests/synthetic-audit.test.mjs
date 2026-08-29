import assert from "node:assert/strict";
import test from "node:test";

import { createSyntheticAuditLedger } from "../lib/synthetic-audit.js";

const intent = {
  intentId: `syn_intent_${"a".repeat(32)}`,
  tabId: 7,
  targetOrigin: "http://localhost:8765",
  slotId: "fine",
  fieldTitle: "Multa original solicitada por la sede",
  requestedAt: "2026-08-29T18:00:00.000Z",
};
const attached = {
  ...intent,
  documentId: "syn-doc-fine",
  filename: "MULTA_ORIGINAL_SINTETICA_v3.pdf",
  version: 3,
  sha256: "b".repeat(64),
  attachedAt: "2026-08-29T18:00:01.000Z",
};

test("intent and attached are distinct and attached never proves submission", () => {
  const ledger = createSyntheticAuditLedger();
  ledger.recordIntent(intent);
  const event = ledger.recordAttached(attached);
  assert.equal(event.type, "rtm.presenter.portal_document_attached.v1");
  assert.equal(event.attachedAt, attached.attachedAt);
  assert.equal(event.submissionProven, false);
});

function pendingReceipt(overrides = {}) {
  return {
    tabId: intent.tabId,
    targetOrigin: intent.targetOrigin,
    receiptId: "SYN-RECEIPT-A1B2C3D4E5F6",
    claimedSentAt: "2026-08-29T18:00:02.000Z",
    incorporatedAt: "2026-08-29T18:00:03.000Z",
    sessionId: "SYN-SESSION-LOCAL-0001",
    filename: "JUSTIFICANTE_SINTETICO_A1B2C3D4E5F6.json",
    contentType: "application/json",
    receiptSha256: "d".repeat(64),
    receiptSize: 1024,
    attachments: [{
      intentId: intent.intentId,
      slotId: intent.slotId,
      documentId: attached.documentId,
      filename: attached.filename,
      version: attached.version,
      sha256: attached.sha256,
      attachedAt: attached.attachedAt,
    }],
    ...overrides,
  };
}

test("incorporated receipt remains pending with sentAt null", () => {
  const ledger = createSyntheticAuditLedger();
  ledger.recordIntent(intent);
  ledger.recordAttached(attached);
  const event = ledger.recordReceiptPending(pendingReceipt());
  assert.equal(event.sentAt, null);
  assert.equal(event.receiptVerified, false);
  assert.equal(event.followUpSignal, null);
  assert.equal(event.status, "receipt_pending");
  assert.equal(event.trust, "unverified_portal_document");
});

test("pending receipt cannot alter filename, version or SHA snapshot", () => {
  const ledger = createSyntheticAuditLedger();
  ledger.recordIntent(intent);
  ledger.recordAttached(attached);
  assert.throws(
    () => ledger.recordReceiptPending(pendingReceipt({
      attachments: [{
        intentId: intent.intentId,
        slotId: intent.slotId,
        documentId: attached.documentId,
        filename: attached.filename,
        version: attached.version,
        sha256: "c".repeat(64),
        attachedAt: attached.attachedAt,
      }],
    })),
    /receipt_attachment_mismatch/
  );
});

test("pending receipt is bound to the synthetic session", () => {
  const ledger = createSyntheticAuditLedger();
  ledger.recordIntent(intent);
  ledger.recordAttached(attached);
  assert.throws(
    () => ledger.recordReceiptPending(pendingReceipt({ sessionId: "OTHER" })),
    /receipt_session_invalid/
  );
});
