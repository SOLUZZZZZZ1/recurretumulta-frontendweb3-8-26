// Compiled React, synthetic HTTP responses only. No provider or production access.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const {chromium}=await import(pathToFileURL('C:/Users/soluz/rtm102026/backend/.venv/browser-tools/node_modules/playwright-core/index.mjs'));
const out=process.argv[2];if(!out)throw Error('Output directory required');fs.mkdirSync(out,{recursive:true});
const build=path.resolve('dist'),origin='https://www.recurretumulta.eu',caseId='11111111-1111-4111-8111-111111111111';
const results=[];let browser;
function data(){return {ok:true,case_id:caseId,session_ref:'a'.repeat(64),expires_at:Date.now()/1000+600,
 initial_study:{state:'provider_verified',amount_cents:1000},balance:{state:'not_started'},quote:{id:'22222222-2222-4222-8222-222222222222',sha256:'b'.repeat(64),revision:1,state:'communicated',title:'PROPUESTA SINTETICA',scope:'ALCANCE SINTETICO UNO',exclusions:'Sin presentación',client_summary:'VALORACION PRIVADA SINTETICA',expires_at:new Date(Date.now()+86400000).toISOString(),mode:'test',economics:{total_cents:3900,net_cents:3223,tax_cents:677,tax_label:'Impuesto de ensayo',tax_basis_points:2100,study_credit_cents:1000,balance_cents:2900}}};}
async function scenario(name,fn){
 const context=await browser.newContext({serviceWorkers:'block'}),state={data:data(),status:200,posts:[],errors:[],hold:null};
 await context.route('**/*',async route=>{const req=route.request(),u=new URL(req.url());
  if(u.origin!==origin)return route.abort();
  if(u.pathname.startsWith('/api/')){
   if(req.method()==='POST'){state.posts.push({path:u.pathname,body:req.postDataJSON()});return route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,balance:{state:'unknown'}})});}
   const snapshot=JSON.parse(JSON.stringify(state.data)),status=state.status;
   if(state.hold){const hold=state.hold;state.hold=null;hold.started();await hold.wait;}
   try{return await route.fulfill({status,contentType:'application/json',body:JSON.stringify(status===200?snapshot:{detail:{code:status===403?'MANAGEMENT_ACCESS_NOT_ACTIVE':'CLIENT_SESSION_REQUIRED'}})});}catch{return;}
  }
  const requested=path.resolve(build,'.'+decodeURIComponent(u.pathname));if(!requested.startsWith(build+path.sep)&&requested!==build)return route.abort();
  const file=fs.existsSync(requested)&&fs.statSync(requested).isFile()?requested:path.join(build,'index.html');
  return route.fulfill({status:200,contentType:{'.js':'application/javascript','.css':'text/css','.html':'text/html'}[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});
 });
 const p=await context.newPage();p.setDefaultTimeout(7000);p.on('pageerror',e=>state.errors.push({message:e.message,stack:e.stack}));
 const url=origin+'/#/cliente/expediente/'+caseId;
 try{await p.goto(url);await p.getByRole('heading',{name:'Presupuesto · versión 1',exact:true}).waitFor();await fn(p,state,context,url);assert.deepEqual(state.errors,[]);results.push({name,passed:true,posts:state.posts});}
 catch(e){results.push({name,passed:false,error:{name:e.name,message:e.message,stack:e.stack},posts:state.posts,pageerrors:state.errors});}
 finally{await context.close();}
}
try{
 browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-background-networking','--disable-component-update','--disable-sync']});
 for(const variant of ['price','scope','session'])await scenario('NORA-MJ-01 '+variant,async(p,s)=>{
  await p.getByRole('checkbox').check();
  if(variant==='session')s.data.session_ref='c'.repeat(64);
  else{s.data.quote.id='33333333-3333-4333-8333-333333333333';s.data.quote.sha256='d'.repeat(64);s.data.quote.revision=2;s.data.quote.scope='ALCANCE SINTETICO DOS';if(variant==='price'){s.data.quote.economics.total_cents=7900;s.data.quote.economics.balance_cents=6900;}}
  await p.getByRole('button',{name:'Consultar confirmación del pago'}).click();await p.getByRole('button',{name:/Aceptar y pagar/}).waitFor();
  await p.waitForFunction(()=>![...document.querySelectorAll('[role="status"]')].some(e=>e.textContent.includes('Consultando el resultado')));
  assert.equal(await p.getByRole('checkbox').isChecked(),false,'Confirmation must not transfer to a different quote/scope/session');
  assert.equal(await p.getByRole('button',{name:/Aceptar y pagar/}).isDisabled(),true);assert.equal(s.posts.length,0);
  await p.getByRole('checkbox').check();assert.equal(await p.getByRole('button',{name:/Aceptar y pagar/}).isEnabled(),true);
 });
 for(const status of [401,403])await scenario('NORA-MJ-04 '+status,async(p,s)=>{
  await p.getByRole('checkbox').check();s.status=status;await p.getByRole('button',{name:'Consultar confirmación del pago'}).click();await p.getByRole('alert').waitFor();
  assert.equal(await p.getByText('VALORACION PRIVADA SINTETICA',{exact:true}).count(),0,'Denied access must remove prior private data');
  assert.equal(await p.getByRole('button',{name:/Aceptar y pagar/}).count(),0);assert.equal(s.posts.length,0);
  if(status===403)assert.equal(await p.getByRole('button',{name:'Recibir enlace privado para entrar'}).count(),0,'Expired profile must not trigger a login loop');
 });
 for(const variant of ['price','scope','session'])await scenario('NORA-MJ-01 action preflight '+variant,async(p,s)=>{
  await p.getByRole('checkbox').check();
  if(variant==='session')s.data.session_ref='e'.repeat(64);
  else{s.data.quote.id='44444444-4444-4444-8444-444444444444';s.data.quote.sha256='f'.repeat(64);s.data.quote.revision=2;s.data.quote.scope='NUEVO ALCANCE';if(variant==='price'){s.data.quote.economics.total_cents=7900;s.data.quote.economics.balance_cents=6900;}}
  await p.getByRole('button',{name:/Aceptar y pagar/}).click();await p.getByRole('alert').waitFor();
  assert.equal(s.posts.length,0);assert.equal(await p.getByRole('checkbox').isChecked(),false);
 });
 await scenario('NORA-MJ-04 case navigation removes old scope',async(p,s,context,url)=>{
  await p.getByRole('checkbox').check();await p.goto(url.replace(caseId,'55555555-5555-4555-8555-555555555555'));
  await p.getByRole('alert').waitFor();assert.equal(await p.getByText('VALORACION PRIVADA SINTETICA',{exact:true}).count(),0);assert.equal(s.posts.length,0);
 });
 await scenario('NORA-MJ-01 another private link retires prior confirmation',async(p,s,context,url)=>{
  await p.getByRole('checkbox').check();await p.goto(url+'?enlace='+'q'.repeat(43));
  await p.getByRole('button',{name:'Entrar con el enlace privado recibido'}).waitFor();
  assert.equal(await p.getByText('VALORACION PRIVADA SINTETICA',{exact:true}).count(),0);assert.equal(await p.getByRole('button',{name:/Aceptar y pagar/}).count(),0);assert.equal(s.posts.length,0);
 });
 await scenario('NORA-MJ-04 late response after denial in another tab',async(p,s,context,url)=>{
  const second=await context.newPage();second.setDefaultTimeout(7000);await second.goto(url);await second.getByText('VALORACION PRIVADA SINTETICA',{exact:true}).waitFor();
  let release,started;const wait=new Promise(r=>release=r),begun=new Promise(r=>started=r);s.hold={wait,started};
  await p.getByRole('button',{name:'Consultar confirmación del pago'}).click();await begun;s.status=403;
  await second.getByRole('button',{name:'Consultar confirmación del pago'}).click();await second.getByRole('alert').waitFor();release();
  await p.waitForFunction(()=>!document.body.innerText.includes('VALORACION PRIVADA SINTETICA'));
  assert.equal(await p.getByRole('button',{name:/Aceptar y pagar/}).count(),0);assert.equal(s.posts.length,0);
 });
}finally{if(browser)await browser.close();const result={passed:results.every(r=>r.passed),results,scope:'Compiled browser and synthetic HTTP only; no API server, PostgreSQL or external providers',browser_closed:true};fs.writeFileSync(path.join(out,'RESULTADO.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,checks:results.length,failed:results.filter(r=>!r.passed).map(r=>r.name)}));process.exitCode=result.passed?0:1;}
