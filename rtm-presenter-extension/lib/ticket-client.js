import {
  MAX_DOCUMENT_BYTES,
  assertDocumentVersion,
  assertPdfMagic,
  assertSafeDocumentId,
  assertSafeIntentId,
  assertSafePdfName,
  assertSafeSlot,
  assertSafeTicket,
  assertSyntheticPortalOrigin,
  sha256Hex,
} from "./policy.js";

export const SYNTHETIC_TICKET_TTL_MS = 90_000;

function randomTicket() {
  return `syn_${globalThis.crypto.randomUUID().replaceAll("-", "")}`;
}

export async function createSyntheticTicketBroker(
  workspaceDefinition,
  { ttlMs = SYNTHETIC_TICKET_TTL_MS, clock = () => Date.now() } = {}
) {
  if (
    workspaceDefinition?.syntheticOnly !== true ||
    workspaceDefinition?.legalEffect !== false ||
    workspaceDefinition?.remoteBridgeEnabled !== false
  ) {
    throw new Error("synthetic_workspace_required");
  }

  const targetOrigin = assertSyntheticPortalOrigin(workspaceDefinition.targetOrigin);
  if (!Number.isInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 300_000) {
    throw new Error("ticket_ttl_invalid");
  }
  if (typeof clock !== "function") throw new Error("ticket_clock_invalid");

  const documentVault = new Map();
  const tickets = new Map();
  const issuedIntents = new Set();
  const fieldsBySlot = new Map();
  const publicDocuments = [];
  const publicFields = [];
  let closed = false;
  let expiryTimer = null;

  function readClock() {
    const value = Number(clock());
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error("ticket_clock_invalid");
    }
    return value;
  }

  function clearExpiryTimer() {
    if (expiryTimer !== null) {
      clearTimeout(expiryTimer);
      expiryTimer = null;
    }
  }

  function zeroize() {
    documentVault.clear();
    tickets.clear();
    issuedIntents.clear();
  }

  function closeBroker() {
    closed = true;
    clearExpiryTimer();
    zeroize();
  }

  function purgeExpiredTickets(at) {
    let removed = 0;
    for (const [ticket, entry] of tickets.entries()) {
      if (at < entry.expiresAt) continue;
      tickets.delete(ticket);
      removed += 1;
    }
    return removed;
  }

  function scheduleExpirySweep(at = readClock()) {
    clearExpiryTimer();
    if (closed || tickets.size === 0) return;
    const nextExpiry = Math.min(
      ...Array.from(tickets.values(), (entry) => entry.expiresAt)
    );
    expiryTimer = setTimeout(() => {
      expiryTimer = null;
      if (closed) return;
      try {
        const sweepTime = readClock();
        purgeExpiredTickets(sweepTime);
        scheduleExpirySweep(sweepTime);
      } catch {
        closeBroker();
      }
    }, Math.max(0, nextExpiry - at));
    expiryTimer?.unref?.();
  }

  try {
    for (const source of workspaceDefinition.portalFields || []) {
      const slotId = assertSafeSlot(source.slotId);
      if (fieldsBySlot.has(slotId)) throw new Error("portal_field_duplicate");
      const field = {
        order: Number(source.order),
        slotId,
        title: String(source.title || ""),
        required: source.required === true,
        selector: String(source.selector || ""),
        fingerprint: { ...source.fingerprint },
      };
      fieldsBySlot.set(slotId, field);
      publicFields.push(field);
    }

    for (const source of workspaceDefinition.documents || []) {
      const documentId = assertSafeDocumentId(source.documentId);
      if (documentVault.has(documentId)) throw new Error("document_duplicate");
      const filename = assertSafePdfName(source.filename);
      const version = assertDocumentVersion(source.version);
      if (typeof source.loadBytes !== "function") {
        throw new Error("document_loader_invalid");
      }
      const bytes = new Uint8Array(source.loadBytes());
      assertPdfMagic(bytes);
      if (bytes.byteLength > MAX_DOCUMENT_BYTES) {
        bytes.fill(0);
        throw new Error("document_too_large");
      }
      const compatibleSlots = (source.compatibleSlots || []).map(assertSafeSlot);
      if (compatibleSlots.some((slotId) => !fieldsBySlot.has(slotId))) {
        bytes.fill(0);
        throw new Error("document_slot_unknown");
      }
      const sha256 = await sha256Hex(bytes);
      const document = {
        documentId,
        title: String(source.title || ""),
        purpose: String(source.purpose || ""),
        filename,
        version,
        mimeType: "application/pdf",
        size: bytes.byteLength,
        sha256,
        compatibleSlots,
        loadBytes: source.loadBytes,
      };
      documentVault.set(documentId, document);
      publicDocuments.push({
        documentId,
        title: document.title,
        purpose: document.purpose,
        filename,
        version,
        mimeType: document.mimeType,
        size: document.size,
        sha256,
        compatibleSlots: [...compatibleSlots],
      });
      bytes.fill(0);
    }
  } catch (error) {
    closeBroker();
    throw error;
  }

  return {
    workspace: {
      environment: "staging",
      syntheticOnly: true,
      legalEffect: false,
      remoteBridgeEnabled: false,
      caseId: String(workspaceDefinition.caseId || ""),
      containerId: String(workspaceDefinition.containerId || ""),
      operatorId: String(workspaceDefinition.operatorId || ""),
      sessionId: String(workspaceDefinition.sessionId || ""),
      profileId: String(workspaceDefinition.profileId || ""),
      adapterVersion: String(workspaceDefinition.adapterVersion || ""),
      portalName: String(workspaceDefinition.portalName || ""),
      targetOrigin,
      portalFields: publicFields.sort((left, right) => left.order - right.order),
      documents: publicDocuments,
    },

    issue({
      intentId: intentInput,
      slotId: slotInput,
      documentId: documentInput,
      targetOrigin: originInput,
      operatorId: operatorInput,
      sessionId: sessionInput,
    }) {
      if (closed) throw new Error("ticket_broker_closed");
      const intentId = assertSafeIntentId(intentInput);
      const slotId = assertSafeSlot(slotInput);
      const documentId = assertSafeDocumentId(documentInput);
      const requestedOrigin = assertSyntheticPortalOrigin(originInput);
      const operatorId = String(operatorInput || "");
      const sessionId = String(sessionInput || "");
      const field = fieldsBySlot.get(slotId);
      const document = documentVault.get(documentId);
      if (!field) throw new Error("portal_field_unknown");
      if (!document) throw new Error("document_unknown");
      if (
        requestedOrigin !== targetOrigin ||
        operatorId !== String(workspaceDefinition.operatorId || "") ||
        sessionId !== String(workspaceDefinition.sessionId || "")
      ) {
        throw new Error("ticket_context_mismatch");
      }
      if (!document.compatibleSlots.includes(slotId)) {
        throw new Error("document_not_compatible_with_field");
      }
      if (issuedIntents.has(intentId)) throw new Error("intent_ticket_already_issued");

      const ticket = randomTicket();
      if (tickets.has(ticket)) throw new Error("ticket_collision");
      const issuedAt = readClock();
      const expiresAt = issuedAt + ttlMs;
      if (!Number.isSafeInteger(expiresAt)) throw new Error("ticket_clock_invalid");
      tickets.set(ticket, {
        intentId,
        slotId,
        documentId,
        targetOrigin,
        operatorId: String(workspaceDefinition.operatorId || ""),
        sessionId: String(workspaceDefinition.sessionId || ""),
        profileId: String(workspaceDefinition.profileId || ""),
        adapterVersion: String(workspaceDefinition.adapterVersion || ""),
        selector: field.selector,
        fingerprint: { ...field.fingerprint },
        filename: document.filename,
        version: document.version,
        mimeType: document.mimeType,
        size: document.size,
        sha256: document.sha256,
        issuedAt,
        expiresAt,
      });
      issuedIntents.add(intentId);
      scheduleExpirySweep(issuedAt);
      return { ticket, intentId, slotId, documentId, expiresAt };
    },

    async redeem({
      ticket: ticketInput,
      intentId: intentInput,
      slotId: slotInput,
      documentId: documentInput,
      targetOrigin: originInput,
      operatorId: operatorInput,
      sessionId: sessionInput,
    }) {
      if (closed) throw new Error("ticket_broker_closed");
      const ticket = assertSafeTicket(ticketInput);
      const entry = tickets.get(ticket);
      if (!entry) throw new Error("ticket_invalid_or_consumed");

      // Every attempt consumes the capability before contextual validation.
      tickets.delete(ticket);
      let redemptionTime;
      try {
        redemptionTime = readClock();
        scheduleExpirySweep(redemptionTime);
      } catch (error) {
        closeBroker();
        throw error;
      }
      if (redemptionTime >= entry.expiresAt) throw new Error("ticket_expired");

      const intentId = assertSafeIntentId(intentInput);
      const slotId = assertSafeSlot(slotInput);
      const documentId = assertSafeDocumentId(documentInput);
      const requestedOrigin = assertSyntheticPortalOrigin(originInput);
      const operatorId = String(operatorInput || "");
      const sessionId = String(sessionInput || "");
      if (
        intentId !== entry.intentId ||
        slotId !== entry.slotId ||
        documentId !== entry.documentId ||
        requestedOrigin !== entry.targetOrigin ||
        operatorId !== entry.operatorId ||
        sessionId !== entry.sessionId
      ) {
        throw new Error("ticket_context_mismatch");
      }

      const document = documentVault.get(documentId);
      if (!document) throw new Error("document_unknown");
      const bytes = new Uint8Array(document.loadBytes());
      try {
        assertPdfMagic(bytes);
        if (
          bytes.byteLength !== entry.size ||
          (await sha256Hex(bytes)) !== entry.sha256
        ) {
          throw new Error("ticket_document_mismatch");
        }
        const blob = new Blob([bytes], { type: entry.mimeType });
        return {
          blob,
          documentId,
          filename: entry.filename,
          version: entry.version,
          mimeType: entry.mimeType,
          size: entry.size,
          sha256: entry.sha256,
          profileId: entry.profileId,
          adapterVersion: entry.adapterVersion,
          selector: entry.selector,
          fingerprint: { ...entry.fingerprint },
        };
      } finally {
        bytes.fill(0);
      }
    },

    close() {
      closeBroker();
    },

    remainingTickets() {
      if (closed) return 0;
      try {
        const now = readClock();
        if (purgeExpiredTickets(now) > 0) scheduleExpirySweep(now);
      } catch (error) {
        closeBroker();
        throw error;
      }
      return tickets.size;
    },
  };
}
