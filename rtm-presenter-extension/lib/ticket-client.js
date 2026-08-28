import {
  MAX_DOCUMENT_BYTES,
  assertPdfMagic,
  assertSafePdfName,
  assertSafeSlot,
  assertSafeTicket,
  assertSyntheticPortalOrigin,
  sha256Hex,
} from "./policy.js";

export const SYNTHETIC_TICKET_TTL_MS = 90_000;

function randomTicket(prefix = "syn") {
  const random = globalThis.crypto.randomUUID().replaceAll("-", "");
  return `${prefix}_${random}`;
}

export async function createSyntheticTicketBroker(
  packageDefinition,
  { ttlMs = SYNTHETIC_TICKET_TTL_MS, clock = () => Date.now() } = {}
) {
  if (
    packageDefinition?.syntheticOnly !== true ||
    packageDefinition?.legalEffect !== false
  ) {
    throw new Error("synthetic_package_required");
  }

  const targetOrigin = assertSyntheticPortalOrigin(packageDefinition.targetOrigin);
  if (!Number.isInteger(ttlMs) || ttlMs < 1_000 || ttlMs > 300_000) {
    throw new Error("ticket_ttl_invalid");
  }
  if (typeof clock !== "function") throw new Error("ticket_clock_invalid");
  const vault = new Map();
  const fields = [];
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

  function zeroizeVault() {
    for (const entry of vault.values()) entry.bytes.fill(0);
    vault.clear();
  }

  function closeBroker() {
    closed = true;
    clearExpiryTimer();
    zeroizeVault();
  }

  function purgeExpiredEntries(at) {
    let removed = 0;
    for (const [ticket, entry] of vault.entries()) {
      if (at < entry.expiresAt) continue;
      vault.delete(ticket);
      entry.bytes.fill(0);
      removed += 1;
    }
    return removed;
  }

  function scheduleExpirySweep(at = readClock()) {
    clearExpiryTimer();
    if (closed || vault.size === 0) return;
    const nextExpiry = Math.min(
      ...Array.from(vault.values(), (entry) => entry.expiresAt)
    );
    expiryTimer = setTimeout(() => {
      expiryTimer = null;
      if (closed) return;
      try {
        const sweepTime = readClock();
        purgeExpiredEntries(sweepTime);
        scheduleExpirySweep(sweepTime);
      } catch {
        // A broken clock must not extend access to in-memory document bytes.
        closeBroker();
      }
    }, Math.max(0, nextExpiry - at));
    expiryTimer?.unref?.();
  }

  let buildingBytes = null;
  try {
    for (const source of [...packageDefinition.fields].sort(
      (left, right) => left.order - right.order
    )) {
      const slotId = assertSafeSlot(source.slotId);
      const filename = assertSafePdfName(source.filename);
      buildingBytes = new Uint8Array(source.bytes);
      assertPdfMagic(buildingBytes);
      if (buildingBytes.byteLength > MAX_DOCUMENT_BYTES) {
        throw new Error("document_too_large");
      }
      const sha256 = await sha256Hex(buildingBytes);
      const ticket = randomTicket();
      if (vault.has(ticket)) throw new Error("ticket_collision");
      const expiresAt = readClock() + ttlMs;
      if (!Number.isSafeInteger(expiresAt)) throw new Error("ticket_clock_invalid");
      vault.set(ticket, {
        targetOrigin,
        slotId,
        filename,
        mimeType: "application/pdf",
        sha256,
        bytes: buildingBytes,
        expiresAt,
      });
      fields.push({
        order: source.order,
        slotId,
        title: source.title,
        required: source.required === true,
        filename,
        mimeType: "application/pdf",
        size: buildingBytes.byteLength,
        sha256,
        selector: source.selector,
        fingerprint: { ...source.fingerprint },
        ticket,
        expiresAt,
      });
      buildingBytes = null;
    }
    scheduleExpirySweep();
  } catch (error) {
    buildingBytes?.fill(0);
    closeBroker();
    throw error;
  }

  return {
    package: {
      environment: "staging",
      syntheticOnly: true,
      legalEffect: false,
      caseId: packageDefinition.caseId,
      packageId: packageDefinition.packageId,
      portalName: packageDefinition.portalName,
      targetOrigin,
      fields,
    },
    async redeem({ ticket: ticketInput, slotId: slotInput, targetOrigin: originInput }) {
      if (closed) throw new Error("ticket_broker_closed");
      const ticket = assertSafeTicket(ticketInput);
      const entry = vault.get(ticket);
      if (!entry) throw new Error("ticket_invalid_or_consumed");

      // Delete before any contextual validation: every attempt consumes the ticket.
      vault.delete(ticket);
      let redemptionTime;
      try {
        redemptionTime = readClock();
        scheduleExpirySweep(redemptionTime);
      } catch (error) {
        entry.bytes.fill(0);
        closeBroker();
        throw error;
      }
      if (redemptionTime >= entry.expiresAt) {
        entry.bytes.fill(0);
        throw new Error("ticket_expired");
      }
      let requestedOrigin;
      let requestedSlot;
      try {
        requestedOrigin = assertSyntheticPortalOrigin(originInput);
        requestedSlot = assertSafeSlot(slotInput);
      } catch (error) {
        entry.bytes.fill(0);
        throw error;
      }
      if (requestedOrigin !== entry.targetOrigin || requestedSlot !== entry.slotId) {
        entry.bytes.fill(0);
        throw new Error("ticket_context_mismatch");
      }

      try {
        const blob = new Blob([entry.bytes], { type: entry.mimeType });
        return {
          blob,
          filename: entry.filename,
          mimeType: entry.mimeType,
          size: blob.size,
          sha256: entry.sha256,
        };
      } finally {
        entry.bytes.fill(0);
      }
    },
    close() {
      closeBroker();
    },
    remainingTickets() {
      if (closed) return 0;
      try {
        const now = readClock();
        if (purgeExpiredEntries(now) > 0) scheduleExpirySweep(now);
      } catch (error) {
        closeBroker();
        throw error;
      }
      return vault.size;
    },
  };
}
