const ACCESS_HEADER = "X-RTM-Case-Token";
const STORAGE_PREFIX = "rtm_case_access:";
// v2 añade fecha de emisión y nonce; la caducidad y la firma solo las decide el
// backend. v1 se conserva temporalmente mientras expiran enlaces ya emitidos.
const TOKEN_PATTERN = /^(?:v1\.[a-f0-9]{64}|v2\.\d{9,11}\.[a-f0-9]{32}\.[a-f0-9]{64})$/i;
const TOKEN_IN_TEXT_PATTERN = /(?:v1\.[a-f0-9]{64}|v2\.\d{9,11}\.[a-f0-9]{32}\.[a-f0-9]{64})/i;
const CASE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const API_PREFIX = "/api";

function cleanCaseId(caseId) {
  const value = String(caseId || "").trim();
  return CASE_ID_PATTERN.test(value) ? value.toLowerCase() : "";
}

export function normalizeCaseId(caseId) {
  return cleanCaseId(caseId);
}

function safeSessionStorage() {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

function currentOrigin() {
  if (typeof window === "undefined") return "";
  const explicitOrigin = String(window.location?.origin || "").trim();
  if (explicitOrigin && explicitOrigin !== "null") return explicitOrigin;
  try {
    return new URL(String(window.location?.href || "")).origin;
  } catch {
    return "";
  }
}

function requestUrl(input) {
  if (typeof input === "string") return input.trim();
  if (typeof URL !== "undefined" && input instanceof URL) return input.href;
  throw new TypeError("Las peticiones con acceso al expediente requieren una URL explícita");
}

export function requireSameOriginApiUrl(input) {
  const raw = requestUrl(input);
  if (!raw) throw new TypeError("URL de API vacía");
  const rawPath = raw.split(/[?#]/, 1)[0];
  if (
    /[\\\u0000-\u001f\u007f]/.test(rawPath) ||
    /(?:^|\/)\.{1,2}(?:\/|$)/.test(rawPath) ||
    /%[0-9a-f]{2}/i.test(rawPath)
  ) {
    throw new TypeError("La ruta de API no usa una forma canónica");
  }

  const origin = currentOrigin();
  if (!origin && (!raw.startsWith("/") || raw.startsWith("//"))) {
    throw new TypeError("No se puede verificar el origen de la URL de API");
  }

  let resolved;
  try {
    resolved = new URL(raw, `${origin || "https://rtm.invalid"}/`);
  } catch {
    throw new TypeError("URL de API no válida");
  }

  if (
    (origin && resolved.origin !== origin) ||
    resolved.username ||
    resolved.password ||
    (resolved.pathname !== API_PREFIX && !resolved.pathname.startsWith(`${API_PREFIX}/`)) ||
    resolved.pathname.includes("//")
  ) {
    throw new TypeError("La URL no pertenece a la API segura del mismo origen");
  }

  // Se devuelve una ruta de raíz para que fetch nunca conserve un host aportado
  // por el servidor. Los fragmentos tampoco forman parte de una petición HTTP.
  return `${resolved.pathname}${resolved.search}`;
}

export function rememberCaseAccessToken(caseId, token) {
  const cleanId = cleanCaseId(caseId);
  const cleanToken = String(token || "").trim();
  if (!cleanId || !TOKEN_PATTERN.test(cleanToken)) return "";
  try {
    const storage = safeSessionStorage();
    if (!storage) return "";
    storage.setItem(`${STORAGE_PREFIX}${cleanId}`, cleanToken);
    return cleanToken;
  } catch {
    return "";
  }
}

export function getCaseAccessToken(caseId) {
  const cleanId = cleanCaseId(caseId);
  if (!cleanId) return "";

  try {
    const stored = safeSessionStorage()?.getItem(`${STORAGE_PREFIX}${cleanId}`) || "";
    return TOKEN_PATTERN.test(stored) ? stored : "";
  } catch {
    return "";
  }
}

export function forgetCaseAccessToken(caseId) {
  const cleanId = cleanCaseId(caseId);
  if (!cleanId) return;
  try {
    safeSessionStorage()?.removeItem?.(`${STORAGE_PREFIX}${cleanId}`);
  } catch {
    // El borrado local es defensivo; una política de storage bloqueada no abre acceso.
  }
}

function sanitizedHeaders(headers) {
  let entries = [];
  if (Array.isArray(headers)) {
    entries = headers;
  } else if (headers && typeof headers.entries === "function") {
    entries = [...headers.entries()];
  } else {
    entries = Object.entries(headers || {});
  }

  return Object.fromEntries(
    entries.filter(
      ([name]) => String(name).toLowerCase() !== ACCESS_HEADER.toLowerCase()
    )
  );
}

export function caseAccessHeaders(caseId, headers = {}) {
  const token = getCaseAccessToken(caseId);
  const cleanHeaders = sanitizedHeaders(headers);
  return token ? { ...cleanHeaders, [ACCESS_HEADER]: token } : cleanHeaders;
}

export function caseAccessOptions(caseId, options = {}) {
  const token = getCaseAccessToken(caseId);
  return caseAccessOptionsForToken(options, token);
}

function caseAccessOptionsForToken(options, token) {
  const cleanHeaders = sanitizedHeaders(options.headers || {});
  return {
    ...options,
    redirect: "error",
    mode: "same-origin",
    credentials: "same-origin",
    cache: "no-store",
    referrerPolicy: "no-referrer",
    headers: token ? { ...cleanHeaders, [ACCESS_HEADER]: token } : cleanHeaders,
  };
}

function decodedPathCaseId(pathname) {
  const match = pathname.match(
    /\/(?:cases|billing\/(?:status|review-context))\/([^/]+)(?:\/|$)/
  );
  if (!match) return "";
  try {
    return decodeURIComponent(match[1]);
  } catch {
    throw new TypeError("El expediente de la ruta no es válido");
  }
}

function bodyCaseIds(body, expectsJson) {
  if (body && typeof body.getAll === "function") {
    return body.getAll("case_id").map((value) => String(value || ""));
  }
  if (typeof body !== "string") return [];

  let payload;
  try {
    payload = JSON.parse(body);
  } catch {
    if (expectsJson) throw new TypeError("El cuerpo JSON protegido no es válido");
    return [];
  }
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return [];
  }
  return Object.hasOwn(payload, "case_id")
    ? [String(payload.case_id || "")]
    : [];
}

function assertRequestBoundToCase(safeUrl, caseId, options) {
  const target = new URL(safeUrl, "https://rtm.invalid");
  const pathCaseId = decodedPathCaseId(target.pathname);
  if (pathCaseId && cleanCaseId(pathCaseId) !== caseId) {
    throw new TypeError("El expediente de la ruta no coincide con su capacidad");
  }

  const queryCaseIds = [
    ...target.searchParams.getAll("case"),
    ...target.searchParams.getAll("case_id"),
  ];
  if (
    queryCaseIds.length > 1 ||
    (queryCaseIds.length === 1 && cleanCaseId(queryCaseIds[0]) !== caseId)
  ) {
    throw new TypeError("El expediente de la consulta no coincide con su capacidad");
  }

  let contentType = "";
  try {
    contentType = new Headers(options.headers || {}).get("Content-Type") || "";
  } catch {
    contentType = "";
  }
  const ids = bodyCaseIds(
    options.body,
    contentType.toLowerCase().includes("application/json")
  );
  if (ids.length > 1 || (ids.length === 1 && cleanCaseId(ids[0]) !== caseId)) {
    throw new TypeError("El expediente del cuerpo no coincide con su capacidad");
  }

  const requiresBodyCase =
    target.pathname.endsWith("/vehicle-removal/verify-registration") ||
    target.pathname.endsWith("/vehicle-removal/create-checkout-session");
  if (requiresBodyCase && ids.length !== 1) {
    throw new TypeError("La operación requiere un único expediente en el cuerpo");
  }
}

export async function caseAccessFetch(input, caseId, options = {}) {
  const safeUrl = requireSameOriginApiUrl(input);
  const cleanId = cleanCaseId(caseId);
  if (!cleanId) throw new TypeError("El expediente protegido no es válido");
  assertRequestBoundToCase(safeUrl, cleanId, options);
  return fetch(safeUrl, caseAccessOptions(cleanId, options));
}

export async function requiredCaseAccessFetch(input, caseId, options = {}) {
  // El origen se valida antes de consultar la sesión para no convertir la
  // presencia de una capacidad local en un oráculo para URLs no confiables.
  const safeUrl = requireSameOriginApiUrl(input);
  const cleanId = cleanCaseId(caseId);
  if (!cleanId) {
    throw new Error("Falta el acceso válido para este expediente.");
  }
  assertRequestBoundToCase(safeUrl, cleanId, options);
  const token = cleanId ? getCaseAccessToken(cleanId) : "";
  if (!token) {
    throw new Error("Falta el acceso válido para este expediente.");
  }
  return fetch(safeUrl, caseAccessOptionsForToken(options, token));
}

export function caseAccessQuery(caseId) {
  const params = new URLSearchParams({ case: cleanCaseId(caseId) });
  return params.toString();
}

export function redactCaseAccessToken(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }
  const clean = { ...payload };
  delete clean.case_access_token;
  delete clean.access_token;
  return clean;
}

function parameterValue(params, names) {
  for (const [key, value] of params.entries()) {
    if (names.includes(String(key).toLowerCase())) return String(value || "");
  }
  return "";
}

function decodedVariants(value, maxRounds = 4) {
  const variants = [String(value || "")];
  for (let round = 0; round < maxRounds; round += 1) {
    try {
      const decoded = decodeURIComponent(variants[variants.length - 1]);
      if (decoded === variants[variants.length - 1]) break;
      variants.push(decoded);
    } catch {
      break;
    }
  }
  return variants;
}

function containsEncodedBearer(value) {
  return decodedVariants(value).some((candidate) =>
    TOKEN_IN_TEXT_PATTERN.test(candidate)
  );
}

function normalizedParameterKey(value) {
  return decodedVariants(value).at(-1).trim().toLowerCase();
}

function removeBearerParameters(params) {
  let bearer = "";
  const keys = [];
  for (const [key, value] of params.entries()) {
    const normalizedKey = String(key).toLowerCase();
    const decodedKey = normalizedParameterKey(key);
    const normalizedValue = String(value || "").trim();
    if (
      decodedKey === "access_token" ||
      decodedKey === "case_access_token" ||
      containsEncodedBearer(normalizedKey) ||
      containsEncodedBearer(normalizedValue)
    ) {
      if (
        !bearer &&
        normalizedKey === "access_token" &&
        TOKEN_PATTERN.test(normalizedValue)
      ) {
        bearer = normalizedValue;
      }
      keys.push(key);
    }
  }
  for (const key of keys) params.delete(key);
  return { bearer, changed: keys.length > 0 };
}

function scrubBearerText(value) {
  const raw = String(value || "");
  const scrubbed = raw.replace(
    new RegExp(TOKEN_IN_TEXT_PATTERN.source, "gi"),
    ""
  );
  if (scrubbed !== raw) return { value: scrubbed, changed: true };

  // URLSearchParams decodifica claves y valores, pero el prefijo de una ruta
  // hash no. Si el secreto se ha codificado de forma inusual, se descarta ese
  // prefijo completo antes que conservarlo en el historial.
  const variants = decodedVariants(raw);
  if (variants.slice(1).some((decoded) => TOKEN_IN_TEXT_PATTERN.test(decoded))) {
    return { value: "", changed: true };
  }
  return { value: raw, changed: false };
}

function parseHashParameters(hash) {
  const original = String(hash || "");
  const raw = original.startsWith("#") ? original.slice(1) : original;
  const queryIndex = raw.indexOf("?");
  if (queryIndex >= 0) {
    const prefix = scrubBearerText(raw.slice(0, queryIndex));
    return {
      original,
      prefix: prefix.value,
      separator: "?",
      params: new URLSearchParams(raw.slice(queryIndex + 1)),
      changed: prefix.changed,
    };
  }
  const decodedRaw = decodedVariants(raw).at(-1);
  if (TOKEN_PATTERN.test(decodedRaw.trim())) {
    return {
      original,
      prefix: "",
      separator: "",
      params: new URLSearchParams({ __raw_bearer: decodedRaw.trim() }),
    };
  }
  const bareParams = new URLSearchParams(raw);
  const containsSecret = [...bareParams.entries()].some(
    ([key, value]) =>
      ["access_token", "case_access_token"].includes(normalizedParameterKey(key)) ||
      containsEncodedBearer(key) ||
      containsEncodedBearer(value)
  );
  if (containsSecret) {
    return {
      original,
      prefix: "",
      separator: "",
      params: bareParams,
    };
  }
  return { original, prefix: raw, separator: "", params: null, changed: false };
}

function serializedHash(parsed) {
  if (!parsed.params) {
    return parsed.changed
      ? parsed.prefix
        ? `#${parsed.prefix}`
        : ""
      : parsed.original;
  }
  const query = parsed.params.toString();
  if (!query) return parsed.prefix ? `#${parsed.prefix}` : "";
  return `#${parsed.prefix}${parsed.prefix ? parsed.separator : ""}${query}`;
}

export function bootstrapCaseAccessFromUrl() {
  if (typeof window === "undefined") return;
  let current;
  try {
    current = new URL(window.location.href);
  } catch {
    // Una ubicación que no se puede interpretar nunca debe tumbar el arranque.
    return;
  }
  const hash = parseHashParameters(current.hash);
  const searchResult = removeBearerParameters(current.searchParams);
  const hashResult = hash.params
    ? removeBearerParameters(hash.params)
    : { bearer: "", changed: false };

  const searchCaseId = parameterValue(current.searchParams, ["case", "case_id", "id"]);
  const hashCaseId = hash.params
    ? parameterValue(hash.params, ["case", "case_id", "id"])
    : "";
  const casesConflict = Boolean(
    searchCaseId && hashCaseId && cleanCaseId(searchCaseId) !== cleanCaseId(hashCaseId)
  );
  const caseId = casesConflict ? "" : searchCaseId || hashCaseId;
  // Una capacidad solo se importa desde el fragmento: nunca desde la query,
  // que sí viaja a CDN, servidor, logs y cabeceras Referer. Los parámetros de
  // query antiguos se eliminan, pero deliberadamente no se aceptan.
  const token = hashResult.bearer;

  // El secreto desaparece del historial visible incluso si es inválido, está
  // huérfano o no puede guardarse. La compatibilidad termina aquí: las llamadas
  // posteriores leen exclusivamente sessionStorage y nunca vuelven a la URL.
  if (searchResult.changed || hashResult.changed || hash.changed) {
    const safeHash = serializedHash(hash);
    try {
      window.history.replaceState(
        window.history.state,
        "",
        `${current.pathname}${current.search}${safeHash}`
      );
    } catch {
      // Si el navegador o una política embebida impiden sanear el historial,
      // la capacidad no se importa. Así la URL nunca queda como almacén activo.
      return;
    }
  }

  if (!caseId || !token || casesConflict) return;
  rememberCaseAccessToken(caseId, token);
}

export async function openCaseFile(url, caseId, options = {}) {
  const response = await requiredCaseAccessFetch(url, caseId, options);
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const detail = payload?.detail?.message || payload?.detail || `HTTP ${response.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  const blob = await response.blob();
  if (options.signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = objectUrl;
  anchor.download = `rtm_${cleanCaseId(caseId)}.pdf`;
  anchor.rel = "noopener noreferrer";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export { ACCESS_HEADER as CASE_ACCESS_HEADER };
