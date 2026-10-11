import { PUBLIC_SERVICE_FAMILIES } from "../data/publicServices.js";

export const SAVED_CASE_DATA_VERSION = "rtm_ops_saved_case_data_v1";
const record = value => value !== null && typeof value === "object" && !Array.isArray(value);
const identityKeys = ["full_name", "dni_nie", "address"];
const addressKeys = ["street", "street_number", "floor", "door", "postal_code", "city", "province"];
const contactKeys = ["name", "email", "phone", "preferred_contact"];
const caseKeys = ["customer_comment", "public_service_family"];
const nullableTextFields = (value, keys) => record(value) && keys.every(key =>
  Object.hasOwn(value, key) && (value[key] === null || typeof value[key] === "string"));
const pick = (value, keys) => Object.fromEntries(keys.map(key => [key, value[key]]));

export function validateOpsWorkspace(workspace, caseId) {
  if (!caseId || !record(workspace) || !Object.hasOwn(workspace, "ok") || workspace.ok !== true
      || !Object.hasOwn(workspace, "case_id") || workspace.case_id !== caseId
      || !Object.hasOwn(workspace, "case") || !record(workspace.case)) {
    throw new Error("La respuesta no corresponde al expediente solicitado.");
  }
  return workspace;
}

// Validate only this projection: independent workspace readings can still succeed.
// Own keys are required by v1; null is valid, omission or a wrong type is not.
// Only authenticated server data: no browser/form fallback or inferred identity.
export function savedCaseData(workspace, caseId) {
  try { validateOpsWorkspace(workspace, caseId); } catch { return null; }
  const data = workspace.case;
  if (!Object.hasOwn(data, "saved_data_version") || data.saved_data_version !== SAVED_CASE_DATA_VERSION
      || !nullableTextFields(data, caseKeys)
      || !Object.hasOwn(data, "identity") || !nullableTextFields(data.identity, identityKeys)
      || !Object.hasOwn(data.identity, "address_parts") || !nullableTextFields(data.identity.address_parts, addressKeys)
      || !Object.hasOwn(data, "contact") || !nullableTextFields(data.contact, contactKeys)) return null;
  return {
    interested: {
      ...pick(data.identity, identityKeys),
      address_parts: pick(data.identity.address_parts, addressKeys),
    },
    contact: pick(data.contact, contactKeys),
    ...pick(data, caseKeys),
  };
}

export function savedPublicFamilyLabel(code) {
  if (code === null) return "No consta";
  if (code === "") return code;
  const family = PUBLIC_SERVICE_FAMILIES.find(item => item.id === code);
  if (!family) return `Área guardada no reconocida: ${code}`;
  return family.entryMode === "consultation" ? `${family.title} · consulta previa` : family.title;
}
