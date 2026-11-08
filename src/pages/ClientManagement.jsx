import React,{useEffect,useRef,useState} from 'react';
import {useLocation,useNavigate,useParams} from 'react-router-dom';
import {jsonRequest,UUID} from '../lib/paidCasework.js';
import {post,money,BALANCE_LABELS,GENERATION_LABELS} from '../lib/managementJourney.js';
import {QuoteDetails} from '../components/OpsManagementQuote.jsx';
import InvoiceRequestFields,{emptyInvoiceData,validInvoiceData} from '../components/InvoiceRequestFields.jsx';
import '../components/OpsPaidCase.css';

const base='/api/client/management';
const request=(url,options={})=>fetch(url,{...options,credentials:'same-origin',cache:'no-store'});
const closureKey='rtm.client.closure.v1';
const accessEventKey='rtm.client.access-change.v1';
const binding=d=>d?.quote?JSON.stringify([d.case_id,d.session_ref,d.quote.id,d.quote.sha256]):null;
function pendingClosure(){const ref=localStorage.getItem(closureKey);if(ref!==null&&!/^[a-f0-9]{64}$/.test(ref))throw new Error('La referencia de cierre necesita revisión.');return ref;}
export default function ClientManagement(){
  const {caseId}=useParams(),location=useLocation(),navigate=useNavigate();
  const [link,setLink]=useState(new URLSearchParams(location.search).get('enlace')||'');
  const [data,setData]=useState(null),[email,setEmail]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[needsLogin,setNeedsLogin]=useState(false),[accepted,setAccepted]=useState(false),[closing,setClosing]=useState(false);
  const [invoiceRequested,setInvoiceRequested]=useState(false),[invoiceData,setInvoiceData]=useState(emptyInvoiceData);
  const active=useRef(true),controller=useRef(null),locked=useRef(false),current=useRef(null);
  const path=base+'/cases/'+caseId;
  useEffect(()=>{
    const incoming=new URLSearchParams(location.search).get('enlace');
    if(incoming){withdraw(401);setLink(incoming);navigate('/cliente/expediente/'+caseId,{replace:true});}
  },[caseId,location.search,navigate]);
  function broadcast(kind){localStorage.setItem(accessEventKey,JSON.stringify({kind,nonce:crypto.randomUUID()}));}
  function withdraw(status){controller.current?.abort();controller.current=null;locked.current=false;setBusy(false);current.current=null;setData(null);setAccepted(false);setEmail('');setLink('');setNotice('');setInvoiceRequested(false);setInvoiceData(emptyInvoiceData);setNeedsLogin(status===401);}
  function valid(signal){return active.current&&!signal.aborted&&controller.current?.signal===signal;}
  async function load(signal){const r=await jsonRequest(request,path,{signal});if(!valid(signal))throw new DOMException('Consulta retirada','AbortError');
    if(r.case_id!==caseId){const e=new Error('El acceso no corresponde a este expediente.');e.status=403;throw e;}
    if(!pendingClosure()){
      if(binding(current.current)!==binding(r))setAccepted(false);
      if(current.current&&current.current.session_ref!==r.session_ref)broadcast('changed');
      current.current=r;setData(r);setNeedsLogin(false);
    }return r;}
  async function task(fn){if(locked.current)return;locked.current=true;setBusy(true);setError('');const ctl=new AbortController();controller.current=ctl;
    try{await fn(ctl.signal);}catch(e){if(valid(ctl.signal)){if(e.status===401||e.status===403){withdraw(e.status);broadcast(String(e.status));}setError(e.status===403?'El acceso a este expediente no está autorizado o ha caducado.':e.message);}}finally{if(controller.current===ctl){controller.current=null;locked.current=false;if(active.current)setBusy(false);}}}
  useEffect(()=>{active.current=true;
    if(!UUID.test(caseId||'')){setError('El enlace no contiene una referencia válida.');return;}
    current.current=null;setData(null);setAccepted(false);setInvoiceRequested(false);setInvoiceData(emptyInvoiceData);setNeedsLogin(false);setError('');
    const changed=e=>{
      if(e.key===accessEventKey){let kind;try{kind=JSON.parse(e.newValue)?.kind;}catch{return;}withdraw(kind==='401'?401:403);setError('El acceso cambió en otra pestaña. Consulta de nuevo antes de continuar.');}
      if(e.key===closureKey){withdraw(401);setClosing(e.newValue!==null);setNeedsLogin(e.newValue===null);}
    };
    window.addEventListener('storage',changed);
    void task(async signal=>{if(pendingClosure()){setClosing(true);return;}if(new URLSearchParams(location.search).has('enlace')){setNeedsLogin(true);return;}await load(signal);if(new URLSearchParams(location.search).get('pago')==='consultar'){
      await post(request,path+'/payment-status',{},signal);await load(signal);}});
    return()=>{active.current=false;controller.current?.abort();controller.current=null;locked.current=false;current.current=null;window.removeEventListener('storage',changed);};},[caseId]);
  function askLink(){return task(async signal=>{const r=await post(request,base+'/access',{case_id:caseId,email},signal);if(valid(signal))setNotice(r.message);});}
  useEffect(()=>{if(closing||data?.balance?.state!=='confirmed'||!['pending','running','retry'].includes(data?.generation?.state))return;
    const timer=setInterval(()=>void task(signal=>load(signal)),5000);return()=>clearInterval(timer);
  },[caseId,closing,data?.balance?.state,data?.generation?.state]);
  function enter(){return task(async signal=>{await post(request,base+'/redeem',{token:link},signal);if(!valid(signal))return;setLink('');setAccepted(false);broadcast('changed');await load(signal);if(valid(signal))setNotice('Sesión privada de cliente.');});}
  async function finishLogout(sessionRef,signal){
    const r=await post(request,base+'/logout',{session_ref:sessionRef},signal);
    if(r.closed_session_ref!==sessionRef)throw new Error('Cierre no confirmado.');
    if(pendingClosure()===sessionRef)localStorage.removeItem(closureKey);
    if(valid(signal)){current.current=null;setClosing(false);setNeedsLogin(true);setData(null);setNotice('Sesión cerrada.');}
  }
  function logout(){if(!data||locked.current)return;const sessionRef=data.session_ref;current.current=null;setClosing(true);setData(null);setAccepted(false);setNotice('Cierre en curso.');
    return task(async signal=>{localStorage.setItem(closureKey,sessionRef);if(pendingClosure()!==sessionRef)throw new Error('No se pudo conservar la referencia de cierre.');await finishLogout(sessionRef,signal);});}
  function resolveLogout(){return task(async signal=>{const ref=pendingClosure();if(!ref)throw new Error('No se ha confirmado la referencia de cierre.');await finishLogout(ref,signal);});}
  function pay(){return task(async signal=>{
    if(invoiceRequested&&!validInvoiceData(invoiceData))throw new Error('Completa todos los datos fiscales para solicitar la factura.');
    const expected=binding(data),confirmed=accepted,q=data.quote;
    if(!q||(!['accepted','settled'].includes(q.state)&&confirmed!==expected))throw new Error('Confirma expresamente la versión del presupuesto.');
    const fresh=await load(signal);
    if(!valid(signal)||binding(fresh)!==expected||binding(current.current)!==expected)throw new Error('La propuesta o la sesión ha cambiado. Revisa y confirma la versión actual.');
    const key='rtm.client.acceptance.v1.'+caseId+'.'+q.id;
    let operation=localStorage.getItem(key);if(!operation){operation=crypto.randomUUID();localStorage.setItem(key,operation);}
    if(!UUID.test(operation))throw new Error('La referencia de aceptación necesita revisión.');
    if(!['accepted','settled'].includes(fresh.quote.state))await post(request,path+'/accept',{operation_id:operation,quote_id:q.id,quote_sha256:q.sha256,accept_exact_version:true,expected_session_ref:fresh.session_ref},signal);
    if(!valid(signal))return;
    const r=await post(request,path+'/checkout',{quote_id:q.id,quote_sha256:q.sha256,expected_session_ref:fresh.session_ref,
      invoice_requested:invoiceRequested,invoice_data:invoiceRequested?invoiceData:null},signal);
    if(!valid(signal))return;
    if(r.balance.checkout_url){const url=new URL(r.balance.checkout_url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com'||url.username||url.password||!url.pathname.startsWith('/c/'))throw new Error('Dirección de pago no verificada.');window.location.assign(url.href);}
    else{await load(signal);setNotice(BALANCE_LABELS[r.balance.state]||'Consulta del pago pendiente.');}
  });}
  return <main className="cw-case sr-container"><header><h1>Tu expediente · acceso privado</h1><p>Conservamos tu estudio y su pago. Este acceso no crea otro expediente ni repite la autorización.</p></header>
    {error&&<p role="alert">{error} Un error no significa que falte un pago o una propuesta.</p>}{notice&&<p role="status">{notice}</p>}{busy&&<p role="status">Consultando el resultado…</p>}
    {closing?<><p>El cierre todavía no está resuelto. Los datos ya se han retirado de esta pantalla.</p><button disabled={busy} onClick={()=>void resolveLogout()}>Consultar el cierre</button></>:
      !data&&needsLogin?<section><h2>Identifícate para continuar</h2>{link&&<button disabled={busy} onClick={()=>void enter()}>Entrar con el enlace privado recibido</button>}
        <form onSubmit={e=>{e.preventDefault();void askLink();}}><label>Correo del expediente<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><button disabled={busy} type="submit">Recibir enlace privado para entrar</button></form><p>El enlace es de un solo uso. No compartas tu sesión ni tu enlace.</p></section>:null}
    {!data&&!needsLogin&&!busy&&!closing&&<button onClick={()=>void task(signal=>load(signal))}>Consultar el acceso privado</button>}
    {data&&data.case_id===caseId&&!closing&&<><button disabled={busy} onClick={()=>void logout()}>Cerrar sesión de cliente</button>
      <h2>Estudio inicial</h2><p>{data.initial_study.state==='provider_verified'?'Estudio inicial pagado: '+money(data.initial_study.amount_cents):'Confirmación del estudio pendiente de consulta. No se ofrece otro cobro.'}</p>
      {data.quote?<><QuoteDetails quote={data.quote}/><h2>Saldo de gestión</h2><p>{BALANCE_LABELS[data.balance.state]||'Resultado todavía no confirmado'}</p>
        <button disabled={busy} onClick={()=>void task(async signal=>{if(data.balance.state!=='not_started')await post(request,path+'/payment-status',{},signal);await load(signal);})}>Consultar confirmación del pago</button>
        {!['confirmed','review_required','expired','retiring'].includes(data.balance.state)&&new Date(data.quote.expires_at)>new Date()&&<>
          {!['accepted','settled'].includes(data.quote.state)&&<label><input type="checkbox" checked={accepted===binding(data)} disabled={busy} onChange={e=>setAccepted(e.target.checked?binding(data):false)}/> He leído el alcance, las exclusiones, la valoración y el precio. Acepto expresamente el presupuesto versión {data.quote.revision}.</label>}
          <button disabled={busy||(accepted!==binding(data)&&!['accepted','settled'].includes(data.quote.state))} onClick={()=>void pay()}>{data.balance.state==='unknown'?'Recuperar la misma sesión de pago':data.quote.state==='accepted'?'Continuar con el pago de '+money(data.quote.economics.balance_cents):'Aceptar y pagar '+money(data.quote.economics.balance_cents)}</button></>}
        {!['confirmed','review_required','expired','retiring'].includes(data.balance.state)&&new Date(data.quote.expires_at)>new Date()&&<InvoiceRequestFields requested={invoiceRequested} onRequestedChange={setInvoiceRequested} data={invoiceData} onDataChange={setInvoiceData} disabled={busy}/>}
        {new Date(data.quote.expires_at)<=new Date()&&data.balance.state!=='confirmed'&&<p>La vigencia comercial ha terminado. El operador debe revisar la propuesta y cualquier pago pendiente antes de abrir otro cobro.</p>}
        {data.balance.state==='confirmed'&&<p role="status">{GENERATION_LABELS[data.generation?.state]||'Pago íntegro registrado. Consultando la generación del recurso.'}</p>}</>:
        <p>La consulta se ha completado: todavía no hay una propuesta habilitada para tu acceso privado.</p>}
    </>}
    <footer className="cw-no-presentation">No presentado. Aceptar o pagar no firma ni presenta un recurso.</footer></main>;
}
