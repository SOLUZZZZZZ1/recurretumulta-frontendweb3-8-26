import {UUID} from './paidCasework.js';
import {studyRequestDigest} from './studyOperationJournal.js';
const prefix='rtm.mail.operation.v1.';
export function mailOperationKey(caseId,actor){
  if(!UUID.test(caseId)||!UUID.test(actor))throw new Error('Referencia de comunicación inválida.');
  return prefix+caseId+'.'+actor;
}
export function pendingMail(caseId,actor){
  const raw=localStorage.getItem(mailOperationKey(caseId,actor));if(raw===null)return null;
  if(raw.length>500)throw new Error('Referencia de comunicación pendiente no válida.');
  const item=JSON.parse(raw);
  if(Object.keys(item).sort().join(',')!=='actor,case_id,operation_id,request_sha256'||item.case_id!==caseId||item.actor!==actor||!UUID.test(item.operation_id)||!/^[0-9a-f]{64}$/.test(item.request_sha256))throw new Error('No se puede comprobar la comunicación pendiente.');
  return item;
}
export async function rememberMail(caseId,actor,operation){
  if(pendingMail(caseId,actor))throw new Error('Hay que recuperar la comunicación pendiente antes de preparar otra.');
  const {recipient,subject,body,reply_id}=operation;
  const item={case_id:caseId,actor,operation_id:operation.operation_id,request_sha256:await studyRequestDigest({case_id:caseId,recipient,subject,body,reply_id,relation:{}})};
  localStorage.setItem(mailOperationKey(caseId,actor),JSON.stringify(item));
  if(pendingMail(caseId,actor)?.operation_id!==item.operation_id)throw new Error('No se pudo conservar la referencia de la comunicación.');
  return item;
}
export function clearMail(item){
  if(pendingMail(item.case_id,item.actor)?.operation_id!==item.operation_id)throw new Error('Otra comunicación requiere comprobación.');
  localStorage.removeItem(mailOperationKey(item.case_id,item.actor));
}
