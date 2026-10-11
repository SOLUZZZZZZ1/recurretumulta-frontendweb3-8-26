// Local browser verification. All API responses are intercepted synthetic data.
// Usage: node scripts/verify-ops-saved-case-data-browser.mjs PLAYWRIGHT_MODULE FIXTURE_JSON EVIDENCE_DIR
import assert from "node:assert/strict";
import { readFile, writeFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createServer } from "vite";
import react from "@vitejs/plugin-react";
import { PUBLIC_SERVICE_FAMILIES } from "../src/data/publicServices.js";

const [modulePath, fixturePath, evidenceDirectory] = process.argv.slice(2);
if (!modulePath || !fixturePath || !evidenceDirectory) throw new Error("Provide local Playwright module, synthetic fixture and evidence directory");
const { chromium } = await import(pathToFileURL(resolve(modulePath)).href);
const fixture = JSON.parse(await readFile(fixturePath, "utf8"));
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const A = fixture.case_id, B = "44444444-4444-4444-8444-444444444444";
assert.equal(fixture.case.authorized, false);
assert.ok(fixture.case.identity.full_name.includes("FICTICIA"));
const mockAuth = `import React, {createContext,useContext,useState} from 'react';
const Context=createContext(null);
const authFetch=(url,options)=>window.fetch(url,options);
export function OpsTestProvider({children}){
 const [session,setSession]=useState({sessionId:'synthetic-session-1'});
 window.rtmTestSetSession=setSession;
 return React.createElement(Context.Provider,{value:{session,authFetch,canSupervise:true}},children);
}
export function useOpsAuth(){return useContext(Context);}`;
const server = await createServer({ root, configFile: false, plugins: [{
  name: "synthetic-ops-verification", enforce: "pre",
  load(id) { if (id.replaceAll("\\", "/").split("?")[0].endsWith("/src/ops-auth/OpsAuthContext.jsx")) return mockAuth; },
  configureServer(instance) {
    instance.middlewares.use("/__rtm_case_test__", (_request, response) => {
      response.setHeader("Content-Type", "text/html; charset=utf-8");
      response.end(`<!doctype html><meta charset="utf-8"><div id="root"></div><script>window.rtmInitialCase=${JSON.stringify(A)}</script><script type="module" src="/scripts/fixtures/opsSavedCaseHarness.jsx"></script>`);
    });
  },
}, react()], server: { host: "127.0.0.1", port: 0, hmr: false, strictPort: true } });
let browser;
const results=[], requests=[], consoleErrors=[];
try {
  await server.listen();
  const origin=`http://127.0.0.1:${server.httpServer.address().port}`;
  browser=await chromium.launch({ executablePath: process.env.RTM_TEST_BROWSER_EXECUTABLE || "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", headless:true });
  const context=await browser.newContext({viewport:{width:1440,height:1000}});
  await context.route("**/*", route => new URL(route.request().url()).origin===origin ? route.continue() : route.abort());
  const page=await context.newPage();
  page.on("pageerror", error=>consoleErrors.push(error.message));
  const payloads=new Map([[A,structuredClone(fixture)], [B,{...structuredClone(fixture),case_id:B}]]);
  payloads.get(B).case.identity.full_name="Beatriz Segunda FICTICIA";
  let mode="normal", delayed=[];
  const fulfill=(route,body,status=200)=>route.fulfill({status,contentType:"application/json",body:JSON.stringify(body)});
  await page.route("**/api/**", async route=>{
    const request=route.request(), path=new URL(request.url()).pathname;
    requests.push({method:request.method(),path});
    if(path.endsWith("/workspace")){
      const id=path.split("/").at(-2);
      if(mode==="delay"){delayed.push({route,id});return;}
      if(mode==="error")return fulfill(route,{detail:"Synthetic unavailable"},500);
      if(mode==="wrong")return fulfill(route,payloads.get(A));
      return fulfill(route,payloads.get(id));
    }
    if(path.endsWith("/payment-status"))return fulfill(route,{ok:true,case_id:path.split("/").at(-2),payment_status:null});
    if(path.endsWith("/documents"))return fulfill(route,{documents:[{id:"synthetic-c01-document",kind:"Documento sintético independiente C01",mime:"application/pdf"}]});
    if(path.endsWith("/events"))return fulfill(route,{events:[]});
    if(path.endsWith("/followups"))return fulfill(route,{followups:[]});
    return fulfill(route,{id:path.split("/").at(-1),authorization_evidence_status:"not_authorized",signed_authority_verified:false});
  });
  const text=()=>page.locator("body").innerText();
  const waitName=name=>page.getByText(name,{exact:true}).waitFor();
  const refresh=()=>page.getByRole("button",{name:/Actualizar/}).first().click();
  await page.goto(origin+"/__rtm_case_test__");
  await waitName("Ángela Peña FICTICIA");
  assert.ok((await text()).includes("Óscar Contacto FICTICIO"));
  const interested=await page.getByRole("region",{name:"Persona interesada",exact:true}).innerText();
  assert.ok(interested.includes("00123")&&interested.includes("007")&&interested.includes("02"));
  assert.ok(!interested.includes("contacto@example.com"));
  assert.ok((await text()).includes("Datos guardados del expediente"));
  results.push("Real OPS component renders the backend synthetic fixture with authorization pending and distinct contact");
  await page.screenshot({path:resolve(evidenceDirectory,"ops-saved-data-synthetic.png"),fullPage:true});
  for(const family of PUBLIC_SERVICE_FAMILIES.filter(item=>item.intake)){
    payloads.get(A).case.public_service_family=family.id;
    await refresh(); await waitName("Ángela Peña FICTICIA");
    assert.equal(await page.locator("dt",{hasText:"Área pública guardada"}).locator("+ dd").innerText(),family.title);
  }
  results.push("All eight families displayed without changing classification or authorization");
  mode="delay"; await refresh();
  await page.waitForFunction(()=>!document.body.innerText.includes("Ángela Peña FICTICIA"));
  await page.evaluate(id=>window.rtmTestNavigate(`/ops/case/${id}`),B);
  await page.waitForFunction(()=>!document.body.innerText.includes("Ángela Peña FICTICIA"));
  await new Promise((resolve,reject)=>{const start=Date.now();const tick=()=>delayed.some(x=>x.id===B)?resolve():Date.now()-start>5000?reject(new Error("Missing delayed B")):setTimeout(tick,10);tick();});
  mode="normal";
  for(const item of delayed.filter(x=>x.id===B))await fulfill(item.route,payloads.get(B));
  await waitName("Beatriz Segunda FICTICIA");
  for(const item of delayed.filter(x=>x.id===A))await fulfill(item.route,payloads.get(A)).catch(()=>{});
  delayed=[];
  assert.ok(!(await text()).includes("Ángela Peña FICTICIA"));
  results.push("Case switch clears the previous record and ignores late responses");
  mode="error";await refresh();
  await page.getByText("❌ No se pudo cargar el espacio jurídico del expediente.",{exact:true}).waitFor();
  assert.ok(!(await text()).includes("Beatriz Segunda FICTICIA"));
  results.push("Failed refresh removes previously recovered personal data");
  mode="wrong";await refresh();
  await page.getByText("❌ No se pudo cargar el espacio jurídico del expediente.",{exact:true}).waitFor();
  assert.ok(!(await text()).includes("Ángela Peña FICTICIA"));
  results.push("A successful response with another case_id is rejected");
  mode="normal";
  const addressKeys=["street","street_number","floor","door","postal_code","city","province"];
  const nullIdentity=()=>({full_name:null,dni_nie:null,address:null,
    address_parts:Object.fromEntries(addressKeys.map(key=>[key,null]))});
  const savedPanel=()=>page.getByRole("region",{name:"Datos guardados del expediente",exact:true});
  const restoreB=()=>{const value=structuredClone(fixture);value.case_id=B;
    value.case.identity.full_name="Beatriz Segunda FICTICIA";payloads.set(B,value);return value;};
  restoreB().case.identity=nullIdentity();
  await refresh();await savedPanel().getByRole("region",{name:"Persona interesada",exact:true}).waitFor();
  const absent=await page.getByRole("region",{name:"Persona interesada",exact:true}).innerText();
  assert.ok(absent.includes("No consta")&&!absent.includes("Óscar"));
  assert.equal(await savedPanel().getByRole("alert").count(),0);
  assert.equal(await savedPanel().locator("dt",{hasText:"Email de contacto"}).locator("+ dd").innerText(),fixture.case.contact.email);
  results.push("Explicit null identity and address remain absent without using the distinct contact as a substitute");

  const allNull=restoreB().case;
  allNull.identity=nullIdentity();
  allNull.contact={name:null,email:null,phone:null,preferred_contact:null};
  allNull.customer_comment=null;allNull.public_service_family=null;
  await refresh();await savedPanel().getByRole("region",{name:"Persona interesada",exact:true}).waitFor();
  assert.deepEqual(await savedPanel().locator("dd").allTextContents(),Array(16).fill("No consta"));
  assert.equal(await savedPanel().getByRole("alert").count(),0);
  await page.screenshot({path:resolve(evidenceDirectory,"ops-saved-data-null.png"),fullPage:true});
  results.push("Complete response with all 16 visible values null is accepted and displays No consta");

  async function assertInvalidProjection(mutate,screenshot){
    restoreB();await refresh();await waitName("Beatriz Segunda FICTICIA");
    mutate(payloads.get(B).case);
    await refresh();
    await savedPanel().getByText("Datos no disponibles: la lectura de los datos guardados está incompleta o no es válida. Actualiza el expediente.",{exact:true}).waitFor();
    const panelText=await savedPanel().innerText();
    assert.ok(!panelText.includes("No consta")&&!panelText.includes("Datos actuales recuperados"));
    assert.equal(await savedPanel().locator("dd").count(),0);
    for(const prior of ["Beatriz Segunda FICTICIA","Óscar Contacto FICTICIO",fixture.case.contact.email]){
      assert.ok(!(await text()).includes(prior),"Previous personal data must be removed: "+prior);
    }
    await page.getByText("Documento sintético independiente C01",{exact:true}).waitFor();
    if(screenshot)await page.screenshot({path:resolve(evidenceDirectory,screenshot),fullPage:true});
  }
  const missingCases=[
    c=>delete c.contact.email, c=>delete c.identity.full_name,
    c=>delete c.identity.address_parts.postal_code, c=>delete c.identity.address_parts,
    c=>delete c.customer_comment, c=>delete c.public_service_family,
  ];
  for(const [index,mutate] of missingCases.entries()){
    await assertInvalidProjection(mutate,index===0?"ops-saved-data-missing-key.png":null);
  }
  results.push("Six omitted-key responses, including contact.email and nested address fields, show an incomplete-read warning; no No consta or stale data");

  const invalidTypes=[
    c=>c.contact.email=123, c=>c.contact.phone=false,
    c=>c.identity.full_name=[], c=>c.identity.address={},
    c=>c.identity.address_parts.street_number=7, c=>c.identity.address_parts=[],
    c=>c.contact=null, c=>c.identity=false,
    c=>c.customer_comment={}, c=>c.public_service_family=true,
  ];
  for(const [index,mutate] of invalidTypes.entries()){
    await assertInvalidProjection(mutate,index===0?"ops-saved-data-invalid-type.png":null);
  }
  results.push("Ten incompatible-field/container responses show an invalid-read warning; never confirmed absence or stale data");
  results.push("Independent document reads still render while the saved-data projection is rejected");

  restoreB();await refresh();await waitName("Beatriz Segunda FICTICIA");
  await page.evaluate(()=>window.rtmTestSetSession(null));
  await page.waitForFunction(()=>!document.body.innerText.includes("Óscar Contacto FICTICIO"));
  results.push("Session invalidation removes the saved-data view");
  assert.ok(requests.length>0&&requests.every(request=>request.method==="GET"));
  assert.deepEqual(consoleErrors,[]);
  results.push("Only GET requests; no authorization, payment, presentation or IA execution");
  await writeFile(resolve(evidenceDirectory,"browser-results.json"),JSON.stringify({kind:"synthetic_browser_with_intercepted_API",results,requests,consoleErrors,realPersistenceVerified:false},null,2),{flag:"wx"});
  console.log(JSON.stringify({passed:results.length,results,requests:requests.length,consoleErrors,realPersistenceVerified:false},null,2));
} finally {await browser?.close();await server.close();}
