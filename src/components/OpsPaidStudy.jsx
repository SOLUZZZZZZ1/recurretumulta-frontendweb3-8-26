import React,{useEffect,useRef,useState} from "react";
import {blankStudy,FACT_LABELS,jsonRequest,root,verifyAssessment,documentLabel} from "../lib/paidCasework.js";
import {journalKey,loadStudyReference,storeStudyReference,clearStudyReference,studyRequestDigest,withStudyLock} from '../lib/studyOperationJournal.js';
import {studyReviewRequirements,studyWriteConflictMessage} from '../lib/studyReviewRequirements.js';

export default function OpsPaidStudy({caseId,operatorId,authFetch,study,documents,reviewed,canWrite,onRefresh}) {
  const [recovery]=useState(()=>{try{return {reference:loadStudyReference(caseId,operatorId)}}catch(e){return {error:e.message}}});
  const [form,setForm]=useState(()=>study.latest?.snapshot.study||blankStudy());
  const [factText,setFactText]=useState(()=>Object.fromEntries(Object.keys(FACT_LABELS).map(k=>[k,study.latest?.snapshot.study.facts[k]?.value||''])));
  const [head,setHead]=useState(study.revision),[ack,setAck]=useState(false),[phase,setPhase]=useState(recovery.error?'blocked':recovery.reference?'unknown':'editing');
  const [message,setMessage]=useState(recovery.error|| (recovery.reference?'Hay una operación pendiente de otra visita. Consúltala antes de editar.':'')),[pending,setPending]=useState(recovery.reference?{reference:recovery.reference}:null),[preview,setPreview]=useState(null);
  const [history,setHistory]=useState(study.history);
  const [observed,setObserved]=useState(null),[compared,setCompared]=useState(false);
  const live=useRef(true),lock=useRef(false),dirty=useRef(false),controllers=useRef(new Set());
  useEffect(()=>{live.current=true;return()=>{live.current=false;controllers.current.forEach(c=>c.abort());};},[]);
  useEffect(()=>{
    const receive=event=>{
      if(event.key!==journalKey(caseId,operatorId))return;
      setAck(false);setCompared(false);
      try{
        const reference=loadStudyReference(caseId,operatorId)||JSON.parse(event.oldValue||'null');
        if(reference){setPending({reference,preserveDraft:dirty.current});setPhase('unknown');setMessage('Otra pestaña ha cambiado la operación. Tu texto sigue en el editor; consulta y compara antes de guardar.');}
      }catch(e){setPhase('blocked');setMessage(e.message);}
    };
    window.addEventListener('storage',receive);return()=>window.removeEventListener('storage',receive);
  },[caseId,operatorId]);
  const editable=phase==='editing'||phase==='verified';
  const missingReviews=studyReviewRequirements(documents,reviewed);
  function change(key,value){dirty.current=true;setForm(f=>({...f,[key]:value}));setAck(false);}
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
    try {await withStudyLock(caseId,operatorId,()=>fn(ctl.signal));}
    catch(e){if(live.current&&!ctl.signal.aborted){setAck(false);setMessage(e.message);}}
    finally {controllers.current.delete(ctl);lock.current=false;}
  }
  function restoreForm(value){dirty.current=false;setForm(structuredClone(value));setFactText(Object.fromEntries(Object.keys(FACT_LABELS).map(k=>[k,value.facts[k]?.value||''])));}
  async function currentWork(signal){
    const current=await jsonRequest(authFetch,`${root(caseId)}/work`,{signal});
    if(current.case_id!==caseId||!current.study||!Number.isInteger(current.study.revision))throw new Error('No se pudo reconciliar el historial.');
    if(current.study.latest){await verifyAssessment(current.study.latest,caseId);if(current.study.latest.snapshot.revision!==current.study.revision)throw new Error('Historial inconsistente.');}
    else if(current.study.revision!==0)throw new Error('Historial incompleto.');
    return current;
  }
  async function confirmKnown(operation,signal){
    const ref=operation.reference;
    const result=await jsonRequest(authFetch,`${root(caseId)}/study/operations/${ref.operation_id}`,{signal});
    await verifyAssessment(result,caseId,ref.operation_id);
    if(result.snapshot.author.id!==operatorId||result.snapshot.revision!==ref.expected_revision+1||
      (ref.confirmed_sha256&&ref.confirmed_sha256!==result.sha256))throw new Error('La operación recuperada no coincide con la referencia conservada.');
    const reconstructed={...result.snapshot.study,operation_id:ref.operation_id,expected_revision:ref.expected_revision,
      documents:result.snapshot.sources.map(s=>({document_id:s.document_id,observed_sha256:s.observed_sha256,read_confirmed:true}))};
    if(await studyRequestDigest(reconstructed)!==ref.request_sha256)throw new Error('El texto y las fuentes recuperados no coinciden con la huella del envío.');
    const current=await currentWork(signal);
    if(current.study.revision<result.snapshot.revision)throw new Error('El historial todavía no incluye la operación.');
    if(!live.current||signal.aborted)return;
    setPreview(result);
    if(!operation.preserveDraft){restoreForm(result.snapshot.study);setHead(result.snapshot.revision);}
    setHistory(current.study.history);setAck(false);setCompared(false);setObserved(current.study);
    if(operation.preserveDraft||current.study.revision!==result.snapshot.revision||current.study.latest?.snapshot.operation_id!==ref.operation_id){
      setPhase('conflict_review');setMessage(operation.preserveDraft?'Otra pestaña ha guardado una valoración. Conservamos tu texto y su base; compara ambas aportaciones antes de editar.':'Tu valoración está guardada, pero otra persona ha avanzado el estudio. La base de tu texto no se ha adelantado: compara ambas versiones antes de editar.');
    }else{
      clearStudyReference(ref);setPending(null);setPhase('verified');
      setMessage('Guardado y recuperado exactamente. Para guardar otra versión, confirma de nuevo la operación.');
    }
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
      setMessage(e.status===409?studyWriteConflictMessage(e.code):
        'No sabemos si se guardó. Conservamos el texto y la identidad de la operación; hay que consultar antes de repetir.');
      return;
    }
    if(!live.current||signal.aborted)return;
    const known={...operation,reference:{...operation.reference,confirmed_sha256:received.sha256}};
    try{storeStudyReference(known.reference);}catch(e){setPhase('known');setMessage('Escritura confirmada. La referencia previa se conserva; consulta la operación. '+e.message);return;}
    setPending(known);setPhase('reading');setMessage('Escritura confirmada. Verificando la versión guardada…');
    try{await confirmKnown(known,signal);}catch(e){if(live.current&&!signal.aborted){setPhase('known');setMessage('La escritura está confirmada, pero su lectura falló. Recupera esa misma versión; no se permite otro guardado. '+e.message);}}
  }
  function save(){
    if(!editable||!ack||!canWrite||missingReviews.length)return;
    const payload={...structuredClone(form),operation_id:crypto.randomUUID(),expected_revision:head,documents:structuredClone(reviewed)};
    return task(async signal=>{
      const prior=loadStudyReference(caseId,operatorId);
      if(prior){setPending({reference:prior});setPhase('unknown');setAck(false);setMessage('Primero debes reconciliar la operación anterior.');return;}
      const reference={version:1,case_id:caseId,operator_id:operatorId,operation_id:payload.operation_id,
        expected_revision:head,request_sha256:await studyRequestDigest(payload),confirmed_sha256:null};
      if(!live.current||signal.aborted)return;
      storeStudyReference(reference);return send({payload,reference},signal);
    });
  }
  function reconcile(){return task(async signal=>{
    if(!pending)return;
    setPhase('reading');setMessage('Consultando la operación y el historial…');
    try{await confirmKnown(pending,signal);}
    catch(e){
      if(!live.current||signal.aborted)return;
      if(e.status===404&&!pending.reference.confirmed_sha256){
        try{
          // Serialize with any delayed writer; a bare 404 is not a terminal result.
          const resolved=await jsonRequest(authFetch,`${root(caseId)}/study/operations/${pending.reference.operation_id}/reconcile`,{method:'POST',signal});
          if(resolved.status==='committed'){await confirmKnown(pending,signal);return;}
          if(resolved.status!=='cancelled'||resolved.contract!=='rtm_study_reconciliation_v1'||resolved.case_id!==caseId||resolved.operation_id!==pending.reference.operation_id)throw new Error('No se pudo resolver la operación.');
          const result=await currentWork(signal);
          if(!live.current||signal.aborted)return;
          setHistory(result.study.history);setObserved(result.study);setCompared(false);setAck(false);setPhase('cancelled_review');
          setMessage('El servidor confirma que esta operación no quedó guardada y ha bloqueado un envío tardío con su identidad. Revisa la versión actual antes de otra edición.'+(pending.payload?' Tu texto sigue en el editor.':' El texto no confirmado no se guardó en el navegador.'));
          onRefresh?.(result);
        }catch(error){if(live.current&&!signal.aborted){setPhase('unknown');setMessage(error.message);}}
      }else{setPhase(pending.reference.confirmed_sha256?'known':'unknown');setMessage(e.message);}
    }
  });}
  function reviewedBase(useLatest){return task(async signal=>{
    if(!compared||!observed||!pending)return;
    const current=await currentWork(signal);
    if(!live.current||signal.aborted)return;
    if(current.study.revision!==observed.revision||current.study.latest?.sha256!==observed.latest?.sha256){
      setObserved(current.study);setHistory(current.study.history);setCompared(false);setMessage('La valoración ha vuelto a cambiar. Compara la nueva versión antes de continuar.');return;
    }
    clearStudyReference(pending.reference);
    if(useLatest)restoreForm(current.study.latest?.snapshot.study||blankStudy());
    setHead(current.study.revision);setPending(null);setAck(false);setCompared(false);setPhase('editing');
    setMessage('Base adoptada tras tu revisión explícita. Confirma de nuevo cualquier nueva valoración.');
  });}
  function readHistorical(id){return task(async signal=>{
    try{const result=await jsonRequest(authFetch,`${root(caseId)}/study/operations/${id}`,{signal});await verifyAssessment(result,caseId,id);
      if(live.current&&!signal.aborted)setPreview(result);
    }catch(e){if(live.current&&!signal.aborted)setMessage(e.message);}
  });}
  const ready=canWrite&&editable&&ack&&form.assessment.trim()&&form.next_action.trim()&&!missingReviews.length;
  return <section aria-label="Estudio inicial"><h2>Estudio inicial</h2>
    <p>La valoración es interna. Guardarla no la comunica al cliente, no genera un recurso ni contrata la gestión posterior.</p>
    <p>Responsable de la última valoración: {study.latest?.snapshot.author.name||'Sin valoración guardada'}. Los hechos sin revisar conservan su estado pendiente.</p>
    <form onSubmit={e=>{e.preventDefault();void save();}}>
      <fieldset disabled={!editable||!canWrite}><legend>Revisión documental y valoración</legend>
      <p>Documentos confirmados en esta sesión: {reviewed.length}. Abre y revisa la multa, la autorización y la identidad antes de guardar.</p>
      {!!missingReviews.length&&<aside aria-label="Documentos pendientes de revisión"><p>Para guardar esta valoración, revisa e incorpora desde Documentos:</p><ul>{missingReviews.map(label=><li key={label}>{label}</li>)}</ul></aside>}
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
    {['known','unknown','conflict'].includes(phase)&&<button onClick={()=>void reconcile()}>Consultar operación e historial</button>}
    {['conflict_review','cancelled_review'].includes(phase)&&observed&&<aside aria-label="Revisión del conflicto">
      <h3>Comparar antes de adoptar otra base</h3><p>Base de tu edición: {head}. Última valoración observada: {observed.revision}.</p>
      <h4>Texto de tu edición</h4><pre className="cw-resource">{form.assessment||'Sin texto confirmado recuperable'}</pre>
      <h4>Valoración más reciente</h4><pre className="cw-resource">{observed.latest?.snapshot.study.assessment||'No consta una valoración guardada'}</pre>
      <details><summary>Comparar contenido y fuentes completos</summary><pre>{JSON.stringify({edicion:form,ultima:observed.latest?.snapshot},null,2)}</pre></details>
      <label><input type="checkbox" checked={compared} onChange={e=>setCompared(e.target.checked)}/> He comparado mi texto con la valoración más reciente.</label>
      <button disabled={!compared} onClick={()=>void reviewedBase(true)}>Usar la valoración más reciente como base</button>
      <button disabled={!compared||(!pending?.payload&&!pending?.preserveDraft&&!preview)} onClick={()=>void reviewedBase(false)}>Conservar mi texto sobre la base revisada</button>
    </aside>}
    <h3>Valoraciones conservadas</h3><ul>{history.map(h=><li key={h.operation_id}><button onClick={()=>void readHistorical(h.operation_id)}>Leer valoración {h.revision}</button> · {h.author.name} · {new Date(h.created_at).toLocaleString('es-ES')}</li>)}</ul>
    {preview&&<article className="cw-snapshot"><h3>Consultando valoración {preview.snapshot.revision}</h3><p>Esta lectura histórica no sustituye la edición ni la versión más reciente.</p>
      <p>Autor: {preview.snapshot.author.name}</p>{['assessment','missing','options','next_action'].map(k=><p key={k} style={{whiteSpace:'pre-wrap'}}>{preview.snapshot.study[k]}</p>)}
      <details><summary>Contenido exacto, fuentes e integridad</summary><pre>{JSON.stringify(preview.snapshot,null,2)}</pre><code>{preview.sha256}</code></details></article>}
  </section>;
}
