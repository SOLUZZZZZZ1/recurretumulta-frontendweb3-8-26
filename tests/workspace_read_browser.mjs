// Full real React application in an isolated headless browser. API/auth simulated.
import { pathToFileURL, fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";
import assert from "node:assert/strict";
import net from "node:net";
import { createServer, build } from "vite";
import react from "@vitejs/plugin-react";
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),"..");
const output=path.resolve(process.argv[2]);
const pwModule=process.argv[3];
const {chromium}=await import(pathToFileURL(pwModule).href);
const fixture=JSON.parse(fs.readFileSync(path.join(root,"tests/fixtures/workspace_read.json"),"utf8"));
const A=fixture.a.case_id,B=fixture.b.case_id;
fs.mkdirSync(output,{recursive:true});
const check=net.createServer();
await new Promise((ok,bad)=>{check.once("error",bad);check.listen(5189,"127.0.0.1",ok)});
await new Promise(ok=>check.close(ok));
let server,browser;
const results=[], contexts=[];
const config={root,configFile:false,envDir:false,plugins:[react()],cacheDir:path.join(output,"vite-cache"),
  server:{host:"127.0.0.1",port:5189,strictPort:true},logLevel:"warn"};
try {
  await build({...config,build:{outDir:path.join(output,"build"),emptyOutDir:false}});
  server=await createServer(config);await server.listen();
  const origin="http://127.0.0.1:5189";
  browser=await chromium.launch({executablePath:process.env.WORKSPACE_BROWSER_PATH || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    headless:true,args:["--disable-background-networking","--disable-component-update","--disable-sync"]});
  async function scenario(name,handler,check,{authenticated=true}={}) {
    const context=await browser.newContext();contexts.push(context);
    const calls=[], errors=[];
    if(authenticated)await context.addInitScript(()=>localStorage.setItem("ops_token","synthetic-browser-fixture"));
    await context.route("**/*",async route=>{
      const req=route.request(),u=new URL(req.url());
      if(u.origin!==origin){await route.abort();return}
      if(!u.pathname.startsWith("/api/")){await route.continue();return}
      calls.push({path:u.pathname,method:req.method()});
      assert.equal(req.headers()["x-rtm-workspace-contract"],"rtm_ops_workspace_read_v1");
      if(req.method()!=="GET"){await route.abort();errors.push("mutation");return}
      if(!u.pathname.endsWith("/workspace")){await route.fulfill({status:503,json:{detail:"Unexpected API request"}});errors.push("unexpected_api");return}
      await handler(route,u);
    });
    const page=await context.newPage();
    page.setDefaultTimeout(10000);
    page.on("pageerror",err=>errors.push(err.message));
    await page.goto(origin+"/#/ops/case/"+A);
    await check(page,calls);
    assert.deepEqual(errors,[],name+" errors");
    assert.ok(calls.every(x=>x.method==="GET"));
    results.push({name,passed:true,api_requests:calls,scope:"real full React DOM; synthetic intercepted API/auth"});
    await context.close();
  }
  const response=(body,status=200)=>async route=>route.fulfill({status,json:body});
  const loaded=async(page,name="Interesado A")=>{await page.getByTestId("workspace-read").waitFor();await page.getByText(name,{exact:true}).waitFor()};
  await scenario("200 authentic saved-field contract; contact distinct; no export or writes",response(fixture.a),async(p,c)=>{
    await loaded(p);
    await p.getByText("Contacto 1",{exact:true}).waitFor();
    assert.equal(await p.getByRole("button",{name:/descargar|presentar|generar|aprobar|zip/i}).count(),0);
    assert.ok((await p.locator("body").innerText()).includes("Evaluación jurídica no disponible"));
    assert.ok(c.every(x=>x.path.endsWith("/workspace")));
    await p.screenshot({path:path.join(output,"workspace_sintetico.png"),fullPage:true});
  });
  await scenario("no credential: no API reads",response(fixture.a),async(p,c)=>{
    await p.getByRole("heading",{name:"Acceso de operador necesario"}).waitFor();
    assert.equal(c.length,0);
  },{authenticated:false});
  for(const status of [401,403]) await scenario("access "+status+" removes private context",response({detail:"denied"},status),async p=>{
    await p.getByRole("heading",{name:"Acceso de operador necesario"}).waitFor();
    assert.equal(await p.getByTestId("workspace-read").count(),0);
    assert.equal(await p.evaluate(()=>localStorage.getItem("ops_token")),null);
  });
  for(const [label,status,body,expected] of [
    ["case missing",404,{detail:{code:"WORKSPACE_CASE_NOT_FOUND"}},"Expediente no encontrado."],
    ["route missing",404,{detail:"Not Found"},"La ruta de detalle no está disponible."],
    ["SQL unavailable",503,{detail:{code:"WORKSPACE_READ_FAILED"}},"No se ha podido leer el expediente."],
    ["server error",500,{detail:"do-not-show-secret"},"No se ha podido leer el expediente."],
    ["malformed 200",200,{ok:true},"Respuesta de detalle no disponible o inválida."],
    ["wrong case",200,fixture.b,"Respuesta de detalle no disponible o inválida."],
  ])await scenario(label,response(body,status),async p=>{
    await p.getByRole("alert").filter({hasText:expected}).waitFor();
    assert.equal(await p.getByTestId("workspace-read").count(),0);
    assert.ok(!(await p.locator("body").innerText()).includes("do-not-show-secret"));
  });
  await scenario("network error",async route=>route.abort(),async p=>{
    await p.getByRole("alert").filter({hasText:"Respuesta de detalle"}).waitFor();
  });
  const missing=structuredClone(fixture.a);
  missing.sections.documents={status:"schema_unavailable",items:null,missing_columns:["id"]};
  await scenario("unavailable schema not empty",response(missing),async p=>{
    await loaded(p);await p.getByText(/No se acredita ausencia de registros/).waitFor();
  });
  const empty=structuredClone(fixture.a);empty.sections.documents={status:"empty",items:[],missing_columns:[],truncated:false};
  await scenario("known empty collection",response(empty),async p=>{
    await loaded(p);assert.ok(await p.getByText("Sin registros en la lectura completada.",{exact:true}).count()>=1);
  });
  let release;
  const gate=new Promise(resolve=>release=resolve);
  await scenario("late case A discarded after navigation to B",async(route,u)=>{
    if(u.pathname.includes(A)){await gate;await route.fulfill({json:fixture.a}).catch(()=>{});}
    else await route.fulfill({json:fixture.b});
  },async(p,c)=>{
    await p.waitForFunction(()=>document.body.innerText.includes("Cargando"));
    await p.evaluate(id=>location.hash="/ops/case/"+id,B);
    await loaded(p,"Interesado B");
    release();await p.waitForTimeout(150);
    assert.equal(await p.getByText("Interesado A",{exact:true}).count(),0);
  });
  await scenario("loaded case cleared on switch, then B only",async(route,u)=>route.fulfill({json:u.pathname.includes(A)?fixture.a:fixture.b}),async p=>{
    await loaded(p);await p.evaluate(id=>location.hash="/ops/case/"+id,B);await loaded(p,"Interesado B");
    assert.equal(await p.getByText("Interesado A",{exact:true}).count(),0);
  });
  await scenario("logout removes loaded private data",response(fixture.a),async p=>{
    await loaded(p);await p.evaluate(()=>{localStorage.removeItem("ops_token");window.dispatchEvent(new Event("storage"))});
    await p.getByRole("heading",{name:"Acceso de operador necesario"}).waitFor();
    assert.equal(await p.getByText("Interesado A",{exact:true}).count(),0);
  });
  let releaseLogout;
  const gateLogout=new Promise(resolve=>releaseLogout=resolve);
  await scenario("late response after logout cannot restore data",async route=>{
    await gateLogout;await route.fulfill({json:fixture.a}).catch(()=>{});
  },async p=>{
    await p.waitForFunction(()=>document.body.innerText.includes("Cargando"));
    await p.evaluate(()=>{localStorage.removeItem("ops_token");window.dispatchEvent(new Event("storage"))});
    await p.getByRole("heading",{name:"Acceso de operador necesario"}).waitFor();
    releaseLogout();await p.waitForTimeout(150);
    assert.equal(await p.getByTestId("workspace-read").count(),0);
  });
  let failRefresh=false;
  let releaseSession;
  const gateSession=new Promise(resolve=>releaseSession=resolve);
  const newSessionFixture=structuredClone(fixture.a);
  newSessionFixture.case.identities.interested.full_name.value="Interesado A sesión nueva";
  await scenario("late old session response cannot replace a new session",async route=>{
    if(route.request().headers()["x-operator-token"]==="synthetic-browser-fixture"){
      await gateSession;await route.fulfill({json:fixture.a}).catch(()=>{});
    } else await route.fulfill({json:newSessionFixture});
  },async p=>{
    await p.waitForFunction(()=>document.body.innerText.includes("Cargando"));
    await p.evaluate(()=>{localStorage.setItem("ops_token","new-synthetic-session");window.dispatchEvent(new Event("storage"))});
    await loaded(p,"Interesado A sesión nueva");
    releaseSession();await p.waitForTimeout(150);
    assert.equal(await p.getByText("Interesado A",{exact:true}).count(),0);
  });
  await scenario("failed refresh withdraws prior data",async(route,u)=>{
    await route.fulfill({status:failRefresh?500:200,json:failRefresh?{detail:"error"}:fixture.a});
  },async p=>{
    // StrictMode can cancel the first request; use a controlled switch after load instead below.
    await loaded(p);
    failRefresh=true;
    await p.getByRole("button",{name:"Actualizar lectura"}).click();
    await p.getByRole("alert").waitFor();
    assert.equal(await p.getByText("Interesado A",{exact:true}).count(),0);
  });
  fs.writeFileSync(path.join(output,"browser_results.json"),JSON.stringify({passed:results.length,results},null,2));
  console.log(JSON.stringify({passed:results.length,output}));
} finally {
  for(const c of contexts)await c.close().catch(()=>{});
  if(browser)await browser.close();
  if(server)await server.close();
  fs.writeFileSync(path.join(output,"closure.json"),JSON.stringify({browser_closed:true,server_closed:true,port:5189}));
}
