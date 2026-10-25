import React,{useEffect,useRef,useState} from 'react';
import {jsonRequest,root} from '../lib/paidCasework.js';
import OpsDocumentViewer from './OpsDocumentViewer.jsx';
const LABEL={prepared:'Preparado · no enviado',queued:'Pendiente de envío',sending:'Envío en curso',provider_accepted:'Aceptado por el proveedor · entrega no confirmada',delivered:'Entrega confirmada por evidencia',bounced:'Rebotado',failed:'Envío fallido',unknown:'Resultado desconocido · reconciliación necesaria',received:'Recibido',pending_assignment:'Pendiente de asignar'};
export default function OpsCommunications({caseId,authFetch,canWrite}){
  const [data,setData]=useState(null),[query,setQuery]=useState(''),[error,setError]=useState(''),[epoch,setEpoch]=useState(0);
  const [draft,setDraft]=useState({recipient:'',subject:'',body:'',reply_id:null}),[pending,setPending]=useState(null),[prepared,setPrepared]=useState(null);
  const [phase,setPhase]=useState('editing'),[approve,setApprove]=useState(false),[attachment,setAttachment]=useState(null);
  const live=useRef(true),lock=useRef(false),controllers=useRef(new Set());
  useEffect(()=>{live.current=true;return()=>{live.current=false;controllers.current.forEach(c=>c.abort());};},[]);
  useEffect(()=>{const ctl=new AbortController();controllers.current.add(ctl);setError('');
    jsonRequest(authFetch,`${root(caseId)}/communications?q=${encodeURIComponent(query)}`,{signal:ctl.signal}).then(r=>{
      if(r.case_id!==caseId||!Array.isArray(r.messages))throw new Error('Conversación no confirmada.');if(!ctl.signal.aborted)setData(r);
    }).catch(e=>{if(!ctl.signal.aborted){setData(null);setError(e.message);}}).finally(()=>controllers.current.delete(ctl));
    return()=>ctl.abort();},[caseId,authFetch,epoch,query]);
  async function task(fn){if(lock.current)return;lock.current=true;const ctl=new AbortController();controllers.current.add(ctl);
    try{await fn(ctl.signal);}catch(e){if(live.current&&!ctl.signal.aborted){setError(e.message);setPhase('unknown');}}finally{controllers.current.delete(ctl);lock.current=false;}}
  async function recover(operation,signal){
    const result=await jsonRequest(authFetch,`${root(caseId)}/communications/${operation.operation_id}`,{signal});
    if(result.case_id!==caseId||result.id!==operation.operation_id||result.message.subject!==operation.subject||
      result.message.body.trimEnd()!==operation.body.trimEnd()||result.message.recipients.length!==1||result.message.recipients[0]!==operation.recipient)throw new Error('El mensaje recuperado no coincide con el preparado.');
    if(!live.current||signal.aborted)return;
    setPrepared(result);setPhase('prepared');setApprove(false);setEpoch(e=>e+1);
  }
  function prepare(){if(phase!=='editing'||!canWrite)return;const operation={...draft,operation_id:crypto.randomUUID()};setPending(operation);setPhase('preparing');setError('');
    return task(async signal=>{await jsonRequest(authFetch,`${root(caseId)}/communications`,{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(operation)});await recover(operation,signal);});}
  function queue(){if(!approve||!prepared)return;setApprove(false);setPhase('queueing');
    return task(async signal=>{
      await jsonRequest(authFetch,`${root(caseId)}/communications/${prepared.id}/queue`,{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({approve_exact_message:true,original_sha256:prepared.message.raw_sha256})});
      const result=await jsonRequest(authFetch,`${root(caseId)}/communications/${prepared.id}`,{signal});
      if(result.id!==prepared.id||result.case_id!==caseId)throw new Error('Estado del envío no confirmado.');
      if(!live.current||signal.aborted)return;setPrepared(result);setPhase('queued');setEpoch(e=>e+1);
    });}
  function reply(item){if(phase!=='editing')return;setDraft({recipient:item.direction==='incoming'?item.message.sender:item.message.recipients[0],subject:'Re: '+item.message.subject.replace(/^Re:\s*/i,''),body:'',reply_id:item.id});}
  return <section aria-label="Comunicaciones"><h2>Comunicaciones del expediente</h2>
    <p>Mensajes destinados al cliente y respuestas recibidas. Las notas y valoraciones internas permanecen separadas y no se envían automáticamente.</p>
    <label>Buscar en esta conversación<input value={query} maxLength={200} onChange={e=>setQuery(e.target.value)}/></label><button onClick={()=>setEpoch(e=>e+1)}>Actualizar comunicaciones</button>
    {error&&<p role="alert">{error} No se interpreta como ausencia de novedades.</p>}
    {!data&&!error&&<p role="status">Consultando comunicaciones y estado de sincronización…</p>}
    {data&&<><p>Dirección operativa: {data.mailbox}</p><div role="status">{data.sync.state==='unconfigured'?'Recepción automática no configurada.':data.sync.state==='error'?'La última sincronización tiene un error. Puede haber mensajes pendientes.':'Últimas comprobaciones del buzón:'}
      {data.sync.folders.map(f=><p key={f.folder}>{f.folder}: último éxito {f.last_success_at||'no acreditado'}{f.error_code?' · '+f.error_code:''}</p>)}</div>
      {data.messages.length===0&&<p>La consulta del archivo no devuelve mensajes{query?' que coincidan con la búsqueda':''}. Esto no acredita que el buzón esté al día.</p>}
      {data.truncated&&<p>Se muestran los primeros 200 resultados. Acota la búsqueda.</p>}
      <ol>{data.messages.map(item=><li key={item.id} className="cw-snapshot"><h3>{item.message.subject}</h3><p>{item.direction==='incoming'?'Entrante':'Saliente'} · {LABEL[item.state]||'Estado no reconocido'}</p>
        <p>De: {item.message.sender} · Para: {item.message.recipients.join(', ')} · {item.message.sent_at||'Fecha original no disponible'}</p>
        {item.message.text_available?<pre className="cw-resource">{item.message.body}</pre>:<p>El original no contiene una parte de texto legible. Se conserva en custodia; no se ejecuta HTML.</p>}
        <button disabled={!canWrite||phase!=='editing'||!data.verified_recipients.includes(item.direction==='incoming'?item.message.sender:item.message.recipients[0])} onClick={()=>reply(item)}>Responder a este mensaje</button>
        {item.message.attachments.map(a=><p key={a.part}>{a.name} · Comprobación de seguridad necesaria <button onClick={()=>setAttachment({item,part:a})}>Consultar adjunto protegido</button></p>)}
        <details><summary>Trazabilidad y actuación vinculada</summary><pre>{JSON.stringify({original_id:item.message.original_id,references:item.message.references,author:item.author_id,relation:item.relation,sha256:item.message.raw_sha256},null,2)}</pre></details></li>)}</ol>
      <h3>Preparar un mensaje</h3><form onSubmit={e=>{e.preventDefault();void prepare();}}><fieldset disabled={!canWrite||phase!=='editing'}>
        <label>Destinatario verificado<select required value={draft.recipient} onChange={e=>setDraft(d=>({...d,recipient:e.target.value}))}><option value="">Seleccionar participante</option>{data.verified_recipients.map(r=><option key={r}>{r}</option>)}</select></label>
        {!data.verified_recipients.length&&<p>Falta verificar el destinatario del expediente. No se infiere ni se cambia por una respuesta de correo.</p>}
        <label>Asunto<input required aria-label="Asunto del mensaje" value={draft.subject} maxLength={200} onChange={e=>setDraft(d=>({...d,subject:e.target.value}))}/></label>
        <label>Mensaje<textarea required aria-label="Contenido del mensaje" value={draft.body} maxLength={50000} onChange={e=>setDraft(d=>({...d,body:e.target.value}))}/></label>
        <p>No se adjuntan automáticamente identidad, notas internas ni borradores. La comunicación de una revisión o presupuesto exige su habilitación y versión concreta; el correo no las sustituye.</p>
        <button type="submit">Guardar mensaje preparado</button></fieldset></form>
      {phase==='unknown'&&pending&&<button onClick={()=>void task(signal=>recover(pending,signal))}>Consultar la misma operación antes de repetir</button>}
      {prepared&&<article className="cw-snapshot"><h3>Mensaje recuperado</h3><p>{LABEL[prepared.state]}</p><pre>{prepared.message.body}</pre>
        {phase==='prepared'&&prepared.state==='prepared'&&<><label><input type="checkbox" checked={approve} onChange={e=>setApprove(e.target.checked)}/> Apruebo el envío de este contenido exacto a {prepared.message.recipients.join(', ')}.</label><button disabled={!approve} onClick={()=>void queue()}>Poner este mensaje en la cola de envío</button></>}
        {phase==='queued'&&<button onClick={()=>{setDraft({recipient:'',subject:'',body:'',reply_id:null});setPending(null);setPrepared(null);setPhase('editing');}}>Preparar otra comunicación</button>}</article>}
    </>}
    {attachment&&<OpsDocumentViewer key={`${attachment.item.id}:${attachment.part.part}`} caseId={caseId}
      document={{id:`${attachment.item.id}:${attachment.part.part}`}} viewBase={`${root(caseId)}/communications/${attachment.item.id}/attachments/${attachment.part.part}`}
      authFetch={authFetch} onClose={()=>setAttachment(null)}/>}
  </section>;
}
