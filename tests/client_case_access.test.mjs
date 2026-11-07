import test from 'node:test';
import assert from 'node:assert/strict';
import {saveClientAccess,readClientAccess,clientCaseOptions,clientCaseRequest,CLIENT_TRIAL_VERSION} from '../src/lib/clientCaseAccess.js';
const id='11111111-1111-4111-8111-111111111111',other='22222222-2222-4222-8222-222222222222';
const token='v2.1794000000.'+'a'.repeat(32)+'.'+'b'.repeat(64);
function storage(){const data=new Map();return {getItem:k=>data.get(k)||null,setItem:(k,v)=>data.set(k,v)};}
function fixture(){const s=storage();saveClientAccess(id,{caseId:id,token,pass:token,trial:CLIENT_TRIAL_VERSION},s);return s;}
test('case access survives navigation in the same tab and is case scoped',()=>{const s=fixture();assert.equal(readClientAccess(id,s).token,token);assert.equal(readClientAccess(other,s),null);});
test('only approved client upload routes use the controlled adapter',()=>{const s=fixture();const r=clientCaseOptions(id,`/cases/${id}/append-documents`,{method:'POST'},s);assert.equal(r.path,`/staging/client/cases/${id}/append-documents`);assert.equal(r.options.headers.get('X-RTM-Client-Pass'),token);assert.equal(r.options.headers.get('X-RTM-Case-Token'),token);});
test('billing keeps its normal route, omits client pass and binds the case',()=>{const s=fixture();const r=clientCaseOptions(id,'/billing/checkout',{method:'POST',body:JSON.stringify({case_id:id})},s);assert.equal(r.path,'/billing/checkout');assert.equal(r.options.headers.get('X-RTM-Client-Pass'),null);assert.equal(r.options.headers.get('X-RTM-Case-Token'),token);assert.throws(()=>clientCaseOptions(id,'/billing/checkout',{body:JSON.stringify({case_id:other})},s));});
test('never attaches case credentials to OPS, other cases or external paths',()=>{for(const path of ['/ops/core/cases','https://evil.invalid',`/cases/${other}/public-status`,`/cases/${id}/../public-status`,`/cases/${id}/public-status?redirect=evil`])assert.throws(()=>clientCaseOptions(id,path,{},fixture()));});
test('corrupt stored state is rejected',()=>{const s=storage();s.setItem('rtm.client-intake.v1:'+id,JSON.stringify({caseId:other,token}));assert.equal(readClientAccess(id,s),null);assert.throws(()=>saveClientAccess(id,{caseId:other,token},s));});
test('lost upload response is not replayed',async()=>{globalThis.sessionStorage=fixture();let count=0;await assert.rejects(clientCaseRequest(id,`/cases/${id}/append-documents`,{method:'POST'},async()=>{count++;throw Error('lost');}),e=>e.uncertain===true);assert.equal(count,1);delete globalThis.sessionStorage;});
