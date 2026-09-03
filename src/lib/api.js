import {
  CASE_ACCESS_HEADER,
  requiredCaseAccessFetch,
} from "./caseAccess.js";

// El navegador usa siempre el proxy /api del mismo origen, también en local.
// El destino de desarrollo se configura exclusivamente en vite.config.js y
// nunca se incrusta como origen alternativo en el bundle público.
export const RTM_API_BASE = "/api";

// Se conserva el contrato de candidatos para los componentes legacy, pero la
// lista contiene un único entorno autoritativo y nunca hace failover por HTTP.
export const RTM_API_CANDIDATES = Object.freeze([RTM_API_BASE]);

export function getApiBase() {
  return RTM_API_BASE;
}

export function apiUrl(path = "") {
  const cleanPath = String(path || "");
  return `${RTM_API_BASE}${cleanPath.startsWith("/") ? cleanPath : `/${cleanPath}`}`;
}

function requestCaseId(input, options = {}) {
  const raw = typeof input === "string" ? input : input?.url || "";
  let pathname = "";
  try {
    pathname = new URL(raw, "https://rtm.invalid").pathname;
  } catch {
    pathname = String(raw || "").split("?", 1)[0];
  }

  if (!pathname.includes("/ops/")) {
    const caseRoute = pathname.match(/\/cases\/([^/]+)/);
    const candidate = decodeURIComponent(caseRoute?.[1] || "");
    if (candidate && !["intake-draft", "continue-lookup"].includes(candidate)) {
      return candidate;
    }
  }

  const billingStatus = pathname.match(/\/billing\/(?:status|review-context)\/([^/]+)/);
  if (billingStatus?.[1]) return decodeURIComponent(billingStatus[1]);

  if (pathname.endsWith("/billing/checkout") || pathname.endsWith("/checkout")) {
    try {
      const payload = JSON.parse(String(options.body || "{}"));
      return String(payload?.case_id || "").trim();
    } catch {
      return "";
    }
  }
  return "";
}

function hasExplicitCaseAccessHeader(headers) {
  if (!headers) return false;
  try {
    return new Headers(headers).has(CASE_ACCESS_HEADER);
  } catch {
    return Object.keys(headers || {}).some(
      (name) => String(name).toLowerCase() === CASE_ACCESS_HEADER.toLowerCase()
    );
  }
}

export async function apiFetch(input, options = {}) {
  const caseId = requestCaseId(input, options);
  if (!caseId) {
    if (hasExplicitCaseAccessHeader(options.headers)) {
      throw new TypeError(
        "No se permite transportar acceso de expediente sin una ruta de caso verificable"
      );
    }
    return fetch(input, options);
  }
  return requiredCaseAccessFetch(input, caseId, options);
}

export {
  CASE_ACCESS_HEADER,
  bootstrapCaseAccessFromUrl,
  caseAccessFetch,
  caseAccessHeaders,
  caseAccessOptions,
  caseAccessQuery,
  forgetCaseAccessToken,
  getCaseAccessToken,
  normalizeCaseId,
  openCaseFile,
  redactCaseAccessToken,
  rememberCaseAccessToken,
  requiredCaseAccessFetch,
  requireSameOriginApiUrl,
} from "./caseAccess.js";
