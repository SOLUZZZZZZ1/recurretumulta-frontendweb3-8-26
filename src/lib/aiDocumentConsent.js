export const DOCUMENT_ANALYSIS_PRIVACY_VERSION = "document-analysis-ai-v1";
export const VEHICLE_REMOVAL_AI_PRIVACY_VERSION = "vehicle-removal-ai-v1";

const ALLOWED_PRIVACY_VERSIONS = new Set([
  DOCUMENT_ANALYSIS_PRIVACY_VERSION,
  VEHICLE_REMOVAL_AI_PRIVACY_VERSION,
]);

export function appendAiDocumentConsent(
  formData,
  { consented, privacyVersion }
) {
  if (!(formData instanceof FormData)) {
    throw new TypeError("Se esperaba un formulario para documentar el consentimiento.");
  }

  if (consented !== true) {
    throw new Error("El procesamiento documental con IA requiere consentimiento explícito.");
  }

  if (!ALLOWED_PRIVACY_VERSIONS.has(privacyVersion)) {
    throw new Error("La versión de privacidad del procesamiento con IA no es válida.");
  }

  formData.set("ai_processing_consent", "true");
  formData.set("privacy_version", privacyVersion);
  return formData;
}
