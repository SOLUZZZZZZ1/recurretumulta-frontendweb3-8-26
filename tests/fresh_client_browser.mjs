// Isolated headless browser. Only compiled local assets and loopback app HTTP.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const chunks=[];for await(const c of process.stdin)chunks.push(c);const cfg=JSON.parse(Buffer.concat(chunks).toString());
const {chromium}=await import(pathToFileURL(cfg.playwright_path).href);
const out=cfg.output;fs.mkdirSync(out,{recursive:true});let browser,page,phase='start',passed=false;
const checks=[],requests=[],screenshots=[];const check=(name,value=true)=>{assert.ok(value,name);checks.push(name);};
const pdfFile=file=>({name:path.basename(file),mimeType:'application/pdf',buffer:fs.readFileSync(file)});
let newCase=null;const capture=async name=>{const file=name+'.png';await page.screenshot({path:path.join(out,file),fullPage:true});screenshots.push(file);};
try{
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-background-networking','--disable-component-update','--disable-sync']});
  const context=await browser.newContext({viewport:{width:1250,height:900},acceptDownloads:true});
  await context.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    if(u.origin!==cfg.origin)return route.abort();
    if(u.pathname.startsWith('/api/')){
      const headers=await req.allHeaders();headers.host='recurretumulta-backend-1.onrender.com';
      const response=await route.fetch({url:`http://127.0.0.1:${cfg.api_port}${u.pathname.slice(4)}${u.search}`,headers,postData:req.postDataBuffer()??undefined,maxRedirects:0});
      const entry={phase,path:u.pathname,method:req.method(),status:response.status()};requests.push(entry);
      if(u.pathname==='/api/ops/auth/status')entry.configuration=await response.json();
      if(!response.ok()){const body=await response.json().catch(()=>null);entry.error=typeof body?.detail==='string'?body.detail:body?.detail?.code||'HTTP_ERROR';}
      if(u.pathname.endsWith('/intake-draft')&&response.ok())newCase=(await response.json()).case_id;
      return route.fulfill({response});
    }
    const build=path.resolve(cfg.build),target=path.resolve(build,'.'+decodeURIComponent(u.pathname));assert.ok(target.startsWith(build+path.sep)||target===build);
    const file=fs.existsSync(target)&&fs.statSync(target).isFile()?target:path.join(build,'index.html');
    const contentType={'.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.jpg':'image/jpeg','.svg':'image/svg+xml'}[path.extname(file)]||'application/octet-stream';
    return route.fulfill({status:200,contentType,body:fs.readFileSync(file)});
  });
  page=await context.newPage();page.setDefaultTimeout(18000);
  phase='supervisor prepares pass';await page.goto(cfg.origin+'/#/ops');
  await page.getByLabel('Email de operador').fill('operator@example.com');await page.getByLabel('Contraseña',{exact:true}).fill(cfg.password);
  await page.getByRole('button',{name:'Entrar en OPS',exact:true}).click();
  await page.getByText('Ensayo nuevo desde cliente',{exact:true}).click();
  await page.getByRole('button',{name:'Preparar pase de cliente',exact:true}).click();
  const pass=await page.getByLabel('Pase de cliente',{exact:true}).inputValue();check('Supervisor issued a client pass without a case',newCase===null&&pass.startsWith('v2.'));
  // Navigate away from OPS: the client receives no operator token.
  phase='client entry';await page.goto(cfg.origin+'/#/ensayo/cliente');
  await page.getByLabel('Pase de cliente',{exact:true}).fill(pass);await page.getByRole('button',{name:'Entrar al ensayo',exact:true}).click();
  await page.getByRole('heading',{name:'Inicia tu expediente',exact:true}).waitFor();
  check('Client form renders fictional identity and controlled email',await page.getByLabel('Email',{exact:true}).inputValue()==='soluzziona@gmail.com');
  check('Consents start unchecked',!await page.getByLabel('Deseo generar la autorización RTM vinculada a este expediente.').isChecked());
  await capture('01-entrada-cliente');
  await page.locator('input[type=file]').nth(0).setInputFiles(pdfFile(path.join(cfg.fixtures,'IDENTIDAD_FICTICIA_FRONT.pdf')));
  await page.locator('input[type=file]').nth(1).setInputFiles(pdfFile(path.join(cfg.fixtures,'IDENTIDAD_FICTICIA_BACK.pdf')));
  await page.getByLabel('Deseo generar la autorización RTM vinculada a este expediente.').check();
  await page.getByLabel('Acepto la política de privacidad y confirmo que los datos son correctos.').check();
  phase='intake';await page.getByRole('button',{name:'Crear expediente',exact:true}).click();
  await page.getByText('Expediente: '+cfg.case_id,{exact:true}).waitFor();check('Client form creates exactly configured new case',newCase===cfg.case_id);
  phase='original before authorization';
  check('Authorization cannot be issued before the original',await page.getByRole('button',{name:'Confirmar autorización y descargar',exact:true}).count()===0);
  await page.locator('input[type=file]').nth(2).setInputFiles(pdfFile(path.join(cfg.fixtures,'NOTIFICACION_FICTICIA_RTM_20261106.pdf')));
  await page.getByRole('button',{name:'Guardar documento del caso',exact:true}).click();
  await page.getByLabel('Confirmo generar la autorización con los datos revisados de este expediente ficticio.').check();
  await page.getByLabel('Confirmo la política de privacidad para el ensayo.').check();
  phase='authorization';const generated=page.waitForEvent('download');await page.getByRole('button',{name:'Confirmar autorización y descargar',exact:true}).click();
  const generatedPdf=await generated;await generatedPdf.saveAs(path.join(out,'autorizacion-ficticia.pdf'));
  check('Current ordinary authorization returned a readable PDF',fs.readFileSync(path.join(out,'autorizacion-ficticia.pdf')).subarray(0,4).toString()==='%PDF');
  const candidateEvent=page.waitForEvent('download');await page.getByRole('button',{name:'Descargar candidato de firma ficticia',exact:true}).click();
  const candidate=await candidateEvent;const candidatePath=path.join(out,'candidato-firma-ficticia.pdf');await candidate.saveAs(candidatePath);
  await page.locator('input[type=file]').nth(2).setInputFiles(pdfFile(candidatePath));
  await page.getByRole('button',{name:'Subir autorización firmada',exact:true}).click();
  await page.getByRole('button',{name:'Ver resumen del expediente',exact:true}).waitFor();await capture('02-autorizacion-recibida');
  phase='reload';await page.reload();await page.getByLabel('Pase de cliente',{exact:true}).fill(pass);await page.getByRole('button',{name:'Entrar al ensayo',exact:true}).click();
  await page.getByRole('button',{name:'Ver resumen del expediente',exact:true}).waitFor();
  check('Reload retains same case, authority binding and uploaded candidate',requests.filter(r=>r.method==='POST'&&r.path.endsWith('/intake-draft')).length===1);
  phase='client summary';await page.getByRole('button',{name:'Ver resumen del expediente',exact:true}).click();
  await page.getByRole('heading',{name:'Resumen del expediente',exact:true}).waitFor();
  await page.getByText('La autorización firmada está pendiente de revisión humana.',{exact:true}).waitFor();
  check('Same-case client summary shows truthful pending signature state',page.url().includes(cfg.case_id));
  check('No Checkout is offered or called before signature verification',requests.every(r=>!r.path.endsWith('/billing/checkout')));
  await capture('03-resumen-cliente-pendiente-revision');
  phase='separate operator login';await page.goto(cfg.origin+'/#/ops/case/'+cfg.case_id);
  await page.getByLabel('Email de operador').fill('operator@example.com');await page.getByLabel('Contraseña',{exact:true}).fill(cfg.password);await page.getByRole('button',{name:'Entrar en OPS',exact:true}).click();
  await page.getByTestId('paid-case-workspace').waitFor();check('Separate operator login opens exactly the client-created case',page.url().endsWith(cfg.case_id));
  await page.getByRole('button',{name:'Estudio',exact:true}).click();await page.getByLabel('Valoración del asunto',{exact:true}).waitFor();
  check('Study heading does not claim a payment that has not occurred',await page.getByRole('heading',{name:'Estudio inicial pagado',exact:true}).count()===0);
  check('Unpaid case cannot save paid study',await page.getByRole('button',{name:'Guardar valoración',exact:true}).isDisabled());await capture('04-ops-estudio-sin-pago');
  await page.getByRole('button',{name:'Presupuesto y pagos',exact:true}).click();await page.getByText('No se ha completado la operación (MANAGEMENT_JOURNEY_NOT_ENABLED).',{exact:true}).waitFor();
  await capture('05-ops-presupuesto-desactivado');check('Management disabled is visible and not mistaken for a working budget');
  passed=true;
}catch(e){console.error(JSON.stringify({phase,type:e.name,message:e.message}));if(page)try{await capture('failure');}catch{}}
finally{if(browser)await browser.close();fs.writeFileSync(path.join(out,'RESULTADO.json'),JSON.stringify({passed,phase,scope:'LOCAL app and PG; synthetic custody; no external payment/mail/AI; no deployment validation',case_id:newCase,checks,requests,screenshots,browser_closed:true},null,2));}
process.exitCode=passed?0:1;
