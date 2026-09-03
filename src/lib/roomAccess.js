const ROOM_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;
const INSTANCE_PATH_PATTERN = /^\/instance\/[A-Za-z0-9._/-]{1,900}$/;
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;
const MAX_ROOM_JSON_BYTES = 512 * 1024;
const MAX_ROOM_SHEET_BYTES = 10 * 1024 * 1024;
export const ROOMS_ORIGIN = "https://backend-spainroom.onrender.com";

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function fail(message) {
  throw new Error(message);
}

export function normalizeRoomId(value) {
  return typeof value === "string" && ROOM_ID_PATTERN.test(value) ? value : "";
}

export function roomApiUrl(value) {
  const roomId = normalizeRoomId(value);
  if (!roomId) fail("El identificador de habitación no es válido.");
  return `${ROOMS_ORIGIN}/api/rooms/${encodeURIComponent(roomId)}`;
}

export function safeRoomAssetUrl(value) {
  if (
    typeof value !== "string" ||
    !INSTANCE_PATH_PATTERN.test(value) ||
    value.includes("//") ||
    value.split("/").some((part) => part === "." || part === "..")
  ) {
    return "";
  }
  return `${ROOMS_ORIGIN}${value}`;
}

export function safeRoomSheetUrl(value) {
  const url = safeRoomAssetUrl(value);
  return url && /\.pdf$/i.test(url) ? url : "";
}

export function normalizeRoomSheetUrl(value) {
  if (typeof value !== "string") return "";
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    return "";
  }
  if (
    value !== parsed.href ||
    parsed.origin !== ROOMS_ORIGIN ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    safeRoomSheetUrl(parsed.pathname) !== parsed.href
  ) {
    return "";
  }
  return parsed.href;
}

function safeText(value, maxLength = 240) {
  if (
    typeof value !== "string" ||
    value.length > maxLength ||
    CONTROL_PATTERN.test(value)
  ) {
    return "";
  }
  return value.trim();
}

function safeBoolean(value) {
  return typeof value === "boolean" ? value : null;
}

function safeNumber(value, maximum) {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= maximum
    ? value
    : null;
}

export function projectRoomRecord(payload, expectedRoomId) {
  const roomId = normalizeRoomId(expectedRoomId);
  if (!roomId || !isPlainObject(payload)) {
    fail("La respuesta de la habitación no es válida.");
  }
  if (payload.code !== undefined && normalizeRoomId(payload.code) !== roomId) {
    fail("La respuesta no corresponde a la habitación solicitada.");
  }

  const rawImages = isPlainObject(payload.images)
    ? payload.images
    : isPlainObject(payload.images_json)
      ? payload.images_json
      : {};
  const rawMeta = isPlainObject(rawImages.meta) ? rawImages.meta : {};
  const rawSheet = isPlainObject(rawImages.sheet) ? rawImages.sheet : {};

  return Object.freeze({
    code: roomId,
    direccion: safeText(payload.direccion),
    ciudad: safeText(payload.ciudad, 120),
    provincia: safeText(payload.provincia, 120),
    sheetUrl: safeRoomSheetUrl(rawSheet.url),
    meta: Object.freeze({
      cama: safeText(rawMeta.cama, 80),
      ventana: safeBoolean(rawMeta.ventana),
      cerradura: safeBoolean(rawMeta.cerradura),
      escritorio: safeBoolean(rawMeta.escritorio),
      enchufes:
        safeNumber(rawMeta.enchufes, 100) ?? safeText(rawMeta.enchufes, 40),
      bano_privado: safeBoolean(rawMeta.bano_privado),
      superficie_m2: safeNumber(rawMeta.superficie_m2, 10_000),
      precio: safeNumber(rawMeta.precio, 1_000_000),
      estado: safeText(rawMeta.estado, 80),
      fecha_disponibilidad: /^\d{4}-\d{2}-\d{2}$/.test(
        String(rawMeta.fecha_disponibilidad || "")
      )
        ? rawMeta.fecha_disponibilidad
        : "",
      barrio: safeText(rawMeta.barrio, 120),
      orientacion: safeText(rawMeta.orientacion, 80),
      planta: safeNumber(rawMeta.planta, 500) ?? safeText(rawMeta.planta, 40),
      metro: safeText(rawMeta.metro, 80),
      consumos_incluidos: safeBoolean(rawMeta.consumos_incluidos),
      normas: safeText(rawMeta.normas, 2_000),
      otros: safeText(rawMeta.otros, 2_000),
      descripcion: safeText(rawMeta.descripcion, 4_000),
    }),
  });
}

async function readBytesLimited(response, maximum) {
  const declared = response?.headers?.get?.("content-length");
  if (declared !== null && declared !== undefined && declared !== "") {
    if (!/^\d+$/.test(declared.trim()) || Number(declared) > maximum) {
      await response?.body?.cancel?.().catch(() => {});
      fail("La respuesta de habitaciones supera el límite seguro.");
    }
  }

  const reader = response?.body?.getReader?.();
  if (!reader) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > maximum) {
      fail("La respuesta de habitaciones supera el límite seguro.");
    }
    return bytes;
  }

  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value);
      total += chunk.byteLength;
      if (total > maximum) {
        await reader.cancel().catch(() => {});
        fail("La respuesta de habitaciones supera el límite seguro.");
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock?.();
  }

  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

function requestOptions(accept, signal) {
  return {
    method: "GET",
    headers: { Accept: accept },
    credentials: "omit",
    mode: "cors",
    redirect: "error",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    signal,
  };
}

export async function fetchRoomRecord(
  value,
  { fetchImpl = globalThis.fetch?.bind(globalThis), signal = null } = {}
) {
  if (typeof fetchImpl !== "function") fail("No hay transporte HTTP disponible.");
  const roomId = normalizeRoomId(value);
  const url = roomApiUrl(roomId);
  const response = await fetchImpl(
    url,
    requestOptions("application/json", signal)
  );
  const contentType = String(response?.headers?.get?.("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (!response?.ok || response.status !== 200 || contentType !== "application/json") {
    await response?.body?.cancel?.().catch(() => {});
    fail("No se pudo obtener la habitación de forma segura.");
  }
  const bytes = await readBytesLimited(response, MAX_ROOM_JSON_BYTES);
  let payload;
  try {
    payload = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
  } catch {
    fail("La respuesta de la habitación no contiene JSON válido.");
  }
  return projectRoomRecord(payload, roomId);
}

export async function fetchRoomSheet(
  value,
  { fetchImpl = globalThis.fetch?.bind(globalThis), signal = null } = {}
) {
  if (typeof fetchImpl !== "function") fail("No hay transporte HTTP disponible.");
  const url = normalizeRoomSheetUrl(value);
  if (!url) fail("La ficha de la habitación no tiene una ruta segura.");
  const response = await fetchImpl(
    url,
    requestOptions("application/pdf", signal)
  );
  const contentType = String(response?.headers?.get?.("content-type") || "")
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (!response?.ok || response.status !== 200 || contentType !== "application/pdf") {
    await response?.body?.cancel?.().catch(() => {});
    fail("No se pudo obtener la ficha PDF de forma segura.");
  }
  const bytes = await readBytesLimited(response, MAX_ROOM_SHEET_BYTES);
  if (new TextDecoder("ascii").decode(bytes.subarray(0, 5)) !== "%PDF-") {
    fail("La ficha recibida no es un PDF válido.");
  }
  return Object.freeze({ bytes, mime: "application/pdf", url });
}
