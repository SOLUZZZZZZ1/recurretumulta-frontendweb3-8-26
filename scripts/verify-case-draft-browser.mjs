// Browser component tests with an intercepted API. No real SQL, custody or authentication.
import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createHash, randomUUID } from 'node:crypto';
import { createServer } from 'vite';
import react from '@vitejs/plugin-react';
const [modulePath, evidence] = process.argv.slice(2);
if (!modulePath || !evidence) throw Error('Provide local Playwright module and new evidence directory');
const { chromium } = await import(pathToFileURL(resolve(modulePath)).href);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const A = '190009f6-8df6-4490-b017-d6c8e760a524', B = '7568fb6f-977c-4bf7-9406-27454534a39d';
const sha = value => createHash('sha256').update(value).digest('hex'), hash = 'a'.repeat(64);
const source = caseId => ({ ok: true, case_id: caseId, version: 'rtm_case_working_document_v1', status: 'working_draft',
  title: 'Borrador sintético', document_kind: 'case_preparation', content: 'BORRADOR SINTÉTICO '+caseId+'\n',
  source_sha256: hash, used_document_ids: [], synthetic_only: true, final_resource_generated: false, operator_export_allowed: false,
  sources: { case_id: caseId, data_status: 'complete', document_reading: 'not_performed', documents: [], customer_comment: null, public_service_family: 'seguros',
    roles: { interested: { status: 'declared', value: { full_name: 'INTERESADA FICTICIA', dni_nie: null, address: null,
      address_parts:Object.fromEntries(['street','street_number','floor','door','postal_code','city','province'].map(k=>[k,null])) } },
      contact: { status: 'declared', value: { name: 'CONTACTO DISTINTO', email: 'unit@example.com', phone: null, preferred_contact: null } },
      ...Object.fromEntries(['driver', 'owner', 'representative'].map(key => [key, { status: 'not_available', value: null, reason: 'Lectura no disponible.' }])) } } });
const states = new Map([A, B].map(id => [id, { ok:true, case_id:id, version:'rtm_working_document_versions_v2', can_save:true,
  synthetic_only:true, final_resource_generated:false, operator_export_allowed:false, latest_id:null, selected_id:null, selection_revision:null, history:[] }]));
const snapshots = new Map(), requests = [], results = [], errors = [];
let conflict = false, wrong = false, delayed = null, browser;
const server = await createServer({ root, configFile:false, plugins:[{
  name:'isolated-draft-component', configureServer(instance) {
    instance.middlewares.use('/__draft_unit__', (_req,res) => { res.setHeader('Content-Type','text/html');
      res.end(`<!doctype html><meta charset="utf-8"><div id="root"></div><script>window.testCaseId=${JSON.stringify(A)}</script><script type="module" src="/scripts/fixtures/opsCaseDraftHarness.jsx"></script>`); });
  } }, react()], server:{host:'127.0.0.1',port:0,hmr:false} });
try {
  await server.listen(); const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true});
  const context=await browser.newContext({viewport:{width:1280,height:1000}});
  await context.route('**/*', route => new URL(route.request().url()).origin===origin ? route.continue() : route.abort());
  const page=await context.newPage(); page.on('pageerror', error => errors.push(error.message));
  const reply=(route,data,status=200)=>route.fulfill({status,contentType:'application/json',body:JSON.stringify(data)});
  await page.route('**/api/**', async route => {
    const req=route.request(), path=new URL(req.url()).pathname, id=[A,B].find(id=>path.includes(id));
    requests.push({path,method:req.method()});
    if(!id)return reply(route,{},404);
    const state=states.get(id);
    if(req.method()==='POST') {
      if(conflict)return reply(route,{detail:'Synthetic stale writer'},409);
      if(path.endsWith('/selection')) {state.selected_id=req.postDataJSON().version_id;state.selection_revision=randomUUID();return reply(route,state);}
      if(path.endsWith('/correction')) {
        const raw=req.postDataBuffer().toString('utf8');
        assert.ok(raw.includes('RTM-CASE: '+id));
        const metadata=JSON.parse(raw.match(/name="metadata"\r\n\r\n([^\r]+)/)[1]);
        const fileText=raw.slice(raw.indexOf('RTM-CASE: ')).split('\r\n--')[0];
        const entry={...state.history[0],id:randomUUID(),sequence:2,previous_id:state.latest_id,previous_material_sha256:hash,based_on_id:state.latest_id,
          change_reason:metadata.change_reason,content_sha256:sha('CORRECCIÓN FICTICIA\n'),provenance:'external_correction',
          correction:{document_id:randomUUID(),filename:'revision.txt',sha256:sha(fileText),size_bytes:Buffer.byteLength(fileText),mime:'text/plain'}};
        snapshots.set(entry.id,{...source(id),content:'CORRECCIÓN FICTICIA\n'});
        state.history.unshift(entry);state.latest_id=entry.id;state.selected_id=entry.id;state.selection_revision=randomUUID();
        return reply(route,{...state,saved_id:entry.id});
      }
      const body=req.postDataJSON(), version=randomUUID();
      assert.equal(body.expected_latest_id,state.latest_id); assert.equal(body.expected_selection_revision,state.selection_revision);
      const entry={format:state.version,id:version,case_id:id,sequence:state.history.length+1,previous_id:state.latest_id,previous_material_sha256:state.latest_id?hash:null,
        based_on_id:body.based_on_id,status:'working_draft',synthetic_only:true,final_resource_generated:false,operator_export_allowed:false,
        title:'Borrador sintético',created_at:new Date().toISOString(),created_by:`operator:${randomUUID()}`,source_sha256:hash,snapshot_sha256:hash,
        content_sha256:sha(body.content),context_sha256:hash,provenance:'operator_edit',change_reason:body.change_reason,persisted:true,
        pdf:{document_id:randomUUID(),sha256:hash,size_bytes:1000}};
      snapshots.set(version,{...source(id),content:body.content});state.history.unshift(entry);state.latest_id=version;state.selected_id=version;state.selection_revision=randomUUID();
      return reply(route,{...state,saved_id:version});
    }
    if(path.endsWith('/versions'))return reply(route,wrong?{...state,case_id:randomUUID()}:state);
    if(path.endsWith('/working-document'))return reply(route,source(id));
    const version=path.split('/').at(-1), entry=state.history.find(x=>x.id===version);
    const data={ok:true,version:state.version,case_id:id,entry,snapshot:snapshots.get(version),persisted:true,operator_export_allowed:false,custody_verified:true};
    if(delayed==='hold'){delayed={route,data};return;}
    return reply(route,data);
  });
  await page.goto(origin+'/__draft_unit__');
  const editor=page.locator('[data-draft-editor]');await editor.waitFor();
  await editor.fill('VERSIÓN UNO FICTICIA\n');await page.locator('[data-draft-reason]').fill('Prueba de guardado explícito');await page.locator('[data-draft-ack]').check();
  await page.locator('[data-draft-save]').click();await page.locator('[data-draft-content]').waitFor();
  assert.equal(await page.locator('[data-draft-content]').textContent(),'VERSIÓN UNO FICTICIA\n');
  results.push('Component saves and displays version one through its normal controls (mock API)');
  const first=states.get(A).latest_id;
  await page.locator('[data-draft-import] summary').click();
  await page.locator('[data-draft-reason]').fill('Corrección externa sintética');await page.locator('[data-draft-ack]').check();
  await page.locator('[data-draft-file]').setInputFiles({name:'revision.txt',mimeType:'text/plain',buffer:Buffer.from(`RTM-CASE: ${A}\nRTM-VERSION: ${first}\n\nCORRECCIÓN FICTICIA\n`)});
  await page.locator('[data-draft-correction]').click();await page.getByRole('heading',{name:'En consulta: versión 2',exact:true}).waitFor();
  const second=states.get(A).latest_id;
  await page.getByRole('button',{name:'Consultar versión 1',exact:true}).click();await page.getByRole('heading',{name:'En consulta: versión 1',exact:true}).waitFor();
  assert.equal(states.get(A).selected_id,second);assert.equal(await page.locator('[data-draft-content]').textContent(),'VERSIÓN UNO FICTICIA\n');
  results.push('Correction is separate; historical view leaves selected version unchanged');
  await page.getByRole('button',{name:'Seleccionar versión 1',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[data-draft-selected]').textContent.includes('seleccionada: 1'));
  assert.equal(states.get(A).latest_id,second);
  results.push('Explicit selection changes only selected version, not history head');
  conflict=true;await editor.fill('EDICIÓN DESACTUALIZADA FICTICIA');await page.locator('[data-draft-reason]').fill('Prueba de concurrencia');await page.locator('[data-draft-ack]').check();
  const before=requests.filter(x=>x.method==='POST').length;await page.locator('[data-draft-save]').click();await page.getByRole('alert').waitFor();
  assert.equal(await editor.inputValue(),'EDICIÓN DESACTUALIZADA FICTICIA');assert.equal(requests.filter(x=>x.method==='POST').length,before+1);
  assert.equal(states.get(A).history.length,2);assert.equal(await page.locator('[data-draft-save]').isDisabled(),true);
  results.push('Conflict retains editable text, blocks blind resave and makes no automatic retry');
  conflict=false;await page.getByRole('button',{name:'Actualizar historial de borradores',exact:true}).click();
  await page.waitForFunction(()=>!document.querySelector('[data-draft-ack]').disabled);
  assert.equal(await page.locator('[data-draft-ack]').isChecked(),false);
  await page.locator('[data-draft-ack]').check();
  await page.waitForFunction(()=>!document.querySelector('[data-draft-save]').disabled);
  delayed='hold';await page.getByRole('button',{name:'Consultar versión 2',exact:true}).click();
  await page.waitForTimeout(100);await page.evaluate(id=>window.draftHarness.setCase(id),B);await editor.waitFor();
  await page.waitForFunction(id=>document.querySelector('[data-draft-editor]')?.value.includes(id),B);
  if(delayed?.route)await reply(delayed.route,delayed.data).catch(()=>{});
  assert.ok(!(await page.locator('body').innerText()).includes('VERSIÓN UNO FICTICIA'));
  results.push('Switching case discards text/history and ignores a late response from the previous case');
  await page.evaluate(()=>window.draftHarness.setSession(null));await page.waitForFunction(()=>!document.querySelector('#ops-case-working-document'));
  await page.evaluate(()=>window.draftHarness.setSession('unit-session-two'));await editor.waitFor();
  delayed=null;await page.evaluate(id=>window.draftHarness.setCase(id),A);await page.getByRole('heading',{name:'En consulta: versión 1',exact:true}).waitFor();
  results.push('A new simulated session reloads selected version and complete history');
  await page.screenshot({path:resolve(evidence,'browser-simulated.png'),fullPage:true});
  wrong=true;await page.getByRole('button',{name:'Actualizar historial de borradores',exact:true}).click();await page.getByRole('alert').waitFor();
  assert.equal(states.get(A).history.length,2);
  results.push('Mismatched case responses fail validation; no binary export controls exist');
  assert.deepEqual(errors,[]);
  await writeFile(resolve(evidence,'browser-simulated.json'),JSON.stringify({kind:'isolated_component_mock_API',real_authentication:false,real_postgresql:false,real_custody:false,results,requests,errors},null,2),{flag:'wx'});
  console.log(JSON.stringify({passed:results.length,kind:'simulated_API',errors}));
} finally {await browser?.close();await server.close();}
