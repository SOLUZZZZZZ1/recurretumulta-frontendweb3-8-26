/** Shared client fields for every existing RTM intake.
 * This is a projection of declared data, not documentary extraction or approval.
 * It deliberately ignores account, driver, representative and consent fields.
 * Nothing is cached in browser storage or placed in a URL.
 */
export const CLIENT_FIELD_LIMITS = Object.freeze({
  full_name: 160, dni_nie: 32, email: 254, telefono: 40,
  street: 200, street_number: 20, floor: 20, door: 20,
  postal_code: 20, city: 120, province: 120, preferred_contact: 20,
  domicilio_notif: 500,
});

const LABELS = Object.freeze({
  full_name: 'Nombre y apellidos del interesado', dni_nie: 'Documento del interesado',
  email: 'Email de contacto', telefono: 'Teléfono de contacto', street: 'Calle',
  street_number: 'Número', floor: 'Piso', door: 'Puerta', postal_code: 'Código postal',
  city: 'Población', province: 'Provincia', preferred_contact: 'Preferencia de contacto',
  domicilio_notif: 'Domicilio a efectos de notificaciones',
});
const clean = value => typeof value === 'string' ? value.trim() : '';
const controls = /[\u0000-\u001f\u007f]/;

// Only known display separators and ASCII letter case are normalized. Do not
// turn an unreadable character into another identifier by deleting it.
export function normalizeIntakeIdentifier(value = '') {
  return clean(value).replace(/[a-z]/g, letter => letter.toUpperCase()).replace(/[ .-]/g, '');
}

export function buildIntakeClientFields(form = {}) {
  const fields = {};
  for (const key of Object.keys(CLIENT_FIELD_LIMITS)) {
    if (key !== 'domicilio_notif') fields[key] = clean(form[key]);
  }
  fields.dni_nie = normalizeIntakeIdentifier(form.dni_nie);
  const first = [fields.street, fields.street_number,
    fields.floor ? `Piso ${fields.floor}` : '', fields.door ? `Puerta ${fields.door}` : '']
    .filter(Boolean).join(', ');
  const second = [fields.postal_code, fields.city,
    fields.province ? `(${fields.province})` : ''].filter(Boolean).join(' ');
  fields.domicilio_notif = [first, second].filter(Boolean).join(' · ');
  return Object.freeze(fields);
}

export function intakeClientDataError(form = {}) {
  const fields = buildIntakeClientFields(form);
  for (const [key, maximum] of Object.entries(CLIENT_FIELD_LIMITS)) {
    if (controls.test(fields[key])) return `${LABELS[key]}: no se admiten saltos de línea ni caracteres de control.`;
    if ([...fields[key]].length > maximum) return `${LABELS[key]}: máximo ${maximum} caracteres. No se ha recortado el dato.`;
  }
  if (fields.full_name.length < 3) return 'Indica el nombre y apellidos de la persona interesada, no los de quien paga o ayuda a completar el formulario.';
  if (!/^[A-Z0-9]{5,32}$/.test(fields.dni_nie)) return 'Revisa el DNI, NIE o pasaporte del interesado. No se eliminan letras desconocidas ni símbolos para inventar un identificador.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fields.email)) return 'Indica un email de contacto válido.';
  if (fields.telefono.length < 6) return 'Indica un teléfono de contacto.';
  for (const key of ['street', 'street_number', 'postal_code', 'city', 'province']) {
    if (!fields[key]) return `Completa ${LABELS[key].toLowerCase()} del domicilio de notificaciones del interesado.`;
  }
  if (!['email', 'phone', 'whatsapp'].includes(fields.preferred_contact)) return 'Selecciona la preferencia de contacto.';
  return '';
}

const INPUT_FIELDS = Object.freeze({
  'Nombre y apellidos': ['full_name', 'section-rtm-interested name'],
  'DNI / NIE / Pasaporte': ['dni_nie', 'off'],
  'Email': ['email', 'section-rtm-contact email'],
  'Teléfono': ['telefono', 'section-rtm-contact tel'],
  'Calle': ['street', 'section-rtm-interested address-line1'],
  'Número': ['street_number', 'off'],
  'Piso': ['floor', 'off'],
  'Puerta': ['door', 'off'],
  'Código postal': ['postal_code', 'section-rtm-interested postal-code'],
  'Población': ['city', 'section-rtm-interested address-level2'],
  'Provincia': ['province', 'section-rtm-interested address-level1'],
});

export function intakeInputAttributes(label) {
  const entry = INPUT_FIELDS[label];
  if (!entry) return {};
  const [name, autoComplete] = entry;
  return { name, autoComplete, maxLength: CLIENT_FIELD_LIMITS[name] };
}
