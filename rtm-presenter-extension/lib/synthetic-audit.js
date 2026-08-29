import {
  assertDocumentVersion,
  assertIsoTimestamp,
  assertSafeDocumentId,
  assertSafeIntentId,
  assertSafePdfName,
  assertSafeSlot,
  assertSha256,
  assertSyntheticPortalOrigin,
} from "./policy.js";

function assertTabId(value) {
  const tabId = Number(value);
  if (!Number.isSafeInteger(tabId) || tabId < 1) throw new Error("tab_id_invalid");
  return tabId;
}

function immutableCopy(value) {
  return structuredClone(value);
}

export function createSyntheticAuditLedger() {
  const intents = new Map();
  const events = [];
  const receipts = new Set();

  function append(event) {
    const frozen = Object.freeze(immutableCopy(event));
    events.push(frozen);
    return immutableCopy(frozen);
  }

  return {
    recordIntent({
      intentId: intentInput,
      tabId: tabInput,
      targetOrigin: originInput,
      slotId: slotInput,
      fieldTitle,
      requestedAt: requestedAtInput,
    }) {
      const intentId = assertSafeIntentId(intentInput);
      if (intents.has(intentId)) throw new Error("intent_duplicate");
      const intent = {
        type: "rtm.presenter.portal_attachment_intent.v1",
        environment: "staging",
        syntheticOnly: true,
        legalEffect: false,
        intentId,
        tabId: assertTabId(tabInput),
        targetOrigin: assertSyntheticPortalOrigin(originInput),
        slotId: assertSafeSlot(slotInput),
        fieldTitle: String(fieldTitle || ""),
        requestedAt: assertIsoTimestamp(requestedAtInput, "requested_at_invalid"),
        status: "requested",
      };
      if (!intent.fieldTitle || intent.fieldTitle.length > 160) {
        throw new Error("field_title_invalid");
      }
      intents.set(intentId, intent);
      return append(intent);
    },

    recordAttached({
      intentId: intentInput,
      tabId: tabInput,
      targetOrigin: originInput,
      slotId: slotInput,
      documentId: documentInput,
      filename: filenameInput,
      version: versionInput,
      sha256: shaInput,
      attachedAt: attachedAtInput,
    }) {
      const intentId = assertSafeIntentId(intentInput);
      const intent = intents.get(intentId);
      if (!intent || intent.status !== "requested") {
        throw new Error("intent_not_attachable");
      }
      const tabId = assertTabId(tabInput);
      const targetOrigin = assertSyntheticPortalOrigin(originInput);
      const slotId = assertSafeSlot(slotInput);
      if (
        tabId !== intent.tabId ||
        targetOrigin !== intent.targetOrigin ||
        slotId !== intent.slotId
      ) {
        throw new Error("intent_context_mismatch");
      }
      const event = {
        type: "rtm.presenter.portal_document_attached.v1",
        environment: "staging",
        syntheticOnly: true,
        legalEffect: false,
        intentId,
        tabId,
        targetOrigin,
        slotId,
        documentId: assertSafeDocumentId(documentInput),
        filename: assertSafePdfName(filenameInput),
        version: assertDocumentVersion(versionInput),
        sha256: assertSha256(shaInput),
        attachedAt: assertIsoTimestamp(attachedAtInput, "attached_at_invalid"),
        submissionProven: false,
      };
      intent.status = "attached";
      intent.documentId = event.documentId;
      intent.filename = event.filename;
      intent.version = event.version;
      intent.sha256 = event.sha256;
      intent.attachedAt = event.attachedAt;
      return append(event);
    },

    recordReceiptPending({
      tabId: tabInput,
      targetOrigin: originInput,
      receiptId: receiptInput,
      claimedSentAt: claimedSentAtInput,
      incorporatedAt: incorporatedAtInput,
      sessionId: sessionInput,
      filename: filenameInput,
      contentType: contentTypeInput,
      receiptSha256: receiptShaInput,
      receiptSize: receiptSizeInput,
      attachments: attachmentInputs,
    }) {
      const tabId = assertTabId(tabInput);
      const targetOrigin = assertSyntheticPortalOrigin(originInput);
      const receiptId = String(receiptInput || "");
      if (!/^SYN-RECEIPT-[A-F0-9]{12}$/.test(receiptId)) {
        throw new Error("receipt_id_invalid");
      }
      if (receipts.has(receiptId)) throw new Error("receipt_duplicate");
      const claimedSentAt = assertIsoTimestamp(
        claimedSentAtInput,
        "claimed_sent_at_invalid"
      );
      const incorporatedAt = assertIsoTimestamp(
        incorporatedAtInput,
        "incorporated_at_invalid"
      );
      if (Date.parse(incorporatedAt) < Date.parse(claimedSentAt)) {
        throw new Error("receipt_incorporated_before_claimed_send");
      }
      const sessionId = String(sessionInput || "");
      if (sessionId !== "SYN-SESSION-LOCAL-0001") {
        throw new Error("receipt_session_invalid");
      }
      const filename = String(filenameInput || "");
      if (!/^JUSTIFICANTE_SINTETICO_[A-F0-9]{12}\.json$/.test(filename)) {
        throw new Error("receipt_filename_invalid");
      }
      const contentType = String(contentTypeInput || "");
      if (contentType !== "application/json") {
        throw new Error("receipt_content_type_invalid");
      }
      const receiptSha256 = assertSha256(receiptShaInput);
      const receiptSize = Number(receiptSizeInput);
      if (!Number.isSafeInteger(receiptSize) || receiptSize < 32 || receiptSize > 131_072) {
        throw new Error("receipt_size_invalid");
      }
      if (!Array.isArray(attachmentInputs) || attachmentInputs.length < 1) {
        throw new Error("receipt_attachments_invalid");
      }

      const attachments = attachmentInputs.map((source) => {
        const intentId = assertSafeIntentId(source.intentId);
        const intent = intents.get(intentId);
        if (!intent || intent.status !== "attached") {
          throw new Error("receipt_attachment_unknown");
        }
        const slotId = assertSafeSlot(source.slotId);
        const documentId = assertSafeDocumentId(source.documentId);
        const filename = assertSafePdfName(source.filename);
        const version = assertDocumentVersion(source.version);
        const sha256 = assertSha256(source.sha256);
        const attachedAt = assertIsoTimestamp(source.attachedAt, "attached_at_invalid");
        if (
          intent.tabId !== tabId ||
          intent.targetOrigin !== targetOrigin ||
          intent.slotId !== slotId ||
          intent.documentId !== documentId ||
          intent.filename !== filename ||
          intent.version !== version ||
          intent.sha256 !== sha256 ||
          intent.attachedAt !== attachedAt ||
          Date.parse(claimedSentAt) <= Date.parse(attachedAt)
        ) {
          throw new Error("receipt_attachment_mismatch");
        }
        return { intentId, slotId, documentId, filename, version, sha256, attachedAt };
      });
      if (new Set(attachments.map((entry) => entry.intentId)).size !== attachments.length) {
        throw new Error("receipt_attachment_duplicate");
      }

      receipts.add(receiptId);
      for (const attachment of attachments) {
        intents.get(attachment.intentId).status = "receipt_pending";
      }
      return append({
        type: "rtm.presenter.portal_receipt_pending.v1",
        environment: "staging",
        syntheticOnly: true,
        legalEffect: false,
        tabId,
        targetOrigin,
        receiptId,
        claimedSentAt,
        sentAt: null,
        incorporatedAt,
        sessionId,
        filename,
        contentType,
        receiptSha256,
        receiptSize,
        attachments,
        status: "receipt_pending",
        receiptVerified: false,
        followUpSignal: null,
        trust: "unverified_portal_document",
      });
    },

    snapshot() {
      return immutableCopy(events);
    },
  };
}
