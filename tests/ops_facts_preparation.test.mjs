import test from "node:test";
import assert from "node:assert/strict";
import {factsPreparationBlockReason, prepareReanalysisFacts} from "../src/lib/opsFactsReview.js";
import {latestCompletedAnalysisEvent} from "../src/lib/opsAnalysisStatus.js";
const caseId = "10000000-0000-4000-8000-000000000001";
const docId = "20000000-0000-4000-8000-000000000001";
const factsId = "30000000-0000-4000-8000-000000000001";
const workspace = {ok:true, case_id:caseId, case:{department:"traffic",case_type:"fine",payment_status:"paid",authorized:true,status:"manual_review_required"},
  reanalysis:{available:true,adapter_version:"rtm_reanalysis_to_validated_facts_v1_1"},
  authority:{validated_facts:{latest_active:null}}, documents:[{id:docId,kind:"original"}],
  next_step:{stage:"validated_facts_pending",actions:[{code:"create_validated_facts_draft",method:"POST",endpoint:`/ops/core/cases/${caseId}/reanalysis/facts-draft`}]}};
const record = {id:factsId,case_id:caseId,sequence:1,frozen:false,invalidated_at:null,payload_sha256:"a".repeat(64),
  facts:{case_id:caseId,frozen:false,source_document_ids:[docId],facts:{
    organismo:{status:"unresolved",value:null,sources:[{document_id:docId,source_type:"model_document_observation"}]},
    sancion_importe_eur:{status:"unresolved",value:null,sources:[]}}}};
const result = {ok:true,case_id:caseId,persisted:true,adapter_version:workspace.reanalysis.adapter_version,facts:record,
  authority_requirements:{model_derived_fields:"unresolved_until_operator_document_review",freeze_requires_document_review_attestation:true}};
const args = {workspace,caseId,canSupervise:true,sessionId:"session",authorizationVerified:true};
const copy = value => structuredClone(value);
test("preparation needs a verified reading, scoped server action, payment, signed authorization and supervisor", async () => {
  assert.equal(factsPreparationBlockReason(workspace,true,"session",true),"");
  const blocked = [
    {...args,canSupervise:false}, {...args,sessionId:""}, {...args,authorizationVerified:false},
    {...args,caseId:docId}, {...args,caseId:"../foreign"},
    {...args,workspace:{...workspace,reanalysis:{available:false}}},
    {...args,workspace:{...workspace,authority:{validated_facts:{latest_active:record}}}},
    {...args,workspace:{...workspace,next_step:{stage:"validated_facts_pending",actions:[]}}},
    {...args,workspace:{...workspace,next_step:{...workspace.next_step,actions:[{...workspace.next_step.actions[0],endpoint:"https://foreign.example/write"}]}}},
    ...["pending","refunded"].map(payment_status=>({...args,workspace:{...workspace,case:{...workspace.case,payment_status}}})),
    ...["submitted","closed","reanalysis_in_progress"].map(status=>({...args,workspace:{...workspace,case:{...workspace.case,status}}})),
  ];
  let calls=0;
  for(const params of blocked) await assert.rejects(prepareReanalysisFacts({...params,authFetch:async()=>{calls++;}}));
  assert.equal(calls,0);
});
test("one empty POST creates an unfrozen facts version, without another analysis or review attestation", async () => {
  const controller=new AbortController(); let calls=0;
  const saved=await prepareReanalysisFacts({...args,signal:controller.signal,authFetch:async(url,options)=>{
    calls++;assert.equal(url,`/api/ops/core/cases/${caseId}/reanalysis/facts-draft`);
    assert.equal(options.method,"POST");assert.deepEqual(JSON.parse(options.body),{});
    assert.equal(options.signal,controller.signal);assert.deepEqual(Object.keys(options.headers),["Content-Type"]);
    return {ok:true,json:async()=>result};
  }});
  assert.equal(saved,record);assert.equal(saved.facts.facts.sancion_importe_eur.value,null);assert.equal(calls,1);
});
test("wrong case, frozen facts, unrelated documents and model-promoted authority are rejected", async () => {
  const bad=[
    data=>data.case_id=docId, data=>data.facts.case_id=docId, data=>data.facts.facts.case_id=docId,
    data=>data.facts.frozen=true, data=>data.facts.facts.frozen=true, data=>data.facts.invalidated_at="now",
    data=>data.persisted=false, data=>data.adapter_version="unknown",
    data=>data.facts.facts.source_document_ids=[caseId],
    data=>data.facts.facts.facts.organismo.sources[0].document_id=caseId,
    data=>data.facts.facts.facts.organismo.status="validated",
    data=>data.authority_requirements.freeze_requires_document_review_attestation=false,
  ];
  for(const alter of bad){const data=copy(result);alter(data);await assert.rejects(prepareReanalysisFacts({...args,authFetch:async()=>({ok:true,json:async()=>data})}));}
});
test("deterministic observations may stay validated; model-derived observations cannot", async () => {
  const data=copy(result); const fact=data.facts.facts.facts.organismo;
  fact.status="validated";fact.value="Organismo ficticio";fact.sources[0].source_type="deterministic_document";
  assert.equal((await prepareReanalysisFacts({...args,authFetch:async()=>({ok:true,json:async()=>data})})).facts.facts.organismo.value,fact.value);
  fact.sources.push({document_id:docId,source_type:"model_document_observation"});
  await assert.rejects(prepareReanalysisFacts({...args,authFetch:async()=>({ok:true,json:async()=>data})}));
});
test("conflicts and dropped responses never trigger an automatic second write", async () => {
  for(const mode of ["conflict","lost"]){
    let calls=0;
    await assert.rejects(prepareReanalysisFacts({...args,authFetch:async()=>{calls++;if(mode==="lost")throw new TypeError("Network unavailable");return {ok:false,status:409};}}));
    assert.equal(calls,1);
  }
});
test("completed reading date is independent from legacy analysis and subsequent failures", () => {
  const completed={type:"case_reanalysis_completed",created_at:"2026-10-07T07:33:14Z"};
  const events=[{type:"case_reanalysis_failed",created_at:"2026-10-07T07:40:00Z"},{type:"ai_expediente_result",created_at:"2026-10-06T07:30:00Z"},completed];
  const before=copy(events);assert.equal(latestCompletedAnalysisEvent(events),completed);assert.deepEqual(events,before);
  assert.equal(latestCompletedAnalysisEvent([{type:"case_reanalysis_started",created_at:completed.created_at}]),null);
  assert.equal(latestCompletedAnalysisEvent([{type:"case_reanalysis_completed",created_at:"bad"}]),null);
  assert.equal(latestCompletedAnalysisEvent(null),null);
});

