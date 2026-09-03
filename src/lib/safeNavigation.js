const CONTROL_OR_BACKSLASH = /[\u0000-\u001f\u007f\\]/;
const ENCODED_CONTROL_OR_BACKSLASH = /%(?:0[0-9a-f]|1[0-9a-f]|7f|5c)/i;
const ENCODED_PATH_SEPARATOR = /%(?:2f|5c)/i;

function browserOrigin() {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://rtm.invalid";
}

function normalizedOrigin(origin) {
  try {
    const parsed = new URL(origin || browserOrigin());
    if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) {
      return null;
    }
    return parsed.origin;
  } catch {
    return null;
  }
}

function hasUnsafeEncoding(raw, { pathSeparators = false } = {}) {
  if (ENCODED_CONTROL_OR_BACKSLASH.test(raw)) return true;
  if (!pathSeparators) return false;

  const withoutFragmentOrQuery = raw.split(/[?#]/, 1)[0];
  return ENCODED_PATH_SEPARATOR.test(withoutFragmentOrQuery);
}

/**
 * Converts an explicitly root-relative or same-origin URL into a root-relative
 * path. Anything ambiguous is rejected instead of being repaired.
 */
export function safeInternalPath(value, options = {}) {
  if (typeof value !== "string" || !value || value !== value.trim()) return null;
  if (value.length > 2048 || CONTROL_OR_BACKSLASH.test(value)) return null;
  if (hasUnsafeEncoding(value, { pathSeparators: true })) return null;
  if (value.startsWith("//")) return null;

  const origin = normalizedOrigin(options.origin);
  if (!origin) return null;

  const isRootRelative = value.startsWith("/");
  const isAbsoluteHttp = /^https?:\/\//i.test(value);
  if (!isRootRelative && !isAbsoluteHttp) return null;

  try {
    const parsed = new URL(value, `${origin}/`);
    if (!/^https?:$/.test(parsed.protocol)) return null;
    if (parsed.origin !== origin || parsed.username || parsed.password) return null;
    if (!parsed.pathname.startsWith("/") || parsed.pathname.startsWith("//")) return null;
    if (CONTROL_OR_BACKSLASH.test(parsed.pathname)) return null;

    const allowedPathnames = options.allowedPathnames;
    if (
      Array.isArray(allowedPathnames) &&
      !allowedPathnames.includes(parsed.pathname)
    ) {
      return null;
    }

    if (options.pathOnly === true) return parsed.pathname;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

/** Only Stripe's canonical HTTPS checkout host may receive a payment redirect. */
export function safeStripeCheckoutUrl(value) {
  if (typeof value !== "string" || !value || value !== value.trim()) return null;
  if (value.length > 4096 || CONTROL_OR_BACKSLASH.test(value)) return null;
  if (hasUnsafeEncoding(value) || value.startsWith("//")) return null;

  try {
    const parsed = new URL(value);
    if (parsed.protocol !== "https:") return null;
    if (parsed.hostname !== "checkout.stripe.com" || parsed.port) return null;
    if (parsed.username || parsed.password) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function requireStripeCheckoutUrl(value) {
  const safeUrl = safeStripeCheckoutUrl(value);
  if (!safeUrl) {
    throw new Error("El proveedor devolvió una dirección de pago no permitida.");
  }
  return safeUrl;
}
