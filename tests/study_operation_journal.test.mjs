import test from 'node:test';
import assert from 'node:assert/strict';
import {journalKey,loadStudyReference,storeStudyReference,clearStudyReference,studyRequestDigest} from '../src/lib/studyOperationJournal.js';
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222',O='33333333-3333-4333-8333-333333333333';
function storage(){const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};}
const ref=()=>({version:1,case_id:A,operator_id:B,operation_id:O,expected_revision:0,request_sha256:'a'.repeat(64),confirmed_sha256:null});
test('Only non-secret reference survives a new reader',()=>{const s=storage();storeStudyReference(ref(),s);assert.deepEqual(loadStudyReference(A,B,s),ref());});
test('Case and operator scope separated',()=>{const s=storage();storeStudyReference(ref(),s);assert.equal(loadStudyReference(B,A,s),null);assert.equal(loadStudyReference(A,O,s),null);});
test('No private text, credential or unknown property accepted',()=>{for(const key of ['assessment','token','password','documents','payload'])assert.throws(()=>storeStudyReference({...ref(),[key]:'private'},storage()));});
test('A pending UUID cannot be replaced by another',()=>{const s=storage();storeStudyReference(ref(),s);assert.throws(()=>storeStudyReference({...ref(),operation_id:A},s));assert.throws(()=>clearStudyReference({...ref(),operation_id:A},s));});
test('Storage failure never silently reports persistence',()=>{assert.throws(()=>storeStudyReference(ref(),{getItem:()=>null,setItem:()=>{},removeItem:()=>{}}));});
test('Malformed persistent reference blocks rather than being discarded',()=>{const s=storage();s.setItem(journalKey(A,B),'broken');assert.throws(()=>loadStudyReference(A,B,s));});
test('Fingerprint covers exact human text and sources independent of key order',async()=>{assert.equal(await studyRequestDigest({b:2,a:1}),await studyRequestDigest({a:1,b:2}));assert.notEqual(await studyRequestDigest({text:'A'}),await studyRequestDigest({text:'B'}));});
test('Only the reconciled reference is removed',()=>{const s=storage();storeStudyReference(ref(),s);clearStudyReference(ref(),s);assert.equal(loadStudyReference(A,B,s),null);});
