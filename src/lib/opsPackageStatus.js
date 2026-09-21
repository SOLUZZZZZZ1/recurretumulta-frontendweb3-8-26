import { isLegalRepresentationVerified } from "./authorizationEvidence.js";

// Kinds emitted by Generate, the CORE gateway, and the protected OPS projection.
// A PDF extension alone does not identify a legal resource.
const RESOURCE_KINDS = new Set(["recurso_pdf", "rtm_generated_pdf", "final_resource_pdf"]);

export function buildPackageStatus(documents, caseRecord) {
  const docs = Array.isArray(documents) ? documents : [];
  const kind = doc => String(doc?.kind || "").trim().toLowerCase();
  const recursoDoc = docs.find(doc => RESOURCE_KINDS.has(kind(doc))
    && doc?.mime === "application/pdf") || null;
  const autorizacionDoc = docs.find(doc => kind(doc) === "authorization_signed_verified") || null;
  const originalDoc = docs.find(doc => kind(doc) === "original") || null;
  const hasAutorizacion = isLegalRepresentationVerified(caseRecord);
  return {
    recursoDoc, autorizacionDoc, originalDoc,
    hasRecurso: recursoDoc !== null, hasOriginal: originalDoc !== null, hasAutorizacion,
    documentsComplete: recursoDoc !== null && originalDoc !== null && hasAutorizacion,
  };
}
