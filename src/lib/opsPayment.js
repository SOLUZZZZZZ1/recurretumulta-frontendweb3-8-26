const PAID_STATUSES = new Set([
  "paid",
  "succeeded",
  "complete",
  "completed",
]);

export function isPaidStatus(value) {
  return PAID_STATUSES.has(String(value || "").trim().toLowerCase());
}

export function derivePaymentDisplay(paymentRecord, workspaceCase = {}) {
  const hasPaymentRecord =
    paymentRecord !== null &&
    typeof paymentRecord === "object" &&
    !Array.isArray(paymentRecord);
  const hasWorkspaceStatus = Object.prototype.hasOwnProperty.call(
    workspaceCase || {},
    "payment_status"
  );
  const known = hasPaymentRecord || hasWorkspaceStatus;
  const status = hasPaymentRecord
    ? paymentRecord.payment_status
    : workspaceCase?.payment_status;
  const paid = known && isPaidStatus(status);

  return {
    known,
    paid,
    status,
    label: !known
      ? "Estado de pago no disponible"
      : paid
      ? "Pago confirmado"
      : "No consta pago",
    tone: !known ? "danger" : paid ? "success" : "warn",
  };
}
