import React,{useState} from 'react';
import IniciarExpedienteRTM from './IniciarExpedienteRTM.jsx';
import {clientRequest} from '../lib/clientApi.js';
import {CLIENT_TRIAL_VERSION,validClientPass,readClientAccess,saveClientAccess,downloadClientPdf} from '../lib/clientCaseAccess.js';

export default function StagingClient(){
  const [pass,setPass]=useState(''),[trial,setTrial]=useState(null),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  async function enter(event){event.preventDefault();if(busy)return;setError('');setBusy(true);
    try{
      if(!validClientPass(pass.trim()))throw new Error('El pase no tiene el formato completo. Vuelve a OPS, pulsa «Copiar pase» y pégalo aquí.');
      const value=pass.trim(),data=await clientRequest('/staging/client/profile',{headers:{'X-RTM-Client-Pass':value},cache:'no-store'});
      if(data.version!==CLIENT_TRIAL_VERSION||data.synthetic_only!==true||data.payment_mode!=='test')throw new Error('No se ha confirmado el entorno de ensayo.');
      const old=readClientAccess(data.case_id);
      saveClientAccess(data.case_id,{...old,caseId:data.case_id,token:value,pass:value,trial:CLIENT_TRIAL_VERSION});
      setTrial({...data,pass:value});setPass('');
    }catch(e){setError(e.message);}finally{setBusy(false);}
  }
  async function download(kind){setError('');try{await downloadClientPdf(`/staging/client/fixtures/${kind}`,{'X-RTM-Client-Pass':trial.pass},trial.fixtures[kind].filename);}catch(e){setError(e.message);}}
  return <>
    <section className="sr-container py-8" style={{padding:'24px 18px'}}><h1 className="sr-h2">Ensayo de cliente RTM</h1><p>Datos ficticios y pagos de prueba. Conserva esta pestaña durante el recorrido.</p>
      {!trial?<form onSubmit={enter} style={{display:'flex',gap:16,flexWrap:'wrap',alignItems:'end',marginTop:16}}><label>Pase de cliente <input style={{display:'block',border:'1px solid #94a3b8',borderRadius:8,padding:10}} type="password" autoComplete="off" value={pass} onChange={e=>setPass(e.target.value)}/></label><button className="sr-btn-primary" disabled={busy}>{busy?'Comprobando…':'Entrar al ensayo'}</button></form>:
        <><p>Completa el formulario con los datos ficticios que aparecen y selecciona los documentos descargados. Las casillas requieren tu confirmación.</p>
          <div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:16}}>{[['identity_front','Descargar identidad: anverso'],['identity_back','Descargar identidad: reverso'],['original','Descargar notificación ficticia']].map(([kind,label])=><button className="sr-btn-secondary" key={kind} onClick={()=>void download(kind)}>{label}</button>)}</div></>}
      {error&&<p role="alert">{error}</p>}
    </section>
    {trial&&<IniciarExpedienteRTM key={trial.case_id} trial={trial}/>}
  </>;
}
