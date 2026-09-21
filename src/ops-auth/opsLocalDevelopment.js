export const OPS_LOCAL_ORIGIN = "http://127.0.0.1:5173";

export function isLocalOpsOrigin(origin = globalThis.location?.origin) {
  return origin === OPS_LOCAL_ORIGIN;
}

export function localOpsDevelopmentEnabled({
  development,
  enabled,
  origin,
} = {}) {
  return development === true && enabled === "1" && origin === OPS_LOCAL_ORIGIN;
}

export function currentLocalOpsDevelopmentEnabled() {
  return localOpsDevelopmentEnabled({
    development: import.meta.env?.DEV,
    enabled: import.meta.env?.VITE_RTM_LOCAL_OPERATOR_AUTH,
    origin: globalThis.location?.origin,
  });
}

export function isExactLocalOpsProfile(payload) {
  return (
    payload?.auth_environment === "development" &&
    payload?.auth_profile === "local_development" &&
    payload?.local_only === true &&
    payload?.staging_only === false
  );
}
