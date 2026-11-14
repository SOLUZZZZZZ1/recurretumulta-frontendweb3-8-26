export function intakeContinuationPath(data, caseId) {
  const interested = data?.interested_data || {};
  const department = interested.department || data?.department;
  if (interested.source_module !== "rtm_web" || !["traffic", "debt", "administration", "claims"].includes(department)) return null;
  const type = interested.case_type || data?.case_type;
  const route = `/iniciar-expediente/${department}${type ? `/${encodeURIComponent(type)}` : ""}`;
  return `${route}?case=${encodeURIComponent(caseId)}`;
}

export function intakeDocumentsPath(data) {
  const interested = data?.interested_data || {};
  const department = interested.department || data?.department;
  const type = interested.case_type || data?.case_type;
  if (department === "traffic") return type === "vehicle_removal" ? "/eliminar-coche" : "/multas/documentos";
  return { debt: "/deudas/documentos", administration: "/administracion/documentos", claims: "/reclamaciones/documentos" }[department] || "/otros/documentos";
}
