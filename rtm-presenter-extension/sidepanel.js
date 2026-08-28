import {
  assertSyntheticPortalOrigin,
  sha256Hex,
} from "./lib/policy.js";
import { attachFileToVerifiedInput } from "./lib/portal-attach.js";
import { syntheticPackageDefinition } from "./lib/synthetic-package.js";
import { createSyntheticTicketBroker } from "./lib/ticket-client.js";

const elements = {
  caseId: document.querySelector("#case-id"),
  packageId: document.querySelector("#package-id"),
  portalName: document.querySelector("#portal-name"),
  fieldList: document.querySelector("#field-list"),
  progress: document.querySelector("#progress"),
  globalStatus: document.querySelector("#global-status"),
};

let broker = null;
let activePackage = null;
let busy = false;
const attachedSlots = new Set();

function formatBytes(value) {
  return `${Math.max(0, Number(value) / 1024).toFixed(1)} KB`;
}

function setGlobalStatus(message) {
  elements.globalStatus.textContent = message;
}

function errorMessage(error) {
  const code = String(error?.message || "unknown_error");
  const messages = {
    portal_origin_not_allowed:
      "Abre el portal sintético en localhost:8765 y vuelve a abrir el panel.",
    active_tab_not_available: "No se puede confirmar la pestaña activa.",
    active_portal_changed:
      "La pestaña activa ya no coincide con el portal ligado al paquete.",
    ticket_invalid_or_consumed:
      "El ticket ya fue consumido. Recarga el panel para crear otra sesión sintética.",
    ticket_expired:
      "El ticket ha caducado. Recarga el panel para crear otra sesión sintética.",
    ticket_context_mismatch: "El ticket no corresponde a este campo y destino.",
    ticket_document_mismatch: "El documento canjeado no coincide con el manifiesto.",
    injection_failed: "El navegador rechazó la adjunción segura.",
    origin_mismatch: "El origen del portal no coincide.",
    selector_not_unique: "El campo esperado no es único en el portal.",
    fingerprint_mismatch: "El campo cambió y la extensión se ha cerrado con seguridad.",
    attachment_failed_closed: "No se pudo verificar la adjunción; el flujo quedó bloqueado.",
  };
  return messages[code] || `Operación bloqueada: ${code}`;
}

async function activeTab() {
  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const tab = tabs[0];
  if (!tab?.id || !tab.url) throw new Error("active_tab_not_available");
  return tab;
}

async function currentAllowedOrigin() {
  const tab = await activeTab();
  return assertSyntheticPortalOrigin(new URL(tab.url).origin);
}

function updateProgress() {
  elements.progress.textContent = `${attachedSlots.size}/${activePackage?.fields.length || 0}`;
}

function fieldCard(field) {
  const item = document.createElement("li");
  item.className = "field-card";
  item.dataset.slot = field.slotId;

  const content = document.createElement("div");
  const title = document.createElement("p");
  title.className = "field-title";
  title.textContent = `${field.title}${field.required ? " · obligatorio" : ""}`;

  const meta = document.createElement("p");
  meta.className = "field-meta";
  meta.textContent = `${field.filename} · ${formatBytes(field.size)}`;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "attach-button";
  button.textContent = "Adjuntar desde RTM";

  const status = document.createElement("p");
  status.className = "field-status";
  status.setAttribute("role", "status");

  button.addEventListener("click", async () => {
    if (busy || attachedSlots.has(field.slotId)) return;
    busy = true;
    button.disabled = true;
    status.className = "field-status";
    status.textContent = "Verificando portal y canjeando ticket…";

    let bytes = null;
    try {
      const tab = await activeTab();
      const tabOrigin = assertSyntheticPortalOrigin(new URL(tab.url).origin);
      if (tabOrigin !== activePackage.targetOrigin) {
        throw new Error("active_portal_changed");
      }

      const redeemed = await broker.redeem({
        ticket: field.ticket,
        slotId: field.slotId,
        targetOrigin: tabOrigin,
      });
      if (
        redeemed.filename !== field.filename ||
        redeemed.mimeType !== field.mimeType ||
        redeemed.size !== field.size ||
        redeemed.sha256 !== field.sha256
      ) {
        throw new Error("ticket_document_mismatch");
      }

      bytes = new Uint8Array(await redeemed.blob.arrayBuffer());
      if ((await sha256Hex(bytes)) !== field.sha256) {
        throw new Error("ticket_document_mismatch");
      }

      const injectionResults = await chrome.scripting.executeScript({
        target: { tabId: tab.id, frameIds: [0] },
        world: "ISOLATED",
        func: attachFileToVerifiedInput,
        args: [
          {
            expectedOrigin: tabOrigin,
            selector: field.selector,
            fingerprint: field.fingerprint,
            file: {
              filename: field.filename,
              mimeType: field.mimeType,
              size: field.size,
              sha256: field.sha256,
            },
            bytes: Array.from(bytes),
          },
        ],
      });
      const result = injectionResults?.length === 1 ? injectionResults[0].result : null;
      if (!result?.ok) throw new Error(result?.code || "injection_failed");

      attachedSlots.add(field.slotId);
      item.classList.add("is-attached");
      status.className = "field-status is-success";
      status.textContent = "Adjuntado y verificado en el portal sintético.";
      button.textContent = "Adjuntado";
      setGlobalStatus(
        "Archivo entregado al campo de la sede. Puede haberse subido; el trámite no se ha firmado ni registrado."
      );
      updateProgress();
    } catch (error) {
      status.className = "field-status is-error";
      status.textContent = errorMessage(error);
      setGlobalStatus(
        "Resultado de adjunción indeterminado. Revisa la sede; RTM no ha firmado ni registrado el trámite."
      );
    } finally {
      if (bytes) bytes.fill(0);
      busy = false;
      if (!attachedSlots.has(field.slotId)) {
        // The one-use ticket was consumed as soon as redemption started.
        button.textContent = "Ticket consumido";
      }
      button.disabled = true;
    }
  });

  content.append(title, meta, button, status);
  item.append(content);
  return item;
}

async function initialize() {
  try {
    const origin = await currentAllowedOrigin();
    broker = await createSyntheticTicketBroker(syntheticPackageDefinition(origin));
    activePackage = broker.package;
    elements.caseId.textContent = activePackage.caseId;
    elements.packageId.textContent = activePackage.packageId;
    elements.portalName.textContent = activePackage.portalName;
    for (const field of activePackage.fields) {
      elements.fieldList.append(fieldCard(field));
    }
    updateProgress();
    setGlobalStatus("Paquete sintético ligado al origen exacto del portal.");
  } catch (error) {
    elements.fieldList.replaceChildren();
    elements.progress.textContent = "BLOQUEADO";
    setGlobalStatus(errorMessage(error));
  }
}

globalThis.addEventListener("pagehide", () => {
  broker?.close();
  broker = null;
  activePackage = null;
});

void initialize();
