import React,{useEffect,useRef,useState} from "react";
import {blankStudy,FACT_LABELS,jsonRequest,root,verifyAssessment,documentLabel,sameJson} from "../lib/paidCasework.js";

export default function OpsPaidStudy({caseId,authFetch,study,documents,reviewed,canWrite,onRefresh}) {
  const [form,setForm]=useState(()=>study.latest?.snapshot.study||blankStudy());
  const [factText,setFactText]=useState(()=>Object.fromEntries(Object.keys(FACT_LABELS).map(k=>[k,study.latest?.snapshot.study.facts[k]?.value||''])));
  const [head,setHead]=useState(study.revision),[ack,setAck]=useState(false),[phase,setPhase]=useState('editing');
  const [message,setMessage]=useState(''),[pending,setPending]=useState(null),[preview,setPreview]=useState(null);
  const [history,setHistory]=useState(study.history);
  const live=useRef(true),lock=useRef(false),controllers=useRef(new Set());
  useEffect(()=>{live.current=true;return()=>{live.current=false;controllers.current.forEach(c=>c.abort());};},[]);
  const editable=phase==='editing'||phase==='verified';
  function change(key,value){setForm(f=>({...f,[key]:value}));setAck(false);}
  function factChange(key,value,sourceId){
    const previous=form.facts[key];
    const val=value===undefined ? factText[key] : value;
    setFactText(f=>({...f,[key]:val}));
    const source=sourceId===undefined ? previous.sources[0]?.document_id||'' : sourceId;
    const valid=!!val.trim() && !!source;
    change('facts',{...form.facts,[key]:{value:valid?val:null,status:valid?'validated':'unresolved',confidence:valid?1:0,
      sources:valid?[{document_id:source,source_type:'document',extraction_method:'human_review',confidence:1,page_index:null,evidence:null}]:[],conflicts:[],notes:[]}});
  }
  async function task(fn){
    if(lock.current)return;lock.current=true;
    const ctl=new AbortController();controllers.current.add(ctl);
    try {await fn(ctl.signal);} finally {controllers.current.delete(ctl);lock.current=false;}
  }
  async function confirmKnown(operation,signal){
    const result=await jsonRequest(authFetch,`${root(caseId)}/study/operations/${operation.payload.operation_id}`,{signal});
    await verifyAssessment(result,caseId,operation.payload.operation_id);
    if(operation.sha && result.sha256!==operation.sha)throw new Error('La lectura no coincide con la operación confirmada.');
    const expected={...operation.payload};delete expected.operation_id;delete expected.expected_revision;delete expected.documents;
    // Verify exact human text and selected sources, not merely an HTTP status.
    for(const key of ['assessment','missing','options','next_action','state'])if(result.snapshot.study[key]!==expected[key])throw new Error('El contenido recuperado no coincide con el enviado.');
    for(const key of Object.keys(FACT_LABELS)) {
      const a=result.snapshot.study.facts[key],b=expected.facts[key];
      if(!sameJson(a,b))throw new Error('Los hechos recuperados no coinciden con los enviados.');
    }
    if(result.snapshot.sources.length!==operation.payload.documents.length || operation.payload.documents.some(d=>!result.snapshot.sources.some(s=>s.document_id===d.document_id&&s.observed_sha256===d.observed_sha256)))throw new Error('Las fuentes recuperadas no coinciden.');
    const current=await jsonRequest(authFetch,`${root(caseId)}/work`,{signal});
    if(current.case_id!==caseId || !current.study)throw new Error('No se pudo reconciliar el historial.');
    if(current.study.latest)await verifyAssessment(current.study.latest,caseId);
    if(!live.current||signal.aborted)return;
    setPreview(result);setHead(current.study.revision);setHistory(current.study.history);setPending(null);setAck(false);setPhase('verified');
    setMessage('Guardado y recuperado exactamente. Para guardar otra versión, confirma de nuevo la operación.');
    onRefresh?.(current);
  }
  async function send(operation,signal){
    setPhase('sending');setAck(false);setMessage('Enviando valoración…');setPending(operation);
    let received;
    try {
      received=await jsonRequest(authFetch,`${root(caseId)}/study`,{method:'POST',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify(operation.payload)});
      await verifyAssessment(received,caseId,operation.payload.operation_id);
    } catch(e) {
      if(!live.current||signal.aborted)return;
      setPhase(e.status===409?'conflict':'unknown');
      setMessage(e.status===409?'El servidor rechazó la escritura. Conservamos tu texto; consulta el historial antes de preparar otra operación.':
        'No sabemos si se guardó. Conservamos el texto y la identidad de la operación; hay que consultar antes de repetir.');
      return;
    }
    if(!live.current||signal.aborted)return;
    const known={...operation,sha:received.sha256};setPending(known);setPhase('reading');setMessage('Escritura confirmada. Verificando la versión guardada…');
    try{await confirmKnown(known,signal);}catch(e){if(live.current&&!signal.aborted){setPhase('known');setMessage('La escritura está confirmada, pero su lectura falló. Recupera esa misma versión; no se permite otro guardado. '+e.message);}}
  }
  function save(){
    if(!editable||!ack||!canWrite)return;
    const payload={...structuredClone(form),operation_id:crypto.randomUUID(),expected_revision:head,documents:structuredClone(reviewed)};
    return task(signal=>send({payload},signal));
  }
  function reconcile(){return task(async signal=>{
    if(!pending)return;
    setPhase('reading');setMessage('Consultando la operación y el historial…');
    try{await confirmKnown(pending,signal);}
    catch(e){
      if(!live.current||signal.aborted)return;
      if(e.status===404&&!pending.sha){
        try{
          const result=await jsonRequest(authFetch,`${root(caseId)}/work`,{signal});
          if(result.case_id!==caseId||!result.study)throw new Error('Historial no confirmado.');
          if(result.study.latest)await verifyAssessment(result.study.latest,caseId);
          if(!live.current||signal.aborted)return;
          setHistory(result.study.history);setHead(result.study.revision);
          if(result.study.revision!==pending.payload.expected_revision){
            setPhase('conflict_reconciled');setMessage('El historial ha avanzado. Revisa la versión actual y tu texto antes de preparar una nueva edición.');
          }else{setPhase('not_found');setMessage('La consulta no encuentra esta operación. Puedes reenviar únicamente la MISMA operación, protegida frente a duplicados; no se ha supuesto que el primer envío no llegara.');}
        }catch(error){setPhase('unknown');setMessage(error.message);}
      }else{setPhase(pending.sha?'known':'unknown');setMessage(e.message);}
    }
  });}
  function readHistorical(id){return task(async signal=>{
    try{const result=await jsonRequest(authFetch,`${root(caseId)}/study/operations/${id}`,{signal});await verifyAssessment(result,caseId,id);
      if(live.current&&!signal.aborted)setPreview(result);
    }catch(e){if(live.current&&!signal.aborted)setMessage(e.message);}
  });}
  const ready=canWrite&&editable&&ack&&form.assessment.trim()&&form.next_action.trim()&&reviewed.length>=3;
  return <section aria-label="Estudio inicial"><h2>Estudio inicial pagado</h2>
    <p>La valoración es interna. Guardarla no la comunica al cliente, no genera un recurso ni contrata la gestión posterior.</p>
    <p>Responsable de la última valoración: {study.latest?.snapshot.author.name||'Sin valoración guardada'}. Los hechos sin revisar conservan su estado pendiente.</p>
    <form onSubmit={e=>{e.preventDefault();void save();}}>
      <fieldset disabled={!editable||!canWrite}><legend>Revisión documental y valoración</legend>
      <p>Documentos confirmados en esta sesión: {reviewed.length}. Abre y revisa la multa, la autorización y la identidad antes de guardar.</p>
      {Object.entries(FACT_LABELS).map(([key,label])=><div className="cw-fact" key={key}>
        <label>{label}<textarea aria-label={label} value={factText[key]} maxLength={8000} onChange={e=>factChange(key,e.target.value)}/></label>
        <label>Documento que sustenta la revisión<select value={form.facts[key].sources[0]?.document_id||''} onChange={e=>factChange(key,undefined,e.target.value)}>
          <option value="">Sin comprobar</option>{reviewed.map(r=><option key={r.document_id} value={r.document_id}>{documentLabel(documents.find(d=>d.id===r.document_id)||{},documents.findIndex(d=>d.id===r.document_id))}</option>)}</select></label>
        <small>{form.facts[key].status==='validated'?'Revisado por el operador, con fuente seleccionada':'Pendiente de revisión documental; no se deduce de otra identidad.'}</small>
      </div>)}
      <label>Estado del estudio<select value={form.state} onChange={e=>change('state',e.target.value)}>
        <option value="in_progress">En curso</option><option value="blocked">Bloqueado por un requisito</option><option value="completed">Valoración terminada</option></select></label>
      {[['assessment','Valoración del asunto',12000],['missing','Qué falta o bloquea el estudio',4000],['options','Opciones y alcance propuestos',8000],['next_action','Siguiente acción concreta',2000]].map(([k,label,max])=><label key={k}>{label}<textarea aria-label={label} required={k==='assessment'||k==='next_action'} maxLength={max} value={form[k]} onChange={e=>change(k,e.target.value)}/></label>)}
      <label><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/> Confirmo guardar una nueva valoración interna con estos hechos y fuentes.</label>
      <button type="submit" disabled={!ready}>Guardar valoración</button></fieldset>
    </form>
    <p role="status" data-testid="study-save-state" data-phase={phase}>{message}</p>
    {['known','unknown','conflict','not_found','conflict_reconciled'].includes(phase)&&<button onClick={()=>void reconcile()}>Consultar operación e historial</button>}
    {phase==='not_found'&&<button onClick={()=>void task(signal=>send(pending,signal))}>Reenviar la misma operación protegida</button>}
    {phase==='conflict_reconciled'&&<button onClick={()=>{setPending(null);setAck(false);setPhase('editing');setMessage('Texto conservado. Revisa el historial y confirma de nuevo antes de guardar.');}}>Preparar una nueva edición con el historial consultado</button>}
    <h3>Valoraciones conservadas</h3><ul>{history.map(h=><li key={h.operation_id}><button onClick={()=>void readHistorical(h.operation_id)}>Leer valoración {h.revision}</button> · {h.author.name} · {new Date(h.created_at).toLocaleString('es-ES')}</li>)}</ul>
    {preview&&<article className="cw-snapshot"><h3>Consultando valoración {preview.snapshot.revision}</h3><p>Esta lectura histórica no sustituye la edición ni la versión más reciente.</p>
      <p>Autor: {preview.snapshot.author.name}</p>{['assessment','missing','options','next_action'].map(k=><p key={k} style={{whiteSpace:'pre-wrap'}}>{preview.snapshot.study[k]}</p>)}
      <details><summary>Contenido exacto, fuentes e integridad</summary><pre>{JSON.stringify(preview.snapshot,null,2)}</pre><code>{preview.sha256}</code></details></article>}
  </section>;
}
