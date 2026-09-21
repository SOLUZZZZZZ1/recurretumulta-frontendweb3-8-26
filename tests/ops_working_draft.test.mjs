import test from 'node:test';
import assert from 'node:assert/strict';
import { parseWorkingDraft, draftRoute, requestWorkingDraft, fetchWorkingDraftPdf } from '../src/lib/opsWorkingDraft.js';
const CASE='11111111-1111-4111-8111-111111111111';
const ID='22222222-2222-4222-8222-222222222222';
const base=()=>({ok:true,case_id:CASE,working_draft:{version:'rtm_local_traffic_working_draft_v1',case_id:CASE,
 synthetic_only:true,source_sha256:'a'.repeat(64),blockers:[],history:[],reviewed_facts:[],can_prepare:true,
 legal_review_pending:true,final_resource_generated:false,latest_id:null}});
test('only this case, explicit draft status and coherent state are accepted',()=>{
 assert.equal(parseWorkingDraft(base(),CASE).latest_id,null);
 for(const changes of [{case_id:ID},{synthetic_only:false},{final_resource_generated:true},{source_sha256:'bad'},
  {blockers:['pending'],can_prepare:true},{latest_id:ID}]){
  const data=base();Object.assign(data.working_draft,changes);assert.throws(()=>parseWorkingDraft(data,CASE));
 }
 assert.throws(()=>draftRoute('../case'));
});
test('save does not retry or accept a response without a new version',async()=>{
 let calls=0;
 await assert.rejects(requestWorkingDraft({caseId:CASE,body:{expected_latest_id:null},authFetch:async()=>{
  calls++;return new Response(JSON.stringify(base()),{status:200});
 }}));assert.equal(calls,1);
});
test('PDF is authenticated and checked against saved size and digest',async()=>{
 const bytes=new TextEncoder().encode('%PDF-1.4 synthetic');
 const sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),n=>n.toString(16).padStart(2,'0')).join('');
 const entry={id:ID,pdf:{sha256:sha,size_bytes:bytes.length}};
 const fetcher=async url=>{assert.equal(url,`/api/ops/cases/${CASE}/working-draft/${ID}/pdf`);return new Response(bytes,{headers:{'content-type':'application/pdf','X-RTM-Document-SHA256':sha}})};
 assert.equal((await fetchWorkingDraftPdf({authFetch:fetcher,caseId:CASE,entry})).byteLength,bytes.length);
 await assert.rejects(fetchWorkingDraftPdf({authFetch:fetcher,caseId:CASE,entry:{...entry,pdf:{...entry.pdf,size_bytes:1}}}));
});
