import React,{useState} from 'react';
import {jsonRequest} from '../lib/paidCasework.js';
import {validClientPass,CLIENT_TRIAL_VERSION} from '../lib/clientCaseAccess.js';

export default function OpsClientRehearsal({authFetch}){
  const [access,setAccess]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  const [copying,setCopying]=useState(false),[copyStatus,setCopyStatus]=useState(''),[showPass,setShowPass]=useState(false);
  async function prepare(){if(busy)return;setBusy(true);setError('');setAccess(null);setCopyStatus('');setShowPass(false);
    try{const data=await jsonRequest(authFetch,'/api/ops/rehearsal/client/access',{method:'POST'});
      if(data.version!==CLIENT_TRIAL_VERSION||!validClientPass(data.client_pass)||data.synthetic_only!==true)throw new Error('Pase no verificable.');
      setAccess(data);
    }catch(e){setError(e.status===404?'La entrada del ensayo nuevo aún no está habilitada.':e.message);}finally{setBusy(false);}}
  async function copyPass(){
    if(!access||copying)return;
    setCopying(true);setCopyStatus('');
    try{await navigator.clipboard.writeText(access.client_pass);setCopyStatus('Pase copiado. Abre el recorrido de cliente y pégalo allí.');}
    catch{setCopyStatus('No se pudo copiar automáticamente. Pulsa «Mostrar pase», selecciona el campo y copia el pase completo.');}
    finally{setCopying(false);}
  }
  return <details><summary>Ensayo nuevo desde cliente</summary><p>Prepara el acceso del ensayo configurado. El expediente se creará al enviar el formulario de cliente.</p>
    <button disabled={busy} onClick={()=>void prepare()}>{busy?'Preparando…':'Preparar pase de cliente'}</button>
    {error&&<p role="alert">{error}</p>}{access&&<><p>Pulsa «Copiar pase» y abre el recorrido de cliente en otra pestaña. El pase es privado y no concede acceso a OPS.</p>
      <label>Pase de cliente <input readOnly type={showPass?'text':'password'} value={access.client_pass} autoComplete="off" spellCheck={false} onFocus={e=>e.target.select()} onClick={e=>e.target.select()} onMouseUp={e=>e.preventDefault()}/></label>
      <button type="button" disabled={copying||busy} onClick={()=>void copyPass()}>{copying?'Copiando…':'Copiar pase'}</button>
      <button type="button" aria-pressed={showPass} onClick={()=>setShowPass(value=>!value)}>{showPass?'Ocultar pase':'Mostrar pase'}</button>
      {copyStatus&&<p role="status">{copyStatus}</p>}
      <a href="/#/ensayo/cliente" target="_blank" rel="noopener noreferrer">Abrir recorrido de cliente</a></>}
  </details>;
}
