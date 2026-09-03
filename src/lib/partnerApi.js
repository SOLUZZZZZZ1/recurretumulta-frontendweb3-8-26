const PARTNER_API_PREFIX = "/api/partner";
const PARTNER_CSRF_COOKIE = "__Host-rtm_partner_csrf";
const CSRF_PATTERN = /^[a-f0-9]{64}$/i;
const PUBLIC_MUTATION_PATHS = new Set([
  "/api/partner/login",
  "/api/partner/change-password",
  "/api/partner/signup",
]);
const SESSION_PROBE_PATH = "/api/partner/session";
let boundPartnerCsrfToken = "";

function sessionChangedError() {
  const error = new Error("La sesión partner ha cambiado en otra ventana.");
  error.code = "PARTNER_SESSION_CHANGED";
  return error;
}

function currentOrigin() {
  const origin = String(globalThis.window?.location?.origin || "").trim();
  return origin && origin !== "null" ? origin : "https://rtm.invalid";
}

function explicitUrl(input) {
  if (typeof input === "string") return input.trim();
  if (typeof URL !== "undefined" && input instanceof URL) return input.href;
  throw new TypeError("La API partner requiere una URL explícita.");
}

export function requirePartnerApiPath(input) {
  const raw = explicitUrl(input);
  if (!raw) throw new TypeError("La URL de la API partner está vacía.");
  const rawPath = raw.split(/[?#]/, 1)[0];
  if (
    /[\\\u0000-\u001f\u007f]/.test(rawPath) ||
    /(?:^|\/)\.{1,2}(?:\/|$)/.test(rawPath) ||
    /%[0-9a-f]{2}/i.test(rawPath)
  ) {
    throw new TypeError("La ruta de la API partner no usa una forma canónica.");
  }

  const origin = currentOrigin();
  let target;
  try {
    target = new URL(raw, `${origin}/`);
  } catch {
    throw new TypeError("La URL de la API partner no es válida.");
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(target.pathname);
  } catch {
    throw new TypeError("La ruta de la API partner no es válida.");
  }

  if (
    target.origin !== origin ||
    target.username ||
    target.password ||
    target.hash ||
    (target.pathname !== PARTNER_API_PREFIX &&
      !target.pathname.startsWith(`${PARTNER_API_PREFIX}/`)) ||
    target.pathname.includes("//") ||
    /[\\\u0000-\u001f\u007f]/.test(decodedPath) ||
    decodedPath.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    throw new TypeError("La URL no pertenece a la API partner del mismo origen.");
  }

  return `${target.pathname}${target.search}`;
}

export function readPartnerCsrfToken(cookieHeader = globalThis.document?.cookie || "") {
  const matches = String(cookieHeader)
    .split(";")
    .map((part) => part.trim())
    .filter((part) => part.startsWith(`${PARTNER_CSRF_COOKIE}=`));
  if (matches.length !== 1) return "";

  let value = matches[0].slice(PARTNER_CSRF_COOKIE.length + 1);
  try {
    value = decodeURIComponent(value);
  } catch {
    return "";
  }
  value = value.trim();
  return CSRF_PATTERN.test(value) ? value : "";
}

export function bindPartnerCookieSession(
  expectedToken = readPartnerCsrfToken()
) {
  const currentToken = readPartnerCsrfToken();
  if (!expectedToken || !currentToken || expectedToken !== currentToken) {
    boundPartnerCsrfToken = "";
    throw sessionChangedError();
  }
  boundPartnerCsrfToken = currentToken;
  return true;
}

export function clearPartnerCookieSessionBinding() {
  boundPartnerCsrfToken = "";
}

export function partnerCookieSessionMatches() {
  const currentToken = readPartnerCsrfToken();
  return Boolean(
    boundPartnerCsrfToken &&
    currentToken &&
    boundPartnerCsrfToken === currentToken
  );
}

function secureHeaders(headers, { requireCsrf, csrfToken }) {
  const safe = new Headers(headers || {});
  if (safe.has("Authorization")) {
    throw new TypeError("La web partner no admite credenciales Bearer.");
  }
  safe.delete("X-CSRF-Token");
  if (!safe.has("Accept")) safe.set("Accept", "application/json");

  if (requireCsrf) {
    if (!csrfToken) {
      throw new Error("La protección de sesión ha caducado. Vuelve a iniciar sesión.");
    }
    safe.set("X-CSRF-Token", csrfToken);
  }
  return safe;
}

export function buildPartnerRequest(input, options = {}, { requireCsrf = false } = {}) {
  const method = String(options.method || "GET").trim().toUpperCase();
  const url = requirePartnerApiPath(input);
  const pathname = new URL(url, `${currentOrigin()}/`).pathname;
  const changesState = !["GET", "HEAD", "OPTIONS"].includes(method);
  const csrfRequiredByRoute = changesState && !PUBLIC_MUTATION_PATHS.has(pathname);
  const mustUseCsrf = requireCsrf || csrfRequiredByRoute;
  if (requireCsrf && ["GET", "HEAD", "OPTIONS"].includes(method)) {
    throw new TypeError("CSRF solo puede exigirse en una operación con cambios.");
  }

  const csrfToken = readPartnerCsrfToken();
  const headers = secureHeaders(options.headers, {
    requireCsrf: mustUseCsrf,
    csrfToken,
  });
  const requiresSessionBinding =
    !PUBLIC_MUTATION_PATHS.has(pathname) && pathname !== SESSION_PROBE_PATH;
  if (
    requiresSessionBinding &&
    (!boundPartnerCsrfToken ||
      !csrfToken ||
      boundPartnerCsrfToken !== csrfToken)
  ) {
    throw sessionChangedError();
  }

  return {
    url,
    options: {
      ...options,
      method,
      headers,
      credentials: "same-origin",
      mode: "same-origin",
      redirect: "error",
      cache: "no-store",
      referrerPolicy: "no-referrer",
    },
  };
}

export async function partnerFetch(
  input,
  options = {},
  { requireCsrf = false, fetchImpl = globalThis.fetch?.bind(globalThis) } = {}
) {
  if (typeof fetchImpl !== "function") {
    throw new Error("No hay transporte HTTP disponible.");
  }
  const request = buildPartnerRequest(input, options, { requireCsrf });
  return fetchImpl(request.url, request.options);
}

export async function readJsonResponseLimited(response, maxBytes) {
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) {
    throw new TypeError("Límite de respuesta no válido.");
  }
  const declaredLength = Number(response?.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await response?.body?.cancel?.().catch(() => {});
    throw new Error("La respuesta del servidor supera el límite seguro.");
  }

  const reader = response?.body?.getReader?.();
  if (!reader) {
    const text = await response.text();
    if (new TextEncoder().encode(text).length > maxBytes) {
      throw new Error("La respuesta del servidor supera el límite seguro.");
    }
    return text ? JSON.parse(text) : {};
  }

  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel().catch(() => {});
      throw new Error("La respuesta del servidor supera el límite seguro.");
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  return text ? JSON.parse(text) : {};
}

export { PARTNER_CSRF_COOKIE };
