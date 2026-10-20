import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateWorkspace, workspaceError, READ_VERSION } from "../src/lib/workspaceRead.js";
const fixtures = JSON.parse(readFileSync(new URL("./fixtures/workspace_read.json",import.meta.url)));
const clone = () => structuredClone(fixtures.a);
test("JSON produced by full backend ASGI fixture is accepted",()=>{
  assert.equal(validateWorkspace(fixtures.a,fixtures.a.case_id).workspace_version,READ_VERSION);
  assert.equal(validateWorkspace(fixtures.b,fixtures.b.case_id).case_id,fixtures.b.case_id);
});
for(const [label,change] of [
  ["wrong case",x=>x.case_id=fixtures.b.case_id],
  ["unknown contract",x=>x.workspace_version="invented"],
  ["missing identity",x=>delete x.case.identities.interested.full_name],
  ["invalid identity type",x=>x.case.identities.interested.full_name.value={}],
  ["missing section",x=>delete x.sections.documents],
  ["other case document",x=>x.sections.documents.items[0].case_id=fixtures.b.case_id],
  ["false empty",x=>x.sections.documents.status="empty"],
  ["export capability",x=>x.capabilities.document_export=true],
  ["missing schema with items",x=>x.sections.documents.status="schema_unavailable"],
])test(label,()=>{const x=clone();change(x);assert.throws(()=>validateWorkspace(x,x.case_id===fixtures.a.case_id?x.case_id:fixtures.a.case_id));});
test("explicit unavailable section, never forged empty",()=>{
 const x=clone();x.sections.documents={status:"schema_unavailable",items:null,missing_columns:["id"]};
 assert.equal(validateWorkspace(x,x.case_id).sections.documents.items,null);
});
test("known case 404 distinct from absent route; private errors not echoed",()=>{
 assert.match(workspaceError({status:404,code:"WORKSPACE_CASE_NOT_FOUND"}),/Expediente no encontrado/);
 assert.match(workspaceError({status:404}),/ruta/);
 assert.doesNotMatch(workspaceError({status:500,message:"secret-string"}),/secret-string/);
});
