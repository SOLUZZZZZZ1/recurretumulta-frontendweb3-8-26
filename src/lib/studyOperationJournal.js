import {UUID,sha256} from './paidCasework.js';
const PREFIX='rtm.ops.study-reference.v1.';
const keys=['version','case_id','operator_id','operation_id','expected_revision','request_sha256','confirmed_sha256'];
export function journalKey(caseId,operatorId){
  if(!UUID.test(caseId||'')||!UUID.test(operatorId||''))throw new Error('Identidad individual no disponible para recuperar la operación.');
  return PREFIX+caseId+'.'+operatorId;
}
function checked(value,caseId,operatorId){
  if(!value||Object.keys(value).some(k=>!keys.includes(k))||value.version!==1||value.case_id!==caseId||value.operator_id!==operatorId||
    !UUID.test(value.operation_id||'')||!Number.isInteger(value.expected_revision)||value.expected_revision<0||
    !/^[a-f0-9]{64}$/.test(value.request_sha256||'')||
    (value.confirmed_sha256!==null&&!/^[a-f0-9]{64}$/.test(value.confirmed_sha256||'')))throw new Error('La referencia pendiente no es válida. No se permite otro envío.');
  return value;
}
export function loadStudyReference(caseId,operatorId,storage=localStorage){
  const raw=storage.getItem(journalKey(caseId,operatorId));
  if(raw===null)return null;
  if(raw.length>1200)throw new Error('Referencia pendiente no válida.');
  return checked(JSON.parse(raw),caseId,operatorId);
}
export function storeStudyReference(value,storage=localStorage){
  checked(value,value.case_id,value.operator_id);
  const key=journalKey(value.case_id,value.operator_id),old=loadStudyReference(value.case_id,value.operator_id,storage);
  if(old&&old.operation_id!==value.operation_id)throw new Error('Hay otra operación pendiente en este navegador.');
  const raw=JSON.stringify(value);storage.setItem(key,raw);
  if(storage.getItem(key)!==raw)throw new Error('No se pudo conservar la referencia. No se envió la valoración.');
}
export function clearStudyReference(value,storage=localStorage){
  const old=loadStudyReference(value.case_id,value.operator_id,storage);
  if(old&&old.operation_id!==value.operation_id)throw new Error('Otra operación necesita reconciliación.');
  storage.removeItem(journalKey(value.case_id,value.operator_id));
  if(loadStudyReference(value.case_id,value.operator_id,storage))throw new Error('No se confirmó el cierre de la referencia pendiente.');
}
function sorted(value){
  if(Array.isArray(value))return value.map(sorted);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sorted(value[k])]));
  return value;
}
export const studyRequestDigest=payload=>sha256(JSON.stringify(sorted(payload)));
export async function withStudyLock(caseId,operatorId,fn){
  if(!navigator.locks?.request)throw new Error('Este navegador no puede coordinar las operaciones de estudio. No se permite guardar.');
  return navigator.locks.request(journalKey(caseId,operatorId),{mode:'exclusive',ifAvailable:true},lock=>{
    if(!lock)throw new Error('Otra pestaña está resolviendo la operación. Vuelve a consultar cuando termine.');
    return fn();
  });
}
