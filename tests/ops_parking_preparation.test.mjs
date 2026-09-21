import test from 'node:test';
import assert from 'node:assert/strict';
import {parseParkingPreparation, appendParkingChecks} from '../src/lib/opsWorkingDraft.js';
const CASE='11111111-1111-4111-8111-111111111111';
const DOC='22222222-2222-4222-8222-222222222222';
const links={proof:'2015-11722#a88',procedure:'2015-11722#a93',parking:'2003-23514#a94',access:'2015-10565#a53'};
const field=()=>({key:'hecho_denunciado_literal',label:'Hecho',value:'Estacionar en doble fila.',sources:[{document_id:DOC,page_index:0}]});
function guide(){return {version:'rtm_traffic_parking_preparation_v1_0',case_id:CASE,status:'review_required',family:'estacionamiento',
 legal_review_pending:true,ready_to_submit:false,checked_on:'2026-09-21',message:'Pendiente de revisar',pending_text:'GUÍA · PENDIENTE DE REVISIÓN\nRevisar la denuncia.',
 reported_fact:field(),procedure_note:'Pendiente',payment_note:'Pendiente',
 checks:['procedure','deadline','location','rule','conditions','evidence','payment','defense'].map(id=>({id,title:id,instruction:'Revisar',fields:[field()],reference_ids:['proof']})),
 references:Object.entries(links).map(([id,path])=>({id,title:id,url:'https://www.boe.es/buscar/act.php?id=BOE-A-'+path}))};}

test('accepts only case-bound unapproved preparation with documented data and official links',()=>{
 assert.equal(parseParkingPreparation(guide(),CASE).checks.length,8);
 for(const change of [{case_id:DOC},{ready_to_submit:true},{legal_review_pending:false},{family:'velocidad'},
   {version:'unreviewed'},{reported_fact:{...field(),sources:[]}},{checks:[]}]) {
   assert.throws(()=>parseParkingPreparation({...guide(),...change},CASE));
 }
 const bad=guide();bad.references[0].url='javascript:alert(1)';assert.throws(()=>parseParkingPreparation(bad,CASE));
 const unknown=guide();unknown.references[0]={id:'evil',title:'evil'};assert.throws(()=>parseParkingPreparation(unknown,CASE));
 const forged=guide();forged.reported_fact.sources[0].page_index=-1;assert.throws(()=>parseParkingPreparation(forged,CASE));
});
test('unavailable guides carry no proposed action; old backend remains compatible',()=>{
 const unavailable={...guide(),status:'unavailable',family:null,checks:[],references:[],pending_text:'',reported_fact:null};
 assert.equal(parseParkingPreparation(unavailable,CASE).status,'unavailable');
 assert.throws(()=>appendParkingChecks('',unavailable));
 assert.throws(()=>parseParkingPreparation({...unavailable,pending_text:'Claim archive'},CASE));
 assert.equal(parseParkingPreparation(undefined,CASE),null);
});
test('appending checks preserves existing text, avoids duplicates and never truncates',()=>{
 const next=appendParkingChecks('Mi comprobación previa.',guide());
 assert.ok(next.startsWith('Mi comprobación previa.\n\n'));
 assert.ok(next.includes(guide().pending_text));
 assert.equal(appendParkingChecks(next,guide()),next);
 assert.throws(()=>appendParkingChecks('X'.repeat(6000),guide()));
});
