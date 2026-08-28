const ACCESS_HEADER = "X-RTM-Case-Token";
const STORAGE_PREFIX = "rtm_case_access:";
const TOKEN_PATTERN = /^v1\.[a-f0-9]{64}$/i;

function cleanCaseId(caseId) {
  return String(caseId || "").trim();
}

function tokenFromSearch(search = "") {
  const raw = String(search || "");
  const query = raw.includes("?") ? raw.slice(raw.indexOf("?") + 1) : raw;
  return new URLSearchParams(query).get("access_token") || "";
}

function tokenFromCurrentLocation() {
  if (typeof window === "undefined") return "";
  return (
    tokenFromSearch(window.location.search) ||
    tokenFromSearch(window.location.hash)
  );
}

function safeSessionStorage() {
  try {
    return typeof window !== "undefined" ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

export function rememberCaseAccessToken(caseId, token) {
  const cleanId = cleanCaseId(caseId);
  const cleanToken = String(token || "").trim();
  if (!cleanId || !TOKEN_PATTERN.test(cleanToken)) return "";
  safeSessionStorage()?.setItem(`${STORAGE_PREFIX}${cleanId}`, cleanToken);
  return cleanToken;
}

export function getCaseAccessToken(caseId, search = "") {
  const cleanId = cleanCaseId(caseId);
  if (!cleanId) return "";

  const incoming = tokenFromSearch(search) || tokenFromCurrentLocation();
  if (incoming) {
    const remembered = rememberCaseAccessToken(cleanId, incoming);
    if (remembered) return remembered;
  }

  const stored = safeSessionStorage()?.getItem(`${STORAGE_PREFIX}${cleanId}`) || "";
  return TOKEN_PATTERN.test(stored) ? stored : "";
}

export function caseAccessHeaders(caseId, headers = {}, search = "") {
  const token = getCaseAccessToken(caseId, search);
  return token ? { ...headers, [ACCESS_HEADER]: token } : { ...headers };
}

export function caseAccessOptions(caseId, options = {}, search = "") {
  return {
    ...options,
    headers: caseAccessHeaders(caseId, options.headers || {}, search),
  };
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

export function bootstrapCaseAccessFromUrl() {
  if (typeof window === "undefined") return;
  const current = new URL(window.location.href);
  const caseId =
    current.searchParams.get("case") ||
    current.searchParams.get("case_id") ||
    current.searchParams.get("id") ||
    "";
  const token = current.searchParams.get("access_token") || "";
  if (!caseId || !rememberCaseAccessToken(caseId, token)) return;

  current.searchParams.delete("access_token");
  window.history.replaceState(
    window.history.state,
    "",
    `${current.pathname}${current.search}${current.hash}`
  );
}

export async function openCaseFile(url, caseId, search = "") {
  const response = await fetch(url, {
    headers: caseAccessHeaders(caseId, {}, search),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    const detail = payload?.detail?.message || payload?.detail || `HTTP ${response.status}`;
    throw new Error(typeof detail === "string" ? detail : JSON.stringify(detail));
  }

  const objectUrl = URL.createObjectURL(await response.blob());
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
