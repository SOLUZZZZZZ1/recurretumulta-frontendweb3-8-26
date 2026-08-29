(() => {
  "use strict";

  const inputs = Array.from(document.querySelectorAll('input[type="file"]'));
  const count = document.querySelector("#local-count");
  const validationResult = document.querySelector("#validation-result");
  const closeResult = document.querySelector("#close-result");
  const closeButton = document.querySelector("#close-simulation");
  const receipt = document.querySelector("#synthetic-receipt");
  const receiptDownload = document.querySelector("#receipt-download");
  let receiptObjectUrl = null;

  function update() {
    const attached = inputs.filter((input) => input.files?.length === 1).length;
    count.textContent = `${attached}/${inputs.length}`;
    for (const input of inputs) {
      const output = document.querySelector(`[data-output-for="${input.id}"]`);
      output.textContent = input.files?.[0]?.name || "Ningún archivo";
    }
  }

  for (const input of inputs) {
    input.addEventListener("change", (event) => {
      if (event.isTrusted) {
        delete input.dataset.rtmIntentId;
        delete input.dataset.rtmDocumentId;
        delete input.dataset.rtmDocumentVersion;
        delete input.dataset.rtmDocumentSha256;
        delete input.dataset.rtmDocumentFilename;
        delete input.dataset.rtmAttachedAt;
      }
      update();
    });
  }

  document.querySelector("#validate-only").addEventListener("click", () => {
    const complete = inputs.every(
      (input) =>
        input.files?.length === 1 &&
        input.files[0].type === "application/pdf" &&
        input.files[0].name.toLowerCase().endsWith(".pdf")
    );
    validationResult.textContent = complete
      ? "Validación local completa. No se ha registrado ni enviado nada."
      : "Faltan archivos PDF. No se ha registrado ni enviado nada.";
  });

  function tracedAttachment(input) {
    if (
      input.files?.length !== 1 ||
      !input.dataset.rtmIntentId ||
      !input.dataset.rtmDocumentId ||
      !input.dataset.rtmDocumentVersion ||
      !input.dataset.rtmDocumentSha256 ||
      !input.dataset.rtmDocumentFilename ||
      !input.dataset.rtmAttachedAt
    ) {
      return null;
    }
    return {
      intentId: input.dataset.rtmIntentId,
      slotId: input.dataset.rtmSlot,
      documentId: input.dataset.rtmDocumentId,
      filename: input.dataset.rtmDocumentFilename,
      version: Number(input.dataset.rtmDocumentVersion),
      sha256: input.dataset.rtmDocumentSha256,
      attachedAt: input.dataset.rtmAttachedAt,
    };
  }

  function receiptId() {
    const bytes = new Uint8Array(6);
    crypto.getRandomValues(bytes);
    return `SYN-RECEIPT-${Array.from(bytes, (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("").toUpperCase()}`;
  }

  closeButton.addEventListener("click", () => {
    const attachments = inputs.map(tracedAttachment);
    if (attachments.some((attachment) => !attachment)) {
      closeResult.textContent =
        "Solo puede cerrarse cuando todos los campos proceden de RTM y conservan su traza.";
      return;
    }
    const latestAttached = Math.max(
      ...attachments.map((attachment) => Date.parse(attachment.attachedAt))
    );
    const sentAt = new Date(Math.max(Date.now(), latestAttached + 1)).toISOString();
    const id = receiptId();
    document.querySelector("#receipt-id").textContent = id;
    document.querySelector("#receipt-sent-at").textContent = sentAt;
    const list = document.querySelector("#receipt-attachments");
    list.replaceChildren();
    for (const attachment of attachments) {
      const item = document.createElement("li");
      item.textContent = `${attachment.filename} · attached_at ${attachment.attachedAt}`;
      list.append(item);
    }
    receipt.hidden = false;
    closeResult.textContent =
      "Justificante local emitido tras acción humana. No existe presentación real.";
    closeButton.disabled = true;

    const receiptDocument = {
      schema: "rtm.mock.portal.receipt.v1",
      environment: "staging",
      syntheticOnly: true,
      legalEffect: false,
      receiptId: id,
      targetOrigin: globalThis.location.origin,
      caseId: "SYN-CASE-0001",
      containerId: "SYN-CONTAINER-0001",
      sessionId: "SYN-SESSION-LOCAL-0001",
      claimedSentAt: sentAt,
      attachments,
    };
    const filename = `JUSTIFICANTE_SINTETICO_${id.slice(-12)}.json`;
    const content = `${JSON.stringify(receiptDocument, null, 2)}\n`;
    if (receiptObjectUrl) URL.revokeObjectURL(receiptObjectUrl);
    receiptObjectUrl = URL.createObjectURL(
      new Blob([content], { type: "application/json" })
    );
    receiptDownload.href = receiptObjectUrl;
    receiptDownload.download = filename;
    receiptDownload.hidden = false;
    document.querySelector("#synthetic-receipt-payload").textContent = content;

    globalThis.dispatchEvent(new CustomEvent("rtm:synthetic-receipt"));
  });

  globalThis.addEventListener("pagehide", () => {
    if (receiptObjectUrl) URL.revokeObjectURL(receiptObjectUrl);
    receiptObjectUrl = null;
  });

  update();
})();
