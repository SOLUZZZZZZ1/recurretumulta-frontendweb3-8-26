import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';
import { buildIntakeClientFields, intakeClientDataError, intakeInputAttributes, normalizeIntakeIdentifier } from '../src/lib/intakeClientData.js';
import { PUBLIC_SERVICE_FAMILIES } from '../src/data/publicServices.js';
import { intakeAuthorizationFlow } from '../src/lib/intakeAuthorizationFlow.js';

const form = Object.freeze({
  full_name: '  PERSONA FICTICIA PEÑA  ', dni_nie: ' RTM-TEST.001 ',
  email: 'ayudante@example.com', telefono: '+34 600 000 001',
  street: ' CALLE FICTICIA ', street_number: ' 01 ', floor: ' 2º ', door: ' 3ª ',
  postal_code: '00001', city: 'CIUDAD FICTICIA', province: 'PROVINCIA FICTICIA',
  preferred_contact: 'email', customer_comment: 'Caso sintético; no existe una persona real.',
});
const source = readFileSync(new URL('../src/pages/IniciarExpedienteRTM.jsx', import.meta.url), 'utf8');
const summarySource = readFileSync(new URL('../src/components/IntakeClientSummary.jsx', import.meta.url), 'utf8');
const ast = parse(source, { sourceType: 'module', plugins: ['jsx'] });
const nodes = [];
function walk(node) {
  if (!node || typeof node !== 'object') return;
  if (node.type) nodes.push(node);
  for (const [key, value] of Object.entries(node)) {
    if (key === 'loc') continue;
    if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') walk(value);
  }
}
walk(ast);

const expectedKeys = [
  'full_name', 'dni_nie', 'email', 'telefono', 'street', 'street_number',
  'floor', 'door', 'postal_code', 'city', 'province', 'preferred_contact', 'domicilio_notif',
].sort();

test('declared interested identity and a different contact remain separate', () => {
  const value = buildIntakeClientFields({ ...form, account_name: 'OTRA CUENTA',
    contact_name: 'AYUDANTE', driver_name: 'CONDUCTOR DISTINTO', representative_name: 'RTM' });
  assert.equal(value.full_name, 'PERSONA FICTICIA PEÑA');
  assert.equal(value.email, 'ayudante@example.com');
  assert.equal(value.dni_nie, 'RTMTEST001');
  assert.deepEqual(Object.keys(value).sort(), expectedKeys);
  assert.equal(intakeClientDataError(form), '');
});

test('address fields retain accents, number, floor, door and leading postal zeros', () => {
  const value = buildIntakeClientFields(form);
  assert.equal(value.street_number, '01');
  assert.equal(value.postal_code, '00001');
  assert.equal(value.domicilio_notif, 'CALLE FICTICIA, 01, Piso 2º, Puerta 3ª · 00001 CIUDAD FICTICIA (PROVINCIA FICTICIA)');
  assert.equal(form.full_name, '  PERSONA FICTICIA PEÑA  ');
  assert.equal(Object.isFrozen(value), true);
});

test('missing data stays missing; account, payer and representative cannot fill it', () => {
  const value = buildIntakeClientFields({ account_name: 'CUENTA', driver_name: 'CONDUCTOR',
    representative_name: 'RTM', address: 'DOMICILIO DE LA SOCIEDAD' });
  assert.equal(value.full_name, '');
  assert.equal(value.dni_nie, '');
  assert.equal(value.domicilio_notif, '');
  assert.notEqual(intakeClientDataError({}), '');
});

test('known identifier separators normalize without conflating letters or zeros', () => {
  assert.equal(normalizeIntakeIdentifier(' x-00.1234-a '), 'X001234A');
  assert.notEqual(normalizeIntakeIdentifier('O01234A'), normalizeIntakeIdentifier('001234A'));
  assert.equal(normalizeIntakeIdentifier('RTM?TEST001'), 'RTM?TEST001');
  for (const dni_nie of ['RTM?TEST001', 'RTM/TEST001', 'RTMÉ001', 'RTM\nTEST001', 'RTMß001']) {
    assert.notEqual(intakeClientDataError({ ...form, dni_nie }), '', dni_nie);
  }
});

test('overlong and multiline identity fields fail without truncating the submitted value', () => {
  const full_name = 'N'.repeat(161);
  assert.equal(buildIntakeClientFields({ ...form, full_name }).full_name, full_name);
  assert.match(intakeClientDataError({ ...form, full_name }), /160/);
  assert.notEqual(intakeClientDataError({ ...form, city: 'CIUDAD\nDISTINTA' }), '');
  assert.notEqual(intakeClientDataError({ ...form, postal_code: '0'.repeat(21) }), '');
});

test('required address, email and contact preference cannot silently become defaults', () => {
  for (const change of [{ street: '' }, { street_number: '' }, { postal_code: '' },
    { city: '' }, { province: '' }, { email: 'no-email' }, { telefono: '' }, { preferred_contact: 'fax' }]) {
    assert.notEqual(intakeClientDataError({ ...form, ...change }), '', JSON.stringify(change));
  }
  assert.equal(intakeClientDataError({ ...form, floor: '', door: '' }), '');
});

test('all eight existing intake families use the same exact client field payload', () => {
  const families = PUBLIC_SERVICE_FAMILIES.filter(family => family.intake);
  assert.equal(families.length, 8);
  for (const family of families) {
    const route = new URL(family.startPath, 'https://synthetic.invalid');
    assert.equal(route.searchParams.get('family'), family.id);
    assert.ok(route.pathname.startsWith('/iniciar-expediente/' + family.intake.department));
    const data = new FormData();
    const fields = buildIntakeClientFields({ ...form, family: family.id, case_type: family.intake.caseTypes[0] });
    Object.entries(fields).forEach(([key, value]) => data.append(key, value));
    assert.deepEqual(Object.fromEntries(data), fields);
    assert.deepEqual(Object.keys(Object.fromEntries(data)).sort(), expectedKeys);
    assert.equal(data.get('full_name'), 'PERSONA FICTICIA PEÑA');
    assert.equal(data.get('email'), 'ayudante@example.com');
  }
});

test('a visible family does not enable another service authorization or a housing case', () => {
  for (const family of PUBLIC_SERVICE_FAMILIES.filter(family => family.intake && family.id !== 'trafico')) {
    assert.equal(intakeAuthorizationFlow({ department: family.intake.department,
      caseType: family.intake.caseTypes[0], family: family.id, localProfile: false }), 'unavailable');
  }
  const housing = PUBLIC_SERVICE_FAMILIES.find(family => family.id === 'vivienda');
  assert.equal(housing.entryMode, 'consultation');
  assert.equal(housing.intake, undefined);
  assert.equal(housing.startPath, '/contacto?area=vivienda');
});

test('summary and existing multipart submission consume the same memoized fields', () => {
  const memo = nodes.find(node => node.type === 'VariableDeclarator' && node.id?.name === 'clientFields');
  assert.equal(memo.init.callee.name, 'useMemo');
  assert.equal(memo.init.arguments[0].body.callee.name, 'buildIntakeClientFields');
  assert.equal(memo.init.arguments[0].body.arguments[0].name, 'form');
  const summary = nodes.find(node => node.type === 'JSXOpeningElement' && node.name?.name === 'IntakeClientSummary');
  assert.equal(summary.attributes.find(attr => attr.name?.name === 'fields').value.expression.name, 'clientFields');
  const payload = nodes.find(node => node.type === 'ObjectExpression' &&
    node.properties.some(prop => prop.type === 'ObjectProperty' && prop.key?.name === 'public_service_family'));
  assert.ok(payload.properties.some(prop => prop.type === 'SpreadElement' && prop.argument.name === 'clientFields'));
  assert.ok(source.includes('intakeClientDataError(form)'));
  assert.ok(source.includes('authorizationFlow === "unavailable"'));
});

test('input limits and autocomplete distinguish interested person from contact', () => {
  assert.equal(intakeInputAttributes('Nombre y apellidos').name, 'full_name');
  assert.equal(intakeInputAttributes('Nombre y apellidos').maxLength, 160);
  assert.equal(intakeInputAttributes('Código postal').name, 'postal_code');
  assert.match(intakeInputAttributes('Nombre y apellidos').autoComplete, /section-rtm-interested/);
  assert.match(intakeInputAttributes('Email').autoComplete, /section-rtm-contact/);
  assert.equal(intakeInputAttributes('DNI / NIE / Pasaporte').autoComplete, 'off');
  assert.deepEqual(intakeInputAttributes('unknown'), {});
  assert.ok(source.includes('{...intakeInputAttributes(label)}'));
});

test('summary adds no approval, storage, network call or HTML injection', () => {
  parse(summarySource, { sourceType: 'module', plugins: ['jsx'] });
  assert.ok(summarySource.includes('todavía') || summarySource.includes('Todavía'));
  assert.ok(summarySource.includes('no una clasificación jurídica confirmada'));
  assert.ok(summarySource.includes('no es una nueva lectura del servidor'));
  for (const prohibited of ['localStorage', 'sessionStorage', 'dangerouslySetInnerHTML', '<input', 'fetch(']) {
    assert.equal(summarySource.includes(prohibited), false, prohibited);
  }
});
