// El código desplegado usa siempre el proxy del mismo origen. Esto impide que
// un fallo de staging termine probando silenciosamente un backend distinto.
const configuredDevelopmentBase = import.meta.env.DEV
  ? import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || ""
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
