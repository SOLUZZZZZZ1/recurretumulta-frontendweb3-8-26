import assert from "node:assert/strict";
import test from "node:test";

import {
  buildAuthorizationForm,
  createCaseRequestGuard,
  EMPTY_AUTHORIZATION_FORM,
} from "../src/lib/authorizationCase.js";

test("a new case aborts and invalidates every late response from the prior case", () => {
  const guard = createCaseRequestGuard();
  const requestA = guard.begin("aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  const requestB = guard.begin("bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");

  assert.equal(requestA.controller.signal.aborted, true);
  assert.equal(requestA.isCurrent(), false);
  assert.equal(requestB.controller.signal.aborted, false);
  assert.equal(requestB.isCurrent(), true);

  guard.cancel();
  assert.equal(requestB.controller.signal.aborted, true);
  assert.equal(requestB.isCurrent(), false);
});

test("an incomplete case never inherits identity or vehicle data from another case", () => {
  const caseA = buildAuthorizationForm({
    interested_data: {
      full_name: "Persona A",
      dni_nie: "00000000T",
      matricula: "1111AAA",
      domicilio_notif: "Domicilio A",
      email: "a@example.com",
      telefono: "600000000",
    },
  });
  const caseB = buildAuthorizationForm({ interested_data: { full_name: "Persona B" } });

  assert.equal(caseA.matricula, "1111AAA");
  assert.deepEqual(caseB, { ...EMPTY_AUTHORIZATION_FORM, full_name: "Persona B" });
  assert.equal(caseB.dni_nie, "");
  assert.equal(caseB.matricula, "");
  assert.equal(caseB.email, "");
});
