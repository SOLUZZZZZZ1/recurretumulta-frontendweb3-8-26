import React from "react";
import { Navigate } from "react-router-dom";

// Compatibilidad defensiva para cualquier import histórico. La ruta pública se
// retira en App.jsx y este componente jamás acepta credenciales manuales.
export default function PartnerUpload() {
  return <Navigate to="/gestorias" replace />;
}
