export const EMPTY_AUTHORIZATION_FORM = Object.freeze({
  full_name: "",
  dni_nie: "",
  domicilio_notif: "",
  matricula: "",
  email: "",
  telefono: "",
});

function firstValue(...values) {
  for (const value of values) {
    if (value !== undefined && value !== null && String(value).trim()) {
      return String(value).trim();
    }
  }
  return "";
}

function unwrapExtracted(value) {
  if (!value) return {};
  return value?.extracted?.extracted || value?.extracted || value || {};
}

export function buildAuthorizationForm(status, localExtracted = {}) {
  const interested = status?.interested_data || {};
  const extracted = unwrapExtracted(status?.extracted || {});
  return {
    full_name: firstValue(
      interested.full_name,
      interested.contact_name,
      interested.name,
      extracted.full_name,
      extracted.nombre_completo,
      extracted.titular,
      extracted.nombre_multado,
      extracted.interesado,
      localExtracted.full_name,
      localExtracted.nombre_completo,
      localExtracted.titular,
      localExtracted.nombre_multado,
      localExtracted.interesado
    ),
    dni_nie: firstValue(
      interested.dni_nie,
      interested.dni,
      interested.nie,
      extracted.dni_nie,
      extracted.dni,
      extracted.nie,
      extracted.documento_identidad,
      localExtracted.dni_nie,
      localExtracted.dni,
      localExtracted.nie,
      localExtracted.documento_identidad
    ),
    domicilio_notif: firstValue(
      interested.domicilio_notif,
      interested.domicilio,
      interested.address,
      extracted.domicilio_notif,
      extracted.domicilio,
      extracted.direccion,
      extracted.domicilio_multado,
      localExtracted.domicilio_notif,
      localExtracted.domicilio,
      localExtracted.direccion,
      localExtracted.domicilio_multado
    ),
    matricula: firstValue(
      interested.matricula,
      interested.plate,
      interested.vehicle_plate,
      extracted.matricula,
      extracted.matrícula,
      extracted.plate,
      extracted.vehicle_plate,
      extracted.matricula_vehiculo,
      localExtracted.matricula,
      localExtracted.matrícula,
      localExtracted.plate,
      localExtracted.vehicle_plate,
      localExtracted.matricula_vehiculo
    ),
    email: firstValue(
      interested.email,
      status?.contact_email,
      localExtracted.email
    ),
    telefono: firstValue(
      interested.telefono,
      interested.phone,
      extracted.telefono,
      extracted.phone,
      localExtracted.telefono,
      localExtracted.phone
    ),
  };
}

/**
 * Coordinates a case-keyed request. Beginning B aborts A and makes every late
 * result from A observably stale before it can update B's view.
 */
export function createCaseRequestGuard() {
  let active = null;
  let generation = 0;

  return {
    begin(caseId) {
      active?.controller.abort();
      const request = {
        caseId,
        generation: ++generation,
        controller: new AbortController(),
        isCurrent() {
          return active === request && !request.controller.signal.aborted;
        },
      };
      active = request;
      return request;
    },
    cancel() {
      active?.controller.abort();
      active = null;
      generation += 1;
    },
  };
}
