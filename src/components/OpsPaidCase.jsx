import React,{useEffect,useRef,useState} from 'react';
import {Link,useParams} from 'react-router-dom';
import {OpsAuthProvider,OpsAuthBoundary,useOpsAuth} from '../ops-auth/OpsAuthContext.jsx';
import {CASEWORK_CONTRACT,fieldText,jsonRequest,root,verifyAssessment,documentLabel,sha256} from '../lib/paidCasework.js';
import OpsDocumentViewer from './OpsDocumentViewer.jsx';
import OpsPaidStudy from './OpsPaidStudy.jsx';
import OpsCommunications from './OpsCommunications.jsx';
import './OpsPaidCase.css';

function CaseList(){
  const auth=useOpsAuth();const [result,setResult]=useState(null),[error,setError]=useState('');
  useEffect(()=>{const ctl=new AbortController();
    jsonRequest(auth.authFetch,'/api/ops/core/cases',{signal:ctl.signal}).then(r=>{if(!ctl.signal.aborted)setResult(r);}).catch(e=>{if(!ctl.signal.aborted)setError(e.message);});
    return()=>ctl.abort();},[auth.authFetch]);
  return <main className="cw-case sr-container"><header><h1>Expedientes para trabajar</h1><p>{auth.session.operator.displayName} · sesión individual</p><button onClick={auth.logout}>Cerrar sesión</button></header>
    {error?<p role="alert">{error}</p>:!result?<p role="status">Consultando expedientes autorizados…</p>:result.cases.map(c=><article key={c.id}><h2>{fieldText(c.case.identities.interested.full_name)}</h2>
      <p>{fieldText(c.case.fields.customer_comment)}</p><Link to={`/ops/case/${c.id}`}>Abrir expediente</Link></article>)}</main>;
}

function Resource({caseId,resources,authFetch}){
  const [read,setRead]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const ctlRef=useRef(null);
  useEffect(()=>()=>ctlRef.current?.abort(),[]);
  async function open(id){
    ctlRef.current?.abort();const ctl=new AbortController();ctlRef.current=ctl;setRead(null);setError('');setBusy(true);
    try{const value=await jsonRequest(authFetch,`${root(caseId)}/resources/${id}`,{signal:ctl.signal});
      if(value.case_id!==caseId||value.id!==id||typeof value.content!=='string'||await sha256(value.content)!==value.sha256||value.operator_export_allowed!==false)throw new Error('No se pudo verificar el contenido del recurso.');
      if(!ctl.signal.aborted)setRead(value);
    }catch(e){if(!ctl.signal.aborted)setError(e.message);}finally{if(!ctl.signal.aborted)setBusy(false);}
  }
  return <section><h2>Recurso</h2>{resources.status==='not_recorded'?<><p>Recurso todavía no preparado en el archivo de recursos consultado.</p><p>El siguiente paso es completar la valoración del estudio. La contratación de la gestión y la preparación/corrección del recurso son etapas posteriores; esta entrega no las habilita.</p></>:
    <><p>Versiones conservadas en el archivo de recursos. Su lectura no las modifica ni regenera.</p>{resources.items.map(r=><button key={r.id} onClick={()=>void open(r.id)}>Leer versión {r.version}{r.is_final?' · marcada final':''}</button>)}</>}
    {busy&&<p role="status">Recuperando versión…</p>}{error&&<p role="alert">{error}</p>}{read&&<article><h3>Versión {read.version}</h3><pre className="cw-resource">{read.content}</pre><details><summary>Integridad</summary><code>{read.sha256}</code></details></article>}
    <p>La lectura de este archivo no acredita el contenido de otros almacenes. El sistema de versiones y correcciones de octubre se conserva para su adaptación posterior; no se ha sustituido por otro editor.</p></section>;
}

function Case({caseId}){
  const auth=useOpsAuth();const [work,setWork]=useState(null),[error,setError]=useState(''),[tab,setTab]=useState('Resumen');
  const [document,setDocument]=useState(null),[reviewed,setReviewed]=useState([]);
  const [epoch,setEpoch]=useState(0);
  useEffect(()=>{
    const ctl=new AbortController();setError('');
    jsonRequest(auth.authFetch,`${root(caseId)}/work`,{signal:ctl.signal}).then(async r=>{
      if(r.contract!==CASEWORK_CONTRACT||r.case_id!==caseId||r.workspace?.case_id!==caseId)throw new Error('El expediente devuelto no coincide.');
      if(r.study.latest)await verifyAssessment(r.study.latest,caseId);
      if(!ctl.signal.aborted)setWork(r);
    }).catch(e=>{if(!ctl.signal.aborted){setWork(null);setError(e.message);}});
    return()=>ctl.abort();
  },[caseId,auth.authFetch,epoch]);
  if(error)return <main className="cw-case sr-container"><h1>Consulta no completada</h1><p role="alert">{error}</p><p>No se interpreta como falta de pago, documentos o recurso.</p><button onClick={()=>setEpoch(e=>e+1)}>Volver a consultar</button><button onClick={auth.logout}>Cerrar sesión</button></main>;
  if(!work)return <main className="cw-case sr-container"><p role="status">Recuperando datos, pago y trabajo guardado…</p></main>;
  const {fields,identities}=work.workspace.case;
  const docs=work.workspace.sections.documents, latest=work.study.latest?.snapshot;
  const state={in_progress:'En curso',blocked:'Bloqueado',completed:'Valoración terminada'}[latest?.study.state]||'Sin iniciar';
  const paid=fields.payment_status?.status==='available'&&fields.payment_status.value==='paid';
  const next=latest?.study.next_action||(paid?'Abrir la documentación y comenzar el estudio inicial.':'Comprobar el estado registrado del pago antes de iniciar el estudio.');
  function markReviewed(doc){setReviewed(rs=>[...rs.filter(r=>r.document_id!==doc.document_id),doc]);}
  return <main className="cw-case sr-container" data-testid="paid-case-workspace">
    <div className="cw-toolbar"><Link to="/ops">← Expedientes</Link><span>{auth.session.operator.displayName} · sesión individual</span><button onClick={auth.logout}>Cerrar sesión</button></div>
    <header className="cw-heading"><h1>{fieldText(identities.interested.full_name)}</h1>
      <p>{fieldText(fields.customer_comment)}</p><dl>
        <div><dt>Referencia</dt><dd>{fieldText(fields.expediente_ref)}</dd></div>
        <div><dt>Estudio inicial</dt><dd>{state}</dd></div>
        <div><dt>Pago registrado en RTM</dt><dd>{paid?'Estudio inicial pagado':fieldText(fields.payment_status)}</dd></div>
        <div><dt>Plazo revisado</dt><dd>{latest?.study.facts.deadline?.status==='validated'?latest.study.facts.deadline.value:'Pendiente de revisión documental'}</dd></div>
        <div><dt>Autor de la última valoración</dt><dd>{latest?.author.name||'Todavía no hay valoración guardada'}</dd></div>
        <div><dt>Responsable asignado</dt><dd>No consta una asignación en este contrato. La sesión identifica al autor de cada guardado.</dd></div>
      </dl><p className="cw-next"><strong>Siguiente acción:</strong> {next}</p></header>
    <nav className="cw-tabs" aria-label="Secciones del expediente">{['Resumen','Documentos','Estudio','Comunicaciones','Presupuesto y pagos','Recurso','Historial'].map(t=><button key={t} aria-current={tab===t?'page':undefined} onClick={()=>setTab(t)}>{t}</button>)}</nav>
    <div hidden={tab!=='Resumen'}><h2>Resumen y datos</h2><p>El pago del estudio no equivale a contratar ni pagar toda la gestión.</p>
      <dl>{[['Interesado',identities.interested.full_name],['Contacto',identities.contact.full_name],['Organismo',fields.organismo],['Notificación guardada',fields.notified_at],['Autorización guardada',fields.authorized]].map(([label,v])=><div key={label}><dt>{label}</dt><dd>{v?.value===true?'Consta recibida; su contenido debe revisarse':fieldText(v)}</dd></div>)}</dl>
      <p>Conductor, titular y representante se revisan por separado en el estudio; no se deducen del contacto.</p>
      <details><summary>Datos completos y procedencia de la lectura</summary><pre>{JSON.stringify(work.workspace.case,null,2)}</pre></details></div>
    <div hidden={tab!=='Documentos'}><h2>Documentos del expediente</h2>
      {docs.status==='schema_unavailable'?<p role="alert">No se pudieron consultar los documentos. No se acredita que falten.</p>:<>
        {docs.status==='empty'&&<p>La consulta completada no devuelve documentos registrados.</p>}{docs.status==='partial'&&<p>Listado parcial; faltan registros por consultar.</p>}
        <ul className="cw-documents">{docs.items.map((d,i)=><li key={d.id}><h3>{documentLabel(d,i)}</h3><p>{d.mime} · {d.created_at?new Date(d.created_at).toLocaleDateString('es-ES'):'Fecha no registrada'}</p>
          <button onClick={()=>setDocument(d)}>Abrir y leer</button>{reviewed.some(r=>r.document_id===d.id)&&<span> · Revisión confirmada en esta sesión</span>}
          <details><summary>Detalle del registro</summary><p>El nombre original no se conservó en este esquema.</p><code>{d.id}</code></details></li>)}</ul></>}
      {document&&<OpsDocumentViewer key={`${caseId}:${document.id}`} caseId={caseId} document={document} authFetch={auth.authFetch} onReviewed={markReviewed} onClose={()=>setDocument(null)}/>}</div>
    <div hidden={tab!=='Estudio'}><details><summary>Extracciones anteriores pendientes de revisión</summary>{work.extractions.length?<>{work.extractions.map(e=><pre key={e.id}>{JSON.stringify(e.values,null,2)}</pre>)}<p>No se han convertido automáticamente en hechos validados.</p></>:<p>Esta lectura no devuelve extracciones. Los originales pueden revisarse en Documentos.</p>}</details>
      <OpsPaidStudy caseId={caseId} authFetch={auth.authFetch} study={work.study} documents={docs.items||[]} reviewed={reviewed} canWrite={paid&&work.capabilities.study_write} onRefresh={setWork}/></div>
    <div hidden={tab!=='Presupuesto y pagos'}><h2>Presupuesto y pagos</h2><p>{paid?'El pago del estudio consta en RTM. No se ofrece repetirlo.':'Estado registrado: '+fieldText(fields.payment_status)}</p>
      <p>La propuesta de gestión, su aceptación versionada y el saldo requieren la siguiente fase de integración. Esta pantalla no crea cobros ni modifica importes o estados.</p></div>
    {tab==='Comunicaciones'&&<OpsCommunications caseId={caseId} authFetch={auth.authFetch} canWrite={work.capabilities.study_write}/>}
    <div hidden={tab!=='Recurso'}><Resource caseId={caseId} resources={work.resources} authFetch={auth.authFetch}/></div>
    <div hidden={tab!=='Historial'}><h2>Historial del trabajo</h2><ol>{work.study.history.map(h=><li key={h.operation_id}>Valoración {h.revision} · {h.author.name} · {new Date(h.created_at).toLocaleString('es-ES')}</li>)}</ol>
      <details><summary>Identificadores y eventos técnicos</summary><p>Expediente: {caseId}</p><pre>{JSON.stringify(work.workspace.sections.timeline,null,2)}</pre></details></div>
    <footer className="cw-no-presentation">No presentado. Esta entrega no firma, aprueba un recurso ni actúa en una sede administrativa.</footer>
  </main>;
}

function Entry({fallback}){
  const auth=useOpsAuth();const {caseId}=useParams();
  if(!auth.status && !auth.error)return <main className="sr-container py-8"><p role="status">Comprobando el acceso de OPS…</p></main>;
  if(auth.status?.authProfile!=='production_casework')return fallback;
  return <OpsAuthBoundary>{auth.session&&(caseId?<Case key={`${caseId}:${auth.session.sessionId}`} caseId={caseId}/>:<CaseList/>)}</OpsAuthBoundary>;
}
export default function OpsPaidCaseEntry({fallback}) {return <OpsAuthProvider><Entry fallback={fallback}/></OpsAuthProvider>;}
