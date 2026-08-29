import { assertSyntheticPortalOrigin, sha256Hex } from "./lib/policy.js";
import { createSyntheticAuditLedger } from "./lib/synthetic-audit.js";
import {
  SYNTHETIC_BRIDGE_IDENTITY,
  syntheticPortalField,
} from "./lib/synthetic-workspace.js";

const pendingIntents = new Map();
const ledgers = new Map();
const pendingReceiptBytes = new Map();

function nowIso() {
  return new Date().toISOString();
}

function ledgerFor(tabId) {
  let ledger = ledgers.get(tabId);
  if (!ledger) {
    ledger = createSyntheticAuditLedger();
    ledgers.set(tabId, ledger);
  }
  return ledger;
}

function senderContext(sender) {
  const tabId = Number(sender?.tab?.id);
  if (!Number.isSafeInteger(tabId) || tabId < 1 || !sender?.url) {
    throw new Error("portal_sender_invalid");
  }
  const parsed = new URL(sender.url);
  const targetOrigin = assertSyntheticPortalOrigin(parsed.origin);
  if (sender.frameId !== 0) throw new Error("portal_top_frame_required");
  return { tabId, targetOrigin };
}

function exactPortalRequest(message, sender) {
  const context = senderContext(sender);
  if (message?.targetOrigin !== context.targetOrigin) {
    throw new Error("portal_origin_mismatch");
  }
  const expected = syntheticPortalField(message?.slotId);
  if (
    !expected ||
    message?.selector !== expected.selector ||
    message?.fieldTitle !== expected.title
  ) {
    throw new Error("portal_field_profile_mismatch");
  }
  return { ...context, expected };
}

async function broadcast(message) {
  try {
    await chrome.runtime.sendMessage(message);
  } catch {
    // The in-memory intent remains available when the panel opens later.
  }
}

async function configureSidePanel() {
  try {
    await chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });
  } catch {
    // Fail closed: no fallback opens pages or injects code automatically.
  }
}

async function createIntent(message, sender) {
  const { tabId, targetOrigin, expected } = exactPortalRequest(message, sender);
  const intent = {
    intentId: `syn_intent_${crypto.randomUUID().replaceAll("-", "")}`,
    tabId,
    targetOrigin,
    slotId: expected.slotId,
    fieldTitle: expected.title,
    selector: expected.selector,
    requestedAt: nowIso(),
  };
  ledgerFor(tabId).recordIntent(intent);
  pendingIntents.set(tabId, intent);

  try {
    await chrome.sidePanel.open({ tabId });
  } catch {
    // The operator can still open the side panel from the extension action.
  }
  await broadcast({ type: "rtm.presenter.intent.available.v1", intent });
  return { ok: true, intent };
}

function readIntent(message) {
  const tabId = Number(message?.tabId);
  if (!Number.isSafeInteger(tabId) || tabId < 1) throw new Error("tab_id_invalid");
  return { ok: true, intent: pendingIntents.get(tabId) || null };
}

async function recordAttached(message) {
  const tabId = Number(message?.tabId);
  const pending = pendingIntents.get(tabId);
  if (!pending || pending.intentId !== message?.intentId) {
    throw new Error("pending_intent_mismatch");
  }
  const event = ledgerFor(tabId).recordAttached(message);
  pendingIntents.delete(tabId);
  await broadcast({ type: "rtm.presenter.audit.changed.v1", tabId });
  return { ok: true, event };
}

function exactReceiptDocument(value, targetOrigin) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("receipt_document_invalid");
  }
  const allowedKeys = [
    "schema",
    "environment",
    "syntheticOnly",
    "legalEffect",
    "receiptId",
    "targetOrigin",
    "caseId",
    "containerId",
    "sessionId",
    "claimedSentAt",
    "attachments",
  ];
  if (
    Object.keys(value).length !== allowedKeys.length ||
    allowedKeys.some((key) => !(key in value)) ||
    value.schema !== "rtm.mock.portal.receipt.v1" ||
    value.environment !== "staging" ||
    value.syntheticOnly !== true ||
    value.legalEffect !== false ||
    value.targetOrigin !== targetOrigin ||
    value.caseId !== SYNTHETIC_BRIDGE_IDENTITY.caseId ||
    value.containerId !== SYNTHETIC_BRIDGE_IDENTITY.containerId ||
    value.sessionId !== SYNTHETIC_BRIDGE_IDENTITY.sessionId
  ) {
    throw new Error("receipt_document_binding_invalid");
  }
  return value;
}

async function incorporateReceipt(message, sender) {
  const { tabId, targetOrigin } = senderContext(sender);
  if (message?.targetOrigin !== targetOrigin) {
    throw new Error("portal_origin_mismatch");
  }
  if (
    !Array.isArray(message?.bytes) ||
    message.bytes.length < 32 ||
    message.bytes.length > 131_072 ||
    message.bytes.some(
      (value) => !Number.isInteger(value) || value < 0 || value > 255
    )
  ) {
    throw new Error("receipt_bytes_invalid");
  }
  const bytes = Uint8Array.from(message.bytes);
  try {
    const receiptSha256 = await sha256Hex(bytes);
    let parsed;
    try {
      parsed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch {
      throw new Error("receipt_json_invalid");
    }
    const receipt = exactReceiptDocument(parsed, targetOrigin);
    const filename = String(message.filename || "");
    if (filename !== `JUSTIFICANTE_SINTETICO_${receipt.receiptId.slice(-12)}.json`) {
      throw new Error("receipt_filename_mismatch");
    }
    const event = ledgerFor(tabId).recordReceiptPending({
      tabId,
      targetOrigin,
      receiptId: receipt.receiptId,
      claimedSentAt: receipt.claimedSentAt,
      incorporatedAt: nowIso(),
      sessionId: receipt.sessionId,
      filename,
      contentType: "application/json",
      receiptSha256,
      receiptSize: bytes.byteLength,
      attachments: receipt.attachments,
    });
    const key = `${tabId}:${receipt.receiptId}`;
    if (pendingReceiptBytes.has(key)) throw new Error("receipt_duplicate");
    pendingReceiptBytes.set(key, {
      tabId,
      targetOrigin,
      sessionId: receipt.sessionId,
      attachments: structuredClone(receipt.attachments),
      receiptSha256,
      bytes: new Uint8Array(bytes),
      status: "receipt_pending",
      receiptVerified: false,
      sentAt: null,
    });
    await broadcast({ type: "rtm.presenter.audit.changed.v1", tabId });
    return { ok: true, event };
  } finally {
    bytes.fill(0);
    message.bytes.fill(0);
  }
}

function readAudit(message) {
  const tabId = Number(message?.tabId);
  if (!Number.isSafeInteger(tabId) || tabId < 1) throw new Error("tab_id_invalid");
  return { ok: true, events: ledgerFor(tabId).snapshot() };
}

chrome.runtime.onInstalled.addListener(() => {
  void configureSidePanel();
});

chrome.runtime.onStartup.addListener(() => {
  pendingIntents.clear();
  ledgers.clear();
  for (const receipt of pendingReceiptBytes.values()) receipt.bytes.fill(0);
  pendingReceiptBytes.clear();
  void configureSidePanel();
});

chrome.tabs?.onRemoved?.addListener((tabId) => {
  pendingIntents.delete(tabId);
  ledgers.delete(tabId);
  for (const [key, receipt] of pendingReceiptBytes.entries()) {
    if (receipt.tabId !== tabId) continue;
    receipt.bytes.fill(0);
    pendingReceiptBytes.delete(key);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  let operation;
  switch (message?.type) {
    case "rtm.presenter.portal.intent.requested.v1":
      operation = createIntent(message, sender);
      break;
    case "rtm.presenter.intent.read.v1":
      operation = Promise.resolve(readIntent(message));
      break;
    case "rtm.presenter.attachment.record.v1":
      operation = recordAttached(message);
      break;
    case "rtm.presenter.portal.receipt.incorporate.v1":
      operation = incorporateReceipt(message, sender);
      break;
    case "rtm.presenter.audit.read.v1":
      operation = Promise.resolve(readAudit(message));
      break;
    default:
      return false;
  }

  operation
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, code: String(error?.message || "blocked") }));
  return true;
});

void configureSidePanel();
