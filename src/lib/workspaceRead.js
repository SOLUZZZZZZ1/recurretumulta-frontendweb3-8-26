export const READ_VERSION = "rtm_ops_workspace_read_v1";
const record = (x) => x !== null && typeof x === "object" && !Array.isArray(x);
const scalar = (x) => x === null || ["string", "boolean", "number"].includes(typeof x);
const states = new Set(["available", "not_recorded", "schema_unavailable"]);
export function validateWorkspace(data, caseId) {
  if (!record(data) || data.ok !== true || data.case_id !== caseId)
    throw new Error("WORKSPACE_RESPONSE_INVALID");
  if (data.workspace_version !== READ_VERSION) {
    if (!["rtm_ops_workspace_v1_0", "rtm_ops_workspace_v1_2"].includes(data.workspace_version)
        || !record(data.case) || !record(data.readiness) || !record(data.authority))
      throw new Error("WORKSPACE_RESPONSE_INVALID");
    return data;
  }
  if (data.read_only !== true || !record(data.case?.fields)
      || !record(data.case?.identities) || !record(data.sections)
      || data.legal?.status !== "not_supported"
      || data.capabilities?.mutations !== false
      || data.capabilities?.document_export !== false
      || data.capabilities?.legal_actions !== false)
    throw new Error("WORKSPACE_RESPONSE_INVALID");
  for (const fields of [data.case.fields, data.case.identities.interested, data.case.identities.contact]) {
    if (!record(fields)) throw new Error("WORKSPACE_RESPONSE_INVALID");
    for (const f of Object.values(fields)) {
      if (!record(f) || !states.has(f.status) || !scalar(f.value)
          || (f.source !== null && typeof f.source !== "string")
          || (f.status === "schema_unavailable" && f.value !== null))
        throw new Error("WORKSPACE_RESPONSE_INVALID");
    }
  }
  if (data.case.fields.id?.value !== caseId) throw new Error("WORKSPACE_RESPONSE_INVALID");
  if (!["status","payment_status","authorized","customer_comment","created_at","updated_at"]
      .every(k => Object.hasOwn(data.case.fields, k))
      || !["full_name","dni_nie","email","phone","address"].every(k => Object.hasOwn(data.case.identities.interested, k))
      || !["full_name","email"].every(k => Object.hasOwn(data.case.identities.contact, k)))
    throw new Error("WORKSPACE_RESPONSE_INVALID");
  for (const name of ["documents", "timeline", "followups"]) {
    const s = data.sections[name];
    if (!record(s) || !["available", "empty", "partial", "schema_unavailable"].includes(s.status)
        || !Array.isArray(s.missing_columns))
      throw new Error("WORKSPACE_RESPONSE_INVALID");
    if (s.status === "schema_unavailable") {
      if (s.items !== null) throw new Error("WORKSPACE_RESPONSE_INVALID");
    } else {
      if (!Array.isArray(s.items) || (s.status === "empty" && s.items.length !== 0)
          || s.items.some((i) => !record(i) || i.case_id !== caseId || typeof i.id !== "string"
            || Object.values(i).some((v) => !scalar(v))))
        throw new Error("WORKSPACE_RESPONSE_INVALID");
    }
  }
  return data;
}
export async function readWorkspace(caseId, token, signal) {
  const response = await fetch("/api/ops/core/cases/" + encodeURIComponent(caseId) + "/workspace",
    {headers: {"X-Operator-Token": token, "X-RTM-Workspace-Contract": READ_VERSION}, signal, cache: "no-store"});
  if (!response.ok) {
    const error = new Error("WORKSPACE_HTTP_" + response.status);
    error.status = response.status;
    // Error bodies may contain sensitive upstream diagnostics. Only consume the known code.
    const body = await response.json().catch(() => null);
    if (body?.detail?.code === "WORKSPACE_CASE_NOT_FOUND") error.code = body.detail.code;
    throw error;
  }
  return validateWorkspace(await response.json(), caseId);
}
export function workspaceError(error) {
  if ([401, 403].includes(error?.status)) return "Acceso denegado. Vuelve a iniciar sesión en OPS.";
  if (error?.code === "WORKSPACE_CASE_NOT_FOUND") return "Expediente no encontrado.";
  if (error?.status === 404) return "La ruta de detalle no está disponible. No se han recuperado datos alternativos.";
  if (error?.status === 422) return "Identificador de expediente no válido.";
  if (error?.status === 406) return "Contrato de detalle incompatible. No se han recuperado datos alternativos.";
  if (error?.status >= 500) return "No se ha podido leer el expediente. No se puede determinar su contenido.";
  return "Respuesta de detalle no disponible o inválida. No se muestran datos anteriores.";
}
