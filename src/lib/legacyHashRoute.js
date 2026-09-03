export function legacyHashRouteTarget(locationLike) {
  const pathname = String(locationLike?.pathname || "");
  const hash = String(locationLike?.hash || "");
  if (pathname !== "/" || !hash.startsWith("#/")) return "";

  const target = hash.slice(1);
  const rawPath = target.split(/[?#]/, 1)[0];
  if (
    !rawPath.startsWith("/") ||
    rawPath.startsWith("//") ||
    /[\\\u0000-\u001f\u007f]/.test(rawPath) ||
    /%[0-9a-f]{2}/i.test(rawPath) ||
    rawPath.includes("//") ||
    rawPath.split("/").some((segment) => segment === "." || segment === "..")
  ) {
    return "";
  }

  try {
    const resolved = new URL(target, "https://rtm.invalid/");
    if (resolved.origin !== "https://rtm.invalid") return "";
    return `${resolved.pathname}${resolved.search}${resolved.hash}`;
  } catch {
    return "";
  }
}

export function migrateLegacyHashRoute(browserWindow = globalThis.window) {
  const target = legacyHashRouteTarget(browserWindow?.location);
  if (!target) return false;
  try {
    browserWindow.history.replaceState(null, "", target);
    return true;
  } catch {
    return false;
  }
}
