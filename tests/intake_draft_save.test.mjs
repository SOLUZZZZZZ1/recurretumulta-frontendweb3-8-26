import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { intakeCreationIssue, saveIntakeDraft } from "../src/lib/intakeDraftSave.js";

const ID = "11111111-1111-4111-8111-111111111111";
const valid = () => ({ ok: true, status: "authorization_pending", authorized: false,
  test_mode: true, case_access_token_header: "X-RTM-Case-Token" });

for (const family of ["trafico", "viajes", "morosidad", "administracion", "bancos", "energia", "telecomunicaciones", "seguros"]) {
  test(`save-only preserves ${family} without invoking authorization or a PDF`, async () => {
    const expected = { caseId: ID, authorizationFlow: "unavailable", family,
      clientFields: { full_name: "Persona ficticia", email: "contacto@example.com", postal_code: "00001" } };
    let remembered;
    const result = await saveIntakeDraft({
      createDraft: async () => expected,
      persistDraft: (record) => { remembered = record; },
      issueAuthorization: () => assert.fail("saving must not issue representation"),
      openAuthorization: () => assert.fail("saving must not open a PDF"),
    });
    assert.equal(result, expected);
    assert.equal(remembered, expected);
    assert.equal(result.clientFields.postal_code, "00001");
    assert.equal(result.authorizationBinding, undefined);
  });
}

test("an existing reference is reused without another intake or state mutation", async () => {
  const draft = Object.freeze({ caseId: ID, authorizationFlow: "unavailable" });
  assert.equal(await saveIntakeDraft({ draft,
    createDraft: () => assert.fail("duplicate intake"),
    persistDraft: () => assert.fail("existing reference must not be rewritten"),
  }), draft);
});

test("an incomplete response preserves its reference before reporting failure", async () => {
  let saved;
  let calls = 0;
  const options = { createDraft: async () => { calls++; return { caseId: ID, blockedMessage: "access missing" }; },
    persistDraft: (record) => { saved = record; } };
  await assert.rejects(saveIntakeDraft(options), /access missing/);
  assert.equal(saved.caseId, ID);
  await assert.rejects(saveIntakeDraft({ ...options, draft: saved }), /access missing/);
  assert.equal(calls, 1);
});

test("failed writes and invalid identifiers are not reported as saved", async () => {
  for (const createDraft of [
    async () => { throw new Error("storage unavailable"); },
    async () => ({}), async () => ({ caseId: "../other" }),
    async () => ({ caseId: [ID] }),
  ]) await assert.rejects(saveIntakeDraft({ createDraft,
    persistDraft: () => assert.fail("no valid response to retain") }));
});

test("only a confirmed pending intake with safe access passes the response check", () => {
  assert.equal(intakeCreationIssue(valid(), true, true), "");
  assert.equal(intakeCreationIssue({ ...valid(), test_mode: false }, true), "");
  for (const change of [{ ok: false }, { status: "ready_to_pay" }, { authorized: true },
    { authorized: undefined }, { test_mode: "true" }, { signed_authority_verified: true },
    { case_access_token_header: "Authorization" }]) {
    assert.notEqual(intakeCreationIssue({ ...valid(), ...change }, true), "");
  }
  assert.notEqual(intakeCreationIssue(valid(), false), "");
  assert.notEqual(intakeCreationIssue({ ...valid(), test_mode: false }, true, true), "");
});

test("the save coordinator has no browser persistence, transport or consent side effects", () => {
  const source = readFileSync(new URL("../src/lib/intakeDraftSave.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /localStorage|sessionStorage|window\.open|\bfetch\s*\(|\.issueAuthorization\s*\(|consent\s*:\s*true/);
});
