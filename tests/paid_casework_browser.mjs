// Compiled real application / real React DOM; intercepted synthetic API only.
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';
import assert from 'node:assert/strict';import {createHash,randomUUID} from 'node:crypto';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {build} from 'vite';import react from '@vitejs/plugin-react';
import {blankStudy} from '../src/lib/paidCasework.js';
import {studyRequestDigest,journalKey} from '../src/lib/studyOperationJournal.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const output=path.resolve(process.argv[2]);const {chromium}=await import(pathToFileURL(process.argv[3]).href);
fs.mkdirSync(output,{recursive:true});
const results=[],errors=[],fixture=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/workspace_read.json')));
const A=fixture.a.case_id,B=fixture.b.case_id;
const hash=s=>createHash('sha256').update(s).digest('hex');
const workspace=structuredClone(fixture.a);
workspace.case.fields.payment_status={status:'available',value:'paid'};
workspace.case.fields.product_code={status:'available',value:'REVIEW_BASIC'};
workspace.case.fields.authorized={status:'available',value:true};
workspace.sections.documents.items=['original','authorization_signed','identity_front'].map((kind,i)=>({id:`33333333-3333-4333-8333-33333333333${i}`,case_id:A,kind,mime:'application/pdf',size_bytes:100,created_at:'2026-10-25T08:00:00Z',sha256:null}));
const docs=workspace.sections.documents.items;
let browser,server,phase='build';
try {
 await build({root,configFile:false,envDir:false,plugins:[react()],logLevel:'warn',build:{outDir:path.join(output,'build'),emptyOutDir:false}});
 phase='static-server';
 server=http.createServer((req,res)=>{
   const pathname=decodeURIComponent(new URL(req.url,'http://local').pathname);
   const file=path.resolve(output,'build','.'+pathname);
   if(file!==path.resolve(output,'build')&&!file.startsWith(path.resolve(output,'build')+path.sep)){res.writeHead(403);res.end();return;}
   const target=fs.existsSync(file)&&fs.statSync(file).isFile()?file:path.join(output,'build/index.html');
   const mime={'.js':'application/javascript','.css':'text/css','.html':'text/html','.ttf':'font/ttf','.svg':'image/svg+xml','.png':'image/png'}[path.extname(target)]||'application/octet-stream';
   res.writeHead(200,{'Content-Type':mime});fs.createReadStream(target).pipe(res);
 });
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));const origin=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-background-networking','--disable-component-update','--disable-sync']});
 async function scenario(name,mode,check,width=1200){
   if(process.argv[4]&&!name.includes(process.argv[4]))return;
   phase=name;const context=await browser.newContext({viewport:{width,height:900}});const page=await context.newPage();page.setDefaultTimeout(7000);
   const state={post:[],records:[],getFailure:mode,postFailure:mode,errors:[],api:[],history:[],resource:null,cancelled:new Set()};
   const study=()=>({status:state.records.length?'available':'not_started',revision:state.records.length,latest:state.records.at(-1)||null,
     history:state.records.map(r=>({operation_id:r.snapshot.operation_id,revision:r.snapshot.revision,author:r.snapshot.author,state:r.snapshot.study.state,created_at:r.snapshot.created_at,sha256:r.sha256})).reverse(),truncated:false});
   const work=()=>({ok:true,contract:'rtm_paid_casework_v1',case_id:A,workspace,study:study(),extractions:[],
     resources:state.resource?{status:'available',items:[{id:state.resource.id,version:1,is_final:false}]}:{status:'not_recorded',items:[]},capabilities:{study_write:true}});
   page.on('pageerror',e=>state.errors.push({message:e.message,stack:e.stack}));
   await context.route('**/*',async route=>{
     const req=route.request(),u=new URL(req.url());if(u.origin!==origin){await route.abort();return;}
     if(!u.pathname.startsWith('/api/')){await route.continue();return;}
     state.api.push({path:u.pathname,method:req.method()});
     const respond=(json,status=200)=>route.fulfill({status,json});
     if(u.pathname==='/api/ops/auth/status')return respond({ok:true,individual_login_enabled:true,configuration_valid:true,shared_ops_login_accepted:false,auth_environment:'production',auth_profile:'production_casework',casework_only:true,local_only:false,staging_only:false,device_logout_contract:'rtm_device_logout_v1'});
     if(u.pathname==='/api/ops/auth/login')return respond({ok:true,token_type:'bearer',token:'SYNTHETIC_TOKEN_ONLY_'+'a'.repeat(40),shared_ops_login_accepted:false,session_id:'44444444-4444-4444-8444-444444444444',device_id:'55555555-5555-4555-8555-555555555555',expires_at:new Date(Date.now()+3600000).toISOString(),absolute_expires_at:new Date(Date.now()+7200000).toISOString(),operator:{id:'66666666-6666-4666-8666-666666666666',email:'operator@example.com',display_name:'OPERADOR SINTETICO',role_code:'rtm.supervisor',permissions:['ops.view','ops.supervise'],must_change_password:false,mfa_required:false}});
     if(u.pathname==='/api/ops/auth/logout')return respond({ok:true,status:'closed'});
     if(u.pathname==='/api/ops/auth/device-logout')return respond({ok:true,status:'closed',contract:'rtm_device_logout_v1',operation_id:req.postDataJSON().operation_id});
     if(!req.headers().authorization?.startsWith('Bearer SYNTHETIC_TOKEN_ONLY_'))return respond({detail:'unauthenticated'},401);
     if(u.pathname.includes(B))return respond({detail:{code:'CASEWORK_SCOPE_DENIED'}},403);
     if(u.pathname.endsWith('/work')){
       if(mode==='work500')return respond({detail:{code:'CASEWORK_STORAGE_UNAVAILABLE'}},503);
       if(mode==='concurrent'&&state.records.length===1&&!state.injectedB){
         state.injectedB=true;const snapshot=structuredClone(state.records[0].snapshot);
         snapshot.operation_id=randomUUID();snapshot.revision=2;snapshot.study.assessment='CORRECCION SINTETICA DEL OPERADOR B';
         snapshot.author={id:'77777777-7777-4777-8777-777777777777',name:'OPERADOR B'};
         const canonical_snapshot=JSON.stringify(snapshot);state.records.push({snapshot,canonical_snapshot,sha256:hash(canonical_snapshot)});
       }
       return respond(work());
     }
     if(u.pathname.endsWith('/view')){
       if(state.deny)return respond({detail:{code:'SESSION_DENIED'}},state.deny);
       const id=u.pathname.split('/').at(-2);
       return respond({ok:true,contract:'rtm_ops_document_view_v1',case_id:A,document_id:id,title:'DOCUMENTO SINTETICO',view_only:true,operator_export_allowed:false,pages:2,width:600,height:800,mime:'application/pdf',observed_sha256:'a'.repeat(64),recorded_hash_state:'not_recorded'});
     }
     if(u.pathname.includes('/pages/')){
       assert.equal(req.headers()['if-match'],'"'+'a'.repeat(64)+'"');
       return route.fulfill({contentType:'image/png',body:Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jv1kAAAAASUVORK5CYII=','base64')});
     }
     if(u.pathname.endsWith('/study')&&req.method()==='POST'){
       const body=req.postDataJSON();state.post.push(body);
       if(state.cancelled.has(body.operation_id))return respond({detail:{code:'STUDY_OPERATION_CANCELLED'}},409);
       if(mode==='conflict')return respond({detail:{code:'STUDY_REVISION_CONFLICT'}},409);
       if(state.postFailure==='post-not-stored'){state.postFailure='';return route.abort();}
       let record=state.records.find(r=>r.snapshot.operation_id===body.operation_id);
       if(!record){const fields={...body};delete fields.operation_id;delete fields.expected_revision;delete fields.documents;
         const snapshot={contract:'rtm_paid_initial_study_v1',case_id:A,operation_id:body.operation_id,revision:state.records.length+1,created_at:new Date().toISOString(),author:{id:'66666666-6666-4666-8666-666666666666',name:'OPERADOR SINTETICO'},study:fields,sources:body.documents.map(d=>({...d,kind:docs.find(x=>x.id===d.document_id).kind}))};
         const canonical_snapshot=JSON.stringify(snapshot);record={snapshot,canonical_snapshot,sha256:hash(canonical_snapshot)};state.records.push(record);
       }
       if(state.postFailure==='post-unknown'){state.postFailure='';return route.abort();}
       return respond({ok:true,...record});
     }
     if(u.pathname.includes('/study/operations/')&&u.pathname.endsWith('/reconcile')){
       const id=u.pathname.split('/').at(-2),record=state.records.find(r=>r.snapshot.operation_id===id);
       if(record)return respond({ok:true,status:'committed',...record});
       state.cancelled.add(id);return respond({ok:true,status:'cancelled',contract:'rtm_study_reconciliation_v1',case_id:A,operation_id:id});
     }
     if(u.pathname.includes('/study/operations/')){
       if(['get500','get-network','get-invalid'].includes(state.getFailure)){
         const failure=state.getFailure;state.getFailure='';
         if(failure==='get-network')return route.abort();
         return respond(failure==='get-invalid'?{ok:true,wrong:true}:{detail:'read unavailable'},failure==='get500'?500:200);
       }
       const record=state.records.find(r=>r.snapshot.operation_id===u.pathname.split('/').at(-1));
       return respond(record?{ok:true,...record}:{detail:{code:'STUDY_OPERATION_NOT_FOUND'}},record?200:404);
     }
     if(u.pathname.includes('/resources/')&&state.resource)return respond({ok:true,case_id:A,...state.resource,operator_export_allowed:false});
     if(u.pathname==='/api/ops/core/cases')return respond({ok:true,cases:[{id:A,case:workspace.case}]});
     state.errors.push({unexpected:u.pathname});return respond({detail:'unexpected'},503);
   });
   async function login(){await page.getByLabel('Email de operador').fill('operator@example.com');await page.getByLabel('Contraseña',{exact:true}).fill('SYNTHETIC_PASSWORD_NOT_REAL');await page.getByRole('button',{name:'Entrar en OPS',exact:true}).click();}
   async function reviewDocuments(){await page.getByRole('button',{name:'Documentos',exact:true}).click();
     for(let i=0;i<3;i++){
       await page.getByRole('button',{name:'Abrir y leer',exact:true}).nth(i).click();
       await page.getByText('1 de 2 páginas mostradas.',{exact:false}).waitFor();
       assert.equal(await page.getByLabel('He leído y revisado este documento completo.').isDisabled(),true);
       await page.getByLabel('Ampliación').selectOption('150');await page.getByRole('button',{name:'Página siguiente',exact:true}).click();
       await page.getByText('2 de 2 páginas mostradas.',{exact:false}).waitFor();
       await page.getByLabel('He leído y revisado este documento completo.').check();
       await page.getByRole('button',{name:'Incorporar a los documentos revisados del estudio'}).click();
     }
   }
   async function fillStudy(){await reviewDocuments();await page.getByRole('button',{name:'Estudio',exact:true}).click();
     await page.getByLabel('Valoración del asunto',{exact:true}).fill('VALORACION SINTETICA EXACTA\nSegunda línea, áéí.');
     await page.getByLabel('Siguiente acción concreta',{exact:true}).fill('Revisar fecha documental; no generar recurso.');
     await page.getByLabel('Confirmo guardar una nueva valoración interna',{exact:false}).check();
     await page.getByRole('button',{name:'Guardar valoración',exact:true}).click();
   }
   try{
     await page.goto(origin+'/#/ops/case/'+A);await login();
     if(mode==='work500')await page.getByRole('heading',{name:'Consulta no completada'}).waitFor();
     else await page.getByTestId('paid-case-workspace').waitFor();
     await check({page,state,fillStudy,reviewDocuments,login,work,context,origin});
     assert.deepEqual(state.errors,[]);results.push({name,passed:true,api:state.api,posts:state.post.length,scope:'compiled React DOM / synthetic API and identity'});
   }catch(e){await page.screenshot({path:path.join(output,`failure_${results.length}.png`),fullPage:true});throw e;}
   finally{await context.close();}
 }
 for(const mode of ['get500','get-network','get-invalid'])await scenario(mode,mode,async({page,state,fillStudy})=>{
   await fillStudy();await page.locator('[data-phase="known"]').waitFor();assert.equal(state.post.length,1);
   assert.equal(await page.getByRole('button',{name:'Guardar valoración',exact:true}).isDisabled(),true);
   await page.getByRole('button',{name:'Consultar operación e historial'}).click();await page.locator('[data-phase="verified"]').waitFor();
   assert.equal(state.post.length,1);assert.equal(await page.getByRole('button',{name:'Guardar valoración',exact:true}).isDisabled(),true);
   assert.equal(await page.getByLabel('Valoración del asunto',{exact:true}).inputValue(),'VALORACION SINTETICA EXACTA\nSegunda línea, áéí.');
 });
 await scenario('unknown POST reconciled without resending','post-unknown',async({page,state,fillStudy})=>{
   await fillStudy();await page.locator('[data-phase="unknown"]').waitFor();await page.getByRole('button',{name:'Consultar operación e historial'}).click();
   await page.locator('[data-phase="verified"]').waitFor();assert.equal(state.post.length,1);
 });
 await scenario('unknown absent operation fenced before new editing','post-not-stored',async({page,state,fillStudy})=>{
   await fillStudy();await page.locator('[data-phase="unknown"]').waitFor();await page.getByRole('button',{name:'Consultar operación e historial'}).click();
   await page.locator('[data-phase="cancelled_review"]').waitFor();assert.equal(state.post.length,1);assert.equal(state.records.length,0);
   assert.equal(state.cancelled.has(state.post[0].operation_id),true);
   await page.getByLabel('He comparado mi texto con la valoración más reciente.').check();
   await page.getByRole('button',{name:'Conservar mi texto sobre la base revisada',exact:true}).click();
   assert.equal(await page.getByRole('button',{name:'Guardar valoración',exact:true}).isDisabled(),true);
 });
 await scenario('concurrent reconciliation keeps editor base separate','concurrent',async({page,state,fillStudy})=>{
   await fillStudy();await page.locator('[data-phase="conflict_review"]').waitFor();
   assert.equal(state.post.length,1);assert.equal(state.records.length,2);
   assert.equal(await page.getByRole('button',{name:'Guardar valoración',exact:true}).isDisabled(),true);
   assert.equal(await page.getByLabel('Valoración del asunto',{exact:true}).inputValue(),'VALORACION SINTETICA EXACTA\nSegunda línea, áéí.');
   await page.getByText('CORRECCION SINTETICA DEL OPERADOR B',{exact:true}).first().waitFor();
   await page.getByLabel('He comparado mi texto con la valoración más reciente.').check();
   await page.getByRole('button',{name:'Conservar mi texto sobre la base revisada',exact:true}).click();
   assert.equal(await page.getByRole('button',{name:'Guardar valoración',exact:true}).isDisabled(),true);
   await page.getByLabel('Confirmo guardar una nueva valoración interna',{exact:false}).check();
   await page.getByRole('button',{name:'Guardar valoración',exact:true}).click();await page.locator('[data-phase="verified"]').waitFor();
   assert.equal(state.post[1].expected_revision,2);assert.equal(state.records[1].snapshot.study.assessment,'CORRECCION SINTETICA DEL OPERADOR B');
 });
 await scenario('409 blocks further writes','conflict',async({page,state,fillStudy})=>{
   await fillStudy();await page.locator('[data-phase="conflict"]').waitFor();assert.equal(await page.getByRole('button',{name:'Guardar valoración',exact:true}).isDisabled(),true);assert.equal(state.post.length,1);
 });
 await scenario('another tab never replaces unsaved local draft during recovery','',async({page,state,context,origin})=>{
   await page.getByRole('button',{name:'Estudio',exact:true}).click();
   await page.getByLabel('Valoración del asunto',{exact:true}).fill('TEXTO LOCAL A SIN GUARDAR');
   const operatorId='66666666-6666-4666-8666-666666666666',operation_id=randomUUID();
   const fields={...blankStudy(),assessment:'TEXTO GUARDADO EN OTRA PESTANA',next_action:'Revisar ambos'};
   const documents=docs.map(d=>({document_id:d.id,observed_sha256:'a'.repeat(64),read_confirmed:true}));
   const payload={...fields,operation_id,expected_revision:0,documents};
   const snapshot={contract:'rtm_paid_initial_study_v1',case_id:A,operation_id,revision:1,study:fields,sources:documents,author:{id:operatorId,name:'OPERADOR SINTETICO'},created_at:new Date().toISOString()};
   const canonical_snapshot=JSON.stringify(snapshot);state.records.push({snapshot,canonical_snapshot,sha256:hash(canonical_snapshot)});
   const reference={version:1,case_id:A,operator_id:operatorId,operation_id,expected_revision:0,request_sha256:await studyRequestDigest(payload),confirmed_sha256:hash(canonical_snapshot)};
   const peer=await context.newPage();await peer.route(origin+'/journal-peer',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><title>Synthetic peer</title>'}));await peer.goto(origin+'/journal-peer');
   await peer.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key:journalKey(A,operatorId),value:reference});
   await page.locator('[data-phase="unknown"]').waitFor();await page.getByRole('button',{name:'Consultar operación e historial'}).click();
   await page.locator('[data-phase="conflict_review"]').waitFor();
   assert.equal(await page.getByLabel('Valoración del asunto',{exact:true}).inputValue(),'TEXTO LOCAL A SIN GUARDAR');
   await page.getByText('TEXTO GUARDADO EN OTRA PESTANA',{exact:true}).first().waitFor();assert.equal(state.post.length,0);
   await peer.close();
 });
 for(const navigate of [false,true])await scenario('unknown committed survives '+(navigate?'navigation':'reload and new login'),'post-unknown',async({page,state,fillStudy,login})=>{
   await fillStudy();await page.locator('[data-phase="unknown"]').waitFor();
   const reference=await page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('rtm.ops.study-reference.v1.')).map(([,v])=>JSON.parse(v)));
   assert.equal(reference.length,1);assert.equal(reference[0].operation_id,state.post[0].operation_id);
   assert.deepEqual(Object.keys(reference[0]).sort(),['version','case_id','operator_id','operation_id','expected_revision','request_sha256','confirmed_sha256'].sort());
   assert.ok(!JSON.stringify(reference).includes('VALORACION'));assert.ok(!JSON.stringify(reference).includes('SYNTHETIC_TOKEN'));
   if(navigate){await page.getByRole('link',{name:'← Expedientes'}).click();await page.getByRole('link',{name:'Abrir expediente',exact:true}).click();}
   else{
     await page.reload();
     const closure=page.getByRole('button',{name:'Comprobar cierre pendiente',exact:true});
     if(await closure.isVisible())await closure.click();
     await login();
   }
   await page.getByRole('button',{name:'Estudio',exact:true}).click();await page.locator('[data-phase="unknown"]').waitFor();
   assert.equal(await page.getByRole('button',{name:'Guardar valoración',exact:true}).isDisabled(),true);
   state.getFailure='get500';await page.getByRole('button',{name:'Consultar operación e historial'}).click();await page.locator('[data-phase="unknown"]').waitFor();
   assert.equal(state.post.length,1);
   await page.getByRole('button',{name:'Consultar operación e historial'}).click();await page.locator('[data-phase="verified"]').waitFor();
   assert.equal(state.post.length,1);assert.equal(state.records.length,1);
   assert.equal(await page.getByLabel('Valoración del asunto',{exact:true}).inputValue(),state.post[0].assessment);
   assert.equal(await page.evaluate(()=>Object.keys(localStorage).filter(k=>k.startsWith('rtm.ops.study-reference.v1.')).length),0);
 });
 await scenario('unknown before commit reload resolves absence without blind retry','post-not-stored',async({page,state,fillStudy,login})=>{
   await fillStudy();await page.locator('[data-phase="unknown"]').waitFor();const originalId=state.post[0].operation_id;
   await page.reload();const closure=page.getByRole('button',{name:'Comprobar cierre pendiente',exact:true});if(await closure.isVisible())await closure.click();await login();
   await page.getByRole('button',{name:'Estudio',exact:true}).click();await page.locator('[data-phase="unknown"]').waitFor();
   await page.getByRole('button',{name:'Consultar operación e historial'}).click();await page.locator('[data-phase="cancelled_review"]').waitFor();
   assert.equal(state.cancelled.has(originalId),true);assert.equal(state.post.length,1);assert.equal(state.records.length,0);
   assert.equal(await page.getByRole('button',{name:'Conservar mi texto sobre la base revisada',exact:true}).isDisabled(),true);
   await page.getByLabel('He comparado mi texto con la valoración más reciente.').check();
   await page.getByRole('button',{name:'Usar la valoración más reciente como base',exact:true}).click();
   assert.equal(await page.getByRole('button',{name:'Guardar valoración',exact:true}).isDisabled(),true);
 });
 await scenario('unknown reference remains after 401 with no private data displayed','post-unknown',async({page,state,fillStudy,login})=>{
   await fillStudy();await page.locator('[data-phase="unknown"]').waitFor();
   await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.getByRole('heading',{name:'Identifica al operador'}).waitFor();
   assert.ok(!(await page.locator('body').innerText()).includes('VALORACION SINTETICA EXACTA'));
   await login();await page.getByRole('button',{name:'Estudio',exact:true}).click();await page.locator('[data-phase="unknown"]').waitFor();
   await page.getByRole('button',{name:'Consultar operación e historial'}).click();await page.locator('[data-phase="verified"]').waitFor();
   assert.equal(state.post.length,1);
 });
 await scenario('recovery after new individual session and responsive layout','',async({page,state,fillStudy,login})=>{
   await fillStudy();await page.locator('[data-phase="verified"]').waitFor();
   await page.screenshot({path:path.join(output,'estudio_sintetico_390.png'),fullPage:true});
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.reload();
   if(await page.evaluate(()=>Object.entries(localStorage).some(([k,v])=>k.startsWith('rtm.ops.device-closure.v1.')&&JSON.parse(v).phase!=='closed'))){
     await page.getByRole('button',{name:'Comprobar cierre pendiente',exact:true}).click();
   }
   await login();await page.getByRole('button',{name:'Estudio',exact:true}).click();
   assert.equal(await page.getByLabel('Valoración del asunto',{exact:true}).inputValue(),'VALORACION SINTETICA EXACTA\nSegunda línea, áéí.');
   await page.getByRole('button',{name:'Leer valoración 1'}).click();await page.getByRole('heading',{name:'Consultando valoración 1'}).waitFor();
   await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await page.getByRole('heading',{name:'Identifica al operador'}).waitFor();
   assert.equal(await page.getByTestId('paid-case-workspace').count(),0);assert.equal(state.post.length,1);
 },390);
 for(const status of [401,403])await scenario('document '+status+' clears private case','',async({page,state})=>{
   state.deny=status;await page.getByRole('button',{name:'Documentos',exact:true}).click();await page.getByRole('button',{name:'Abrir y leer',exact:true}).first().click();
   await page.getByRole('heading',{name:'Identifica al operador'}).waitFor();assert.equal(await page.getByTestId('paid-case-workspace').count(),0);
 });
 await scenario('query failure never becomes unpaid or missing','work500',async({page})=>{
   assert.ok((await page.locator('main').innerText()).includes('No se interpreta como falta de pago'));
   assert.equal(await page.getByTestId('paid-case-workspace').count(),0);
 });
 await scenario('case switch clears previous identity','',async({page})=>{
   await page.evaluate(id=>{location.hash='/ops/case/'+id},B);await page.getByRole('heading',{name:'Identifica al operador'}).waitFor();
   assert.ok(!(await page.locator('body').innerText()).includes('Interesado A'));
 });
}catch(e){errors.push({phase,name:e.name,message:e.message,stack:e.stack});process.exitCode=1;}
finally{await browser?.close();if(server)await new Promise(ok=>server.close(ok));fs.writeFileSync(path.join(output,'RESULTADO.json'),JSON.stringify({at:new Date().toISOString(),passed:!errors.length,results,errors,scope:'isolated compiled frontend; synthetic API, no PostgreSQL/B2/mail/payment'},null,2));console.log(JSON.stringify({output,passed:!errors.length,scenarios:results.length,errors}));}
