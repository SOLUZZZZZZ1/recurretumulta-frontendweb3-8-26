import test from 'node:test';
import assert from 'node:assert/strict';
import { intakeContinuationPath, intakeDocumentsPath } from '../src/lib/intakeJourney.js';

test('modern intake resumes the same case in each service without using the traffic-only legacy form', () => {
  for (const [department, case_type] of [['traffic', 'fine'], ['debt', 'asnef_equifax'], ['administration', 'aeat'], ['claims', 'airline']]) {
    assert.equal(intakeContinuationPath({ interested_data: { department, case_type, source_module: 'rtm_web' } }, 'case-id'), `/iniciar-expediente/${department}/${case_type}?case=case-id`);
  }
});

test('legacy cases keep their existing authorization route', () => {
  assert.equal(intakeContinuationPath({ interested_data: { department: 'traffic' } }, 'case-id'), null);
  assert.equal(intakeContinuationPath({ interested_data: { source_module: 'rtm_web', department: 'unknown' } }, 'case-id'), null);
});

test('documents use the persisted service, including the vehicle-removal exception', () => {
  for (const [department, case_type, expected] of [['traffic', 'fine', '/multas/documentos'], ['traffic', 'vehicle_removal', '/eliminar-coche'], ['debt', 'asnef_equifax', '/deudas/documentos'], ['administration', 'aeat', '/administracion/documentos'], ['claims', 'airline', '/reclamaciones/documentos']]) {
    assert.equal(intakeDocumentsPath({ interested_data: { department, case_type } }), expected);
  }
  assert.equal(intakeDocumentsPath({}), '/otros/documentos');
});
