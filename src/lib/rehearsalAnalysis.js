import { normalizeCaseId } from "./caseAccess.js";
import { REHEARSAL_BASE, REHEARSAL_VERSION, rehearsalJson } from "./stagingRehearsal.js";

export async function runRehearsalAnalysis({ authFetch, caseId, signal }) {
  const id = normalizeCaseId(caseId);
  if (!id) throw new TypeError("El expediente no es válido.");
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const data = await rehearsalJson(await authFetch(REHEARSAL_BASE + "/cases/" + id + "/analysis", {
    method: "POST", signal,
  }));
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const keys = ["ok", "version", "synthetic_only", "case_id", "analysis_status", "reused", "requires_human_review"];
  if (JSON.stringify(Object.keys(data).sort()) !== JSON.stringify(keys.sort()) ||
      data.version !== REHEARSAL_VERSION || data.synthetic_only !== true || data.case_id !== id ||
      data.analysis_status !== "completed" || typeof data.reused !== "boolean" ||
      data.requires_human_review !== true) {
    throw new Error("No se ha podido verificar la lectura del ensayo.");
  }
  return Object.freeze({ reused: data.reused });
}
