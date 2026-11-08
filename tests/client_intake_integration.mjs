// Compiled UI, real local app/PG; synthetic Stripe, storage and AI boundaries.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const chunks=[];for await(const c of process.stdin)chunks.push(c);
const cfg=JSON.parse(Buffer.concat(chunks).toString('utf8'));
const {chromium}=await import(pathToFileURL(cfg.playwright_path).href);
const origin=cfg.origin,build=path.resolve(cfg.build),out=path.resolve(cfg.output);
const fixtureFile={name:'synthetic-client.pdf',mimeType:'application/pdf',buffer:fs.readFileSync(cfg.document)};
assert.ok(['https://www.resuelvetusmovidas.es','https://rtm-journey-test-ui.onrender.com'].includes(origin));fs.mkdirSync(out,{recursive:true});
const checks=[],requests=[],errors=[],inflight=new Set();let browser,page,phase='start',passed=false,closing=false,losePath='',createdCase='',pdfSeen=false,checkoutSeen=false;
const screenshots=[];let lastWork=null,savedStudy=null,savedQuote=null,sameCaseEvidence=null;
const check=(name,condition=true)=>{assert.ok(condition,name);checks.push(name);};
const writes=suffix=>requests.filter(r=>r.method==='POST'&&r.path.endsWith(suffix)).length;
async function control(action){const r=await fetch(`http://127.0.0.1:${cfg.control_port}/${action}`,{method:'POST',body:JSON.stringify({case_id:createdCase})});assert.equal(r.status,200);return r.json();}
async function transport(route){
  if(closing)return route.abort();
  const req=route.request(),u=new URL(req.url());
  if(u.origin==='https://checkout.stripe.com'){checkoutSeen=true;return route.fulfill({status:200,contentType:'text/html',body:'<h1>STRIPE SINTETICO: SIN COBRO</h1>'});}
  if(u.origin!==origin){errors.push({phase,type:'unexpected_origin',origin:u.origin});return route.abort();}
  if(u.pathname.startsWith('/api/')){
    const entry={phase,path:u.pathname,method:req.method()};requests.push(entry);
    const headers=await req.allHeaders();delete headers.host;
    const postData=req.postDataBuffer();entry.body_bytes=postData?.length||0;
    const response=await route.fetch({url:`http://127.0.0.1:${cfg.api_port}${u.pathname.slice(4)}${u.search}`,headers,postData:postData??undefined,maxRedirects:0});entry.status=response.status();
    if(entry.path.endsWith('/intake-draft')&&response.ok())createdCase=(await response.json()).case_id;
    if(response.ok()&&entry.path.endsWith('/work'))lastWork=await response.json();
    if(response.ok()&&entry.method==='POST'&&entry.path.endsWith('/study'))savedStudy=await response.json();
    if(response.ok()&&entry.method==='POST'&&entry.path.endsWith('/management/quotes'))savedQuote=(await response.json()).quote;
    if(entry.path.endsWith('/rtm-authorization-pdf')&&response.ok())pdfSeen=(await response.body()).subarray(0,4).toString()==='%PDF';
    if(losePath&&entry.path.endsWith(losePath)&&req.method()==='POST'){
      assert.equal(response.status(),200);losePath='';entry.lost_after_commit=true;return route.abort();
    }
    return route.fulfill({response});
  }
  const file=path.resolve(build,'.'+decodeURIComponent(u.pathname));assert.ok(file===build||file.startsWith(build+path.sep));
  const actual=fs.existsSync(file)&&fs.statSync(file).isFile()?file:path.join(build,'index.html');
  const contentType={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.ttf':'font/ttf','.jpg':'image/jpeg'}[path.extname(actual)]||'application/octet-stream';
  return route.fulfill({status:200,contentType,body:fs.readFileSync(actual)});
}
async function fillIntake(){
  for(const [label,value] of Object.entries({'Nombre y apellidos':'CLIENTE SINTETICO NAVEGADOR','DNI / NIE / Pasaporte':'FICTICIO001','Email':'browser-client@example.com','Teléfono':'000000000','Calle':'CALLE DE ENSAYO','Número':'1','Código postal':'00000','Población':'LOCALIDAD FICTICIA','Provincia':'PROVINCIA FICTICIA'}))await page.getByLabel(label,{exact:true}).fill(value);
  await page.locator('input[type=file]').nth(0).setInputFiles(fixtureFile);await page.locator('input[type=file]').nth(1).setInputFiles(fixtureFile);
  await page.getByPlaceholder('Explica brevemente el problema...').fill('ENSAYO SINTETICO SIN VALIDEZ: comprobar el recorrido del cliente y operador.');
  await page.getByLabel('Deseo generar la autorización RTM vinculada a este expediente.').check();
  await page.getByLabel('Acepto la política de privacidad y confirmo que los datos son correctos.').check();
}
async function waitUnknown(){await page.getByText('No hemos podido confirmar el resultado.',{exact:false}).waitFor();}
async function capture(name,locator=page){const file=name+'.png';await locator.screenshot({path:path.join(out,file)});screenshots.push({file,case_id:createdCase,phase});}
async function studyAndQuote(){
  phase='review_documents';await page.getByRole('button',{name:'Documentos',exact:true}).click();
  const source=lastWork.workspace.sections.documents.items.find(d=>d.kind==='original');assert.ok(source);
  for(let index=0;index<4;index++){
    await page.getByRole('button',{name:'Abrir y leer',exact:true}).nth(index).click();
    await page.getByText('1 de 1 páginas mostradas.',{exact:false}).waitFor();
    await page.getByLabel('He leído y revisado este documento completo.').check();
    await page.getByRole('button',{name:'Incorporar a los documentos revisados del estudio',exact:true}).click();
  }
  check('All four originals render in the protected viewer and are reviewed in the same browser session');
  phase='study';await page.getByRole('button',{name:'Estudio',exact:true}).click();
  const values={'Organismo':'ORGANISMO SINTETICO DE ENSAYO','Referencia del asunto':'ENSAYO-20261104-PANTALLAS',
    'Fecha de notificación':'FECHA SINTETICA 04/11/2026','Hechos revisados':'HECHOS FICTICIOS DEL MISMO EXPEDIENTE DE ENSAYO',
    'Plazo revisado y fundamento':'PLAZO SINTETICO DE ENSAYO, SIN VALIDEZ ADMINISTRATIVA'};
  for(const [label,value] of Object.entries(values)){
    await page.getByLabel(label,{exact:true}).fill(value);
    await page.locator('.cw-fact').filter({has:page.getByLabel(label,{exact:true})}).locator('select').selectOption(source.id);
  }
  await page.getByLabel('Estado del estudio').selectOption('completed');
  await page.getByLabel('Valoración del asunto',{exact:true}).fill('VALORACION SINTETICA GUARDADA DESDE EL NAVEGADOR PARA EL MISMO EXPEDIENTE.');
  await page.getByLabel('Opciones y alcance propuestos',{exact:true}).fill('Preparar un presupuesto de alegaciones exclusivamente para este ensayo.');
  await page.getByLabel('Siguiente acción concreta',{exact:true}).fill('PREPARAR PRESUPUESTO SINTETICO DEL MISMO CASO.');
  await page.getByLabel('Confirmo guardar una nueva valoración interna con estos hechos y fuentes.').check();
  await page.getByRole('button',{name:'Guardar valoración',exact:true}).click();
  await page.locator('[data-testid="study-save-state"][data-phase="verified"]').waitFor();
  check('Study written and recovered through real browser, tied to the customer case',savedStudy?.snapshot.case_id===createdCase&&savedStudy.snapshot.study.state==='completed');
  await capture('03-estudio-guardado',page.getByRole('region',{name:'Estudio inicial',exact:true}));
  phase='quote';await page.getByRole('button',{name:'Presupuesto y pagos',exact:true}).click();
  await page.getByRole('button',{name:'Actualizar presupuesto y pagos',exact:true}).click();
  await page.getByRole('button',{name:'Preparar presupuesto',exact:true}).click();
  await page.getByLabel('Actuación propuesta',{exact:true}).fill('Alegaciones sintéticas · mismo expediente de ensayo');
  await page.getByLabel('Escrito y fase del procedimiento',{exact:true}).selectOption('Alegaciones');
  await page.getByLabel('Valoración autorizada para el cliente (sin notas internas)',{exact:true}).fill('PRESUPUESTO SINTETICO DEL MISMO EXPEDIENTE, VINCULADO AL ESTUDIO VISIBLE.');
  await page.getByLabel('He revisado esta valoración, el alcance y los importes.',{exact:true}).check();
  await page.getByRole('button',{name:'Guardar presupuesto para vista previa',exact:true}).click();
  await page.getByRole('heading',{name:'Presupuesto · versión 1',exact:true}).waitFor();
  check('Budget visible in browser belongs to the same case and exact saved study',savedQuote?.snapshot.case_id===createdCase&&savedQuote.snapshot.study_operation_id===savedStudy.snapshot.operation_id&&savedQuote.snapshot.study_sha256===savedStudy.sha256);
  const quote=page.locator('article').filter({has:page.getByRole('heading',{name:'Presupuesto · versión 1',exact:true})});
  const amounts=await quote.locator('dd').allTextContents();check('Visible quote has 39 total, 10 initial credit and 29 outstanding',['39,00','10,00','29,00'].every(v=>amounts.some(s=>s.includes(v))));
  await capture('04-presupuesto-guardado',quote);
  const verified=await control('verify');
  check('Stored study and budget IDs and hashes match the browser records',verified.study.operation_id===savedStudy.snapshot.operation_id&&verified.study.snapshot_sha256===savedStudy.sha256&&verified.quote.id===savedQuote.snapshot.id&&verified.quote.snapshot_sha256===savedQuote.sha256&&verified.quote.study_operation_id===savedStudy.snapshot.operation_id);
  sameCaseEvidence={case_id:createdCase,study_operation_id:verified.study.operation_id,study_sha256:verified.study.snapshot_sha256,quote_id:verified.quote.id,quote_sha256:verified.quote.snapshot_sha256};
  phase='reentry';await page.getByRole('button',{name:'Cerrar sesión',exact:true}).click();
  await page.getByLabel('Email de operador').fill('operator@example.com');await page.getByLabel('Contraseña',{exact:true}).fill(cfg.password);
  await page.getByRole('button',{name:'Entrar en OPS',exact:true}).click();await page.getByTestId('paid-case-workspace').waitFor();
  await page.getByRole('button',{name:'Estudio',exact:true}).click();
  check('Saved study remains visible after explicit logout and new login',await page.getByLabel('Valoración del asunto',{exact:true}).inputValue()===savedStudy.snapshot.study.assessment);
  await page.getByRole('button',{name:'Presupuesto y pagos',exact:true}).click();await page.getByRole('heading',{name:'Presupuesto · versión 1',exact:true}).waitFor();
  check('Budget remains visible after new login to the same case',page.url().includes(createdCase));
  await page.getByTestId('paid-case-workspace').screenshot({path:path.join(out,'05-presupuesto-tras-reingreso.png')});screenshots.push({file:'05-presupuesto-tras-reingreso.png',case_id:createdCase,phase});
}
try{
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-background-networking','--disable-component-update','--disable-sync']});
  const context=await browser.newContext({viewport:{width:1366,height:960},serviceWorkers:'block'});
  await context.route('**/*',async route=>{const p=transport(route);inflight.add(p);try{await p;}catch(e){if(!closing)errors.push({phase,message:e.message});try{await route.abort();}catch{}}finally{inflight.delete(p);}});
  page=await context.newPage();page.setDefaultTimeout(15000);page.on('pageerror',e=>errors.push({phase,message:e.message}));
  phase='intake';await page.goto(origin+'/#/iniciar-expediente/traffic/fine');await fillIntake();
  await page.getByRole('button',{name:'Crear expediente y descargar autorización',exact:true}).click();
  await page.getByText('Expediente: ',{exact:false}).filter({hasText:/[0-9a-f]{8}-/}).waitFor();
  check('Customer form creates one case through the full app',writes('/intake-draft')===1&&Boolean(createdCase));
  await control('scope');
  // Popup PDF uses the same context interception, never the public server.
  await page.getByRole('button',{name:'Descargar autorización RTM',exact:false}).click();
  await page.waitForFunction(()=>true); // no fixed sleep; wait on the request below
  for(let i=0;!pdfSeen&&i<100;i++)await new Promise(r=>setTimeout(r,20));
  check('Authorization download returns an actual PDF from the same case',pdfSeen);
  phase='authorization';await page.locator('input[type=file]').nth(2).setInputFiles(fixtureFile);
  await page.getByRole('button',{name:'Subir autorización firmada',exact:true}).click();
  await page.getByRole('button',{name:'Continuar y subir documentación del caso',exact:true}).click();
  await page.getByRole('heading',{name:'Adjunta la documentación de tu caso',exact:true}).waitFor();
  check('Signed authorization advances to the documents screen for the same case',page.url().includes(createdCase)&&writes('/upload-authorization-signed')===1);
  phase='documents';await page.locator('input[type=file]').setInputFiles(fixtureFile);
  await page.getByRole('button',{name:/Guardar.*continuar|Subir.*continuar|Enviar.*continuar/}).click();
  await page.getByRole('heading',{name:'Resumen del expediente',exact:true}).waitFor();
  check('Document upload reaches the customer summary once',writes('/append-documents')===1&&page.url().includes(createdCase));
  phase='checkout';await page.getByRole('button',{name:/Pagar revisión inicial/}).click();
  await page.getByRole('heading',{name:'STRIPE SINTETICO: SIN COBRO',exact:true}).waitFor();
  check('Initial customer payment reaches the synthetic Checkout boundary once',checkoutSeen&&writes('/billing/checkout')===1);
  if(!cfg.initial_screens){phase='lost_checkout';await page.goto(origin+'/#/resumen?case='+createdCase);losePath='/billing/checkout';
  await page.getByRole('button',{name:/Pagar revisión inicial/}).click();await waitUnknown();
  check('Lost Checkout response produces one request and an explicit uncertain outcome',writes('/billing/checkout')===2);}
  await control('settle');await page.goto(origin+'/#/resumen?case='+createdCase);await page.getByText('paid',{exact:true}).waitFor();
  check('Signed synthetic webhook and duplicate settle the displayed customer case',!(await page.getByRole('button',{name:/Pagar revisión inicial/}).isVisible()));
  phase='ops';await page.goto(origin+'/#/ops/case/'+createdCase);
  if(cfg.initial_screens){await page.getByLabel('Email de operador').waitFor();await capture('01-acceso-test');}
  await page.getByLabel('Email de operador').fill('operator@example.com');await page.getByLabel('Contraseña',{exact:true}).fill(cfg.password);
  await page.getByRole('button',{name:'Entrar en OPS',exact:true}).click();await page.getByTestId('paid-case-workspace').waitFor();
  check('Separate individual operator login opens the case created by the customer',await page.getByText('CLIENTE SINTETICO NAVEGADOR',{exact:true}).first().isVisible());
  const actual=await control('verify');check('Database contains exactly the four customer documents and paid manual-review state',JSON.stringify(actual.kinds)===JSON.stringify(['authorization_signed','identity_back','identity_front','original'])&&actual.payment_status==='paid'&&actual.status==='manual_review'&&actual.customer_cases===1);
  if(cfg.initial_screens){await capture('02-expediente-test',page.getByTestId('paid-case-workspace'));await studyAndQuote();}
  else{phase='lost_upload';await page.goto(origin+'/#/multas/documentos?case='+createdCase);await page.locator('input[type=file]').setInputFiles(fixtureFile);losePath='/append-documents';
  await page.getByRole('button',{name:/Guardar.*continuar|Subir.*continuar|Enviar.*continuar/}).click();await waitUnknown();
  check('Lost upload response does not automatically write a second document',writes('/append-documents')===2&&(await control('verify')).kinds.length===5);
  await page.reload();check('Reload after uncertain upload sends no further write',writes('/append-documents')===2);
  phase='lost_intake';await page.goto(origin+'/#/iniciar-expediente/traffic/fine');await fillIntake();losePath='/intake-draft';
  await page.getByRole('button',{name:'Crear expediente y descargar autorización',exact:true}).click();await waitUnknown();
  check('Lost initial creation response never replays the form against another backend',writes('/intake-draft')===2&&(await control('verify')).customer_cases===2);}
  check('No browser errors or calls to a different application origin',errors.length===0);
  passed=true;
}catch(e){errors.push({phase,name:e.name,message:String(e.message).replaceAll(cfg.password,'[redacted]')});if(page)try{await page.screenshot({path:path.join(out,'failure.png'),fullPage:true});fs.writeFileSync(path.join(out,'failure.txt'),await page.locator('body').innerText());}catch{}}
finally{
  closing=true;await Promise.allSettled([...inflight]);if(browser)await browser.close();
  fs.writeFileSync(path.join(out,'RESULTADO.json'),JSON.stringify({passed,phase,checks,requests,errors,screenshots,same_case:sameCaseEvidence,browser_closed:!browser?.isConnected(),scope:'Compiled initial UI, real local app.py/PostgreSQL, synthetic providers and Render identity. No remote persistent environment or real external validation. Manual retry recovery is not certified.'},null,2));
}
console.log(JSON.stringify({passed,checks:checks.length,phase,errors:errors.length}));if(!passed)process.exitCode=1;
