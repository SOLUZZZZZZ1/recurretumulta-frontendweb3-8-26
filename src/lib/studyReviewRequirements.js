// Match the server's required document categories before preparing a write.
// The server still verifies custody bytes, authorization, payment and revision.
export function studyReviewRequirements(documents, reviewed) {
  const kinds = new Set(reviewed.filter(r=>r.read_confirmed === true)
    .map(r=>documents.find(d=>d.id === r.document_id)?.kind).filter(Boolean));
  return [
    !kinds.has('original') && 'Documento original aportado',
    !kinds.has('authorization_signed') && 'Autorización firmada',
    !kinds.has('identity_front') && !kinds.has('identity_back') && 'Identidad: anverso o reverso',
  ].filter(Boolean);
}

const rejectionReasons = Object.freeze({
  STUDY_REQUIRED_DOCUMENTS_NOT_REVIEWED: 'Falta revisar el documento original, la autorización firmada o una cara de la identidad.',
  STUDY_PAYMENT_NOT_CONFIRMED: 'El servidor no confirma el pago del estudio inicial para este expediente.',
  STUDY_AUTHORIZATION_NOT_CONFIRMED: 'El servidor no confirma la autorización del expediente.',
  STUDY_REVISION_CONFLICT: 'Se ha guardado otra valoración desde que abriste esta edición.',
  STUDY_SOURCE_CHANGED: 'Un documento ha cambiado desde que lo revisaste; vuelve a abrirlo y revisarlo.',
  STUDY_OPERATION_CANCELLED: 'Este intento ya fue cancelado al consultar su resultado.',
  STUDY_OPERATION_MISMATCH: 'La referencia de esta operación no coincide con el contenido o su autor.',
});

export function studyWriteConflictMessage(code) {
  const reason = Object.hasOwn(rejectionReasons, code) ? rejectionReasons[code] : 'El servidor rechazó la escritura.';
  // Only allowlisted explanations: no response payload or arbitrary server text.
  return reason + ' Conservamos tu texto; pulsa «Consultar operación e historial» antes de preparar otro guardado.';
}
