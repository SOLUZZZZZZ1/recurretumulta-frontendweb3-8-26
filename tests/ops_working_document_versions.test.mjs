import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchVersions, fetchSavedVersion, fetchSavedVersionPdf, saveWorkingDocumentVersion, verifyVersions } from '../src/lib/opsWorkingDocumentVersions.js';

const caseId='10000000-0000-4000-8000-000000000001';
const versionId='20000000-0000-4000-8000-000000000001';
const docId='30000000-0000-4000-8000-000000000001';
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),v=>v.toString(16).padStart(2,'0')).join('');
const content='BORRADOR\nPersona que conducía: [PENDIENTE].\n';
const bytes=new TextEncoder().encode('%PDF-1.4\nSynthetic draft transport\n%%EOF').buffer;
const projection={ok:true,case_id:caseId,version:'rtm_working_document_v1',source_sha256:'a'.repeat(64),
  status:'working_draft',final_resource_generated:false,persisted:false,can_save:false,
  facts_id:null,facts_payload_sha256:null,latest_id:null,history:[],document_kind:'driver_identification',
  title:'Contestación pendiente',content,fields:[],issues:[]};
const entry={format:'rtm_working_document_versions_v1',id:versionId,case_id:caseId,sequence:1,
  status:'working_draft',synthetic_only:true,final_resource_generated:false,previous_id:null,previous_material_sha256:null,
  source_sha256:projection.source_sha256,snapshot_sha256:'c'.repeat(64),content_sha256:await hash(new TextEncoder().encode(content)),
  authority_sha256:'d'.repeat(64),title:projection.title,created_at:'2026-10-08T19:00:00+00:00',
  pdf:{document_id:docId,sha256:await hash(bytes),size_bytes:bytes.byteLength},persisted:true,current_authority:true};
const empty={ok:true,version:'rtm_working_document_versions_v1',case_id:caseId,synthetic_only:true,
  final_resource_generated:false,can_save:true,latest_id:null,history:[]};
const saved={...empty,latest_id:versionId,history:[entry],saved_id:versionId,reused:false};
const detail={ok:true,version:empty.version,case_id:caseId,entry,snapshot:projection,persisted:true,final_resource_generated:false};
const response=data=>({ok:true,json:async()=>data});
const copy=data=>structuredClone(data);

function pdfResponse(changes={}) {
 return {ok:true,headers:new Headers({'Content-Type':'application/pdf','X-RTM-Version-ID':entry.id,
 'X-RTM-Source-SHA256':entry.source_sha256,'X-RTM-Document-SHA256':entry.pdf.sha256,...changes.headers}),
 arrayBuffer:async()=>changes.bytes??bytes};
}

test('saving sends only two version preconditions, never text, actor or approval',async()=>{
 let calls=0;
 const result=await saveWorkingDocumentVersion({caseId,document:projection,versions:empty,authFetch:async(url,options)=>{
  calls++;assert.ok(url.endsWith('/working-document/versions'));assert.equal(options.method,'POST');
  assert.deepEqual(JSON.parse(options.body),{expected_source_sha256:projection.source_sha256,expected_latest_id:null});
  return response(saved);
 }});
 assert.equal(calls,1);assert.equal(result.history[0].persisted,true);assert.equal(result.final_resource_generated,false);
});

test('history and saved content reopen with GET only, with the expected case and content hash',async()=>{
 const history=await fetchVersions({caseId,authFetch:async(_,options)=>{assert.equal(options.method,'GET');return response(saved);}});
 const result=await fetchSavedVersion({caseId,entry:history.history[0],authFetch:async(url,options)=>{
  assert.ok(url.endsWith('/versions/'+versionId));assert.equal(options.method,'GET');return response(detail);
 }});
 assert.equal(result.snapshot.content,content);
});

test('foreign cases, duplicate history, invalid chains and invented final states are rejected',()=>{
 for(const modify of [d=>d.case_id=docId,d=>d.final_resource_generated=true,d=>d.history.push(d.history[0]),
  d=>d.history[0].case_id=docId,d=>d.history[0].previous_id=docId,d=>d.latest_id=docId,
  d=>d.history[0].persisted=false,d=>d.history[0].sequence=2]) {
  const data=copy(saved);modify(data);assert.throws(()=>verifyVersions(data,caseId));
 }
});

test('a saved response must correspond to the currently displayed source',async()=>{
 const changed=copy(saved);changed.history[0].source_sha256='f'.repeat(64);
 await assert.rejects(saveWorkingDocumentVersion({caseId,document:projection,versions:empty,authFetch:async()=>response(changed)}));
});

test('stored PDF is bound to case, version, source, declared length and actual bytes',async()=>{
 const result=await fetchSavedVersionPdf({caseId,entry,authFetch:async(url,options)=>{
  assert.ok(url.endsWith('/versions/'+versionId+'/pdf'));assert.equal(options.method,'GET');return pdfResponse();
 }});
 assert.equal(result,bytes);
 for(const changes of [{headers:{'X-RTM-Version-ID':docId}},{headers:{'X-RTM-Source-SHA256':'f'.repeat(64)}},
  {headers:{'X-RTM-Document-SHA256':'f'.repeat(64)}},{bytes:new TextEncoder().encode('%PDF-tampered').buffer}]) {
  await assert.rejects(fetchSavedVersionPdf({caseId,entry,authFetch:async()=>pdfResponse(changes)}));
 }
});

test('tampered saved text and cancelled sessions are rejected',async()=>{
 const changed=copy(detail);changed.snapshot.content+='FORGED';
 await assert.rejects(fetchSavedVersion({caseId,entry,authFetch:async()=>response(changed)}));
 const controller=new AbortController();
 await assert.rejects(fetchSavedVersionPdf({caseId,entry,signal:controller.signal,authFetch:async()=>{
  controller.abort();return pdfResponse();
 }}));
});

test('failed writes are not automatically retried or represented as saved',async()=>{
 for(const status of [401,403,404,409,503,500]) {
  let calls=0;
  await assert.rejects(saveWorkingDocumentVersion({caseId,document:projection,versions:empty,authFetch:async()=>{
   calls++;return {ok:false,status};
  }}));assert.equal(calls,1);
 }
});
