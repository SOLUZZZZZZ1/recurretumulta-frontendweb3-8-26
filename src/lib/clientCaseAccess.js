import {clientRequest, clientApiUrl} from './clientApi.js';

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TOKEN=/^v2\.\d{9,11}\.[0-9a-f]{32}\.[0-9a-f]{64}$/;
const key=id=>`rtm.client-intake.v1:${id}`;
export const CLIENT_TRIAL_VERSION='rtm_client_rehearsal_20261106_v1';
export const validClientPass=value=>TOKEN.test(value||'');

export function readClientAccess(id,storage=globalThis.sessionStorage){
  if(!UUID.test(id||''))return null;
  try{const value=JSON.parse(storage.getItem(key(id))||'null');
    return value?.caseId===id&&TOKEN.test(value.token||'')?value:null;
  }catch{return null;}
}
export function saveClientAccess(id,value,storage=globalThis.sessionStorage){
  if(!UUID.test(id||'')||!TOKEN.test(value.token||'')||value.caseId!==id)throw new Error('Acceso del expediente no verificable.');
  storage.setItem(key(id),JSON.stringify(value));
  if(readClientAccess(id,storage)?.token!==value.token)throw new Error('No se pudo conservar el acceso en esta pestaña.');
}
export function clientCaseOptions(id,path,options={},storage=globalThis.sessionStorage){
  if(!UUID.test(id||''))throw new Error('Referencia de expediente no válida.');
  const access=readClientAccess(id,storage),headers=new Headers(options.headers||{});
  // Do not attach case credentials to arbitrary paths or another case.
  const cases=`/cases/${id}/`;
  const scoped=path.startsWith(cases)&&/^(public-status|authorize|authorization-pdf|upload-authorization-signed|append-documents|review|candidate-fixture)$/.test(path.slice(cases.length));
  const billing=path===`/billing/status/${id}`||path===`/billing/review-context/${id}`;
  const write=path==='/billing/checkout'||path==='/billing/confirm';
  if(!scoped&&!billing&&!write)throw new Error('La operación no pertenece al expediente.');
  if(write){let body;try{body=JSON.parse(options.body);}catch{throw new Error('Solicitud de pago no válida.');}
    if(body.case_id!==id)throw new Error('El pago no corresponde al expediente.');}
  if(access){headers.set('X-RTM-Case-Token',access.token);
    if(access.trial===CLIENT_TRIAL_VERSION&&scoped&&['authorize','authorization-pdf','upload-authorization-signed','append-documents','candidate-fixture'].includes(path.slice(cases.length))){
      if(!TOKEN.test(access.pass||''))throw new Error('Falta el pase de ensayo.');
      path='/staging/client'+path;headers.set('X-RTM-Client-Pass',access.pass);
    }
  }
  return {path,options:{...options,headers,cache:'no-store'}};
}
export function clientCaseRequest(id,path,options={},fetcher=globalThis.fetch){
  const prepared=clientCaseOptions(id,path,options);
  return clientRequest(prepared.path,prepared.options,fetcher);
}
export async function downloadClientPdf(path,headers,filename,fetcher=globalThis.fetch){
  const response=await fetcher(clientApiUrl(path),{headers,cache:'no-store',redirect:'error'});
  if(!response.ok||!response.headers.get('content-type')?.includes('application/pdf'))throw new Error('No se pudo recuperar el PDF. El expediente se conserva.');
  const blob=await response.blob(),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download=filename;link.click();setTimeout(()=>URL.revokeObjectURL(url),30000);
}
export function downloadCasePdf(id,kind,filename){
  const prepared=clientCaseOptions(id,`/cases/${id}/${kind}`);
  return downloadClientPdf(prepared.path,prepared.options.headers,filename);
}
