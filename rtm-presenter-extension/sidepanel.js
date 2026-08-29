import { assertSyntheticPortalOrigin, sha256Hex } from "./lib/policy.js";
import { attachFileToVerifiedInput } from "./lib/portal-attach.js";
import { syntheticWorkspaceDefinition } from "./lib/synthetic-workspace.js";
import { createSyntheticTicketBroker } from "./lib/ticket-client.js";

const elements = {
  caseId: document.querySelector("#case-id"),
  containerId: document.querySelector("#container-id"),
  portalName: document.querySelector("#portal-name"),
  documentCount: document.querySelector("#document-count"),
  containerDocuments: document.querySelector("#container-documents"),
  requestState: document.querySelector("#request-state"),
  requestIdle: document.querySelector("#request-idle"),
  requestWorkflow: document.querySelector("#request-workflow"),
  activeField: document.querySelector("#active-field"),
  activeOrigin: document.querySelector("#active-origin"),
  documentOptions: document.querySelector("#document-options"),
  confirmation: document.querySelector("#confirmation"),
  confirmField: document.querySelector("#confirm-field"),
  confirmFilename: document.querySelector("#confirm-filename"),
  confirmVersion: document.querySelector("#confirm-version"),
  confirmSha: document.querySelector("#confirm-sha"),
  confirmCheck: document.querySelector("#confirm-check"),
  confirmAttach: document.querySelector("#confirm-attach"),
  globalStatus: document.querySelector("#global-status"),
  auditEvents: document.querySelector("#audit-events"),
};

let broker = null;
let workspace = null;
let currentIntent = null;
let selectedDocument = null;
let currentTabId = null;
let busy = false;

function formatBytes(value) {
  return `${Math.max(0, Number(value) / 1024).toFixed(1)} KB`;
}

function setStatus(message, state = "") {
  elements.globalStatus.className = `global-status${state ? ` is-${state}` : ""}`;
  elements.globalStatus.textContent = message;
}

function errorMessage(error) {
  const code = String(error?.message || error || "unknown_error");
  const messages = {
    portal_origin_not_allowed: "Abre el portal sintético en localhost:8765.",
    active_tab_not_available: "No se puede confirmar la pestaña activa.",
    active_portal_changed: "La pestaña activa ya no coincide con el destino.",
    document_not_compatible_with_field: "Ese documento no corresponde al campo verificado.",
    ticket_invalid_or_consumed: "El ticket ya fue consumido. Vuelve a pulsar el botón del campo.",
    ticket_expired: "El ticket caducó. Vuelve a pulsar el botón del campo.",
    ticket_context_mismatch: "El ticket no coincide con campo, documento, sesión y origen.",
    ticket_document_mismatch: "Los bytes no coinciden con versión y SHA-256 confirmados.",
    fingerprint_mismatch: "El campo de la sede cambió. RTM se ha bloqueado.",
    attachment_outcome_unknown: "Resultado indeterminado: revisa el campo y no repitas la adjunción.",
  };
  return messages[code] || `Operación bloqueada: ${code}`;
}

async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !tab.url) throw new Error("active_tab_not_available");
  return tab;
}

function renderContainer() {
  elements.documentCount.textContent = String(workspace.documents.length);
  elements.containerDocuments.replaceChildren();
  for (const containerDocument of workspace.documents) {
    const item = globalThis.document.createElement("li");
    item.className = "container-item";
    const title = globalThis.document.createElement("strong");
    title.textContent = containerDocument.title;
    const version = globalThis.document.createElement("span");
    version.textContent = `Versión ${containerDocument.version} · ${containerDocument.filename} · ${formatBytes(containerDocument.size)}`;
    const sha = globalThis.document.createElement("span");
    sha.textContent = `SHA-256 ${containerDocument.sha256}`;
    item.append(title, version, sha);
    elements.containerDocuments.append(item);
  }
}

function chooseDocument(document) {
  selectedDocument = document;
  elements.confirmation.hidden = false;
  elements.confirmField.textContent = currentIntent.fieldTitle;
  elements.confirmFilename.textContent = document.filename;
  elements.confirmVersion.textContent = String(document.version);
  elements.confirmSha.textContent = document.sha256;
  elements.confirmCheck.checked = false;
  elements.confirmAttach.disabled = true;
}

function renderDocumentOptions(field) {
  elements.documentOptions.replaceChildren();
  for (const candidate of workspace.documents) {
    const compatible = candidate.compatibleSlots.includes(field.slotId);
    const label = document.createElement("label");
    label.className = "document-option";
    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "container-document";
    radio.value = candidate.documentId;
    radio.disabled = !compatible;
    const content = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = candidate.title;
    const meta = document.createElement("span");
    meta.textContent = compatible
      ? `v${candidate.version} · ${candidate.filename}`
      : "No corresponde a este campo verificado";
    content.append(title, meta);
    label.append(radio, content);
    radio.addEventListener("change", () => chooseDocument(candidate));
    elements.documentOptions.append(label);
  }
}

async function showIntent(intent) {
  if (!workspace || !intent) return;
  const tab = await activeTab();
  const origin = assertSyntheticPortalOrigin(new URL(tab.url).origin);
  const field = workspace.portalFields.find((candidate) => candidate.slotId === intent.slotId);
  if (
    tab.id !== intent.tabId ||
    origin !== workspace.targetOrigin ||
    intent.targetOrigin !== workspace.targetOrigin ||
    !field ||
    field.selector !== intent.selector ||
    field.title !== intent.fieldTitle
  ) {
    throw new Error("active_portal_changed");
  }
  currentTabId = tab.id;
  currentIntent = intent;
  selectedDocument = null;
  elements.requestIdle.hidden = true;
  elements.requestWorkflow.hidden = false;
  elements.requestState.textContent = "CAMPO ACTIVO";
  elements.requestState.className = "badge is-active";
  elements.activeField.textContent = intent.fieldTitle;
  elements.activeOrigin.textContent = intent.targetOrigin;
  elements.confirmation.hidden = true;
  elements.confirmCheck.checked = false;
  elements.confirmAttach.disabled = true;
  renderDocumentOptions(field);
  setStatus("Elige una versión compatible y revisa campo, archivo, versión y SHA-256.");
  await refreshAudit();
}

function clearIntent() {
  currentIntent = null;
  selectedDocument = null;
  elements.requestIdle.hidden = false;
  elements.requestWorkflow.hidden = true;
  elements.requestState.textContent = "ESPERANDO";
  elements.requestState.className = "badge is-waiting";
}

async function refreshAudit() {
  if (!currentTabId) return;
  const response = await chrome.runtime.sendMessage({
    type: "rtm.presenter.audit.read.v1",
    tabId: currentTabId,
  });
  if (!response?.ok) return;
  elements.auditEvents.replaceChildren();
  for (const event of response.events) {
    const item = document.createElement("li");
    item.className = "audit-item";
    const title = document.createElement("strong");
    const detail = document.createElement("span");
    if (event.type === "rtm.presenter.portal_attachment_intent.v1") {
      title.textContent = `Intent · ${event.fieldTitle}`;
      detail.textContent = `requested_at ${event.requestedAt}`;
    } else if (event.type === "rtm.presenter.portal_document_attached.v1") {
      item.classList.add("is-attached");
      title.textContent = `Attached · ${event.filename} · v${event.version}`;
      detail.textContent = `attached_at ${event.attachedAt} · no prueba presentación`;
    } else {
      item.classList.add("is-receipt");
      title.textContent = `Receipt pending · ${event.filename}`;
      detail.textContent = `incorporated_at ${event.incorporatedAt} · claimed_sent_at ${event.claimedSentAt} · sent_at sin verificar · SHA-256 ${event.receiptSha256}`;
    }
    item.append(title, detail);
    elements.auditEvents.append(item);
  }
}

async function confirmAttachment() {
  if (busy || !currentIntent || !selectedDocument || !elements.confirmCheck.checked) return;
  const intent = currentIntent;
  const documentSnapshot = selectedDocument;
  const workspaceSnapshot = workspace;
  busy = true;
  elements.confirmAttach.disabled = true;
  setStatus("Verificando contexto y obteniendo solo la versión confirmada…");
  let bytes = null;
  let assignmentReached = false;
  try {
    const tab = await activeTab();
    const origin = assertSyntheticPortalOrigin(new URL(tab.url).origin);
    if (tab.id !== intent.tabId || origin !== intent.targetOrigin) {
      throw new Error("active_portal_changed");
    }

    const context = {
      intentId: intent.intentId,
      slotId: intent.slotId,
      documentId: documentSnapshot.documentId,
      targetOrigin: origin,
      operatorId: workspaceSnapshot.operatorId,
      sessionId: workspaceSnapshot.sessionId,
    };
    const capability = broker.issue(context);
    const redeemed = await broker.redeem({ ...context, ticket: capability.ticket });
    if (
      redeemed.documentId !== documentSnapshot.documentId ||
      redeemed.filename !== documentSnapshot.filename ||
      redeemed.version !== documentSnapshot.version ||
      redeemed.mimeType !== documentSnapshot.mimeType ||
      redeemed.size !== documentSnapshot.size ||
      redeemed.sha256 !== documentSnapshot.sha256
    ) {
      throw new Error("ticket_document_mismatch");
    }
    bytes = new Uint8Array(await redeemed.blob.arrayBuffer());
    if ((await sha256Hex(bytes)) !== documentSnapshot.sha256) {
      throw new Error("ticket_document_mismatch");
    }

    const attachedAt = new Date().toISOString();
    const injectionResults = await chrome.scripting.executeScript({
      target: { tabId: tab.id, frameIds: [0] },
      world: "ISOLATED",
      func: attachFileToVerifiedInput,
      args: [{
        expectedOrigin: origin,
        selector: redeemed.selector,
        fingerprint: redeemed.fingerprint,
        intentId: intent.intentId,
        attachedAt,
        file: {
          documentId: redeemed.documentId,
          filename: redeemed.filename,
          version: redeemed.version,
          mimeType: redeemed.mimeType,
          size: redeemed.size,
          sha256: redeemed.sha256,
        },
        bytes: Array.from(bytes),
      }],
    });
    const result = injectionResults?.length === 1 ? injectionResults[0].result : null;
    if (!result?.ok) {
      assignmentReached = result?.assignedToInput === true;
      throw new Error(result?.code || "attachment_failed_closed");
    }
    assignmentReached = true;

    const audit = await chrome.runtime.sendMessage({
      type: "rtm.presenter.attachment.record.v1",
      intentId: intent.intentId,
      tabId: tab.id,
      targetOrigin: origin,
      slotId: intent.slotId,
      documentId: redeemed.documentId,
      filename: redeemed.filename,
      version: redeemed.version,
      sha256: redeemed.sha256,
      attachedAt: result.attachedAt,
    });
    if (!audit?.ok) throw new Error(audit?.code || "audit_record_failed");

    setStatus(
      `Adjuntado al campo a las ${result.attachedAt}. Esto no prueba envío ni registro.`,
      "success"
    );
    if (currentIntent?.intentId === intent.intentId) clearIntent();
    await refreshAudit();
  } catch (error) {
    setStatus(
      assignmentReached
        ? "El archivo pudo quedar asignado o empezar a subirse, pero la traza no se cerró. Revisa la sede y no repitas."
        : errorMessage(error),
      "error"
    );
  } finally {
    bytes?.fill(0);
    busy = false;
    // A ticket is one-use; any failure requires a fresh human request from the portal field.
    elements.confirmAttach.disabled = true;
  }
}

elements.confirmCheck.addEventListener("change", () => {
  elements.confirmAttach.disabled =
    busy || !selectedDocument || !elements.confirmCheck.checked;
});
elements.confirmAttach.addEventListener("click", () => void confirmAttachment());

chrome.runtime.onMessage.addListener((message) => {
  if (message?.type === "rtm.presenter.intent.available.v1") {
    void showIntent(message.intent).catch((error) => setStatus(errorMessage(error), "error"));
  }
  if (message?.type === "rtm.presenter.audit.changed.v1" && message.tabId === currentTabId) {
    void refreshAudit();
  }
});

async function initialize() {
  try {
    const tab = await activeTab();
    const origin = assertSyntheticPortalOrigin(new URL(tab.url).origin);
    currentTabId = tab.id;
    broker = await createSyntheticTicketBroker(syntheticWorkspaceDefinition(origin));
    workspace = broker.workspace;
    elements.caseId.textContent = workspace.caseId;
    elements.containerId.textContent = workspace.containerId;
    elements.portalName.textContent = workspace.portalName;
    renderContainer();
    await refreshAudit();
    const pending = await chrome.runtime.sendMessage({
      type: "rtm.presenter.intent.read.v1",
      tabId: tab.id,
    });
    if (pending?.intent) await showIntent(pending.intent);
    else setStatus("Esperando a que pulses un campo de la sede.");
  } catch (error) {
    clearIntent();
    setStatus(errorMessage(error), "error");
  }
}

globalThis.addEventListener("pagehide", () => {
  broker?.close();
  broker = null;
  workspace = null;
  currentIntent = null;
  selectedDocument = null;
});

void initialize();
