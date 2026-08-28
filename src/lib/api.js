// El código desplegado usa siempre el proxy del mismo origen. Esto impide que
// un fallo de staging termine probando silenciosamente un backend distinto.
const runtimeEnv = import.meta.env || {};
const configuredDevelopmentBase = import.meta.env && import.meta.env.DEV
  ? runtimeEnv.VITE_API_BASE_URL || runtimeEnv.VITE_API_URL || ""
  : "";

export const RTM_API_BASE = String(configuredDevelopmentBase || "/api").replace(
  /\/$/,
  ""
);

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

export async function apiFetch(input, options = {}) {
  const caseId = requestCaseId(input, options);
  if (!caseId) return fetch(input, options);
  const { caseAccessOptions } = await import("./caseAccess.js");
  return fetch(input, caseAccessOptions(caseId, options));
}

export {
  CASE_ACCESS_HEADER,
  bootstrapCaseAccessFromUrl,
  caseAccessHeaders,
  caseAccessOptions,
  caseAccessQuery,
  getCaseAccessToken,
  openCaseFile,
  redactCaseAccessToken,
  rememberCaseAccessToken,
} from "./caseAccess.js";
