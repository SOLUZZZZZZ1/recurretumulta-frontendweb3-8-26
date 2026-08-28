// This function is deliberately self-contained because Chrome serializes it
// before executing it in the active tab's isolated world.
export async function attachFileToVerifiedInput(payload) {
  const allowedOrigins = [
    "http://localhost:8765",
    "http://127.0.0.1:8765",
  ];
  const maxBytes = 5 * 1024 * 1024;
  const fingerprintKeys = [
    "tagName",
    "type",
    "id",
    "name",
    "accept",
    "multiple",
    "slot",
    "labelText",
  ];
  const fail = (code) => ({ ok: false, code });
  const normalizedText = (value) =>
    String(value || "")
      .replace(/\s+/g, " ")
      .trim();

  let input = null;
  let assigned = false;
  let bytes = null;
  try {
    if (!payload || typeof payload !== "object") return fail("payload_invalid");

    const runtimeOrigin = String(globalThis.location?.origin || "");
    if (
      !allowedOrigins.includes(runtimeOrigin) ||
      payload.expectedOrigin !== runtimeOrigin
    ) {
      return fail("origin_mismatch");
    }

    const selector = String(payload.selector || "");
    if (
      !/^input\[type="file"\]\[data-rtm-slot="[a-z][a-z0-9-]{0,31}"\]$/.test(
        selector
      )
    ) {
      return fail("selector_not_allowed");
    }

    const matches = globalThis.document?.querySelectorAll(selector);
    if (!matches || matches.length !== 1) return fail("selector_not_unique");
    input = matches[0];
    if (!input?.isConnected || input.disabled || input.readOnly) {
      return fail("input_not_available");
    }

    const expected = payload.fingerprint;
    if (
      !expected ||
      typeof expected !== "object" ||
      Object.keys(expected).length !== fingerprintKeys.length ||
      fingerprintKeys.some((key) => !(key in expected))
    ) {
      return fail("fingerprint_invalid");
    }

    const labelText = Array.from(input.labels || [])
      .map((label) => normalizedText(label?.textContent))
      .filter(Boolean)
      .join(" | ");
    const actual = {
      tagName: String(input.tagName || "").toUpperCase(),
      type: String(input.type || "").toLowerCase(),
      id: String(input.id || ""),
      name: String(input.name || ""),
      accept: String(input.accept || ""),
      multiple: Boolean(input.multiple),
      slot: String(input.dataset?.rtmSlot || ""),
      labelText,
    };
    if (
      fingerprintKeys.some((key) => {
        const expectedValue =
          key === "labelText" ? normalizedText(expected[key]) : expected[key];
        return actual[key] !== expectedValue;
      })
    ) {
      return fail("fingerprint_mismatch");
    }

    const filename = String(payload.file?.filename || "");
    const mimeType = String(payload.file?.mimeType || "");
    const expectedSize = Number(payload.file?.size);
    const expectedSha256 = String(payload.file?.sha256 || "").toLowerCase();
    if (
      filename.length > 120 ||
      !/^[A-Za-z0-9][A-Za-z0-9._ -]*\.pdf$/i.test(filename) ||
      filename.includes("..")
    ) {
      return fail("filename_invalid");
    }
    if (mimeType !== "application/pdf") return fail("mime_type_invalid");
    if (!/^[a-f0-9]{64}$/.test(expectedSha256)) {
      return fail("hash_invalid");
    }
    if (!Array.isArray(payload.bytes)) return fail("bytes_invalid");
    if (
      !Number.isSafeInteger(expectedSize) ||
      expectedSize < 8 ||
      expectedSize > maxBytes ||
      payload.bytes.length !== expectedSize ||
      payload.bytes.some(
        (value) => !Number.isInteger(value) || value < 0 || value > 255
      )
    ) {
      return fail("size_invalid");
    }

    bytes = Uint8Array.from(payload.bytes);
    if (
      bytes[0] !== 0x25 ||
      bytes[1] !== 0x50 ||
      bytes[2] !== 0x44 ||
      bytes[3] !== 0x46 ||
      bytes[4] !== 0x2d
    ) {
      return fail("pdf_magic_invalid");
    }
    const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
    const actualSha256 = Array.from(new Uint8Array(digest), (byte) =>
      byte.toString(16).padStart(2, "0")
    ).join("");
    if (actualSha256 !== expectedSha256) return fail("hash_mismatch");

    const blob = new Blob([bytes], { type: mimeType });
    const file = new File([blob], filename, {
      type: mimeType,
      lastModified: 0,
    });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    assigned = true;

    if (
      input.files?.length !== 1 ||
      input.files[0]?.name !== filename ||
      input.files[0]?.size !== expectedSize ||
      input.files[0]?.type !== mimeType
    ) {
      throw new Error("assignment_not_verified");
    }

    input.dispatchEvent(new Event("input", { bubbles: true, composed: true }));
    input.dispatchEvent(new Event("change", { bubbles: true, composed: true }));
    return {
      ok: true,
      code: "attached",
      slot: actual.slot,
      filename,
      size: expectedSize,
      mimeType,
    };
  } catch {
    if (assigned && input) {
      try {
        input.files = new DataTransfer().files;
      } catch {
        // The result still fails closed and never progresses to submission.
      }
    }
    return fail("attachment_failed_closed");
  } finally {
    if (bytes) bytes.fill(0);
    if (Array.isArray(payload?.bytes)) payload.bytes.fill(0);
  }
}
