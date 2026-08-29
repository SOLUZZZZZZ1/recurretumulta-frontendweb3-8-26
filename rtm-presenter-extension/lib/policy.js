export const BUILD_MODE = "synthetic-only";
export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;

export const SYNTHETIC_PORTAL_ORIGINS = Object.freeze([
  "http://localhost:8765",
  "http://127.0.0.1:8765",
]);

export function exactOrigin(value) {
  let parsed;
  try {
    parsed = new URL(String(value || ""));
  } catch {
    throw new Error("origin_invalid");
  }

  if (parsed.origin !== String(value || "") || parsed.username || parsed.password) {
    throw new Error("origin_not_exact");
  }
  return parsed.origin;
}

export function assertSyntheticPortalOrigin(value) {
  const origin = exactOrigin(value);
  if (!SYNTHETIC_PORTAL_ORIGINS.includes(origin)) {
    throw new Error("portal_origin_not_allowed");
  }
  return origin;
}

export function assertSafeTicket(value) {
  const ticket = String(value || "");
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(ticket)) {
    throw new Error("ticket_invalid");
  }
  return ticket;
}

export function assertSafeSlot(value) {
  const slot = String(value || "");
  if (!/^[a-z][a-z0-9-]{0,31}$/.test(slot)) {
    throw new Error("slot_invalid");
  }
  return slot;
}

export function assertSafePdfName(value) {
  const filename = String(value || "");
  if (
    filename.length > 120 ||
    !/^[A-Za-z0-9][A-Za-z0-9._ -]*\.pdf$/i.test(filename) ||
    filename.includes("..")
  ) {
    throw new Error("filename_invalid");
  }
  return filename;
}

export async function sha256Hex(input) {
  const bytes =
    input instanceof Uint8Array ? input : new Uint8Array(await input.arrayBuffer());
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("");
}

export function assertPdfMagic(bytes) {
  const view = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  if (
    view.length < 8 ||
    view[0] !== 0x25 ||
    view[1] !== 0x50 ||
    view[2] !== 0x44 ||
    view[3] !== 0x46 ||
    view[4] !== 0x2d
  ) {
    throw new Error("pdf_magic_invalid");
  }
}
