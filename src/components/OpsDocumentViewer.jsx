import React,{useEffect,useRef,useState} from "react";
import {jsonRequest,root} from "../lib/paidCasework.js";

export default function OpsDocumentViewer({caseId,document,authFetch,onReviewed,onClose,viewBase=null}) {
  const [meta,setMeta]=useState(null),[page,setPage]=useState(1),[zoom,setZoom]=useState(100);
  const [image,setImage]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(true);
  const [seen,setSeen]=useState(new Set());
  const [confirmed,setConfirmed]=useState(false);
  const blobRef=useRef(null);
  useEffect(()=>{
    const ctl=new AbortController(); setBusy(true);setMeta(null);setImage(null);setError('');setSeen(new Set());setConfirmed(false);setPage(1);
    jsonRequest(authFetch,`${viewBase||`${root(caseId)}/documents/${document.id}`}/view`,{signal:ctl.signal}).then(result=>{
      if(ctl.signal.aborted) return;
      if(result.contract!=='rtm_ops_document_view_v1' || result.case_id!==caseId || result.document_id!==document.id ||
        result.view_only!==true || result.operator_export_allowed!==false || !Number.isInteger(result.pages) || result.pages<1 || result.pages>200 || !/^[0-9a-f]{64}$/.test(result.observed_sha256||'')) throw new Error('El visor no confirmó el documento solicitado.');
      setMeta(result);
    }).catch(e=>{if(!ctl.signal.aborted){setError(e.message);setBusy(false);}});
    return()=>{ctl.abort();if(blobRef.current) URL.revokeObjectURL(blobRef.current);blobRef.current=null;};
  },[caseId,document.id,authFetch,viewBase]);
  useEffect(()=>{
    if(!meta)return;
    const ctl=new AbortController();setBusy(true);setError('');setImage(null);
    if(blobRef.current)URL.revokeObjectURL(blobRef.current);blobRef.current=null;
    (async()=>{
      const response=await authFetch(`${viewBase||`${root(caseId)}/documents/${document.id}`}/pages/${page}?width=1600`,{
        signal:ctl.signal,headers:{'If-Match':`"${meta.observed_sha256}"`}});
      if(!response.ok || response.headers.get('content-type')?.split(';')[0]!=='image/png') throw new Error('No se pudo recuperar esta página de forma protegida. No se acredita su lectura.');
      const blob=await response.blob();if(blob.size>18000000)throw new Error('Página demasiado grande.');
      if(ctl.signal.aborted)return;
      const url=URL.createObjectURL(blob);blobRef.current=url;setImage(url);
    })().catch(e=>{if(!ctl.signal.aborted)setError(e.message);}).finally(()=>{if(!ctl.signal.aborted)setBusy(false);});
    return()=>ctl.abort();
  },[meta,page,caseId,document.id,authFetch,viewBase]);
  return <section className="cw-viewer" aria-label="Visor protegido de documentos">
    <div className="cw-toolbar"><h3>{meta?.title || 'Abriendo documento…'}</h3><button onClick={onClose}>Cerrar visor</button></div>
    <p>Consulta privada dentro de OPS. El original permanece en custodia.</p>
    {meta&&<div className="cw-toolbar"><button disabled={busy||page<=1} onClick={()=>setPage(p=>p-1)}>Página anterior</button>
      <span>Página {page} de {meta.pages}</span><button disabled={busy||page>=meta.pages} onClick={()=>setPage(p=>p+1)}>Página siguiente</button>
      <label>Ampliación <select value={zoom} onChange={e=>setZoom(Number(e.target.value))}>{[75,100,125,150,200].map(z=><option key={z} value={z}>{z}%</option>)}</select></label></div>}
    {busy&&<p role="status">Recuperando contenido…</p>}{error&&<p role="alert">{error}</p>}
    {image&&<div className="cw-image-scroll"><img key={image} src={image} alt={`Página ${page} del documento`} style={{width:`${zoom}%`,maxWidth:'none'}}
      onLoad={()=>setSeen(s=>new Set([...s,page]))} onError={()=>{setImage(null);setError('La imagen no se pudo mostrar.');}} /></div>}
    {meta&&<><p>{seen.size} de {meta.pages} páginas mostradas. Mostrar una página no sustituye su revisión.</p>
      {onReviewed&&<><label><input type="checkbox" checked={confirmed} disabled={busy||!!error||seen.size!==meta.pages} onChange={e=>setConfirmed(e.target.checked)}/> He leído y revisado este documento completo.</label>
      <button disabled={!confirmed||busy||!!error||seen.size!==meta.pages} onClick={()=>{onReviewed({document_id:document.id,observed_sha256:meta.observed_sha256,read_confirmed:true});onClose();}}>Incorporar a los documentos revisados del estudio</button></>}
      <details><summary>Integridad del contenido</summary><p>Huella calculada al leer el original: <code>{meta.observed_sha256}</code></p>
        <p>{meta.recorded_hash_state==='verified'?'Coincide con la huella registrada.':'No hay una huella registrada anterior con la que compararla. No se ha modificado el registro original.'}</p></details></>}
  </section>;
}
