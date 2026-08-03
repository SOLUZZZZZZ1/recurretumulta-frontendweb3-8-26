export async function crearCheckout({ caseId, product, email }) {
  const res = await fetch(`${import.meta.env.VITE_API_URL}/billing/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      case_id: caseId,
      product: product, // "DGT_PRESENTACION"
      email: email,
      locale: "es",
    }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || "Error creando el pago");
  }

  return res.json(); // { url, session_id }
}
