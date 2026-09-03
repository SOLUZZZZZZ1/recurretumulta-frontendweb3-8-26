export const PARTNER_SESSION_KEYS = Object.freeze([
  "partner_authenticated",
  "partner_name",
  "partner_email",
  "partner_must_change",
  "partner_expires_at",
]);

const LEGACY_PARTNER_SECRET_KEYS = Object.freeze(["partner_token"]);
const PARTNER_SESSION_ENVELOPE_KEYS = Object.freeze([
  "authenticated",
  "expires_at",
  "ok",
  "partner_name",
]);
const PARTNER_LOGIN_ENVELOPE_KEYS = Object.freeze([
  "authenticated",
  "expires_at",
  "must_change_password",
  "ok",
  "partner_name",
  "token_returned",
]);
const PARTNER_PASSWORD_CHANGE_ENVELOPE_KEYS = Object.freeze([
  "must_change_password",
  "ok",
  "partner_name",
  "token_returned",
]);
const CONTROL_PATTERN = /[\u0000-\u001f\u007f]/;
// Must match the server's hard ceiling for RTM_PARTNER_SESSION_TTL_SECONDS.
const MAX_SESSION_HINT_MS = 7 * 24 * 60 * 60 * 1000;

function hasExactKeys(value, expected) {
  return (
    value &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    JSON.stringify(Object.keys(value).sort()) ===
      JSON.stringify([...expected].sort())
  );
}

function parsePartnerName(value) {
  if (typeof value !== "string" || CONTROL_PATTERN.test(value)) return "";
  const clean = value.trim();
  return clean && clean.length <= 160 ? clean : "";
}

function parseFutureExpiration(value, now) {
  if (typeof value !== "string" || value.length > 64) return "";
  const expiration = Date.parse(value);
  if (
    !Number.isFinite(expiration) ||
    !Number.isFinite(now) ||
    expiration <= now ||
    expiration - now > MAX_SESSION_HINT_MS
  ) {
    return "";
  }
  return value;
}

export function parsePartnerSessionEnvelope(payload, now = Date.now()) {
  if (
    !hasExactKeys(payload, PARTNER_SESSION_ENVELOPE_KEYS) ||
    payload.ok !== true ||
    payload.authenticated !== true
  ) {
    throw new TypeError("Respuesta de sesión partner no válida.");
  }
  const partnerName = parsePartnerName(payload.partner_name);
  const expiresAt = parseFutureExpiration(payload.expires_at, now);
  if (!partnerName || !expiresAt) {
    throw new TypeError("Sesión partner fuera de límites.");
  }
  return { partnerName, expiresAt };
}

export function parsePartnerLoginEnvelope(payload, now = Date.now()) {
  if (
    hasExactKeys(payload, PARTNER_PASSWORD_CHANGE_ENVELOPE_KEYS) &&
    payload.ok === true &&
    payload.must_change_password === true &&
    payload.token_returned === false
  ) {
    const partnerName = parsePartnerName(payload.partner_name);
    if (!partnerName) throw new TypeError("Respuesta de acceso partner no válida.");
    return { mustChangePassword: true, partnerName, expiresAt: "" };
  }

  if (
    !hasExactKeys(payload, PARTNER_LOGIN_ENVELOPE_KEYS) ||
    payload.ok !== true ||
    payload.authenticated !== true ||
    payload.must_change_password !== false ||
    payload.token_returned !== false
  ) {
    throw new TypeError("Respuesta de acceso partner no válida.");
  }
  const partnerName = parsePartnerName(payload.partner_name);
  const expiresAt = parseFutureExpiration(payload.expires_at, now);
  if (!partnerName || !expiresAt) {
    throw new TypeError("Sesión partner fuera de límites.");
  }
  return { mustChangePassword: false, partnerName, expiresAt };
}

function getStorage(name) {
  try {
    return globalThis.window?.[name] || globalThis[name] || null;
  } catch {
    return null;
  }
}

function read(storage, key) {
  try {
    return storage?.getItem(key);
  } catch {
    return null;
  }
}

function write(storage, key, value) {
  try {
    storage?.setItem(key, String(value ?? ""));
    return Boolean(storage);
  } catch {
    return false;
  }
}

function remove(storage, key) {
  try {
    storage?.removeItem(key);
  } catch {
    // Storage may be disabled by the browser. Authentication remains fail-closed.
  }
}

function assertKnownKey(key) {
  if (!PARTNER_SESSION_KEYS.includes(key)) {
    throw new Error("Clave de sesión partner no permitida.");
  }
}

/**
 * One-time migration for pre-hardening sessions. Non-sensitive UI metadata is
 * copied to the tab-scoped store. Legacy bearer credentials are destroyed in
 * both stores: the browser authenticates exclusively with the HttpOnly cookie.
 */
export function migratePartnerSession() {
  const session = getStorage("sessionStorage");
  const legacy = getStorage("localStorage");

  for (const key of LEGACY_PARTNER_SECRET_KEYS) {
    remove(session, key);
    remove(legacy, key);
  }

  for (const key of PARTNER_SESSION_KEYS) {
    const sessionValue = read(session, key);
    const legacyValue = read(legacy, key);
    if (sessionValue == null && legacyValue != null) {
      write(session, key, legacyValue);
    }
    remove(legacy, key);
  }
}

export function getPartnerSessionValue(key) {
  assertKnownKey(key);
  migratePartnerSession();
  return read(getStorage("sessionStorage"), key) || "";
}

export function setPartnerSessionValue(key, value) {
  assertKnownKey(key);
  const stored = write(getStorage("sessionStorage"), key, value);
  remove(getStorage("localStorage"), key);
  // Solo es una pista de interfaz. La autoridad de autenticación vive en la
  // cookie HttpOnly y en el servidor, así que bloquear storage no degrada auth.
  return stored;
}

export function clearPartnerSession() {
  const session = getStorage("sessionStorage");
  const legacy = getStorage("localStorage");
  for (const key of [...PARTNER_SESSION_KEYS, ...LEGACY_PARTNER_SECRET_KEYS]) {
    remove(session, key);
    remove(legacy, key);
  }
}

export function hasPartnerSessionHint() {
  if (getPartnerSessionValue("partner_authenticated") !== "1") return false;

  const expiresAt = getPartnerSessionValue("partner_expires_at");
  if (!expiresAt) return false;
  const expiration = Date.parse(expiresAt);
  return Number.isFinite(expiration) && expiration > Date.now();
}

export function partnerSessionRemainingMs(now = Date.now()) {
  const expiration = Date.parse(getPartnerSessionValue("partner_expires_at"));
  if (!Number.isFinite(expiration) || !Number.isFinite(now)) return 0;
  return Math.max(0, expiration - now);
}
