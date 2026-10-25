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
      const isClose=u.pathname.endsWith('/study')&&request.method()==='POST';
      const selected=isClose?fault:null;if(selected)fault=null;
      if(isClose)entry.operation_id=request.postDataJSON().operation_id;
      if(selected){selected.operation_id=entry.operation_id;injections.push({kind:selected.kind,operation_id:entry.operation_id});}
      if(selected?.kind==='lost-before'){selected.arrived.resolve();return route.abort();}
      if(selected?.kind==='http-error'){selected.arrived.resolve();return route.fulfill({status:503,json:{detail:'ISOLATED_PROXY_FAILURE'}});}
      const response=await route.fetch({url:`http://127.0.0.1:${config.api_port}${u.pathname.slice(4)}${u.search}`,headers,maxRedirects:0,timeout:20000});
      entry.status=response.status();entry.device_cookie_mutated=response.headersArray().some(h=>h.name.toLowerCase()==='set-cookie'&&h.value.startsWith('__Host-rtm_presenter_device='));
      if(isClose)assert.equal(entry.device_cookie_mutated,false,'Study response must not mutate device cookie');
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
  async function review(){
    await page.getByRole('button',{name:'Documentos',exact:true}).click();
    for(let i=0;i<3;i++){
      await page.getByRole('button',{name:'Abrir y leer',exact:true}).nth(i).click();
      await page.getByText('1 de 2 paginas mostradas.'.replace('paginas','páginas'),{exact:false}).waitFor();
      await page.getByRole('button',{name:'Página siguiente',exact:true}).click();
      await page.getByText('2 de 2 páginas mostradas.',{exact:false}).waitFor();
      await page.getByLabel('He leído y revisado este documento completo.').check();
      await page.getByRole('button',{name:'Incorporar a los documentos revisados del estudio'}).click();
    }
  }
  for(const kind of ['lost-after','lost-before']){
    phase=kind;await review();await page.getByRole('button',{name:'Estudio',exact:true}).click();
    const assessment='ESTUDIO SINTETICO RECUPERACION '+kind+'\nTexto exacto y fuentes revisadas.';
    await page.getByLabel('Valoración del asunto',{exact:true}).fill(assessment);
    await page.getByLabel('Siguiente acción concreta',{exact:true}).fill('Revisar documentos sintéticos; no presentar.');
    await page.getByLabel('Confirmo guardar una nueva valoración interna',{exact:false}).check();
    const broken=inject(kind);
    await page.getByRole('button',{name:'Guardar valoración',exact:true}).click();await broken.arrived.promise;
    await page.locator('[data-phase="unknown"]').waitFor();
    check(kind+': uncertain POST blocks another save',await page.getByRole('button',{name:'Guardar valoración',exact:true}).isDisabled());
    const before=http.filter(e=>e.path.endsWith('/study')&&e.method==='POST').length;
    const references=await page.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('rtm.ops.study-reference.v1.')).map(([,v])=>JSON.parse(v)));
    check('Reference stores same operation and no private payload',references.length===1&&references[0].operation_id===broken.operation_id&&!JSON.stringify(references).includes(assessment)&&!Object.hasOwn(references[0],'payload'));
    await page.reload();
    // Wait for the real auth boundary to resolve startup before deciding whether
    // a previous device closure needs reconciliation. No fixed delay/unlock.
    await page.waitForFunction(()=>document.querySelector('[data-testid="ops-closure"]')||
      [...document.querySelectorAll('button')].some(b=>b.textContent==='Entrar en OPS'&&!b.disabled));
    if(await page.getByRole('button',{name:'Comprobar cierre pendiente',exact:true}).isVisible())await recover(page);
    await login(page);await page.getByRole('button',{name:'Estudio',exact:true}).click();
    await page.locator('[data-phase="unknown"]').waitFor();
    check('New session remains blocked pending same operation',await page.getByRole('button',{name:'Guardar valoración',exact:true}).isDisabled());
    await page.getByRole('button',{name:'Consultar operación e historial'}).click();
    if(kind==='lost-after'){
      await page.locator('[data-phase="verified"]').waitFor();
      check('Committed study recovered exactly after lost response, reload and new login',await page.getByLabel('Valoración del asunto',{exact:true}).inputValue()===assessment);
    }else{
      await page.locator('[data-phase="cancelled_review"]').waitFor();
      check('Never received POST resolved by real API; no invented success',await page.getByRole('button',{name:'Guardar valoración',exact:true}).isDisabled());
      await page.getByLabel('He comparado mi texto con la valoración más reciente.').check();
      await page.getByRole('button',{name:'Usar la valoración más reciente como base',exact:true}).click();
    }
    check('No second study POST during recovery',http.filter(e=>e.path.endsWith('/study')&&e.method==='POST').length===before);
  }
  await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await ready(page);
  check('Sensitive case removed after close',await page.getByTestId('paid-case-workspace').count()===0);
  assert.deepEqual(errors,[]);passed=true;
}catch(e){errors.push({phase,...safeError(e)});if(page)try{errors.push({phase,visible_alerts:await page.getByRole('alert').allTextContents()});}catch{}}
finally{
  gates.forEach(g=>g.release.resolve());closing=true;await Promise.allSettled([...inflight]);
  if(context)await context.close();if(browser)await browser.close();
  fs.writeFileSync(path.join(output,'RESULTADO.json'),JSON.stringify({passed,phase,checks,errors,http,injections,browser_closed:true,
    scope:'Compiled React/Edge, real HTTP API and PostgreSQL fixture; injected network failures, synthetic S3 custody; no production access'},null,2));
  console.log(JSON.stringify({passed,checks:checks.length,phase,output}));process.exitCode=passed?0:1;
}
