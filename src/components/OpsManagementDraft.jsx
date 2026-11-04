import React,{useEffect,useRef,useState} from 'react';
import {jsonRequest,root,sha256} from '../lib/paidCasework.js';
import {managementRoot,verifyRecord,pendingOperation,rememberOperation,forgetOperation,withOperationLock,post,REQUIREMENTS,GENERATION_LABELS} from '../lib/managementJourney.js';

export default function OpsManagementDraft({caseId,operatorId,authFetch,study,resources,canWrite}){
  const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[pending,setPending]=useState(null),[edit,setEdit]=useState(null),[read,setRead]=useState(null),[notice,setNotice]=useState('');
  const live=useRef(true),controller=useRef(null),locked=useRef(false);
  async function load(signal){const r=await jsonRequest(authFetch,managementRoot(caseId),{signal});if(r.case_id!==caseId)throw new Error('Expediente no coincidente.');
    if(r.drafts.latest)await verifyRecord(r.drafts.latest,caseId,'draft');if(live.current&&!signal?.aborted)setData(r);return r;}
  async function task(fn){if(locked.current)return;locked.current=true;setBusy(true);setError('');const ctl=new AbortController();controller.current=ctl;
    try{await fn(ctl.signal);}catch(e){if(live.current&&!ctl.signal.aborted)setError(e.message);}finally{locked.current=false;if(live.current)setBusy(false);}}
  useEffect(()=>{live.current=true;try{setPending(pendingOperation(caseId,operatorId,'draft'));}catch(e){setError(e.message);setPending({invalid:true});}void task(signal=>load(signal));
    return()=>{live.current=false;controller.current?.abort();};},[caseId,operatorId,authFetch]);
  useEffect(()=>{if(!['pending','running','retry'].includes(data?.generation?.state))return;
    const timer=setInterval(()=>void task(signal=>load(signal)),5000);return()=>clearInterval(timer);
  },[data?.generation?.state,caseId,operatorId,authFetch]);
  function start(action){const base=data.drafts.latest;setEdit({action,expected_version_id:base?.snapshot.id||null,expected_version_sha256:base?.sha256||null,
    quote_id:data.quotes.latest.snapshot.id,study_operation_id:study.latest.snapshot.operation_id,study_sha256:study.latest.sha256,
    content:action==='correct'?base.snapshot.content:'',document_type:'',primary_strategy:'',argument_title:'',argument_body:'',legal_basis:'',requested_outcomes:'',reviewed:false,correction_reason:''});setNotice('');}
  async function save(){await task(signal=>withOperationLock(caseId,operatorId,'draft',async()=>{
    let payload={operation_id:crypto.randomUUID(),expected_version_id:edit.expected_version_id,expected_version_sha256:edit.expected_version_sha256,
      quote_id:edit.quote_id,study_operation_id:edit.study_operation_id,study_sha256:edit.study_sha256,action:edit.action,correction_reason:edit.correction_reason,draft_only_acknowledged:true};
    if(edit.action==='correct')payload.content=edit.content;
    else if(edit.action==='recover_existing'){payload.legacy_resource_id=edit.legacy_resource_id;payload.legacy_content_sha256=edit.legacy_content_sha256;}
    else payload.reviewed={document_type:edit.document_type,primary_strategy:edit.primary_strategy,
      legal_arguments:[{title:edit.argument_title,body:edit.argument_body,legal_basis:edit.legal_basis.split('\n').filter(s=>s.trim())}],
      requested_outcomes:edit.requested_outcomes.split('\n').filter(s=>s.trim()),identity_and_phase_reviewed:edit.reviewed,contract_scope_confirmed:edit.reviewed};
    const ref=await rememberOperation(caseId,operatorId,'draft',payload);setPending(ref);
    const r=await post(authFetch,managementRoot(caseId)+'/drafts',payload,signal);await verifyRecord(r.version,caseId,'draft');
    const recovered=await jsonRequest(authFetch,`${managementRoot(caseId)}/drafts/${ref.operation_id}`,{signal});await verifyRecord(recovered.version,caseId,'draft');
    if(recovered.version.sha256!==r.version.sha256)throw new Error('El contenido recuperado no coincide.');forgetOperation(ref);
    if(live.current){setPending(null);setEdit(null);setRead(recovered.version);setNotice('Versión guardada y recuperada exactamente. Sigue siendo un borrador; no presentado.');}await load(signal);
  }));}
  function recover(){return task(signal=>withOperationLock(caseId,operatorId,'draft',async()=>{const ref=pendingOperation(caseId,operatorId,'draft');if(!ref)return;
    const r=await post(authFetch,`${managementRoot(caseId)}/operations/draft/${ref.operation_id}/reconcile`,{},signal);
    if(r.status==='committed'){await verifyRecord(r.result.version,caseId,'draft');if(live.current)setRead(r.result.version);}else if(r.status!=='cancelled')throw new Error('Resultado todavía desconocido.');
    forgetOperation(ref);if(live.current){setPending(null);setNotice(r.status==='committed'?'Se recuperó la versión de la misma operación.':'Operación cancelada definitivamente; no se guardó un borrador.');}await load(signal);
  }));}
  function open(id){return task(async signal=>{const r=await jsonRequest(authFetch,`${managementRoot(caseId)}/drafts/${id}`,{signal});await verifyRecord(r.version,caseId,'draft');if(live.current)setRead(r.version);});}
  function recoverLegacy(id){return task(async signal=>{const r=await jsonRequest(authFetch,`${root(caseId)}/resources/${id}`,{signal});
    if(r.case_id!==caseId||r.id!==id||await sha256(r.content)!==r.sha256)throw new Error('No se verificó el recurso anterior.');
    if(live.current){start('recover_existing');setEdit(e=>({...e,legacy_resource_id:id,legacy_content_sha256:r.sha256,content:r.content}));}});}
  const shown=read||data?.drafts.latest;
  return <section><h2>Preparar y revisar el recurso</h2><p>RTM genera el recurso automáticamente al confirmar el pago íntegro del presupuesto. Revisa aquí el escrito y guarda las correcciones necesarias.</p>
    {error&&<p role="alert">{error} No se interpreta como ausencia de recurso.</p>}{notice&&<p role="status">{notice}</p>}{busy&&<p role="status">Consultando o guardando la misma versión…</p>}
    <button disabled={busy} onClick={()=>void task(signal=>load(signal))}>Consultar versiones y requisitos</button>
    {pending&&<p role="alert">Guardado pendiente de reconciliación. {!pending.invalid&&<button disabled={busy} onClick={()=>void recover()}>Recuperar la misma operación</button>}</p>}
    {data&&<>{data.draft_requirements.length>0&&<ul>{data.draft_requirements.map(r=><li key={r}>{REQUIREMENTS[r]||r}</li>)}</ul>}
      {data.generation&&<p role="status">{GENERATION_LABELS[data.generation.state]||'Consulta pendiente de generación.'}</p>}
      {data.generation?.state==='blocked'&&<><p role="alert">{REQUIREMENTS[data.generation.last_code]||'La generación necesita revisión de los datos o del servicio.'}</p><button disabled={busy||!canWrite} onClick={()=>void task(async signal=>{await post(authFetch,`${managementRoot(caseId)}/generation/${data.generation.id}/retry`,{},signal);await load(signal);})}>Reintentar la generación del recurso</button></>}
      {!data.drafts.latest&&resources.status==='not_recorded'&&data.generation?.state==='awaiting_payment'&&<p>El recurso se generará cuando se confirme el pago íntegro del presupuesto.</p>}
      {!edit&&!pending&&canWrite&&!data.draft_requirements.length&&!['pending','running','retry'].includes(data.generation?.state)&&<>{data.drafts.latest?<button disabled={busy} onClick={()=>start('correct')}>Corregir la última versión guardada</button>:
        resources.items.length?resources.items.slice(0,1).map(r=><button key={r.id} disabled={busy} onClick={()=>void recoverLegacy(r.id)}>Recuperar exactamente la versión anterior {r.version} para continuar</button>):<button disabled={busy} onClick={()=>start('prepare')}>Preparar borrador del recurso</button>}</>}
      {edit&&<form onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={busy||!!pending||!canWrite}>
        {(edit.expected_version_id!==(data.drafts.latest?.snapshot.id||null)||edit.study_sha256!==study.latest?.sha256)&&<p role="alert">Hay una nueva versión o valoración. Tu texto conserva su base anterior. Revisa ambas aportaciones antes de guardar; no se sustituirá la base automáticamente.</p>}
        {edit.action==='prepare'?<><p>Organismo, referencia y hechos se recuperarán de la valoración revisada. Completa el razonamiento jurídico correspondiente a esta multa; no se añade texto ficticio.</p>
          <label>Actuación y fase revisadas<select required value={edit.document_type} onChange={e=>setEdit(d=>({...d,document_type:e.target.value}))}><option value="">Seleccionar</option>{['Alegaciones','Recurso de reposición','Recurso de alzada'].map(t=><option key={t}>{t}</option>)}</select></label>
          {[['primary_strategy','Enfoque propuesto'],['argument_title','Título de la alegación'],['argument_body','Argumentación revisada'],['legal_basis','Fundamentos contrastados (uno por línea; no inventar referencias)'],['requested_outcomes','Solicitudes concretas (una por línea)']].map(([key,label])=><label key={key}>{label}<textarea aria-label={label} required={key!=='legal_basis'} value={edit[key]} onChange={e=>setEdit(d=>({...d,[key]:e.target.value}))}/></label>)}
          <label><input type="checkbox" required checked={edit.reviewed} onChange={e=>setEdit(d=>({...d,reviewed:e.target.checked}))}/> He contrastado identidad, fase, hechos, argumentos y alcance contratado con los documentos.</label></>:
          <label>{edit.action==='recover_existing'?'Contenido anterior exacto, sin regenerar':'Contenido de la nueva versión'}<textarea aria-label="Contenido del borrador" className="cw-resource" rows={24} required readOnly={edit.action==='recover_existing'} value={edit.content} onChange={e=>setEdit(d=>({...d,content:e.target.value}))}/></label>}
        <label>Motivo de esta versión<textarea aria-label="Motivo de esta versión" required minLength={5} value={edit.correction_reason} onChange={e=>setEdit(d=>({...d,correction_reason:e.target.value}))}/></label>
        <p>Borrador de trabajo · no aprobado · no firmado · no presentado.</p><button type="submit">Guardar nueva versión de borrador</button><button type="button" onClick={()=>setEdit(null)}>Cerrar edición sin guardar</button>
      </fieldset></form>}
      {shown&&<article><h3>Borrador · versión {shown.snapshot.revision}</h3><p>{shown.snapshot.author.name} · {new Date(shown.snapshot.created_at).toLocaleString('es-ES')}</p><pre className="cw-resource">{shown.snapshot.content}</pre>{!!shown.snapshot.generation?.provider_result?.proposed?.review_notes?.length&&<><h4>Puntos para revisar</h4><ul>{shown.snapshot.generation.provider_result.proposed.review_notes.map((note,i)=><li key={i}>{note}</li>)}</ul></>}<p>Pendiente de aprobación · no presentado.</p></article>}
      <details><summary>Historial de versiones</summary>{data.drafts.history.map(v=><button key={v.id} disabled={busy} onClick={()=>void open(v.id)}>Leer versión {v.revision} · {new Date(v.created_at).toLocaleString('es-ES')}</button>)}</details></>}
  </section>;
}
