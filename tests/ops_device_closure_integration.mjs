// Compiled frontend -> real loopback HTTP API -> temporary PostgreSQL.
// Network transport is redirected; API success responses are not fabricated.
// All documents, identities and passwords belong solely to the isolated fixture.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);
const config=JSON.parse(Buffer.concat(chunks).toString('utf8'));
const {chromium}=await import(pathToFileURL(config.playwright_path).href);
const output=path.resolve(config.output);fs.mkdirSync(output,{recursive:true});
const build=path.resolve(config.build),origin='https://www.recurretumulta.eu';
const checks=[],errors=[],http=[],injections=[],inflight=new Set(),gates=[];
let browser,context,page,phase='start',passed=false,closing=false,fault=null,loginRequests=0;
const safeError=e=>({name:e.name,message:String(e.message).split('\n')[0],stack:String(e.stack||'').split('\n').filter(l=>/^\s+at /.test(l)).join('\n')});
const check=(name,value=true)=>{assert.ok(value,name);checks.push(name);};
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}
function inject(kind){const item={kind,arrived:deferred(),release:deferred(),delivered:deferred()};fault=item;gates.push(item);return item;}
const loginButton=p=>p.getByRole('button',{name:'Entrar en OPS',exact:true});
async function ready(p){await p.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent==='Entrar en OPS'&&!b.disabled));}
async function login(p){
  await ready(p);await p.getByLabel('Email de operador').fill(config.email);
  await p.getByLabel('Contraseña',{exact:true}).fill(config.password);await loginButton(p).click();
  await p.getByTestId('paid-case-workspace').waitFor();
}
async function pending(p){await p.getByTestId('ops-closure').waitFor();assert.equal(await loginButton(p).isDisabled(),true);}
async function recover(p){await p.getByRole('button',{name:'Comprobar cierre pendiente',exact:true}).click();await ready(p);}
try {
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,
    args:['--disable-background-networking','--disable-component-update','--disable-sync']});
  context=await browser.newContext({viewport:{width:1280,height:960},serviceWorkers:'block'});
  async function transport(route){
    if(closing)return route.abort();
    const request=route.request(),u=new URL(request.url());
    if(u.origin!==origin)return route.abort();
    if(u.pathname.startsWith('/api/')){
      if(u.pathname.endsWith('/auth/login'))loginRequests++;
      const headers=await request.allHeaders();delete headers.host;
      const entry={phase,path:u.pathname,method:request.method(),device_cookie_present:!!headers.cookie?.includes('__Host-rtm_presenter_device=')};http.push(entry);
      const isClose=u.pathname.endsWith('/auth/device-logout');
      const selected=isClose?fault:null;if(selected)fault=null;
      if(isClose)entry.operation_id=request.postDataJSON().operation_id;
      if(selected){selected.operation_id=entry.operation_id;injections.push({kind:selected.kind,operation_id:entry.operation_id});}
      if(selected?.kind==='lost-before'){selected.arrived.resolve();return route.abort();}
      if(selected?.kind==='http-error'){selected.arrived.resolve();return route.fulfill({status:503,json:{detail:'ISOLATED_PROXY_FAILURE'}});}
      const response=await route.fetch({url:`http://127.0.0.1:${config.api_port}${u.pathname.slice(4)}${u.search}`,headers,maxRedirects:0,timeout:20000});
      entry.status=response.status();entry.device_cookie_mutated=response.headersArray().some(h=>h.name.toLowerCase()==='set-cookie'&&h.value.startsWith('__Host-rtm_presenter_device='));
      if(isClose)assert.equal(entry.device_cookie_mutated,false,'A logout acknowledgement must never mutate the shared device cookie');
      if(selected?.kind==='lost-after'){selected.arrived.resolve();return route.abort();}
      if(selected?.kind==='hold'){selected.arrived.resolve();await selected.release.promise;}
      try{await route.fulfill({response});entry.delivered=true;}finally{selected?.delivered.resolve();}
      return;
    }
    const resolved=path.resolve(build,'.'+decodeURIComponent(u.pathname));
    if(resolved!==build&&!resolved.startsWith(build+path.sep))return route.abort();
    const file=fs.existsSync(resolved)&&fs.statSync(resolved).isFile()?resolved:path.join(build,'index.html');
    const contentType={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf'}[path.extname(file)]||'application/octet-stream';
    return route.fulfill({status:200,contentType,body:fs.readFileSync(file)});
  }
  await context.route('**/*',async route=>{
    const promise=transport(route);inflight.add(promise);
    try{await promise;}catch(e){
      // A navigation can abandon the old response: record this, not credentials.
      if(!closing&&!/Target.*closed|Request context disposed|Invalid InterceptionId|Route is already handled/i.test(String(e.message)))errors.push({phase:'transport',...safeError(e)});
      try{await route.abort();}catch{}
    }finally{inflight.delete(promise);}
  });
  async function tab(){const p=await context.newPage();p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push({phase,...safeError(e)}));return p;}
  const url=origin+'/#/ops/case/'+config.case_id;
  page=await tab();await page.goto(url);await login(page);
  check('UI login with real API, password verification, device cookie and PostgreSQL');
  phase='documents';await page.getByRole('button',{name:'Documentos',exact:true}).click();
  for(let i=0;i<3;i++){
    await page.getByRole('button',{name:'Abrir y leer',exact:true}).nth(i).click();
    await page.getByText('1 de 2 páginas mostradas.',{exact:false}).waitFor();
    await page.getByLabel('Ampliación').selectOption('150');await page.getByRole('button',{name:'Página siguiente',exact:true}).click();
    await page.getByText('2 de 2 páginas mostradas.',{exact:false}).waitFor();
    await page.getByLabel('He leído y revisado este documento completo.').check();
    await page.getByRole('button',{name:'Incorporar a los documentos revisados del estudio'}).click();
    check('Real rendered pages and review of synthetic document '+i);
  }
  phase='save';await page.getByRole('button',{name:'Estudio',exact:true}).click();
  const assessment='VALORACION SINTETICA CIERRE COORDINADO\nContenido exacto después de una nueva sesión.';
  await page.getByLabel('Valoración del asunto',{exact:true}).fill(assessment);
  await page.getByLabel('Siguiente acción concreta',{exact:true}).fill('Revisar plazo sintético; no presentar.');
  await page.getByLabel('Confirmo guardar una nueva valoración interna',{exact:false}).check();
  await page.getByRole('button',{name:'Guardar valoración',exact:true}).click();await page.locator('[data-phase="verified"]').waitFor();
  check('Study saved by UI and exact PostgreSQL read verified');
  const other=await tab();await other.goto(url);await login(other);
  phase='delayed-close-multiple-tabs';const delayed=inject('hold');const count=loginRequests;
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await delayed.arrived.promise;
  await pending(page);await pending(other);
  check('Both tabs immediately remove sensitive case data',await page.getByTestId('paid-case-workspace').count()===0&&await other.getByTestId('paid-case-workspace').count()===0);
  await other.getByLabel('Email de operador').fill(config.email);await other.getByLabel('Contraseña',{exact:true}).fill(config.password);
  await other.getByLabel('Contraseña',{exact:true}).press('Enter');
  check('No new login request while closure response is held',loginRequests===count);
  delayed.release.resolve();await delayed.delivered.promise;await ready(page);await ready(other);
  await login(page);await page.getByRole('button',{name:'Estudio',exact:true}).click();
  assert.equal(await page.getByLabel('Valoración del asunto',{exact:true}).inputValue(),assessment);
  check('Delayed close resolved, then exact assessment recovered');

  phase='lost-response-reload';const lost=inject('lost-after');
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await lost.arrived.promise;
  await page.locator('[data-testid="ops-closure"][data-phase="unknown"]').waitFor();
  check('Lost acknowledgement is unknown, not falsely completed',await loginButton(page).isDisabled());
  await page.reload();await pending(page);await recover(page);await login(page);
  check('Reload reconciles the same durable logout operation',http.filter(e=>e.operation_id===lost.operation_id).length===2);
  await page.getByRole('button',{name:'Estudio',exact:true}).click();assert.equal(await page.getByLabel('Valoración del asunto',{exact:true}).inputValue(),assessment);
  check('Exact assessment recovered after lost response and reload');
  const replay=await page.evaluate(async operation_id=>{
    const r=await fetch('/api/ops/auth/device-logout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({operation_id})});
    return {status:r.status,body:await r.json()};
  },lost.operation_id);
  check('Old operation replay is acknowledged without a new closure',replay.status===200&&replay.body.operation_id===lost.operation_id);
  await page.getByRole('link',{name:'← Expedientes'}).click();await page.getByRole('link',{name:'Abrir expediente',exact:true}).click();
  await page.getByRole('button',{name:'Estudio',exact:true}).click();assert.equal(await page.getByLabel('Valoración del asunto',{exact:true}).inputValue(),assessment);
  check('Replay did not invalidate new session; list navigation recovers same work');

  phase='late-response-after-navigation';const late=inject('hold');
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await late.arrived.promise;await pending(page);
  await page.reload();await pending(page);await recover(page);await login(page);
  late.release.resolve();await late.delivered.promise;
  await page.getByRole('button',{name:'Documentos',exact:true}).click();await page.getByRole('button',{name:'Abrir y leer',exact:true}).first().click();
  await page.getByText('1 de 2 páginas mostradas.',{exact:false}).waitFor();
  check('Late original acknowledgement cannot remove device cookie or invalidate reconciled new session');
  await page.getByRole('button',{name:'Cerrar visor',exact:true}).click();

  for(const kind of ['lost-before','http-error']){
    phase=kind;const broken=inject(kind);await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await broken.arrived.promise;
    await page.locator('[data-testid="ops-closure"][data-phase="unknown"]').waitFor();await pending(other);
    await page.goto(origin+'/#/contacto');await page.goto(url);await pending(page);
    await recover(page);await login(page);
    check(kind+': navigation preserves unknown operation; explicit reconciliation permits new login',http.filter(e=>e.operation_id===broken.operation_id).length===2);
    await page.getByRole('button',{name:'Estudio',exact:true}).click();assert.equal(await page.getByLabel('Valoración del asunto',{exact:true}).inputValue(),assessment);
  }
  phase='active-reload';inject('lost-after');await page.reload();fault=null;await pending(page);await recover(page);await login(page);
  await page.getByRole('button',{name:'Estudio',exact:true}).click();assert.equal(await page.getByLabel('Valoración del asunto',{exact:true}).inputValue(),assessment);
  check('Active page reload withdraws old session; recovery and new login restore exact work');
  const journal=await page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('rtm.ops.device-closure.v1.')).map(([,v])=>JSON.parse(v)));
  check('Persistent browser journal contains UUID and phase only',journal.length>0&&journal.every(r=>Object.keys(r).sort().join(',')==='id,phase'&&r.phase==='closed'));
  const device=(await context.cookies()).find(c=>c.name==='__Host-rtm_presenter_device');
  check('Device cookie still present, Secure and HttpOnly',!!device?.httpOnly&&device.secure);
  phase='final-close';await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await ready(page);
  check('Final close removes all case views',await page.getByTestId('paid-case-workspace').count()===0&&await other.getByTestId('paid-case-workspace').count()===0);
  assert.deepEqual(errors,[]);passed=true;
}catch(e){errors.push({phase,...safeError(e)});if(page)try{errors.push({phase,visible_alerts:await page.getByRole('alert').allTextContents()});}catch{}}
finally{
  gates.forEach(g=>g.release.resolve());closing=true;await Promise.allSettled([...inflight]);
  if(context)await context.close();if(browser)await browser.close();
  fs.writeFileSync(path.join(output,'RESULTADO.json'),JSON.stringify({passed,phase,checks,errors,http,injections,browser_closed:true,
    scope:'Compiled React/Edge, real HTTP API and PostgreSQL fixture; injected network failures, synthetic S3 custody; no production access'},null,2));
  console.log(JSON.stringify({passed,checks:checks.length,phase,output}));process.exitCode=passed?0:1;
}
