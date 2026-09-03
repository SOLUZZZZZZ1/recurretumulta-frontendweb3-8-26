const STORAGE_PREFIX = "rtm_case_data:v1:";
const CASE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LEGACY_EXACT_KEYS = Object.freeze([
  "rtm_last_analysis",
  "rtm_last_intake",
]);
const LEGACY_KEY_PREFIXES = Object.freeze(["rtm_client_"]);

const FIELD_ALIASES = Object.freeze({
  full_name: [
    "full_name",
    "nombre_completo",
    "nombre",
    "titular",
    "nombre_multado",
    "interesado",
  ],
  dni_nie: ["dni_nie", "dni", "nie", "documento_identidad"],
  domicilio_notif: [
    "domicilio_notif",
    "domicilio",
    "direccion",
    "domicilio_multado",
  ],
  matricula: [
    "matricula",
    "matrícula",
    "plate",
    "vehicle_plate",
    "matricula_vehiculo",
  ],
  email: ["email", "contact_email"],
  telefono: ["telefono", "phone"],
  organismo: ["organismo", "organismo_cabecera"],
  expediente_ref: ["expediente_ref", "numero_expediente"],
});

const FIELD_LIMITS = Object.freeze({
  full_name: 160,
  dni_nie: 32,
  domicilio_notif: 500,
  matricula: 32,
  email: 254,
  telefono: 40,
  organismo: 200,
  expediente_ref: 160,
});

function storage(name) {
  try {
    return globalThis.window?.[name] || globalThis[name] || null;
  } catch {
    return null;
  }
}

function validCaseId(caseId) {
  const value = String(caseId || "").trim();
  return CASE_ID_PATTERN.test(value) ? value.toLowerCase() : "";
}

function remove(store, key) {
  try {
    store?.removeItem(key);
  } catch {
    // Storage is optional. The application continues without local autofill.
  }
}

function legacyKeys(store) {
  const keys = [];
  try {
    for (let index = 0; index < Number(store?.length || 0); index += 1) {
      const key = store.key(index);
      if (typeof key === "string") keys.push(key);
    }
  } catch {
    return [];
  }
  return keys;
}

export function purgeLegacyCaseLocalStorage() {
  const persistent = storage("localStorage");
  for (const key of LEGACY_EXACT_KEYS) remove(persistent, key);
  for (const key of legacyKeys(persistent)) {
    if (LEGACY_KEY_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      remove(persistent, key);
    }
  }
}

function safeString(value, limit) {
  if (typeof value !== "string" && typeof value !== "number") return "";
  const clean = String(value)
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return clean.slice(0, limit);
}

function candidateSources(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const extraction = payload.extracted;
  return [
    payload.client_data,
    payload.interested_data,
    extraction?.extracted,
    extraction,
    payload.case_data,
    payload,
  ].filter((value) => value && typeof value === "object" && !Array.isArray(value));
}

function firstField(sources, aliases, limit) {
  for (const source of sources) {
    for (const alias of aliases) {
      const value = safeString(source?.[alias], limit);
      if (value) return value;
    }
  }
  return "";
}

export function projectCaseScopedData(caseId, payload = {}) {
  const canonicalCaseId = validCaseId(caseId);
  if (!canonicalCaseId) return null;
  const claimedCaseId = String(payload?.case_id ?? payload?.caseId ?? "").trim();
  if (claimedCaseId && validCaseId(claimedCaseId) !== canonicalCaseId) {
    return null;
  }
  const sources = candidateSources(payload);
  const caseData = {};
  for (const [field, aliases] of Object.entries(FIELD_ALIASES)) {
    const value = firstField(sources, aliases, FIELD_LIMITS[field]);
    if (value) caseData[field] = value;
  }
  return {
    version: 1,
    case_id: canonicalCaseId,
    case_data: caseData,
  };
}

export function rememberCaseScopedData(caseId, payload = {}) {
  purgeLegacyCaseLocalStorage();
  const projected = projectCaseScopedData(caseId, payload);
  if (!projected) return null;
  try {
    const scopedStorage = storage("sessionStorage");
    if (!scopedStorage) return null;
    scopedStorage.setItem(
      `${STORAGE_PREFIX}${projected.case_id}`,
      JSON.stringify(projected)
    );
    return projected;
  } catch {
    return null;
  }
}

export function getCaseScopedData(caseId) {
  purgeLegacyCaseLocalStorage();
  const canonicalCaseId = validCaseId(caseId);
  if (!canonicalCaseId) return null;
  try {
    const raw = storage("sessionStorage")?.getItem(
      `${STORAGE_PREFIX}${canonicalCaseId}`
    );
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.case_id !== canonicalCaseId) return null;
    return projectCaseScopedData(canonicalCaseId, parsed?.case_data || {});
  } catch {
    return null;
  }
}

export function clearCaseScopedData(caseId) {
  const canonicalCaseId = validCaseId(caseId);
  if (canonicalCaseId) {
    remove(storage("sessionStorage"), `${STORAGE_PREFIX}${canonicalCaseId}`);
  }
}

export { STORAGE_PREFIX as CASE_SESSION_STORAGE_PREFIX };
