import test from 'node:test';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';
import {createDeviceClosure,CLOSURE_PREFIX} from '../src/ops-auth/opsDeviceClosure.js';
import {closeOpsDevice,validateOpsAuthStatus} from '../src/ops-auth/opsAuthApi.js';

function environment(){
  const entries=new Map(),windows=[];let tail=Promise.resolve();
  const locks={request(name,options,fn){if(typeof options==='function'){fn=options;options={};}
    const result=tail.then(()=>{if(options?.signal?.aborted)throw new Error('aborted');return fn();});tail=result.catch(()=>{});return result;}};
  return {entries,window(){
    const handlers=new Map(),w={crypto:{randomUUID},navigator:{locks},addEventListener(k,f){if(!handlers.has(k))handlers.set(k,new Set());handlers.get(k).add(f);},removeEventListener(k,f){handlers.get(k)?.delete(f);},emit(k,event){handlers.get(k)?.forEach(f=>f(event));}};
    w.localStorage={get length(){return entries.size;},key(i){return [...entries.keys()][i]??null;},getItem(k){return entries.get(k)??null;},setItem(k,v){entries.set(k,v);windows.filter(x=>x!==w).forEach(x=>x.emit('storage',{key:k}));},removeItem(k){entries.delete(k);windows.filter(x=>x!==w).forEach(x=>x.emit('storage',{key:k}));}};
    windows.push(w);return w;
  }};
}
function deferred(){let resolve;const promise=new Promise(r=>{resolve=r;});return {promise,resolve};}

test('delayed closure blocks login in both contexts; persistence contains no credentials',async()=>{
  const env=environment(),gate=deferred(),entered=deferred();let calls=0;
  const request=async()=>{calls++;entered.resolve();await gate.promise;};
  const a=createDeviceClosure({browserWindow:env.window(),closeRequest:request}),b=createDeviceClosure({browserWindow:env.window(),closeRequest:request});
  const closing=a.begin();await entered.promise;assert.equal(a.snapshot().phase,'closing');
  await assert.rejects(b.runLogin(()=>{throw new Error('must not run');}),/cierre pendiente/);
  for(const [k,v] of env.entries){assert.ok(k.startsWith(CLOSURE_PREFIX));assert.deepEqual(Object.keys(JSON.parse(v)).sort(),['id','phase']);}
  gate.resolve();await closing;assert.equal(calls,1);assert.equal(b.snapshot().phase,'ready');
  const login=await b.runLogin(async()=>({identity:'fixture'}));assert.equal(b.permits(login.epoch),true);a.dispose();b.dispose();
});
test('lost response survives new coordinator and recovers the exact same operation',async()=>{
  const env=environment(),ids=[];let fail=true;
  const request=async({operationId})=>{ids.push(operationId);if(fail)throw new Error('network');};
  const a=createDeviceClosure({browserWindow:env.window(),closeRequest:request});await assert.rejects(a.begin());assert.equal(a.snapshot().phase,'unknown');a.dispose();
  const fresh=createDeviceClosure({browserWindow:env.window(),closeRequest:request});assert.equal(fresh.snapshot().phase,'unknown');
  await assert.rejects(fresh.runLogin(async()=>true));fail=false;await fresh.reconcile();assert.equal(ids[0],ids[1]);assert.equal(fresh.snapshot().phase,'ready');fresh.dispose();
});
test('close started during a login prevents admission of that response',async()=>{
  const env=environment(),gate=deferred(),entered=deferred();
  const a=createDeviceClosure({browserWindow:env.window(),closeRequest:async()=>{}}),b=createDeviceClosure({browserWindow:env.window(),closeRequest:async()=>{}});
  const attempt=a.runLogin(async()=>{entered.resolve();await gate.promise;return 'unadmitted';});await entered.promise;
  const close=b.begin();gate.resolve();await assert.rejects(attempt,/cierre pendiente/);await close;assert.equal(a.snapshot().phase,'ready');a.dispose();b.dispose();
});
test('two pending operation keys are both reconciled before another login',async()=>{
  const env=environment(),w=env.window(),ids=[randomUUID(),randomUUID()],seen=[];
  ids.forEach(id=>w.localStorage.setItem(CLOSURE_PREFIX+id,JSON.stringify({id,phase:'unknown'})));
  const c=createDeviceClosure({browserWindow:w,closeRequest:async({operationId})=>seen.push(operationId)});
  await assert.rejects(c.runLogin(async()=>true));await c.reconcile();assert.deepEqual(seen.sort(),ids.sort());c.dispose();
});
test('malformed journal and unavailable Web Locks fail closed',async()=>{
  const env=environment(),w=env.window();w.localStorage.setItem(CLOSURE_PREFIX+randomUUID(),'invalid');
  const c=createDeviceClosure({browserWindow:w,closeRequest:async()=>{throw new Error('must not run');}});
  assert.equal(c.snapshot().phase,'unavailable');await assert.rejects(c.runLogin(async()=>true));c.dispose();
  const other=environment().window();other.navigator.locks=null;
  const d=createDeviceClosure({browserWindow:other,closeRequest:async()=>{}});assert.equal(d.snapshot().phase,'unavailable');await assert.rejects(d.runLogin(async()=>true));d.dispose();
});
test('closure acknowledgement requires exact operation; cookie-only request contains no bearer',async()=>{
  const id=randomUUID();let request;
  const good=async(url,options)=>{request={url,options};return new Response(JSON.stringify({ok:true,contract:'rtm_device_logout_v1',operation_id:id,status:'closed'}));};
  assert.deepEqual(await closeOpsDevice({operationId:id,fetchImpl:good}),{closed:true});
  assert.deepEqual(JSON.parse(request.options.body),{operation_id:id});assert.equal(request.options.headers.Authorization,undefined);assert.equal(request.options.credentials,'same-origin');
  await assert.rejects(closeOpsDevice({operationId:id,fetchImpl:async()=>new Response(JSON.stringify({ok:true,contract:'rtm_device_logout_v1',operation_id:randomUUID(),status:'closed'}))}),/No se ha confirmado/);
  await assert.rejects(closeOpsDevice({operationId:id,fetchImpl:async()=>{throw new Error('lost');}}),/No se ha confirmado/);
});
test('production client refuses an older backend without recoverable closure contract',()=>{
  const status={ok:true,configuration_valid:true,individual_login_enabled:true,shared_ops_login_accepted:false,auth_environment:'production',auth_profile:'production_casework',casework_only:true,local_only:false,staging_only:false};
  assert.throws(()=>validateOpsAuthStatus(status));assert.equal(validateOpsAuthStatus({...status,device_logout_contract:'rtm_device_logout_v1'}).authProfile,'production_casework');
});
