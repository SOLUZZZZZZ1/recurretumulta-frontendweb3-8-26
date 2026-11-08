import {UUID,sha256,sameJson,root,jsonRequest} from './paidCasework.js';
import {studyRequestDigest} from './studyOperationJournal.js';
export const managementRoot=id=>root(id)+'/management';
export const money=cents=>Number.isInteger(cents)?new Intl.NumberFormat('es-ES',{style:'currency',currency:'EUR'}).format(cents/100):'Consulta pendiente';
export const GENERATION_LABELS={awaiting_payment:'Pendiente de pago íntegro para generar el recurso.',pending:'Pago íntegro confirmado. El recurso está en cola de generación.',running:'Generando el recurso con los datos del expediente.',retry:'La generación se está recuperando automáticamente. El pago ya está registrado.',blocked:'El pago está registrado. La generación necesita intervención del operador.',completed:'Recurso generado y disponible para revisión en OPS.'};
export const BALANCE_LABELS={not_started:'Saldo pendiente · todavía no se ha iniciado el pago',reserved:'Preparación del pago pendiente de confirmar',open:'Saldo pendiente · sesión de pago abierta',unknown:'Resultado del pago desconocido · consultar antes de repetir',expired:'Sesión de pago cerrada sin cobro confirmado',confirmed:'Saldo confirmado por Stripe',review_required:'Pago recibido · revisión de vinculación necesaria',retiring:'Cierre de la sesión de pago en comprobación',failed:'Pago no confirmado'};
export const REQUIREMENTS={STUDY_NOT_SAVED:'Guardar la valoración del estudio.',STUDY_NOT_COMPLETED:'Terminar la revisión y guardar el estudio como completado.',STUDY_HAS_UNRESOLVED_REQUIREMENTS:'Resolver los requisitos pendientes del estudio.',REQUIRED_DOCUMENTS_NOT_REVIEWED:'Leer y confirmar multa, autorización e identidad.',MANAGEMENT_QUOTE_REQUIRED:'Preparar y comunicar el presupuesto.',MANAGEMENT_BALANCE_NOT_CONFIRMED:'Aceptar el presupuesto y confirmar su saldo.',MANAGEMENT_PROVIDER_RECEIPT_REQUIRED:'Obtener la confirmación del saldo de Stripe.'};
export async function verifyRecord(record,caseId,kind){
  const contract=kind==='quote'?'rtm_management_quote_v1':'rtm_management_working_draft_v1';
  if(!record||typeof record.canonical_snapshot!=='string'||record.canonical_snapshot.length>1000000||!sameJson(JSON.parse(record.canonical_snapshot),record.snapshot)||
    record.snapshot?.case_id!==caseId||record.snapshot.contract!==contract||!UUID.test(record.snapshot.id||'')||await sha256(record.canonical_snapshot)!==record.sha256)throw new Error('El contenido recuperado no coincide con la versión guardada.');
  if(kind==='draft'&&(record.snapshot.presented!==false||await sha256(record.snapshot.content)!==record.snapshot.content_sha256))throw new Error('No se pudo verificar el borrador.');
  return record;
}
const prefix='rtm.management.operation.v1.';
function key(caseId,actor,kind){if(!UUID.test(caseId)||!UUID.test(actor)||!['quote','draft'].includes(kind))throw new Error('Referencia de operación inválida.');return prefix+caseId+'.'+actor+'.'+kind;}
export function pendingOperation(caseId,actor,kind,storage=localStorage){
  const raw=storage.getItem(key(caseId,actor,kind));if(raw===null)return null;
  const item=JSON.parse(raw);
  if(raw.length>800||Object.keys(item).sort().join(',')!=='actor,case_id,kind,operation_id,request_sha256'||item.case_id!==caseId||item.actor!==actor||item.kind!==kind||!UUID.test(item.operation_id)||!/^[a-f0-9]{64}$/.test(item.request_sha256))throw new Error('Hay una referencia pendiente no válida. No se enviará otra operación.');
  return item;
}
export async function rememberOperation(caseId,actor,kind,payload,storage=localStorage){
  if(pendingOperation(caseId,actor,kind,storage))throw new Error('Primero hay que recuperar el guardado pendiente.');
  const value={case_id:caseId,actor,kind,operation_id:payload.operation_id,request_sha256:await studyRequestDigest(payload)};
  storage.setItem(key(caseId,actor,kind),JSON.stringify(value));
  if(!sameJson(pendingOperation(caseId,actor,kind,storage),value))throw new Error('No se pudo conservar la referencia del guardado.');return value;
}
export function forgetOperation(item,storage=localStorage){
  const old=pendingOperation(item.case_id,item.actor,item.kind,storage);
  if(old?.operation_id!==item.operation_id)throw new Error('Otra operación requiere reconciliación.');
  storage.removeItem(key(item.case_id,item.actor,item.kind));
}
export async function withOperationLock(caseId,actor,kind,fn){
  if(!navigator.locks?.request)throw new Error('El navegador no puede coordinar el guardado entre pestañas.');
  return navigator.locks.request(key(caseId,actor,kind),{ifAvailable:true},lock=>{if(!lock)throw new Error('Otra pestaña está guardando.');return fn();});
}
export const post=(authFetch,url,body,signal)=>jsonRequest(authFetch,url,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal});
