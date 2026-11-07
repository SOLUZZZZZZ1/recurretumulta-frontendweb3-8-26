import React,{useState} from 'react';
import {jsonRequest} from '../lib/paidCasework.js';
import {validClientPass,CLIENT_TRIAL_VERSION} from '../lib/clientCaseAccess.js';

export default function OpsClientRehearsal({authFetch}){
  const [access,setAccess]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function prepare(){if(busy)return;setBusy(true);setError('');setAccess(null);
    try{const data=await jsonRequest(authFetch,'/api/ops/rehearsal/client/access',{method:'POST'});
      if(data.version!==CLIENT_TRIAL_VERSION||!validClientPass(data.client_pass)||data.synthetic_only!==true)throw new Error('Pase no verificable.');
      setAccess(data);
    }catch(e){setError(e.status===404?'La entrada del ensayo nuevo aún no está habilitada.':e.message);}finally{setBusy(false);}}
  return <details><summary>Ensayo nuevo desde cliente</summary><p>Prepara el acceso del ensayo configurado. El expediente se creará al enviar el formulario de cliente.</p>
    <button disabled={busy} onClick={()=>void prepare()}>{busy?'Preparando…':'Preparar pase de cliente'}</button>
    {error&&<p role="alert">{error}</p>}{access&&<><p>Copia este pase y abre el recorrido de cliente en otra pestaña. Es privado y no concede acceso a OPS.</p>
      <label>Pase de cliente <input readOnly type="password" value={access.client_pass} onFocus={e=>e.target.select()}/></label>
      <a href="/#/ensayo/cliente" target="_blank" rel="noopener noreferrer">Abrir recorrido de cliente</a></>}
  </details>;
}
