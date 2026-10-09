// Structural integration checks. These do not replace an authenticated OPS/browser acceptance test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parse } from '@babel/parser';

const source = readFileSync(new URL('../src/components/OpsWorkingDocument.jsx', import.meta.url), 'utf8');
const program = parse(source, { sourceType: 'module', plugins: ['jsx'] }).program;
const panel = program.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'DocumentPanel');
const root = panel.body.body.find(node => node.type === 'ReturnStatement').argument;
const mounted = root.children.filter(node => node.type === 'JSXElement'
  && node.openingElement.name.name === 'OpsWorkingDocumentVersions');
const expression = name => mounted[0].openingElement.attributes.find(attr => attr.name?.name === name)?.value?.expression;

test('the existing document screen imports and mounts saved versions exactly once', () => {
  const imported = program.body.find(node => node.type === 'ImportDeclaration'
    && node.source.value === './OpsWorkingDocumentVersions.jsx');
  assert.equal(imported?.specifiers[0]?.local.name, 'OpsWorkingDocumentVersions');
  assert.equal(mounted.length, 1);
});

test('saved history remains mounted when the current proposal is absent or fails to load', () => {
  // A direct section child is not nested in the conditional that needs a live proposal.
  assert.equal(root.type, 'JSXElement');
  assert.equal(root.openingElement.name.name, 'section');
  assert.equal(mounted.length, 1);
  assert.equal(expression('document')?.type, 'Identifier');
  assert.equal(expression('document')?.name, 'document');
});

test('versions use the existing authenticated fetch, case identity and authorization gate', () => {
  for (const name of ['authFetch', 'caseId', 'enabled']) {
    assert.equal(expression(name)?.type, 'Identifier');
    assert.equal(expression(name)?.name, name);
  }
  const enabled = panel.body.body.flatMap(node => node.type === 'VariableDeclaration' ? node.declarations : [])
    .find(node => node.id.name === 'enabled');
  assert.equal(source.slice(enabled.init.start, enabled.init.end),
    '!!sessionId && canSupervise && authorizationVerified === true');
});

test('version actions respect ongoing proposal loading, PDF viewing and external work', () => {
  const busy = expression('externalBusy');
  assert.equal(source.slice(busy.start, busy.end), 'externalBusy || loading || viewing');
});

test('changing case, session or authority remounts the entire document panel', () => {
  const wrapper = program.body.find(node => node.type === 'ExportDefaultDeclaration').declaration;
  const result = wrapper.body.body.find(node => node.type === 'ReturnStatement').argument;
  const key = result.openingElement.attributes.find(attr => attr.name?.name === 'key').value.expression;
  assert.equal(key.type, 'TemplateLiteral');
  assert.deepEqual(key.expressions.map(node => `${node.object.name}.${node.property.name}`),
    ['props.caseId', 'props.sessionId', 'props.canSupervise', 'props.revision', 'props.authorizationVerified']);
});

test('the live proposal does not falsely deny an existing saved version or claim approval', () => {
  assert.ok(!source.includes('No se ha guardado una versión del recurso'));
  assert.ok(source.includes('Guardar no aprueba el escrito ni su presentación.'));
});
