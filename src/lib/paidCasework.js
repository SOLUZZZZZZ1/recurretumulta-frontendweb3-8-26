export const FACT_LABELS = Object.freeze({organismo:"Organismo", expediente_ref:"Referencia del asunto",
  notified_at:"Fecha de notificación", facts:"Hechos revisados", deadline:"Plazo revisado y fundamento",
  interested:"Interesado",contact:"Contacto",driver:"Conductor",owner:"Titular",representative:"Representante"});
export const CASEWORK_CONTRACT = "rtm_paid_casework_v1";
export const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-[1-5][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
export function root(caseId) {
  if (!UUID.test(caseId)) throw new Error("Referencia de expediente no válida.");
  return `/api/ops/core/cases/${caseId}`;
}
export async function jsonRequest(authFetch, url, options={}) {
  let response;
  try { response=await authFetch(url,options); }
  catch(error) { throw Object.assign(new Error("No se pudo completar la consulta. El resultado no está confirmado."),{status:error.status, cause:error}); }
  const body=await response.text();
  if(body.length>3000000) throw new Error("Respuesta demasiado grande; lectura no acreditada.");
  let payload;
  try { payload=JSON.parse(body); } catch { throw Object.assign(new Error("Respuesta no válida; lectura no acreditada."),{status:response.status}); }
  if(!response.ok) {
    const code=payload?.detail?.code;
    const safeCode=typeof code==='string' && /^[A-Z_]{3,100}$/.test(code) ? code : "CONSULTA_RECHAZADA";
    throw Object.assign(new Error(`No se ha completado la operación (${safeCode}).`),{status:response.status,code:safeCode});
  }
  if(payload?.ok!==true) throw new Error("El servidor no confirmó la operación.");
  return payload;
}
export async function sha256(text) {
  return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text))),b=>b.toString(16).padStart(2,'0')).join('');
}
function sorted(value) {
  if(Array.isArray(value)) return value.map(sorted);
  if(value && typeof value==='object') return Object.fromEntries(Object.keys(value).sort().map(k=>[k,sorted(value[k])]));
  return value;
}
export function sameJson(a,b) { return JSON.stringify(sorted(a))===JSON.stringify(sorted(b)); }
export async function verifyAssessment(record, caseId, operationId=null) {
  if(!record || typeof record.canonical_snapshot!=='string' || record.canonical_snapshot.length>200000 ||
    !/^[a-f0-9]{64}$/.test(record.sha256||'')) throw new Error("Valoración incompleta; recuperación no verificada.");
  const parsed=JSON.parse(record.canonical_snapshot);
  if(JSON.stringify(sorted(parsed))!==JSON.stringify(sorted(record.snapshot)) || parsed.case_id!==caseId ||
    parsed.contract!=='rtm_paid_initial_study_v1' || !UUID.test(parsed.operation_id||'') ||
    (operationId && parsed.operation_id!==operationId) || await sha256(record.canonical_snapshot)!==record.sha256) {
    throw new Error("La integridad o pertenencia de la valoración no coincide.");
  }
  return record;
}
export function fieldText(field) {
  if(!field || field.status==='schema_unavailable') return "Lectura no disponible";
  if(field.status==='not_recorded') return "No consta";
  return String(field.value);
}
export function documentLabel(document,index=0) {
  return ({original:"Documento aportado",authorization_signed:"Autorización firmada",identity_front:"Identidad · anverso",identity_back:"Identidad · reverso"}[document.kind] || "Documento del expediente")+` · ${index+1}`;
}
export function blankStudy() {
  return {state:"in_progress",facts:Object.fromEntries(Object.keys(FACT_LABELS).map(k=>[k,{value:null,status:"unresolved",sources:[],confidence:0,conflicts:[],notes:[]}])),
    assessment:"",missing:"",options:"",next_action:""};
}
