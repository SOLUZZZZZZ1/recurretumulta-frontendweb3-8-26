// Real React/DOM in Edge, intercepted API only. No RTM server, SQL, custody or real login.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';

const [modulePath, evidence] = process.argv.slice(2);
if (!modulePath || !evidence) throw Error('Provide installed Playwright module and new evidence directory');
const { chromium } = await import(pathToFileURL(resolve(modulePath)).href);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const A = randomUUID(), B = randomUUID(), documentId = randomUUID();
const hash = 'a'.repeat(64), sha = text => createHash('sha256').update(text).digest('hex');
const exactText = 'BORRADOR C01 FICTICIO\nÁrbol y espacios finales.  \n\n';
const source = caseId => ({ ok: true, case_id: caseId, version: 'rtm_case_working_document_v1',
  status: 'working_draft', title: 'Prueba C01', document_kind: 'case_preparation', content: `FUENTE ${caseId}\n`,
  source_sha256: hash, used_document_ids: [documentId], synthetic_only: true,
  final_resource_generated: false, operator_export_allowed: false,
  sources: { case_id: caseId, data_status: 'complete', document_reading: 'not_performed',
    customer_comment: 'RELATO SINTÉTICO C01', public_service_family: 'seguros',
    documents: [{ id: documentId, kind: 'synthetic', mime: 'text/plain', size_bytes: 100, sha256: hash,
      reading_status: 'not_read', operator_export_allowed: false }],
    roles: { interested: { status: 'declared', value: { full_name: 'INTERESADA FICTICIA C01', dni_nie: null,
      address: null, address_parts: Object.fromEntries(['street', 'street_number', 'floor', 'door', 'postal_code', 'city', 'province'].map(k => [k, null])) } },
      contact: { status: 'declared', value: { name: 'CONTACTO DIFERENTE', email: 'c01@example.com', phone: null, preferred_contact: null } },
      ...Object.fromEntries(['driver', 'owner', 'representative'].map(k => [k, { status: 'not_available', value: null, reason: 'Lectura no disponible.' }])) } } });
const empty = id => ({ ok: true, case_id: id, version: 'rtm_working_document_versions_v2', can_save: true,
  synthetic_only: true, final_resource_generated: false, operator_export_allowed: false,
  latest_id: null, selected_id: null, selection_revision: null, history: [] });
const results = [], errors = [], requests = [];
let states, snapshots, postMode, readMode, historyMode, held, browser, context, page, scenario;
const server = await createServer({ root, configFile: false, plugins: [{ name: 'c01-isolated-component',
  configureServer(instance) {
    instance.middlewares.use('/__c01__', (_req, res) => {
      res.setHeader('Content-Type', 'text/html');
      res.end(`<!doctype html><meta charset="utf-8"><div id="root"></div><script>window.testCaseId=${JSON.stringify(A)}</script><script type="module" src="/scripts/fixtures/opsCaseDraftHarness.jsx"></script>`);
    });
  } }, react()], server: { host: '127.0.0.1', port: 0, hmr: false } });
const reply = (route, value, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(value) });
const postCount = () => requests.filter(r => r.scenario === scenario && r.method === 'POST').length;
const saveButton = () => page.locator('[data-draft-save]');
const editor = () => page.locator('[data-draft-editor]');
async function idle() {
  await page.waitForFunction(() => {
    const b = [...document.querySelectorAll('button')].find(b => b.textContent === 'Actualizar historial de borradores');
    return b && !b.disabled;
  });
}
async function phase(value) { await page.locator(`[data-draft-save-state="${value}"]`).waitFor(); await idle(); }
async function start(name) {
  await page?.close();
  scenario = name; states = new Map([A, B].map(id => [id, empty(id)])); snapshots = new Map();
  postMode = readMode = historyMode = null; held = null;
  page = await context.newPage(); page.on('pageerror', err => errors.push({ scenario, message: err.message }));
  await page.route('**/api/**', async route => {
    const request = route.request(), path = new URL(request.url()).pathname;
    const id = [A, B].find(id => path.includes(id));
    requests.push({ scenario, method: request.method(), path });
    assert.ok(id, 'Only synthetic mock cases are allowed');
    const state = states.get(id);
    if (request.method() === 'POST') {
      assert.ok(!path.endsWith('/selection'), 'No selection or export bypass during recovery');
      if ([401, 403, 409, 422].includes(postMode)) return reply(route, {}, postMode);
      let body, correction;
      if (path.endsWith('/correction')) {
        const raw = request.postDataBuffer().toString('utf8');
        body = JSON.parse(raw.match(/name="metadata"\r\n\r\n([^\r]+)/)[1]);
        const fileText = raw.slice(raw.indexOf('RTM-CASE: ')).split('\r\n--')[0];
        assert.ok(fileText.startsWith(`RTM-CASE: ${id}\nRTM-VERSION: ${body.based_on_id}\n\n`));
        body.content = fileText.split('\n').slice(3).join('\n');
        correction = { document_id: randomUUID(), filename: 'correction.txt', sha256: sha(fileText),
          size_bytes: Buffer.byteLength(fileText), mime: 'text/plain' };
      } else body = request.postDataJSON();
      assert.equal(body.expected_latest_id, state.latest_id);
      assert.equal(body.expected_selection_revision, state.selection_revision);
      if (postMode === 'network_without_write') return route.abort('failed');
      const entry = { format: state.version, id: randomUUID(), case_id: id, sequence: state.history.length + 1,
        previous_id: state.latest_id, previous_material_sha256: state.latest_id ? hash : null, based_on_id: body.based_on_id,
        status: 'working_draft', synthetic_only: true, final_resource_generated: false, operator_export_allowed: false,
        title: 'Borrador C01 ficticio', created_at: new Date().toISOString(), created_by: `operator:${randomUUID()}`,
        source_sha256: body.expected_source_sha256, snapshot_sha256: hash, content_sha256: sha(body.content),
        context_sha256: hash, provenance: correction ? 'external_correction' : 'operator_edit',
        ...(correction ? { correction } : {}), change_reason: body.change_reason, persisted: true,
        pdf: { document_id: randomUUID(), sha256: hash, size_bytes: 1000 } };
      snapshots.set(entry.id, { ...source(id), content: body.content, used_document_ids: body.used_document_ids });
      state.history.unshift(entry); state.latest_id = entry.id; state.selected_id = entry.id; state.selection_revision = randomUUID();
      const data = { ...state, saved_id: entry.id };
      if (postMode === 'hold') { held = { route, data }; return; }
      if (postMode === 'network') return route.abort('failed');
      if (postMode === 500) return reply(route, {}, 500);
      if (postMode === 'invalid') return reply(route, { ...data, saved_id: randomUUID() });
      if (postMode === 'empty') return reply(route, { ...empty(id), saved_id: null });
      return reply(route, data);
    }
    if (path.endsWith('/versions')) {
      if (historyMode === 500) return reply(route, {}, 500);
      return reply(route, state);
    }
    if (path.endsWith('/working-document')) return reply(route, source(id));
    const entry = state.history.find(e => e.id === path.split('/').at(-1));
    assert.ok(entry);
    const data = { ok: true, version: state.version, case_id: id, entry, snapshot: snapshots.get(entry.id),
      persisted: true, custody_verified: true, operator_export_allowed: false };
    if (readMode === 'hold') { held = { route, data }; return; }
    if (readMode === 'network') return route.abort('failed');
    if (typeof readMode === 'number') return reply(route, {}, readMode);
    if (readMode === 'invalid') return reply(route, { ...data, snapshot: { ...data.snapshot, content: 'CORRUPT MOCK' } });
    return reply(route, data);
  });
  await page.goto(origin + '/__c01__'); await editor().waitFor(); await idle();
}
async function send() {
  await editor().fill(exactText); await page.locator('[data-draft-reason]').fill('Regresión sintética C01');
  await page.locator('[data-draft-ack]').check(); await saveButton().click();
}
async function blocked() {
  assert.equal(await saveButton().isDisabled(), true);
  const count = postCount();
  // Native DOM clicks on the disabled button, including multiple attempts, cannot send a POST.
  await saveButton().evaluate(button => { button.click(); button.click(); });
  assert.equal(postCount(), count);
  assert.equal(await editor().inputValue(), exactText);
  assert.equal(await page.locator('fieldset input[type=checkbox]').isChecked(), true);
  assert.equal(await page.locator('[data-draft-reason]').inputValue(), 'Regresión sintética C01');
}
async function reconcile() { await page.locator('[data-draft-reconcile]').click(); }
async function recovered(id) {
  await phase('verified');
  assert.equal(await page.locator('[data-draft-view]').getAttribute('data-draft-view'), id);
  assert.equal(await page.locator('[data-draft-content]').textContent(), exactText);
  assert.equal(await editor().inputValue(), exactText);
  assert.ok((await page.locator('[data-draft-sources]').textContent()).includes(hash));
  assert.equal(await page.locator('[data-draft-ack]').isChecked(), false);
  if (scenario === 'confirmed POST then GET 500') await page.screenshot({ path: resolve(evidence, 'C01-recuperado-confirmacion-pendiente.png'), fullPage: true });
  await page.locator('[data-draft-reason]').fill('Otra edición debe confirmarse');
  assert.equal(await saveButton().isDisabled(), true);
  await page.locator('[data-draft-ack]').check(); assert.equal(await saveButton().isEnabled(), true);
  assert.equal(postCount(), 1);
}
let origin;
try {
  await server.listen(); origin = `http://127.0.0.1:${server.httpServer.address().port}`;
  browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', headless: true });
  context = await browser.newContext();
  await context.route('**/*', route => new URL(route.request().url()).origin === origin ? route.continue() : route.abort());

  for (const failure of [500, 'network', 'invalid']) {
    await start(`confirmed POST then GET ${failure}`); readMode = failure; await send(); await phase('confirmed');
    const id = states.get(A).latest_id;
    await blocked();
    assert.ok((await page.locator('[data-draft-save-state]').innerText()).includes(id));
    assert.equal(await page.getByRole('button', { name: 'Preparar otra edición desde los datos actuales', exact: true }).isDisabled(), true);
    assert.equal(await page.getByRole('button', { name: 'Editar desde versión 1', exact: true }).isDisabled(), true);
    // Ordinary history refresh must verify the known ID too, not merely clear a conflict flag.
    await page.getByRole('button', { name: 'Actualizar historial de borradores', exact: true }).click();
    await phase('confirmed'); await blocked();
    await page.screenshot({ path: resolve(evidence, `C01-bloqueado-${failure}.png`), fullPage: true });
    readMode = null; await reconcile(); await recovered(id);
    results.push({ scenario, passed: true, posts: postCount(), known_id: id, content_sha256: sha(exactText) });
  }

  for (const failure of ['network', 500, 'invalid', 'empty']) {
    await start(`unknown POST ${failure}, reconcile persisted version`); postMode = failure;
    await send(); await phase('unknown'); await blocked();
    assert.equal(requests.filter(r => r.scenario === scenario && /versions\/[^/]+$/.test(r.path) && r.method === 'GET').length, 0);
    historyMode = 500; await reconcile(); await phase('unknown'); await blocked();
    historyMode = null; postMode = null; await reconcile(); await recovered(states.get(A).latest_id);
    results.push({ scenario, passed: true, posts: postCount() });
  }

  await start('unknown POST with unchanged history stays unresolved'); postMode = 'network_without_write';
  await send(); await phase('unknown'); await reconcile(); await phase('unknown'); await blocked();
  assert.match(await page.getByRole('alert').innerText(), /no permite identificar/);
  assert.equal(postCount(), 1); assert.equal(states.get(A).history.length, 0);
  results.push({ scenario, passed: true, posts: postCount(), no_inference_of_absent_write: true });

  await start('known ID read with changed document references stays blocked'); readMode = 500;
  await send(); await phase('confirmed'); readMode = null;
  snapshots.get(states.get(A).latest_id).used_document_ids = [];
  await reconcile(); await phase('confirmed'); await blocked();
  results.push({ scenario, passed: true, posts: postCount() });

  await start('recovery verifies known ID even when head/selection advanced'); readMode = 500;
  await send(); await phase('confirmed'); const saved = states.get(A).latest_id, state = states.get(A);
  const concurrent = { ...state.history[0], id: randomUUID(), sequence: 2, previous_id: saved,
    previous_material_sha256: hash, based_on_id: saved, content_sha256: sha('OTRA EDICIÓN FICTICIA'), change_reason: 'Otra operación' };
  snapshots.set(concurrent.id, { ...source(A), content: 'OTRA EDICIÓN FICTICIA' });
  state.history.unshift(concurrent); state.latest_id = concurrent.id; state.selected_id = concurrent.id; state.selection_revision = randomUUID();
  readMode = null; await reconcile(); await recovered(saved);
  assert.ok((await page.locator('[data-draft-selected]').textContent()).includes(concurrent.id));
  await saveButton().click(); await phase('verified');
  assert.equal(postCount(), 2); assert.equal(state.history[0].previous_id, concurrent.id);
  assert.equal(state.history[0].based_on_id, saved);
  results.push({ scenario, passed: true, posts: postCount(), second_post_only_after_reconciliation_and_new_ack: true });

  for (const failure of ['read', 'post']) {
    await start(`external correction ${failure} failure retains file and verifies saved bytes`);
    await send(); await phase('verified'); const base = states.get(A).latest_id;
    const correctionText = 'CORRECCIÓN SINTÉTICA C01\nCon espacios.  \n';
    await page.locator('[data-draft-import] summary').click();
    await page.locator('[data-draft-file]').setInputFiles({ name: 'correction.txt', mimeType: 'text/plain',
      buffer: Buffer.from(`RTM-CASE: ${A}\nRTM-VERSION: ${base}\n\n${correctionText}`) });
    await page.locator('[data-draft-reason]').fill('Corrección C01 sintética'); await page.locator('[data-draft-ack]').check();
    if (failure === 'read') readMode = 500; else postMode = 'network';
    await page.locator('[data-draft-correction]').click(); await phase(failure === 'read' ? 'confirmed' : 'unknown');
    assert.equal(await page.locator('[data-draft-correction]').isDisabled(), true);
    assert.equal(await page.locator('[data-draft-file]').evaluate(input => input.files[0].name), 'correction.txt');
    assert.equal(await editor().inputValue(), exactText);
    const correctedId = states.get(A).latest_id; readMode = postMode = null; await reconcile(); await phase('verified');
    assert.equal(await page.locator('[data-draft-view]').getAttribute('data-draft-view'), correctedId);
    assert.equal(await page.locator('[data-draft-content]').textContent(), correctionText);
    assert.equal(await page.locator('[data-draft-ack]').isChecked(), false);
    assert.equal(await page.locator('[data-draft-file]').evaluate(input => input.files.length), 0);
    assert.equal(postCount(), 2); results.push({ scenario, passed: true, posts: postCount(), correction_sha256: states.get(A).history[0].correction.sha256 });
  }

  await start('POST 409 requires successful history refresh and fresh acknowledgement'); postMode = 409;
  await send(); await page.getByRole('alert').waitFor(); await idle(); await blocked();
  historyMode = 500; await page.getByRole('button', { name: 'Actualizar historial de borradores', exact: true }).click();
  await idle(); await blocked(); historyMode = null;
  await page.getByRole('button', { name: 'Actualizar historial de borradores', exact: true }).click(); await idle();
  assert.equal(await saveButton().isDisabled(), true);
  assert.equal(await page.locator('[data-draft-ack]').isChecked(), false);
  await page.locator('[data-draft-ack]').check(); assert.equal(await saveButton().isEnabled(), true);
  assert.equal(postCount(), 1); results.push({ scenario, passed: true, posts: postCount() });

  for (const status of [401, 403]) {
    await start(`GET ${status} after confirmed POST removes all case data`); readMode = status;
    await send(); await page.getByRole('alert').waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-draft-editor]'));
    assert.equal(await page.locator('[data-draft-save-state], [data-draft-version], [data-draft-view], [data-draft-file]').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Actualizar historial de borradores', exact: true }).isDisabled(), true);
    assert.ok(!(await page.locator('body').innerText()).includes(exactText.trim()));
    results.push({ scenario, passed: true, posts: postCount() });
  }

  for (const stage of ['post', 'read']) for (const change of ['case', 'session', 'logout']) {
    await start(`late ${stage} response after ${change}`);
    if (stage === 'post') postMode = 'hold'; else readMode = 'hold';
    await send();
    // Wait for the intercepted request to be held, not for an arbitrary delay.
    for (let i = 0; !held && i < 200; i++) await new Promise(resolve => setTimeout(resolve, 10));
    assert.ok(held); const oldResponse = held; postMode = readMode = null;
    if (change === 'case') {
      await page.evaluate(id => window.draftHarness.setCase(id), B);
      await page.waitForFunction(id => document.querySelector('[data-draft-editor]')?.value.includes(id), B);
    } else if (change === 'session') {
      // Empty mock storage for the new principal: an old response cannot populate the new context.
      states.set(A, empty(A));
      await page.evaluate(() => window.draftHarness.setSession('new-individual-session'));
      await page.waitForFunction(id => document.querySelector('[data-draft-editor]')?.value.includes(id), A);
    } else {
      await page.evaluate(() => window.draftHarness.setSession(null));
      await page.waitForFunction(() => !document.querySelector('#ops-case-working-document'));
    }
    await reply(oldResponse.route, oldResponse.data).catch(() => {});
    // Flush browser tasks/React work after the delivered (or aborted) old response.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('[data-draft-save-state], [data-draft-view]').count(), 0);
    assert.ok(!(await page.locator('body').innerText()).includes(exactText.trim()));
    assert.equal(postCount(), 1); results.push({ scenario, passed: true, posts: postCount() });
  }

  assert.deepEqual(errors, []);
  await writeFile(resolve(evidence, 'C01-browser-results.json'), JSON.stringify({ kind: 'real_React_DOM_Edge_mock_API',
    real_postgresql: false, real_authentication: false, real_custody: false, node: process.version,
    browser: browser.version(), results, requests, errors }, null, 2), { flag: 'wx' });
  console.log(JSON.stringify({ passed: results.length, kind: 'real_React_DOM_Edge_mock_API', errors }));
} finally {
  await browser?.close(); await server.close();
  await writeFile(resolve(evidence, 'C01-browser-closure.json'), JSON.stringify({ closed_at: new Date().toISOString(),
    test_server_listening: server.httpServer.listening, browser_connected: browser?.isConnected() ?? false,
    origin, process_id: process.pid }, null, 2), { flag: 'wx' });
}
