import React,{useEffect,useRef,useState} from 'react';
import {useLocation,useNavigate,useParams} from 'react-router-dom';
import {jsonRequest,UUID} from '../lib/paidCasework.js';
import {post,money,BALANCE_LABELS} from '../lib/managementJourney.js';
import {QuoteDetails} from '../components/OpsManagementQuote.jsx';
import '../components/OpsPaidCase.css';

const base='/api/client/management';
const request=(url,options={})=>fetch(url,{...options,credentials:'same-origin',cache:'no-store'});
const closureKey='rtm.client.closure.v1';
function pendingClosure(){const ref=localStorage.getItem(closureKey);if(ref!==null&&!/^[a-f0-9]{64}$/.test(ref))throw new Error('La referencia de cierre necesita revisión.');return ref;}
export default function ClientManagement(){
  const {caseId}=useParams(),location=useLocation(),navigate=useNavigate();
  const [link,setLink]=useState(new URLSearchParams(location.search).get('enlace')||'');
  const [data,setData]=useState(null),[email,setEmail]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[needsLogin,setNeedsLogin]=useState(false),[accepted,setAccepted]=useState(false),[closing,setClosing]=useState(false);
  const active=useRef(true),controller=useRef(null),locked=useRef(false);
  const path=base+'/cases/'+caseId;
  useEffect(()=>{
    const incoming=new URLSearchParams(location.search).get('enlace');
    if(incoming){setLink(incoming);navigate('/cliente/expediente/'+caseId,{replace:true});}
  },[caseId,location.search,navigate]);
  async function load(signal){const r=await jsonRequest(request,path,{signal});if(r.case_id!==caseId)throw new Error('El acceso no corresponde a este expediente.');
    if(active.current&&!signal?.aborted&&!pendingClosure()){setData(r);setNeedsLogin(false);}return r;}
  async function task(fn){if(locked.current)return;locked.current=true;setBusy(true);setError('');const ctl=new AbortController();controller.current=ctl;
    try{await fn(ctl.signal);}catch(e){if(active.current&&!ctl.signal.aborted){if(e.status===401){setData(null);setNeedsLogin(true);}setError(e.message);}}finally{locked.current=false;if(active.current)setBusy(false);}}
  useEffect(()=>{active.current=true;
    if(!UUID.test(caseId||'')){setError('El enlace no contiene una referencia válida.');return;}
    const changed=e=>{if(e.key!==closureKey)return;controller.current?.abort();setData(null);setAccepted(false);setClosing(e.newValue!==null);setNeedsLogin(e.newValue===null);};
    window.addEventListener('storage',changed);
    void task(async signal=>{if(pendingClosure()){setClosing(true);return;}await load(signal);if(new URLSearchParams(location.search).get('pago')==='consultar'){
      await post(request,path+'/payment-status',{},signal);await load(signal);}});
    return()=>{active.current=false;controller.current?.abort();window.removeEventListener('storage',changed);};},[caseId]);
  function askLink(){return task(async signal=>{const r=await post(request,base+'/access',{case_id:caseId,email},signal);if(active.current)setNotice(r.message);});}
  function enter(){return task(async signal=>{await post(request,base+'/redeem',{token:link},signal);setLink('');await load(signal);setNotice('Sesión privada de cliente.');});}
  async function finishLogout(sessionRef,signal){
    const r=await post(request,base+'/logout',{session_ref:sessionRef},signal);
    if(r.closed_session_ref!==sessionRef)throw new Error('Cierre no confirmado.');
    if(pendingClosure()===sessionRef)localStorage.removeItem(closureKey);
    if(active.current){setClosing(false);setNeedsLogin(true);setData(null);setNotice('Sesión cerrada.');}
  }
  function logout(){if(!data)return;const sessionRef=data.session_ref;setClosing(true);setData(null);setAccepted(false);setNotice('Cierre en curso.');
    return task(async signal=>{localStorage.setItem(closureKey,sessionRef);if(pendingClosure()!==sessionRef)throw new Error('No se pudo conservar la referencia de cierre.');await finishLogout(sessionRef,signal);});}
  function resolveLogout(){return task(async signal=>{const ref=pendingClosure();if(!ref)throw new Error('No se ha confirmado la referencia de cierre.');await finishLogout(ref,signal);});}
  function pay(){return task(async signal=>{
    const q=data.quote;
    if(!q||(!accepted&&!['accepted','settled'].includes(q.state)))throw new Error('Confirma expresamente la versión del presupuesto.');
    const key='rtm.client.acceptance.v1.'+caseId+'.'+q.id;
    let operation=localStorage.getItem(key);if(!operation){operation=crypto.randomUUID();localStorage.setItem(key,operation);}
    if(!UUID.test(operation))throw new Error('La referencia de aceptación necesita revisión.');
    if(!['accepted','settled'].includes(q.state))await post(request,path+'/accept',{operation_id:operation,quote_id:q.id,quote_sha256:q.sha256,accept_exact_version:true},signal);
    const r=await post(request,path+'/checkout',{quote_id:q.id,quote_sha256:q.sha256},signal);
    if(r.balance.checkout_url){const url=new URL(r.balance.checkout_url);if(url.protocol!=='https:'||url.hostname!=='checkout.stripe.com'||url.username||url.password||!url.pathname.startsWith('/c/'))throw new Error('Dirección de pago no verificada.');window.location.assign(url.href);}
    else{await load(signal);setNotice(BALANCE_LABELS[r.balance.state]||'Consulta del pago pendiente.');}
  });}
  return <main className="cw-case sr-container"><header><h1>Tu expediente · acceso privado</h1><p>Conservamos tu estudio y su pago. Este acceso no crea otro expediente ni repite la autorización.</p></header>
    {error&&<p role="alert">{error} Un error no significa que falte un pago o una propuesta.</p>}{notice&&<p role="status">{notice}</p>}{busy&&<p role="status">Consultando el resultado…</p>}
    {closing?<><p>El cierre todavía no está resuelto. Los datos ya se han retirado de esta pantalla.</p><button disabled={busy} onClick={()=>void resolveLogout()}>Consultar el cierre</button></>:
      !data&&needsLogin?<section><h2>Identifícate para continuar</h2>{link&&<button disabled={busy} onClick={()=>void enter()}>Entrar con el enlace privado recibido</button>}
        <form onSubmit={e=>{e.preventDefault();void askLink();}}><label>Correo del expediente<input type="email" autoComplete="email" required value={email} onChange={e=>setEmail(e.target.value)}/></label><button disabled={busy} type="submit">Recibir enlace privado para entrar</button></form><p>El enlace es de un solo uso. No compartas tu sesión ni tu enlace.</p></section>:null}
    {!data&&!needsLogin&&!busy&&!closing&&<button onClick={()=>void task(signal=>load(signal))}>Consultar el acceso privado</button>}
    {data&&!closing&&<><button disabled={busy} onClick={()=>void logout()}>Cerrar sesión de cliente</button>
      <h2>Estudio inicial</h2><p>{data.initial_study.state==='provider_verified'?'Estudio inicial pagado: '+money(data.initial_study.amount_cents):'Confirmación del estudio pendiente de consulta. No se ofrece otro cobro.'}</p>
      {data.quote?<><QuoteDetails quote={data.quote}/><h2>Saldo de gestión</h2><p>{BALANCE_LABELS[data.balance.state]||'Resultado todavía no confirmado'}</p>
        <button disabled={busy} onClick={()=>void task(async signal=>{if(data.balance.state!=='not_started')await post(request,path+'/payment-status',{},signal);await load(signal);})}>Consultar confirmación del pago</button>
        {!['confirmed','review_required','expired','retiring'].includes(data.balance.state)&&new Date(data.quote.expires_at)>new Date()&&<>
          {!['accepted','settled'].includes(data.quote.state)&&<label><input type="checkbox" checked={accepted} disabled={busy} onChange={e=>setAccepted(e.target.checked)}/> He leído el alcance, las exclusiones, la valoración y el precio. Acepto expresamente el presupuesto versión {data.quote.revision}.</label>}
          <button disabled={busy||(!accepted&&!['accepted','settled'].includes(data.quote.state))} onClick={()=>void pay()}>{data.balance.state==='unknown'?'Recuperar la misma sesión de pago':data.quote.state==='accepted'?'Continuar con el pago de '+money(data.quote.economics.balance_cents):'Aceptar y pagar '+money(data.quote.economics.balance_cents)}</button></>}
        {new Date(data.quote.expires_at)<=new Date()&&data.balance.state!=='confirmed'&&<p>La vigencia comercial ha terminado. El operador debe revisar la propuesta y cualquier pago pendiente antes de abrir otro cobro.</p>}
        {data.balance.state==='confirmed'&&<p>Saldo registrado. El operador puede continuar la preparación y revisión del recurso cuando estén completos los requisitos documentales y jurídicos. Un borrador interno no se entrega automáticamente.</p>}</>:
        <p>La consulta se ha completado: todavía no hay una propuesta habilitada para tu acceso privado.</p>}
    </>}
    <footer className="cw-no-presentation">No presentado. Aceptar o pagar no firma ni presenta un recurso.</footer></main>;
}
