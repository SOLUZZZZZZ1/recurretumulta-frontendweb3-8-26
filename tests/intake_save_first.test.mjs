import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import {
  continueIntakeAuthorization,
  intakeAuthorizationFlow,
  LOCAL_RTM_AUTHORIZATION_KIND,
  saveIntakeDraft,
} from "../src/lib/intakeAuthorizationFlow.js";
import { PUBLIC_SERVICE_FAMILIES } from "../src/data/publicServices.js";

const CASE = "11111111-1111-4111-8111-111111111111";
const DOCUMENT = "22222222-2222-4222-8222-222222222222";
const formSource = readFileSync(new URL("../src/pages/IniciarExpedienteRTM.jsx", import.meta.url), "utf8");

function harness(flow = "unavailable") {
  let current = null;
  const calls = [];
  return {
    calls,
    get current() { return current; },
    options: {
      createDraft: async () => {
        calls.push("intake");
        return { caseId: CASE, authorizationFlow: flow, blockedMessage: "" };
      },
      persistDraft: async (saved) => { calls.push("retain"); current = saved; },
      issueAuthorization: async () => { calls.push("issue"); return { binding: { document_id: DOCUMENT } }; },
      openAuthorization: async () => { calls.push("open"); },
    },
  };
}

test("save-only retains the server reference without issue or PDF callbacks", async () => {
  const h = harness("dgt");
  const result = await continueIntakeAuthorization({ ...h.options, saveOnly: true });
  assert.equal(result.caseId, CASE);
  assert.equal(result.authorizationBinding, undefined);
  assert.equal(result, h.current);
  assert.deepEqual(h.calls, ["intake", "retain"]);
});

test("standalone save works even when authorization is unavailable", async () => {
  const h = harness();
  const result = await saveIntakeDraft(h.options);
  assert.equal(result.authorizationFlow, "unavailable");
  assert.equal(result.authorizationBinding, undefined);
  assert.deepEqual(h.calls, ["intake", "retain"]);
});

test("all existing intake families retain their selected authorization kind during save-only", async () => {
  const families = PUBLIC_SERVICE_FAMILIES.filter((item) => item.intake);
  assert.equal(families.length, 8);
  for (const family of families) {
    for (const caseType of family.intake.caseTypes) {
      const flow = intakeAuthorizationFlow({
        family: family.id, department: family.intake.department, caseType,
      });
      const h = harness(flow);
      const result = await continueIntakeAuthorization({ ...h.options, saveOnly: true });
      assert.equal(result.authorizationFlow, flow);
      assert.equal(result.authorizationBinding, undefined);
      assert.deepEqual(h.calls, ["intake", "retain"]);
    }
  }
});

test("known draft is reused without a second intake or unnecessary state write", async () => {
  const h = harness();
  const first = await saveIntakeDraft(h.options);
  const second = await saveIntakeDraft({ ...h.options, draft: first });
  assert.equal(second, first);
  assert.deepEqual(h.calls, ["intake", "retain"]);
});

test("a known reference with blocked capability is retained but never called saved successfully", async () => {
  const h = harness();
  await assert.rejects(continueIntakeAuthorization({ ...h.options, saveOnly: true,
    createDraft: async () => ({ caseId: CASE, authorizationFlow: "unavailable", blockedMessage: "capability not confirmed" }),
  }), /capability not confirmed/);
  assert.equal(h.current.caseId, CASE);
  assert.deepEqual(h.calls, ["retain"]);
  await assert.rejects(saveIntakeDraft({ ...h.options, draft: h.current }), /capability not confirmed/);
  assert.deepEqual(h.calls, ["retain"]);
});

test("a server refusal does not retain a fake reference or start authorization", async () => {
  const h = harness();
  await assert.rejects(continueIntakeAuthorization({ ...h.options, saveOnly: true,
    createDraft: async () => { throw new Error("staging input refused"); },
  }), /staging input refused/);
  assert.equal(h.current, null);
  assert.deepEqual(h.calls, []);
});

test("missing or malformed case references are rejected", async () => {
  for (const result of [null, {}, { caseId: "../other" }, { caseId: "" }]) {
    const h = harness();
    await assert.rejects(saveIntakeDraft({ ...h.options, createDraft: async () => result }), /referencia/i);
    assert.equal(h.current, null);
    assert.deepEqual(h.calls, []);
  }
});

test("save-only requires a boolean rather than trusting a truthy string", async () => {
  for (const value of ["true", "false", 0, 1, null]) {
    const h = harness("dgt");
    await assert.rejects(continueIntakeAuthorization({ ...h.options, saveOnly: value }), /expresamente/);
    assert.deepEqual(h.calls, []);
  }
});

test("unavailable authorization never falls back to DGT after data was saved", async () => {
  const h = harness();
  const saved = await continueIntakeAuthorization({ ...h.options, saveOnly: true });
  await assert.rejects(continueIntakeAuthorization({ ...h.options, draft: saved }), /no está disponible/);
  assert.deepEqual(h.calls, ["intake", "retain"]);
  assert.equal(h.current.authorizationFlow, "unavailable");
});

test("unknown authorization kinds fail closed before either authorization callback", async () => {
  const h = harness("invented-kind");
  await assert.rejects(continueIntakeAuthorization(h.options), /no está disponible/);
  assert.deepEqual(h.calls, ["intake", "retain"]);
});

test("explicit second step issues DGT on the same case and later retries only its PDF", async () => {
  const h = harness("dgt");
  const saved = await continueIntakeAuthorization({ ...h.options, saveOnly: true });
  const issued = await continueIntakeAuthorization({ ...h.options, draft: saved });
  assert.equal(issued.caseId, CASE);
  assert.equal(issued.authorizationBinding.document_id, DOCUMENT);
  await continueIntakeAuthorization({ ...h.options, draft: h.current });
  assert.deepEqual(h.calls, ["intake", "retain", "issue", "retain", "open", "open"]);
});

test("local generic keeps its own authorization contract after a separate save", async () => {
  const h = harness(LOCAL_RTM_AUTHORIZATION_KIND);
  const saved = await continueIntakeAuthorization({ ...h.options, saveOnly: true });
  await continueIntakeAuthorization({ ...h.options, draft: saved });
  assert.equal(h.current.authorizationFlow, LOCAL_RTM_AUTHORIZATION_KIND);
  assert.deepEqual(h.calls, ["intake", "retain", "issue", "retain", "open"]);
});

test("default rehearsal sequence and vehicle-removal continuation remain supported", async () => {
  const rehearsal = harness("dgt");
  await continueIntakeAuthorization(rehearsal.options);
  assert.deepEqual(rehearsal.calls, ["intake", "retain", "issue", "retain", "open"]);
  const removal = harness("vehicle_removal");
  await continueIntakeAuthorization(removal.options);
  assert.deepEqual(removal.calls, ["intake", "retain"]);
});

test("screen selects save-only for ordinary first submit, retaining special rehearsal paths", () => {
  assert.match(formSource, /const saveOnly = !rehearsal && !draftCaseRef\.current && !isVehicleRemoval;/);
  assert.match(formSource, /continueIntakeAuthorization\(\{\s*saveOnly,/);
  assert.match(formSource, /Guardar datos del expediente/);
  assert.match(formSource, /if \(rehearsal && !isVehicleRemoval && !isLocalGeneric && !form\.representation_confirmed\)/);
  const validation = formSource.slice(formSource.indexOf("function validateDraft"), formSource.indexOf("async function createDraftAndDownload"));
  assert.doesNotMatch(validation, /authorizationFlow === "unavailable"/);
  assert.match(validation, /privacy_accepted/);
  assert.match(validation, /localSyntheticIdentityError/);
});

test("screen preserves unavailable-family drafts without constructing another authorization route", () => {
  assert.match(formSource, /isVehicleRemoval \|\| authorizationFlow === "unavailable"\s*\? \{\} : authorizationRoutes/);
  assert.match(formSource, /isVehicleRemoval \|\| isLocalGeneric \|\| saveOnly \? false : form\.representation_confirmed/);
  assert.match(formSource, /draftCase\.authorizationFlow === "unavailable" \? <p role="status">/);
  assert.match(formSource, /restricciones del entorno de pruebas siguen vigentes/);
});

test("screen does not present a blocked reference as saved or allow its continuation", () => {
  assert.match(formSource, /hasCase=\{Boolean\(draftCase\) && !draftCase\.blockedMessage\}/);
  assert.match(formSource, /draftCase\.blockedMessage \? <p role="alert">/);
  assert.match(formSource, /!rehearsal && draftCase\.authorizationFlow === "dgt"/);
  assert.match(formSource, /disabled=\{loading \|\| \(draftCase\.authorizationFlow === "dgt" && !form\.representation_confirmed\)\}/);
});
