import React,{useEffect,useState} from 'react';
import {jsonRequest} from '../lib/paidCasework.js';

export default function OpsMailTextViewer({caseId,documentId,viewBase,authFetch,onClose}) {
  const [data,setData]=useState(null),[error,setError]=useState('');
  useEffect(()=>{
    const ctl=new AbortController();setData(null);setError('');
    jsonRequest(authFetch,`${viewBase}/view`,{signal:ctl.signal}).then(result=>{
      if(result.case_id!==caseId||result.document_id!==documentId||result.mime!=='text/plain'||
        result.view_only!==true||result.operator_export_allowed!==false||typeof result.text!=='string'||
        !/^[a-f0-9]{64}$/.test(result.observed_sha256||''))throw new Error('No se ha confirmado el adjunto solicitado.');
      if(!ctl.signal.aborted)setData(result);
    }).catch(e=>{if(!ctl.signal.aborted)setError(e.message);});
    return()=>ctl.abort();
  },[caseId,documentId,viewBase,authFetch]);
  return <section role="dialog" aria-label="Adjunto protegido"><button onClick={onClose}>Cerrar adjunto</button>
    {error?<p role="alert">{error}</p>:data?<><h3>{data.title}</h3><pre className="cw-resource">{data.text}</pre>
      <p>Texto consultado desde su original protegido. No se ejecuta contenido ni se incorpora automáticamente como documentación revisada.</p></>:<p role="status">Recuperando adjunto protegido…</p>}
  </section>;
}
