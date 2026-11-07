// All customer steps use the same server-side /api binding as OPS.
// Never replay a mutation against another origin after an uncertain response.
export function clientApiUrl(path) {
  if (typeof path !== "string" || !path.startsWith("/") || path.startsWith("//") || path.includes("\\")) {
    throw new Error("La ruta solicitada no pertenece a este servicio.");
  }
  return `/api${path}`;
}

function unavailable(mutation) {
  const error = new Error(mutation
    ? "No hemos podido confirmar el resultado. No repitas el envío o el pago; comprueba primero el estado del expediente."
    : "No hemos podido consultar el expediente. Inténtalo de nuevo más tarde.");
  error.uncertain = mutation;
  return error;
}

export async function clientRequest(path, options = {}, fetcher = globalThis.fetch) {
  const url = clientApiUrl(path);
  const mutation = !["GET", "HEAD"].includes(String(options.method || "GET").toUpperCase());
  let response, data;
  try {
    response = await fetcher(url, { ...options, redirect: "error" });
    data = await response.json();
  } catch {
    throw unavailable(mutation);
  }
  if (!response.ok) {
    if (response.status >= 500) throw unavailable(mutation);
    const detail = data?.detail?.message || data?.detail || data?.message || data?.error;
    const error = new Error(typeof detail === "string" ? detail : `No se pudo completar la solicitud (HTTP ${response.status}).`);
    error.status = response.status;
    error.uncertain = false;
    throw error;
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw unavailable(mutation);
  return data;
}
