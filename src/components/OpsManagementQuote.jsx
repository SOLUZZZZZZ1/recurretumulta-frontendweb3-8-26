import React,{useEffect,useRef,useState} from 'react';
import {jsonRequest,root} from '../lib/paidCasework.js';
import {managementRoot,money,BALANCE_LABELS,REQUIREMENTS,verifyRecord,pendingOperation,rememberOperation,forgetOperation,withOperationLock,post} from '../lib/managementJourney.js';
import {FINE_OFFER} from '../lib/fineOffer.js';

export function QuoteDetails({quote}){
  const q=quote.snapshot||quote,e=q.economics;
  return <article className="cw-snapshot"><h3>Presupuesto · versión {q.revision}</h3><h4>{q.title}</h4>
    <p>Valoración autorizada para el cliente</p><pre className="cw-resource">{q.client_summary}</pre>
    <h4>Alcance</h4><pre className="cw-resource">{q.scope}</pre><h4>Exclusiones</h4><pre className="cw-resource">{q.exclusions}</pre>
    <dl><div><dt>Total, impuestos incluidos</dt><dd>{money(e.total_cents)}</dd></div><div><dt>Base</dt><dd>{money(e.net_cents)}</dd></div>
      <div><dt>{e.tax_label} · {e.tax_basis_points/100}%</dt><dd>{money(e.tax_cents)}</dd></div><div><dt>Estudio inicial abonado y aplicado</dt><dd>{money(e.study_credit_cents)}</dd></div><div><dt>Saldo de gestión</dt><dd>{money(e.balance_cents)}</dd></div></dl>
    <p>Oferta válida hasta {new Date(q.expires_at).toLocaleString('es-ES')}. Esta fecha no es el plazo administrativo de la multa.</p><p>{q.mode==='test'?'Stripe TEST · ensayo sin dinero real':'Pago LIVE'} · No presentado.</p></article>;
}

export default function OpsManagementQuote({caseId,operatorId,authFetch,study,canWrite}){
  const [data,setData]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false),[form,setForm]=useState(null),[pending,setPending]=useState(null),[message,setMessage]=useState(null),[approve,setApprove]=useState(false),[notice,setNotice]=useState('');
  const live=useRef(true),controller=useRef(null),locked=useRef(false);
  useEffect(()=>{live.current=true;try{setPending(pendingOperation(caseId,operatorId,'quote'));}catch(e){setError(e.message);setPending({invalid:true});}return()=>{live.current=false;controller.current?.abort();};},[caseId,operatorId,authFetch]);
  async function load(signal){const result=await jsonRequest(authFetch,managementRoot(caseId),{signal});
    if(result.case_id!==caseId)throw new Error('El expediente no coincide.');for(const q of result.quotes.history)await verifyRecord(q,caseId,'quote');
    if(live.current&&!signal?.aborted)setData(result);return result;}
  // All failures remain visible; a failed query is never an empty quote or zero balance.
  async function task(fn){if(locked.current)return;locked.current=true;setBusy(true);setError('');const ctl=new AbortController();controller.current=ctl;
    try{await fn(ctl.signal);}catch(e){if(live.current&&!ctl.signal.aborted)setError(e.message);}finally{locked.current=false;if(live.current)setBusy(false);}}
  useEffect(()=>{void task(signal=>load(signal));},[]);
  function edit(){const old=data.quotes.latest?.snapshot;setForm({expected_quote_id:old?.id||null,study_operation_id:study.latest.snapshot.operation_id,study_sha256:study.latest.sha256,title:old?.title||'Recurso de multa · una actuación y fase',scope:old?.scope||FINE_OFFER.basicScope,exclusions:old?.exclusions||FINE_OFFER.exclusions,client_summary:'',total_cents:data.agreed_total_cents||old?.economics.total_cents||3900,expires_at:new Date(Date.now()+7*86400000-Date.now()%60000-new Date().getTimezoneOffset()*60000).toISOString().slice(0,16),review_confirmed:false});setNotice('');}
  async function save(){if(!form||!study.latest)return;await task(signal=>withOperationLock(caseId,operatorId,'quote',async()=>{
    const payload={...form,operation_id:crypto.randomUUID(),expires_at:new Date(form.expires_at).toISOString()};
    const ref=await rememberOperation(caseId,operatorId,'quote',payload);setPending(ref);
    const result=await post(authFetch,managementRoot(caseId)+'/quotes',payload,signal);await verifyRecord(result.quote,caseId,'quote');
    const fresh=await load(signal);const recovered=fresh.quotes.history.find(q=>q.snapshot.id===ref.operation_id);
    if(!recovered||recovered.sha256!==result.quote.sha256)throw new Error('El guardado no se ha recuperado todavía.');
    forgetOperation(ref);if(live.current){setPending(null);setForm(null);setNotice('Presupuesto guardado y recuperado. Todavía no se ha enviado.');}
  }));}
  async function recover(){await task(signal=>withOperationLock(caseId,operatorId,'quote',async()=>{
    const ref=pendingOperation(caseId,operatorId,'quote');if(!ref)return;
    const r=await post(authFetch,`${managementRoot(caseId)}/operations/quote/${ref.operation_id}/reconcile`,{},signal);
    if(r.status==='committed')await verifyRecord(r.result.quote,caseId,'quote');else if(r.status!=='cancelled')throw new Error('El resultado sigue pendiente. No se enviará otro presupuesto.');
    forgetOperation(ref);if(live.current){setPending(null);setNotice(r.status==='committed'?'Se recuperó el mismo presupuesto confirmado.':'La operación no se guardó y ha quedado cancelada frente a peticiones tardías.');}await load(signal);
  }));}
  function prepareMessage(){return task(async signal=>{const q=data.quotes.latest;
    const r=await post(authFetch,managementRoot(caseId)+'/quote-message',{operation_id:q.snapshot.id,quote_id:q.snapshot.id,quote_sha256:q.sha256},signal);
    const checked=await jsonRequest(authFetch,`${root(caseId)}/communications/${q.snapshot.id}`,{signal});
    if(checked.message.raw_sha256!==r.message.raw_sha256)throw new Error('No coincide el mensaje recuperado.');if(live.current){setMessage(checked);setApprove(false);}
  });}
  function sendMessage(){return task(async signal=>{await post(authFetch,`${root(caseId)}/communications/${message.id}/queue`,{approve_exact_message:true,original_sha256:message.message.raw_sha256},signal);
    const r=await jsonRequest(authFetch,`${root(caseId)}/communications/${message.id}`,{signal});if(live.current){setMessage(r);setApprove(false);setNotice('Consulta el estado de envío y la conversación en Comunicaciones. En cola no significa entregado.');}await load(signal);});}
  return <section><h2>Presupuesto y pagos</h2><p>El estudio inicial y la gestión posterior conservan sus pagos separados.</p>
    {error&&<p role="alert">{error}</p>}{notice&&<p role="status">{notice}</p>}{busy&&<p role="status">Comprobando la misma operación…</p>}
    {!data&&!error&&<p>Consultando presupuesto y confirmaciones…</p>}<button disabled={busy} onClick={()=>void task(signal=>load(signal))}>Actualizar presupuesto y pagos</button>
    {pending&&<p role="alert">Hay un guardado pendiente. {pending.invalid?'Su referencia necesita revisión.':<button disabled={busy} onClick={()=>void recover()}>Recuperar el mismo guardado</button>}</p>}
    {data&&<><p>Estudio inicial: {data.initial_payment.state==='provider_verified'?money(data.initial_payment.amount_cents)+' confirmado por Stripe':'Consta en el estudio; falta contrastar el recibo con Stripe para el presupuesto.'}</p>
      <p>{BALANCE_LABELS[data.balance.state]||'Estado de saldo no reconocido'}</p>
      {!!data.study_requirements.length&&<ul>{data.study_requirements.map(r=><li key={r}>{REQUIREMENTS[r]||r}</li>)}</ul>}
      {data.quotes.latest&&<QuoteDetails quote={data.quotes.latest}/>}
      {!form&&<button disabled={!canWrite||busy||!!pending||!!data.study_requirements.length||data.quotes.latest?.state==='settled'} onClick={edit}>{data.quotes.latest?'Preparar otra versión del presupuesto':'Preparar presupuesto'}</button>}
      {data.balance.id&&!['confirmed','expired','not_started'].includes(data.balance.state)&&<button disabled={busy} onClick={()=>void task(async signal=>{await post(authFetch,`${managementRoot(caseId)}/checkout/${data.balance.id}/retire`,{},signal);await load(signal);})}>Cerrar y comprobar el Checkout anterior antes de cambiar el presupuesto</button>}
      {form&&<form onSubmit={e=>{e.preventDefault();void save();}}><fieldset disabled={busy||!!pending||!canWrite}>
        {form.expected_quote_id!==(data.quotes.latest?.snapshot.id||null)&&<p role="alert">Otra versión se ha guardado. Tu texto y su base se conservan; revisa ambas propuestas antes de crear otra.</p>}
        {[['title','Actuación propuesta'],['scope','Alcance'],['exclusions','Exclusiones'],['client_summary','Valoración autorizada para el cliente (sin notas internas)']].map(([key,label])=><label key={key}>{label}<textarea aria-label={label} required value={form[key]} onChange={e=>setForm(f=>({...f,[key]:e.target.value}))}/></label>)}
        <label>Total, impuestos incluidos (€)<input type="number" min="39" step="0.01" required readOnly={!!data.agreed_total_cents} value={form.total_cents/100} onChange={e=>setForm(f=>({...f,total_cents:Math.round(Number(e.target.value)*100)}))}/></label>
        <p>El servidor verificará y aplicará los 10 € una sola vez. {data.tax_label}: {data.tax_basis_points/100}% incluido.</p>
        <label>Vigencia comercial (hora local)<input type="datetime-local" required value={form.expires_at} onChange={e=>setForm(f=>({...f,expires_at:e.target.value}))}/></label>
        <label><input type="checkbox" required checked={form.review_confirmed} onChange={e=>setForm(f=>({...f,review_confirmed:e.target.checked}))}/> He revisado esta valoración, el alcance y los importes.</label>
        <button type="submit">Guardar presupuesto para vista previa</button><button type="button" onClick={()=>setForm(null)}>Cerrar edición sin guardar</button></fieldset></form>}
      {data.quotes.latest?.state==='prepared'&&!form&&<button disabled={busy||!!pending||!data.verified_recipient} onClick={()=>void prepareMessage()}>Preparar mensaje al cliente</button>}
      {!data.verified_recipient&&<p>Falta confirmar el destinatario para comunicar la propuesta.</p>}
      {message&&<article className="cw-snapshot"><h3>Vista previa del mensaje exacto</h3><p>Para: {message.message.recipients.join(', ')}</p><p>{message.message.subject}</p><pre className="cw-resource">{message.message.body}</pre><p>Estado: {message.state}</p>
        {message.state==='prepared'&&<><label><input type="checkbox" checked={approve} onChange={e=>setApprove(e.target.checked)}/> Apruebo este mensaje y esta versión para el destinatario mostrado.</label><button disabled={!approve||busy} onClick={()=>void sendMessage()}>Enviar presupuesto al cliente</button></>}</article>}
      <details><summary>Versiones anteriores</summary>{data.quotes.history.slice(1).map(q=><QuoteDetails key={q.snapshot.id} quote={q}/>)}</details></>}
  </section>;
}
