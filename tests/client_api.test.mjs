import test from 'node:test';
import assert from 'node:assert/strict';
import { clientRequest, clientApiUrl } from '../src/lib/clientApi.js';

test('customer writes use only the same-origin proxy, with no redirect replay', async () => {
  const calls=[]; const body=new FormData();body.append('file',new Blob(['synthetic']),'fixture.txt');
  const result=await clientRequest('/cases/fixture/append-documents',{method:'POST',body},async (...args)=>{
    calls.push(args);return Response.json({ok:true});
  });
  assert.deepEqual(result,{ok:true});assert.equal(calls.length,1);
  assert.equal(calls[0][0],'/api/cases/fixture/append-documents');
  assert.equal(calls[0][1].body,body);assert.equal(calls[0][1].redirect,'error');
});

for (const [name, response] of [
  ['lost response after server commit',()=>{throw new TypeError('connection lost');}],
  ['server error',()=>Response.json({detail:'failure'},{status:500})],
  ['HTML instead of JSON',()=>new Response('<html>proxy error</html>')],
  ['truncated JSON',()=>new Response('{"ok":')],
  ['unexpected success body',()=>Response.json(null)],
]) test(name+' never sends a second Checkout',async()=>{
  let count=0;
  await assert.rejects(clientRequest('/billing/checkout',{method:'POST'},async()=>{count++;return response();}),
    e=>e.uncertain===true && /No repitas/.test(e.message));
  assert.equal(count,1);
});

test('a validation rejection remains a rejection and is not replayed', async()=>{
  let count=0;
  await assert.rejects(clientRequest('/cases/intake-draft',{method:'POST'},async()=>{count++;return Response.json({detail:'Falta consentimiento'},{status:400});}),
    e=>e.status===400 && e.uncertain===false && e.message==='Falta consentimiento');
  assert.equal(count,1);
});

test('a read failure does not turn into an unrelated-server lookup',async()=>{
  let count=0;
  await assert.rejects(clientRequest('/cases/fixture/public-status',{},async()=>{count++;throw new Error('offline');}),e=>e.uncertain===false);
  assert.equal(count,1);
});

test('absolute or ambiguous URLs cannot select a different backend',()=>{
  for (const value of ['https://example.com/cases','//example.com/cases','/\\example.com/cases',null]) {
    assert.throws(()=>clientApiUrl(value));
  }
});
