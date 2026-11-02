// Isolated compiled-browser test. Real app.py HTTP, disposable PG/S3.
// Stripe and mailbox boundaries are synthetic; NOT a provider TEST payment.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const chunks=[];for await(const chunk of process.stdin)chunks.push(chunk);
const cfg=JSON.parse(Buffer.concat(chunks).toString('utf8'));
const {chromium}=await import(pathToFileURL(cfg.playwright_path).href);
const origin='https://www.recurretumulta.eu',build=path.resolve(cfg.build),output=path.resolve(cfg.output);
fs.mkdirSync(output,{recursive:true});
const checks=[],errors=[],http=[],inflight=new Set();let browser,ops,customer,phase='start',passed=false,closing=false,loseDraft=false,loseClientLogout=false,loseMail=false,checkoutReached=false;
const check=(name,ok=true)=>{assert.ok(ok,name);checks.push(name);};
const safe=e=>({name:e.name,message:String(e.message).replaceAll(cfg.password,'[redacted]').replace(/([?&]enlace=)[A-Za-z0-9_-]+/g,'$1[redacted]'),stack:String(e.stack||'').split('\n').filter(l=>/^\s+at /.test(l)).join('\n')});
async function control(action){const r=await fetch(`http://127.0.0.1:${cfg.control_port}/${action}`,{method:'POST'});assert.equal(r.status,200,'fixture '+action);return r.json();}
async function login(p){
  await p.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>['Entrar en OPS','Comprobar cierre pendiente'].includes(b.textContent)&&!b.disabled));
  const recover=p.getByRole('button',{name:'Comprobar cierre pendiente',exact:true});if(await recover.isVisible()&&await recover.isEnabled())await recover.click();
  await p.getByLabel('Email de operador').fill(cfg.email);await p.getByLabel('Contraseña',{exact:true}).fill(cfg.password);
  await p.getByRole('button',{name:'Entrar en OPS',exact:true}).click();await p.getByTestId('paid-case-workspace').waitFor();
}
async function transport(route){
  if(closing)return route.abort();const request=route.request(),u=new URL(request.url());
  if(u.origin==='https://checkout.stripe.com'){
    checkoutReached=true;return route.fulfill({status:200,contentType:'text/html; charset=utf-8',body:'<h1>FRONTERA SINTETICA DE STRIPE — NO ES UN PAGO TEST REAL</h1>'});
  }
  if(u.origin!==origin)return route.abort();
  if(u.pathname.startsWith('/api/')){
    const headers=await request.allHeaders();delete headers.host;
    const entry={phase,path:u.pathname,method:request.method()};http.push(entry);
    const response=await route.fetch({url:`http://127.0.0.1:${cfg.api_port}${u.pathname.slice(4)}${u.search}`,headers,maxRedirects:0,timeout:25000});entry.status=response.status();
    if(loseDraft&&u.pathname.endsWith('/management/drafts')&&request.method()==='POST'){
      loseDraft=false;entry.injected_lost_response_after_server_commit=true;assert.equal(response.status(),200);return route.abort();
    }
    if(loseClientLogout&&u.pathname.endsWith('/client/management/logout')){loseClientLogout=false;entry.lost_logout_response=true;assert.equal(response.status(),200);return route.abort();}
    if(loseMail&&u.pathname.endsWith('/communications')&&request.method()==='POST'){loseMail=false;entry.lost_prepare_response_after_commit=true;assert.equal(response.status(),200);return route.abort();}
    return route.fulfill({response});
  }
  const file=path.resolve(build,'.'+decodeURIComponent(u.pathname));if(file!==build&&!file.startsWith(build+path.sep))return route.abort();
  const actual=fs.existsSync(file)&&fs.statSync(file).isFile()?file:path.join(build,'index.html');
  const type={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf'}[path.extname(actual)]||'application/octet-stream';
  return route.fulfill({status:200,contentType:type,body:fs.readFileSync(actual)});
}
async function context(){const c=await browser.newContext({viewport:{width:1366,height:960},serviceWorkers:'block'});
  await c.route('**/*',async route=>{const p=transport(route);inflight.add(p);try{await p;}catch(e){if(!closing)errors.push({phase:'transport',...safe(e)});try{await route.abort();}catch{}}finally{inflight.delete(p);}});
  const p=await c.newPage();p.setDefaultTimeout(12000);p.on('pageerror',e=>errors.push({phase,...safe(e)}));return {c,p};}
try{
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-background-networking','--disable-component-update','--disable-sync']});
  ops=await context();customer=await context();const p=ops.p,c=customer.p,url=origin+'/#/ops/case/'+cfg.case_id,client=origin+'/#/cliente/expediente/'+cfg.case_id;
  phase='ops_login';await p.goto(url);await login(p);
  phase='documents';await p.getByRole('button',{name:'Documentos',exact:true}).click();
  for(let i=0;i<2;i++){await p.getByRole('button',{name:'Abrir y leer',exact:true}).nth(i).click();await p.getByText('1 de 2 páginas mostradas.',{exact:false}).waitFor();await p.getByRole('button',{name:'Página siguiente',exact:true}).click();await p.getByText('2 de 2 páginas mostradas.',{exact:false}).waitFor();await p.getByRole('button',{name:'Cerrar visor',exact:true}).click();}
  check('Protected synthetic originals opened as actual two-page PDF rasters');
  phase='quote';await p.getByRole('button',{name:'Presupuesto y pagos',exact:true}).click();await p.getByRole('button',{name:'Preparar presupuesto',exact:true}).click();
  await p.getByLabel('Actuación propuesta',{exact:true}).fill('Alegaciones sintéticas de ensayo');
  await p.getByLabel('Valoración autorizada para el cliente (sin notas internas)',{exact:true}).fill('VALORACION COMUNICABLE SINTETICA. Hechos y opciones revisados en el ensayo.');
  await p.getByLabel('He revisado esta valoración, el alcance y los importes.',{exact:true}).check();
  await p.getByRole('button',{name:'Guardar presupuesto para vista previa',exact:true}).click();
  await p.getByRole('heading',{name:'Presupuesto · versión 1',exact:true}).waitFor();
  const quote=p.locator('article').filter({has:p.getByRole('heading',{name:'Presupuesto · versión 1',exact:true})}).first();
  const amounts=await quote.locator('dd').allTextContents();check('Actual OPS tab shows server 39 total, 10 credit, 29 balance',['39,00','10,00','29,00'].every(n=>amounts.some(s=>s.includes(n))));
  await p.getByRole('button',{name:'Preparar mensaje al cliente',exact:true}).click();await p.getByRole('heading',{name:'Vista previa del mensaje exacto'}).waitFor();
  await p.getByLabel('Apruebo este mensaje y esta versión para el destinatario mostrado.',{exact:true}).check();await p.getByRole('button',{name:'Enviar presupuesto al cliente',exact:true}).click();
  await p.getByText('Consulta el estado de envío y la conversación en Comunicaciones.',{exact:false}).waitFor();
  phase='mail';check('Quote received at synthetic SMTP boundary',(await control('mail')).quote_received);
  phase='client_access';await c.goto(client);await c.getByLabel('Correo del expediente').fill(cfg.client_email);await c.getByRole('button',{name:'Recibir enlace privado para entrar'}).click();await c.getByText('Si el correo corresponde al expediente habilitado',{exact:false}).waitFor();
  const mail=await control('mail');assert.ok(mail.private_link);await c.goto(mail.private_link);await c.getByRole('button',{name:'Entrar con el enlace privado recibido'}).click();await c.getByRole('heading',{name:'Presupuesto · versión 1',exact:true}).waitFor();
  check('Client sees same quote version and authorized summary',await c.getByText('VALORACION COMUNICABLE SINTETICA.',{exact:false}).isVisible());
  check('Internal assessment not exposed',!(await c.locator('body').innerText()).includes('VALORACION INTERNA SINTETICA'));
  check('Private credential removed from address bar',!c.url().includes('enlace='));
  await p.getByRole('button',{name:'Comunicaciones',exact:true}).click();await p.getByText('Acceso privado solicitado por el cliente.',{exact:false}).waitFor();
  check('Private link not exposed anywhere in OPS DOM',!(await p.content()).includes(new URL(mail.private_link).hash.split('enlace=')[1]));
  phase='acceptance_checkout';await c.getByLabel('He leído el alcance, las exclusiones, la valoración y el precio.',{exact:false}).check();await c.getByRole('button',{name:/Aceptar y pagar 29/}).click();await c.getByRole('heading',{name:'FRONTERA SINTETICA DE STRIPE — NO ES UN PAGO TEST REAL'}).waitFor();check('Accepted quote leads to hosted Checkout boundary',checkoutReached);
  phase='pending_then_confirmed';await control('settle');await c.goto(client+'?pago=consultar');await c.getByText('Saldo confirmado por Stripe',{exact:true}).waitFor();check('Backend confirms balance after initially pending notification');
  phase='reply_attachment';await control('reply');await p.getByRole('button',{name:'Actualizar comunicaciones'}).click();await p.getByText('RESPUESTA SINTETICA DEL MISMO EXPEDIENTE',{exact:true}).waitFor();
  await p.getByRole('button',{name:'Consultar adjunto protegido'}).click();await p.getByText('ADJUNTO INOCUO SINTETICO',{exact:true}).waitFor();check('Reply and protected original text attachment in same case');await p.getByRole('button',{name:'Cerrar adjunto'}).click();
  phase='ops_reply';const incoming=p.getByRole('listitem').filter({has:p.getByRole('heading',{name:'Respuesta sintética al presupuesto',exact:true})});
  await incoming.getByRole('button',{name:'Responder a este mensaje'}).click();await p.getByLabel('Contenido del mensaje',{exact:true}).fill('CONTESTACION SINTETICA DESDE OPS AL MISMO HILO');
  loseMail=true;await p.getByRole('button',{name:'Guardar mensaje preparado',exact:true}).click();await p.getByRole('button',{name:'Consultar la misma operación antes de repetir'}).waitFor();
  const mailRef=await p.evaluate(()=>Object.entries(localStorage).filter(([key])=>key.startsWith('rtm.mail.operation.v1.')).map(([,value])=>JSON.parse(value)));
  check('Pending prepared mail persists metadata only',mailRef.length===1&&Object.keys(mailRef[0]).sort().join(',')==='actor,case_id,operation_id,request_sha256');
  const mailWrites=http.filter(r=>r.path.endsWith('/communications')&&r.method==='POST').length;
  await p.reload();await login(p);await p.getByRole('button',{name:'Comunicaciones',exact:true}).click();
  await p.getByRole('button',{name:'Consultar la misma operación antes de repetir'}).click();await p.getByRole('heading',{name:'Mensaje recuperado'}).waitFor();
  check('Prepared mail recovered after reload without duplicate POST',http.filter(r=>r.path.endsWith('/communications')&&r.method==='POST').length===mailWrites);
  await p.getByLabel('Apruebo el envío de este contenido exacto',{exact:false}).check();await p.getByRole('button',{name:'Poner este mensaje en la cola de envío'}).click();await p.getByRole('button',{name:'Consultar el estado de esta comunicación'}).waitFor();
  check('OPS reply leaves through persistent outbox without duplicate',(await control('mail')).count===3);
  phase='draft';await p.getByRole('button',{name:'Recurso',exact:true}).click();await p.getByRole('button',{name:'Consultar versiones y requisitos'}).click();await p.getByRole('button',{name:'Preparar borrador del recurso',exact:true}).click();
  await p.getByLabel('Actuación y fase revisadas').selectOption('Alegaciones');
  await p.getByLabel('Enfoque propuesto',{exact:true}).fill('ESTRATEGIA SINTETICA: contrastar los hechos documentados en este ensayo.');
  await p.getByLabel('Título de la alegación',{exact:true}).fill('Alegación sintética documentada');
  await p.getByLabel('Argumentación revisada',{exact:true}).fill('ARGUMENTO SINTETICO REVISADO: el documento de ensayo permite contrastar los hechos, sin inventar datos.');
  await p.getByLabel('Solicitudes concretas (una por línea)',{exact:true}).fill('Solicitud sintética delimitada a este ensayo, sin presentación.');
  await p.getByLabel('He contrastado identidad, fase, hechos, argumentos y alcance contratado con los documentos.',{exact:true}).check();
  await p.getByLabel('Motivo de esta versión',{exact:true}).fill('Primera versión sintética revisada');await p.getByRole('button',{name:'Guardar nueva versión de borrador',exact:true}).click();await p.getByRole('heading',{name:'Borrador · versión 1',exact:true}).waitFor();
  check('Real reused renderer output contains reviewed argument',await p.getByText('ARGUMENTO SINTETICO REVISADO:',{exact:false}).isVisible());
  phase='correction_lost_response';await p.getByRole('button',{name:'Corregir la última versión guardada'}).click();const editor=p.getByLabel('Contenido del borrador',{exact:true});const corrected=(await editor.inputValue())+'\nCORRECCION EXACTA SINTETICA CONSERVADA.';await editor.fill(corrected);await p.getByLabel('Motivo de esta versión',{exact:true}).fill('Corrección sintética exacta con respuesta perdida');loseDraft=true;
  await p.getByRole('button',{name:'Guardar nueva versión de borrador',exact:true}).click();await p.getByRole('button',{name:'Recuperar la misma operación',exact:true}).waitFor();
  const refs=await p.evaluate(()=>Object.entries(localStorage).filter(([k])=>k.startsWith('rtm.management.operation.v1.')).map(([,v])=>JSON.parse(v)));
  check('Recovery reference contains identifiers/hash only, not draft or credentials',refs.length===1&&Object.keys(refs[0]).sort().join(',')==='actor,case_id,kind,operation_id,request_sha256'&&!JSON.stringify(refs).includes(corrected));
  const writes=http.filter(x=>x.path.endsWith('/management/drafts')&&x.method==='POST').length;
  await p.reload();await login(p);await p.getByRole('button',{name:'Recurso',exact:true}).click();await p.getByRole('button',{name:'Recuperar la misma operación',exact:true}).click();await p.getByRole('heading',{name:'Borrador · versión 2',exact:true}).waitFor();
  const recovered=p.locator('article').filter({has:p.getByRole('heading',{name:'Borrador · versión 2',exact:true})}).locator('pre');check('Same correction recovered exactly after lost response, reload and login',await recovered.textContent()===corrected);
  check('Recovery sends no second draft write',http.filter(x=>x.path.endsWith('/management/drafts')&&x.method==='POST').length===writes);
  phase='exit_reentry';await p.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await login(p);await p.getByRole('button',{name:'Recurso',exact:true}).click();await p.getByRole('heading',{name:'Borrador · versión 2',exact:true}).waitFor();check('Version preserved after explicit logout/login',await recovered.textContent()===corrected);
  await p.getByRole('button',{name:'Comunicaciones',exact:true}).click();await p.getByText('RESPUESTA SINTETICA DEL MISMO EXPEDIENTE',{exact:true}).waitFor();check('Conversation survives new OPS session');
  await p.getByText('CONTESTACION SINTETICA DESDE OPS AL MISMO HILO',{exact:true}).waitFor();check('OPS answer recovered after logout and login');
  phase='client_logout_unknown';const other=await customer.c.newPage();other.setDefaultTimeout(12000);await other.goto(client);await other.getByRole('heading',{name:'Presupuesto · versión 1',exact:true}).waitFor();
  loseClientLogout=true;await c.getByRole('button',{name:'Cerrar sesión de cliente'}).click();await c.getByRole('button',{name:'Consultar el cierre'}).waitFor();await other.getByRole('button',{name:'Consultar el cierre'}).waitFor();
  check('Unknown client logout removes sensitive content in both tabs',await c.getByRole('heading',{name:'Presupuesto · versión 1',exact:true}).count()===0&&await other.getByRole('heading',{name:'Presupuesto · versión 1',exact:true}).count()===0);
  await c.reload();await c.getByRole('button',{name:'Consultar el cierre'}).click();await c.getByRole('heading',{name:'Identifícate para continuar'}).waitFor();await other.getByRole('heading',{name:'Identifícate para continuar'}).waitFor();check('Same client logout reconciled after reload without credentials persisted');
  assert.deepEqual(errors,[]);passed=true;
}catch(e){errors.push({phase,...safe(e)});if(ops)try{errors.push({phase,visible_alerts:await ops.p.getByRole('alert').allTextContents(),client_alerts:await customer.p.getByRole('alert').allTextContents(),checkoutReached});}catch{}}
finally{closing=true;await Promise.allSettled([...inflight]);if(ops)await ops.c.close();if(customer)await customer.c.close();if(browser)await browser.close();
  fs.writeFileSync(path.join(output,'RESULTADO.json'),JSON.stringify({passed,phase,checks,errors,http,browser_closed:true,scope:'Compiled browser + full app.py HTTP + disposable PostgreSQL; synthetic Stripe SDK, SMTP/IMAP and S3; NOT real provider TEST or production.'},null,2));
  console.log(JSON.stringify({passed,checks:checks.length,phase}));process.exitCode=passed?0:1;}
