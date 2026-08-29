(() => {
  "use strict";

  const allowedOrigins = new Set([
    "http://localhost:8765",
    "http://127.0.0.1:8765",
  ]);
  const fields = [
    {
      slotId: "fine",
      fieldTitle: "Multa original solicitada por la sede",
      selector: 'input[type="file"][data-rtm-slot="fine"]',
      fingerprint: {
        tagName: "INPUT",
        type: "file",
        id: "fine-file",
        name: "fine_document",
        accept: "application/pdf",
        multiple: false,
        slot: "fine",
        labelText: "Añadir multa",
      },
    },
    {
      slotId: "appeal",
      fieldTitle: "Recurso solicitado por la sede",
      selector: 'input[type="file"][data-rtm-slot="appeal"]',
      fingerprint: {
        tagName: "INPUT",
        type: "file",
        id: "appeal-file",
        name: "appeal_document",
        accept: "application/pdf",
        multiple: false,
        slot: "appeal",
        labelText: "Añadir recurso",
      },
    },
    {
      slotId: "authorization",
      fieldTitle: "Autorización solicitada por la sede",
      selector: 'input[type="file"][data-rtm-slot="authorization"]',
      fingerprint: {
        tagName: "INPUT",
        type: "file",
        id: "authorization-file",
        name: "authorization_document",
        accept: "application/pdf",
        multiple: false,
        slot: "authorization",
        labelText: "Añadir autorización",
      },
    },
  ];

  if (!allowedOrigins.has(globalThis.location.origin) || globalThis.top !== globalThis) {
    return;
  }

  const normalizeText = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();

  function actualFingerprint(input) {
    return {
      tagName: String(input?.tagName || "").toUpperCase(),
      type: String(input?.type || "").toLowerCase(),
      id: String(input?.id || ""),
      name: String(input?.name || ""),
      accept: String(input?.accept || ""),
      multiple: Boolean(input?.multiple),
      slot: String(input?.dataset?.rtmSlot || ""),
      labelText: Array.from(input?.labels || [])
        .map((label) => normalizeText(label?.textContent))
        .filter(Boolean)
        .join(" | "),
    };
  }

  function matchesProfile(input, expected) {
    const actual = actualFingerprint(input);
    return Object.keys(expected).every((key) => {
      const wanted = key === "labelText" ? normalizeText(expected[key]) : expected[key];
      return actual[key] === wanted;
    });
  }

  function installStyles() {
    if (document.querySelector("style[data-rtm-presenter-style]")) return;
    const style = document.createElement("style");
    style.dataset.rtmPresenterStyle = "synthetic-v1";
    style.textContent = `
      .rtm-presenter-control { grid-column: 2; display: grid; gap: 6px; margin-top: 7px; }
      .rtm-presenter-button { width: 100%; border: 0; border-radius: 10px; padding: 10px 12px; color: #fff; background: #2349bd; font: inherit; font-size: 12px; font-weight: 850; cursor: pointer; }
      .rtm-presenter-button:disabled { cursor: not-allowed; opacity: .66; }
      .rtm-presenter-status { margin: 0; color: #31509b; font: 700 11px/1.4 ui-sans-serif, system-ui, sans-serif; }
      .rtm-presenter-control[data-state="attached"] .rtm-presenter-button { background: #19713b; }
      .rtm-receipt-incorporate { display: grid; gap: 7px; margin-top: 12px; }
      .rtm-receipt-incorporate button { border: 0; border-radius: 10px; padding: 11px 13px; color: #fff; background: #2349bd; font: 850 12px/1.2 ui-sans-serif, system-ui, sans-serif; cursor: pointer; }
      .rtm-receipt-incorporate button:disabled { cursor: not-allowed; opacity: .6; }
      .rtm-receipt-incorporate p { margin: 0; color: #31509b; font: 700 11px/1.4 ui-sans-serif, system-ui, sans-serif; }
      @media (max-width: 650px) { .rtm-presenter-control { grid-column: 1; } }
    `;
    document.documentElement.append(style);
  }

  function updateControl(input, control, button, status) {
    const attachedAt = String(input.dataset.rtmAttachedAt || "");
    if (input.files?.length === 1 && attachedAt) {
      control.dataset.state = "attached";
      button.disabled = true;
      button.textContent = "Adjuntado desde RTM";
      status.textContent = `Trazado en RTM · attached_at ${attachedAt}`;
      return;
    }
    const manualFilePresent = Boolean(input.files?.length);
    control.dataset.state = manualFilePresent ? "manual" : "ready";
    button.disabled = manualFilePresent;
    button.textContent = "Adjuntar desde RTM";
    status.textContent = manualFilePresent
      ? "Campo ocupado por un archivo del PC. Retíralo antes de adjuntar desde RTM."
      : "Elige el documento suelto en RTM cuando la sede lo solicite.";
  }

  function installFieldControl(profile) {
    const matches = document.querySelectorAll(profile.selector);
    if (matches.length !== 1) return;
    const input = matches[0];
    if (!matchesProfile(input, profile.fingerprint)) return;
    if (input.dataset.rtmPresenterControl === "installed") return;
    input.dataset.rtmPresenterControl = "installed";

    const control = document.createElement("div");
    control.className = "rtm-presenter-control";
    control.dataset.rtmPresenterSlot = profile.slotId;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "rtm-presenter-button";
    button.textContent = "Adjuntar desde RTM";
    const status = document.createElement("p");
    status.className = "rtm-presenter-status";
    status.setAttribute("role", "status");
    control.append(button, status);
    input.insertAdjacentElement("afterend", control);

    button.addEventListener("click", async () => {
      if (!matchesProfile(input, profile.fingerprint) || input.disabled || input.readOnly) {
        button.disabled = true;
        status.textContent = "Campo modificado: RTM se ha bloqueado con seguridad.";
        return;
      }
      button.disabled = true;
      status.textContent = "Abriendo el contenedor RTM para este campo…";
      try {
        const response = await chrome.runtime.sendMessage({
          type: "rtm.presenter.portal.intent.requested.v1",
          targetOrigin: globalThis.location.origin,
          slotId: profile.slotId,
          fieldTitle: profile.fieldTitle,
          selector: profile.selector,
        });
        if (!response?.ok) throw new Error(response?.code || "intent_blocked");
        status.textContent = "Petición abierta en RTM. Elige y confirma un documento.";
      } catch {
        status.textContent = "No se pudo abrir RTM. No se ha adjuntado ningún archivo.";
      } finally {
        if (!input.dataset.rtmAttachedAt && !input.files?.length) button.disabled = false;
      }
    });

    input.addEventListener("change", () => updateControl(input, control, button, status));
    updateControl(input, control, button, status);
  }

  installStyles();
  for (const profile of fields) installFieldControl(profile);

  let receiptCandidate = null;
  globalThis.addEventListener("rtm:synthetic-receipt", () => {
    const payload = document.querySelector("#synthetic-receipt-payload");
    const link = document.querySelector("#receipt-download");
    const content = String(payload?.textContent || "");
    const filename = String(link?.download || "");
    if (
      content.length < 32 ||
      content.length > 131_072 ||
      !/^JUSTIFICANTE_SINTETICO_[A-F0-9]{12}\.json$/.test(filename)
    ) {
      return;
    }
    const mount = document.querySelector("[data-rtm-receipt-actions]");
    if (!mount) return;
    receiptCandidate = {
      filename,
      content,
      targetOrigin: globalThis.location.origin,
    };
    mount.replaceChildren();
    const control = document.createElement("div");
    control.className = "rtm-receipt-incorporate";
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = "Incorporar justificante a RTM";
    const status = document.createElement("p");
    status.setAttribute("role", "status");
    status.textContent =
      "Se copiará a memoria como receipt_pending; no acredita envío ni activa seguimiento.";
    control.append(button, status);
    mount.append(control);

    button.addEventListener("click", async (clickEvent) => {
      if (!clickEvent.isTrusted || !receiptCandidate) {
        status.textContent = "RTM exige una acción humana real para incorporar el justificante.";
        return;
      }
      button.disabled = true;
      status.textContent = "Verificando binding y copiando el justificante solo en memoria…";
      const candidate = receiptCandidate;
      const bytes = Array.from(new TextEncoder().encode(candidate.content));
      try {
        const response = await chrome.runtime.sendMessage({
          type: "rtm.presenter.portal.receipt.incorporate.v1",
          targetOrigin: candidate.targetOrigin,
          filename: candidate.filename,
          bytes,
        });
        if (!response?.ok) throw new Error(response?.code || "receipt_blocked");
        receiptCandidate = null;
        status.textContent =
          "Incorporado en memoria · receipt_pending · sent_at sin verificar.";
      } catch {
        button.disabled = false;
        status.textContent =
          "No se pudo incorporar. El justificante sigue sin verificar y no activa seguimiento.";
      } finally {
        bytes.fill(0);
      }
    });
  });
})();
