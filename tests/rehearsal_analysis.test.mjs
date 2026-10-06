import assert from "node:assert/strict";
import test from "node:test";
import { runRehearsalAnalysis } from "../src/lib/rehearsalAnalysis.js";
import { REHEARSAL_VERSION } from "../src/lib/stagingRehearsal.js";
const id="11111111-1111-4111-8111-111111111111";
const data={ok:true,version:REHEARSAL_VERSION,synthetic_only:true,case_id:id,analysis_status:"completed",reused:false,requires_human_review:true};
const response=(payload,status=200)=>new Response(JSON.stringify(payload),{status});
test("rehearsal analysis requests only its fixed case without client overrides",async()=>{
  const calls=[];
  const result=await runRehearsalAnalysis({caseId:id,authFetch:async(...args)=>{calls.push(args);return response(data)}});
  assert.deepEqual(result,{reused:false});
  assert.equal(calls[0][0],"/api/ops/rehearsal/radar/cases/"+id+"/analysis");
  assert.deepEqual(calls[0][1],{method:"POST",signal:undefined});
  assert.deepEqual(await runRehearsalAnalysis({caseId:id,authFetch:async()=>response({...data,reused:true})}),{reused:true});
});
test("unpaid, foreign, unfinished or non-synthetic analysis is not displayed as complete",async()=>{
  for(const change of [{case_id:"other"},{synthetic_only:false},{analysis_status:"pending"},{requires_human_review:false},{reused:"true"},{extra:true},{version:"unknown"}]){
    await assert.rejects(runRehearsalAnalysis({caseId:id,authFetch:async()=>response({...data,...change})}),/verificar/);
  }
  await assert.rejects(runRehearsalAnalysis({caseId:id,authFetch:async()=>response({detail:"Pago requerido"},402)}),/Pago requerido/);
});
test("invalid or aborted analysis cannot update another case or session",async()=>{
  await assert.rejects(runRehearsalAnalysis({caseId:"invalid",authFetch:()=>assert.fail()}),/válido/);
  const controller=new AbortController();
  await assert.rejects(runRehearsalAnalysis({caseId:id,signal:controller.signal,authFetch:async()=>{controller.abort();return response(data)}}),{name:"AbortError"});
});
