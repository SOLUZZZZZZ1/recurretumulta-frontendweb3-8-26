import { CASE_ACCESS_HEADER, getCaseAccessToken, normalizeCaseId, rememberCaseAccessToken } from "./caseAccess.js";
import { REHEARSAL_BASE, REHEARSAL_VERSION, rehearsalJson } from "./stagingRehearsal.js";

export async function prepareOpsSummaryAccess({ authFetch, caseId, signal }) {
  const id = normalizeCaseId(caseId);
  if (!id) throw new Error("El expediente no es válido.");
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const path = "/resumen?case=" + encodeURIComponent(id);
  if (getCaseAccessToken(id)) return path;

  const response = await authFetch(REHEARSAL_BASE + "/cases/" + id + "/payment-access", {
    method: "POST", signal,
  });
  if (response.status === 404) {
    throw new Error("Abre el resumen desde el enlace privado de continuación de este expediente.");
  }
  const data = await rehearsalJson(response);
  const keys = ["ok", "version", "synthetic_only", "case_id", "case_access_token_header", "case_access_token"];
  if (data.version !== REHEARSAL_VERSION || data.synthetic_only !== true || data.case_id !== id ||
      data.case_access_token_header !== CASE_ACCESS_HEADER ||
      JSON.stringify(Object.keys(data).sort()) !== JSON.stringify(keys.sort())) {
    throw new Error("No se ha podido verificar el acceso al resumen del ensayo.");
  }
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  if (!rememberCaseAccessToken(id, data.case_access_token)) {
    throw new Error("No se ha podido preparar el acceso privado en esta pestaña.");
  }
  return path;
}
