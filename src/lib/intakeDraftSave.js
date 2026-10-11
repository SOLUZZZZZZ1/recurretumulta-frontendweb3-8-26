/** Saving intake data is not issuing or approving a representation document.
 * This coordinator has no authorization, payment, upload-to-portal or PDF hook.
 * References are kept in React state only; no PII is written to browser storage.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function intakeCreationIssue(data, hasAccess, requireSynthetic = false) {
  if (data?.ok !== true || data.status !== "authorization_pending" || data.authorized !== false
      || typeof data.test_mode !== "boolean" || data.signed_authority_verified === true) {
    return "El servidor no confirmó un alta pendiente de autorización. Conservamos la referencia para evitar duplicados; hay que comprobarla en OPS.";
  }
  if (hasAccess !== true || data.case_access_token_header !== "X-RTM-Case-Token") {
    return "El acceso seguro al expediente no quedó confirmado. Conservamos la referencia para evitar duplicados; hay que comprobarla en OPS.";
  }
  if (requireSynthetic === true && data.test_mode !== true) {
    return "El servidor no confirmó que el expediente sea sintético. No se ha solicitado ninguna autorización.";
  }
  return "";
}

export async function saveIntakeDraft({ draft, createDraft, persistDraft }) {
  let current = draft;
  if (!current) {
    current = await createDraft();
    if (!current || typeof current.caseId !== "string" || !UUID.test(current.caseId)) {
      throw new TypeError("No hay una referencia de expediente verificable. No se confirma el guardado.");
    }
    // Preserve a valid reference BEFORE reporting an incomplete response. A
    // retry must not create another case because access or a later step failed.
    persistDraft(current);
  }
  if (typeof current.caseId !== "string" || !UUID.test(current.caseId)) {
    throw new TypeError("Referencia de expediente no válida.");
  }
  if (current.blockedMessage) throw new Error(current.blockedMessage);
  return current;
}
