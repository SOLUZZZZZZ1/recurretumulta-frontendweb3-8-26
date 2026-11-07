import assert from 'node:assert/strict';
import test from 'node:test';
import {studyReviewRequirements,studyWriteConflictMessage} from '../src/lib/studyReviewRequirements.js';

const documents = [
  {id:'original',kind:'original'}, {id:'authorization',kind:'authorization_signed'},
  {id:'front',kind:'identity_front'}, {id:'back',kind:'identity_back'},
  ...[1,2,3].map(n=>({id:'other'+n,kind:'generated_resource'})),
];
const reviewed = (...ids)=>ids.map(document_id=>({document_id,read_confirmed:true}));

test('five reviewed documents cannot replace the original and authorization',()=>{
  assert.deepEqual(studyReviewRequirements(documents,reviewed('front','back','other1','other2','other3')),
    ['Documento original aportado','Autorización firmada']);
});
test('either identity side completes the three required categories',()=>{
  for(const identity of ['front','back'])assert.deepEqual(studyReviewRequirements(documents,reviewed('original','authorization',identity)),[]);
});
test('unconfirmed, duplicate and foreign references do not satisfy missing categories',()=>{
  assert.deepEqual(studyReviewRequirements(documents,[...reviewed('front','front','foreign'),{document_id:'original',read_confirmed:false}]),
    ['Documento original aportado','Autorización firmada']);
});
test('payment and document rejections keep distinct explanations and reconciliation',()=>{
  assert.match(studyWriteConflictMessage('STUDY_PAYMENT_NOT_CONFIRMED'),/no confirma el pago/);
  assert.match(studyWriteConflictMessage('STUDY_REQUIRED_DOCUMENTS_NOT_REVIEWED'),/Falta revisar el documento original/);
  for(const code of ['STUDY_PAYMENT_NOT_CONFIRMED','STUDY_REQUIRED_DOCUMENTS_NOT_REVIEWED','STUDY_REVISION_CONFLICT'])
    assert.match(studyWriteConflictMessage(code),/Consultar operación e historial/);
});
test('unexpected server detail cannot be displayed as a rejection reason',()=>{
  for(const value of ['secret-from-provider','__proto__','constructor',undefined]){
    const message=studyWriteConflictMessage(value);
    assert.match(message,/^El servidor rechazó la escritura\./);
    assert.doesNotMatch(message,/secret-from-provider|__proto__|constructor/);
  }
});
