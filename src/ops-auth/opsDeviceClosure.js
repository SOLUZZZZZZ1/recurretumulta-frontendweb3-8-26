import {OpsAuthError, closeOpsDevice} from './opsAuthApi.js';

export const CLOSURE_PREFIX='rtm.ops.device-closure.v1.';
export const AUTH_LOCK='rtm.ops.auth-transition.v1';
const ID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const denied=()=>new OpsAuthError('ops_auth.closure_pending','Hay un cierre pendiente de confirmar en este navegador. Compruébalo antes de iniciar otra sesión.');

// One key per operation avoids lost updates between tabs. Only public UUIDs and
// states are persisted: never bearer tokens, passwords, cookies or case data.
export function createDeviceClosure({browserWindow=window,closeRequest=closeOpsDevice}={}) {
  const listeners=new Set();let active=0,storageReady=true;
  try {
    const probe='rtm.ops.storage-probe.v1';browserWindow.localStorage.setItem(probe,'1');browserWindow.localStorage.removeItem(probe);
  } catch {storageReady=false;}
  function snapshot(){
    try {
      if(!storageReady||!browserWindow.navigator.locks?.request)throw new Error();
      const store=browserWindow.localStorage,records=[];
      for(let i=0;i<store.length;i++){
        const key=store.key(i);if(!key?.startsWith(CLOSURE_PREFIX))continue;
        const value=JSON.parse(store.getItem(key));
        if(!value||!ID.test(value.id)||key!==CLOSURE_PREFIX+value.id||
          !['pending','unknown','closed'].includes(value.phase)||Object.keys(value).sort().join(',')!=='id,phase')throw new Error();
        records.push(value);if(records.length>1000)throw new Error();
      }
      records.sort((a,b)=>a.id.localeCompare(b.id));
      const pending=records.filter(r=>r.phase!=='closed');
      return {phase:pending.length?(active?'closing':'unknown'):'ready',active:active>0,
        epoch:records.map(r=>r.id).join(','),pending:pending.map(r=>r.id)};
    } catch {return {phase:'unavailable',active:false,epoch:null,pending:[]};}
  }
  function emit(){const state=snapshot();listeners.forEach(fn=>fn(state));}
  function write(record){browserWindow.localStorage.setItem(CLOSURE_PREFIX+record.id,JSON.stringify(record));emit();}
  function ensureAvailable(){if(snapshot().phase==='unavailable')throw new OpsAuthError('ops_auth.coordination_unavailable','Este navegador no permite coordinar de forma segura las sesiones de OPS. No se iniciará una sesión.');}
  async function reconcile(){
    ensureAvailable();active++;emit();
    try {
      await browserWindow.navigator.locks.request(AUTH_LOCK,async()=>{
        // A tab may disappear while its request is in flight. Replay the SAME
        // operation, whose server acknowledgement is durable and idempotent.
        for(;;){
          const state=snapshot();if(state.phase==='unavailable')throw denied();
          const id=state.pending[0];if(!id)return;
          try {
            await closeRequest({operationId:id});
            write({id,phase:'closed'});
          } catch(error){write({id,phase:'unknown'});throw error;}
        }
      });
    } finally {active--;emit();}
  }
  function begin(){
    ensureAvailable();const state=snapshot();
    if(!state.pending.length)write({id:browserWindow.crypto.randomUUID(),phase:'pending'});
    return reconcile();
  }
  async function runLogin(action,{signal}={}){
    ensureAvailable();if(snapshot().phase!=='ready')throw denied();
    return browserWindow.navigator.locks.request(AUTH_LOCK,{signal},async()=>{
      const before=snapshot();if(before.phase!=='ready')throw denied();
      const value=await action();
      const after=snapshot();
      if(after.phase!=='ready'||after.epoch!==before.epoch)throw denied();
      return {value,epoch:before.epoch};
    });
  }
  function permits(epoch){const state=snapshot();return state.phase==='ready'&&epoch===state.epoch;}
  const onStorage=event=>{if(event.key===null||event.key.startsWith(CLOSURE_PREFIX))emit();};
  browserWindow.addEventListener('storage',onStorage);
  browserWindow.addEventListener('focus',emit);
  browserWindow.addEventListener('pageshow',emit);
  return {snapshot,begin,reconcile,runLogin,permits,
    subscribe(fn){listeners.add(fn);fn(snapshot());return()=>listeners.delete(fn);},
    dispose(){browserWindow.removeEventListener('storage',onStorage);browserWindow.removeEventListener('focus',emit);browserWindow.removeEventListener('pageshow',emit);listeners.clear();}};
}
let shared;
export function deviceClosure(){return shared||(shared=createDeviceClosure());}
