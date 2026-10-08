import assert from "node:assert/strict";
import test from "node:test";
import { withOpsAuthorizationStatus } from "../src/lib/opsCaseAuthorization.js";
import { isAuthorizationPendingReview, isLegalRepresentationVerified } from "../src/lib/authorizationEvidence.js";

const CASE_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_CASE_ID = "22222222-2222-4222-8222-222222222222";
const workspace = { case_type: "fine", department: "traffic", authorized: true };
const reviewed = { id: CASE_ID, case_type: "fine", authorization_evidence_status: "verified", signed_authority_verified: true };

test("the summary reuses the existing case review instead of the workspace's legacy flag", () => {
  assert.equal(isLegalRepresentationVerified(workspace), false);
  const result = withOpsAuthorizationStatus(workspace, reviewed, CASE_ID);
  assert.equal(isLegalRepresentationVerified(result), true);
  assert.equal(result.department, "traffic");
  assert.equal(Object.hasOwn(workspace, "signed_authority_verified"), false);
});

test("failed, mismatched, incomplete or contradictory review projections remain unknown", () => {
  for (const record of [null, {}, { ...reviewed, id: OTHER_CASE_ID }, { ...reviewed, case_type: "vehicle_removal" },
    { ...reviewed, signed_authority_verified: undefined }, { ...reviewed, signed_authority_verified: "true" },
    { ...reviewed, signed_authority_verified: false }, { ...reviewed, authorization_evidence_status: "pending_review" }]) {
    const result = withOpsAuthorizationStatus({ ...workspace, ...reviewed }, record, CASE_ID);
    assert.equal(result.authorization_evidence_status, null);
    assert.equal(isLegalRepresentationVerified(result), false);
    assert.equal(isAuthorizationPendingReview(result), false);
  }
});

test("a real pending review stays pending and vehicle preparation never becomes representation", () => {
  const pending = withOpsAuthorizationStatus(workspace, { ...reviewed, authorization_evidence_status: "pending_review", signed_authority_verified: false }, CASE_ID);
  assert.equal(isAuthorizationPendingReview(pending), true);
  assert.equal(isLegalRepresentationVerified(pending), false);
  const vehicle = withOpsAuthorizationStatus({ case_type: "vehicle_removal", vehicle_preparation_consent: true }, { ...reviewed, case_type: "vehicle_removal" }, CASE_ID);
  assert.equal(isLegalRepresentationVerified(vehicle), false);
});
