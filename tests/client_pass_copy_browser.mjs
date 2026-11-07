// Focused UI check: actual React components, synthetic API and in-memory clipboard.
// No user browser profile, system clipboard, remote network or real access pass.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const root=path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out=path.resolve(process.argv[2]);fs.mkdirSync(out,{recursive:true});
const {chromium}=await import(pathToFileURL('C:/Users/soluz/rtm102026/backend/.venv/browser-tools/node_modules/playwright-core/index.mjs').href);
const origin='http://127.0.0.1:19999',pass=`v2.1794048000.${'1'.repeat(32)}.${'2'.repeat(64)}`;
const caseId='11111111-1111-4111-8111-111111111111';
const bundle=await build({stdin:{contents:`
import React from 'react';import {createRoot} from 'react-dom/client';
import {HashRouter,Routes,Route} from 'react-router-dom';import {HelmetProvider} from 'react-helmet-async';
import Ops from './src/components/OpsClientRehearsal.jsx';import Client from './src/pages/StagingClient.jsx';
createRoot(document.getElementById('root')).render(<HelmetProvider><HashRouter><p>PRUEBA LOCAL: API y portapapeles simulados; pase ficticio.</p><Routes><Route path="/ops" element={<Ops authFetch={(url,opts)=>fetch(url,opts)}/>}/><Route path="/ensayo/cliente" element={<Client/>}/></Routes></HashRouter></HelmetProvider>);
`,resolveDir:root,sourcefile:'client-pass-copy-fixture.jsx',loader:'jsx'},bundle:true,write:false,format:'iife',jsx:'automatic',define:{'process.env.NODE_ENV':'"development"'},logLevel:'silent'});
const js=Buffer.from(bundle.outputFiles[0].contents);
let browser,passed=false,phase='start';const checks=[],screenshots=[],requests=[];
const check=(name,condition)=>{assert.ok(condition,name);checks.push(name);};
try{
  browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',headless:true,args:['--disable-background-networking','--disable-component-update','--disable-sync']});
  const context=await browser.newContext({viewport:{width:1200,height:820}});
  await context.addInitScript(()=>{
    let value='';window.__denyClipboard=false;
    Object.defineProperty(navigator,'clipboard',{configurable:true,value:{
      async writeText(text){if(window.__denyClipboard)throw new DOMException('Denied','NotAllowedError');value=text;},
      async readText(){return value;}
    }});
  });
  await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());
    if(url.origin!==origin)return route.abort();
    if(url.pathname==='/fixture.js')return route.fulfill({contentType:'application/javascript',body:js});
    if(url.pathname==='/api/ops/rehearsal/client/access'){
      requests.push({path:url.pathname,method:req.method()});
      return route.fulfill({json:{ok:true,version:'rtm_client_rehearsal_20261106_v1',synthetic_only:true,case_id:caseId,client_pass:pass}});
    }
    if(url.pathname==='/api/staging/client/profile'){
      const headers=await req.allHeaders();check('Client sends the complete copied pass only in its header',headers['x-rtm-client-pass']===pass);
      check('Private pass is absent from request URL',!req.url().includes(pass));requests.push({path:url.pathname,method:req.method()});
      return route.fulfill({json:{ok:true,version:'rtm_client_rehearsal_20261106_v1',synthetic_only:true,payment_mode:'test',case_id:caseId,existing:false,
        fields:{department:'traffic',full_name:'PERSONA FICTICIA',email:'client@example.invalid'},fixtures:Object.fromEntries(['original','identity_front','identity_back'].map(k=>[k,{filename:k+'.pdf'}]))}});
    }
    if(url.pathname.startsWith('/api/'))return route.abort();
    return route.fulfill({contentType:'text/html',body:'<!doctype html><html lang="es"><div id="root"></div><script src="/fixture.js"></script></html>'});
  });
  const page=await context.newPage();page.setDefaultTimeout(18000);
  page.on('pageerror',error=>console.error(JSON.stringify({phase,type:'pageerror',message:error.message.slice(0,300)})));
  phase='copy';await page.goto(origin+'/#/ops',{waitUntil:'domcontentloaded'});await page.getByText('Ensayo nuevo desde cliente',{exact:true}).click();
  await page.getByRole('button',{name:'Preparar pase de cliente',exact:true}).click();
  const field=page.getByLabel('Pase de cliente',{exact:true});await field.waitFor();
  check('Pass stays masked by default',await field.getAttribute('type')==='password');
  await page.getByRole('button',{name:'Copiar pase',exact:true}).click();
  await page.getByRole('status').filter({hasText:'Pase copiado.'}).waitFor();
  const copied=await page.evaluate(()=>navigator.clipboard.readText());check('Copy button writes the full pass, not mask characters',copied===pass);
  check('Copying does not request a second pass',requests.filter(r=>r.path.endsWith('/access')).length===1);
  await page.screenshot({path:path.join(out,'01-pase-copiado.png'),fullPage:true});screenshots.push('01-pase-copiado.png');
  phase='paste';const popupPromise=page.waitForEvent('popup');await page.getByRole('link',{name:'Abrir recorrido de cliente',exact:true}).click();
  const client=await popupPromise;await client.waitForLoadState();
  await client.getByLabel('Pase de cliente',{exact:true}).fill(copied);await client.getByRole('button',{name:'Entrar al ensayo',exact:true}).click();
  await client.getByRole('heading',{name:'Inicia tu expediente',exact:true}).waitFor();
  check('Copied pass opens the client form',await client.getByLabel('Email',{exact:true}).inputValue()==='client@example.invalid');
  await client.screenshot({path:path.join(out,'02-entrada-cliente.png'),fullPage:true});screenshots.push('02-entrada-cliente.png');
  phase='invalid pass';await client.reload();await client.getByLabel('Pase de cliente',{exact:true}).fill('••••••••••••');
  await client.getByRole('button',{name:'Entrar al ensayo',exact:true}).click();await client.getByRole('alert').filter({hasText:'Copiar pase'}).waitFor();
  check('Mask characters are rejected locally without sending a profile request',requests.filter(r=>r.path.endsWith('/profile')).length===1);
  phase='clipboard denied';await page.evaluate(()=>{window.__denyClipboard=true;});
  await page.getByRole('button',{name:'Copiar pase',exact:true}).click();await page.getByRole('status').filter({hasText:'No se pudo copiar'}).waitFor();
  check('Clipboard failure never claims success',!(await page.getByRole('status').innerText()).includes('Pase copiado.'));
  await page.getByRole('button',{name:'Mostrar pase',exact:true}).click();await field.click();
  check('Manual fallback selects the whole visible pass',await field.evaluate(el=>el.type==='text'&&el.selectionStart===0&&el.selectionEnd===el.value.length));
  await page.getByRole('button',{name:'Ocultar pase',exact:true}).click();
  await page.screenshot({path:path.join(out,'03-alternativa-copia.png'),fullPage:true});screenshots.push('03-alternativa-copia.png');
  passed=true;
}catch(e){console.error(JSON.stringify({phase,type:e.name,message:e.message}));}
finally{if(browser)await browser.close();fs.writeFileSync(path.join(out,'RESULTADO.json'),JSON.stringify({passed,phase,checks,requests,screenshots,browser_closed:true,scope:'LOCAL actual React components; synthetic API and in-memory clipboard; no system clipboard or remote journey validation'},null,2));}
process.exitCode=passed?0:1;
