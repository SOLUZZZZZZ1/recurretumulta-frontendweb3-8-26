import test, {beforeEach} from "node:test";
import assert from "node:assert/strict";
import { prepareOpsSummaryAccess } from "../src/lib/opsSummaryAccess.js";
import { getCaseAccessToken, rememberCaseAccessToken } from "../src/lib/caseAccess.js";
import { REHEARSAL_VERSION } from "../src/lib/stagingRehearsal.js";

const id="11111111-1111-5111-8111-111111111111";
const other="22222222-2222-5222-8222-222222222222";
const token="v1."+"a".repeat(64);
let storage;
beforeEach(()=>{
  storage=new Map();
  globalThis.window={sessionStorage:{getItem:key=>storage.get(key)||"",setItem:(key,value)=>storage.set(key,value)}};
});
const payload=()=>({ok:true,version:REHEARSAL_VERSION,synthetic_only:true,case_id:id,
  case_access_token_header:"X-RTM-Case-Token",case_access_token:token});
const response=(data=payload(),status=200)=>new Response(JSON.stringify(data),{status,headers:{"Content-Type":"application/json"}});

test("new tab recovers its trial capability through one authenticated fixed route",async()=>{
  const calls=[];
  const path=await prepareOpsSummaryAccess({caseId:id,authFetch:async(...args)=>{calls.push(args);return response();}});
  assert.equal(calls.length,1);
  assert.equal(calls[0][0],"/api/ops/rehearsal/radar/cases/"+id+"/payment-access");
  assert.equal(calls[0][1].method,"POST");
  assert.equal(getCaseAccessToken(id),token);
  assert.equal(getCaseAccessToken(other),"");
  assert.equal(path,"/resumen?case="+id);
  assert.ok(!path.includes(token));
});

test("an existing private continuation access needs no additional operator request",async()=>{
  rememberCaseAccessToken(id,token);
  const path=await prepareOpsSummaryAccess({caseId:id,authFetch:()=>{throw new Error("Unexpected request");}});
  assert.equal(path,"/resumen?case="+id);
});

test("foreign or malformed recovery envelopes never become browser capabilities",async()=>{
  for(const change of [{case_id:other},{version:"old"},{synthetic_only:false},
      {case_access_token_header:"Authorization"},{extra:"field"},{case_access_token:"not-a-capability"}]){
    await assert.rejects(prepareOpsSummaryAccess({caseId:id,authFetch:async()=>response({...payload(),...change})}));
    assert.equal(storage.size,0);
  }
});

test("a denied or unavailable recovery cannot produce a summary path",async()=>{
  for(const status of [403,404,409,503]){
    await assert.rejects(prepareOpsSummaryAccess({caseId:id,authFetch:async()=>response({detail:"Unavailable"},status)}));
    assert.equal(storage.size,0);
  }
});

test("an aborted recovery never stores the returned capability",async()=>{
  const controller=new AbortController();
  await assert.rejects(prepareOpsSummaryAccess({caseId:id,signal:controller.signal,
    authFetch:async()=>{controller.abort();return response();}}),{name:"AbortError"});
  assert.equal(storage.size,0);
});

test("blocked tab storage prevents navigating with unusable access",async()=>{
  globalThis.window.sessionStorage.setItem=()=>{throw new Error("Storage blocked");};
  await assert.rejects(prepareOpsSummaryAccess({caseId:id,authFetch:async()=>response()}));
  assert.equal(storage.size,0);
});

test("invalid case identifiers never make an operator request",async()=>{
  let calls=0;
  for(const caseId of ["","../"+id,"https://other.invalid/"+id,id+"?other="+other]){
    await assert.rejects(prepareOpsSummaryAccess({caseId,authFetch:async()=>{calls++;return response();}}));
  }
  assert.equal(calls,0);
});
