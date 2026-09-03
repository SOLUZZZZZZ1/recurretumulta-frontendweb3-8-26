import assert from "node:assert/strict";
import test from "node:test";

import {
  appendAuthorizationDocumentBinding,
  hasVehiclePreparationConsent,
  isLegalRepresentationVerified,
  isVehicleRemovalCase,
  parseAuthorizationCandidateEnvelope,
  parseAuthorizationIssueEnvelope,
} from "../src/lib/authorizationEvidence.js";

const CASE_ID = "11111111-1111-4111-8111-111111111111";
const AUTHORITY_ID = "22222222-2222-4222-8222-222222222222";
const DOCUMENT_ID = "33333333-3333-4333-8333-333333333333";
const NONCE = "44444444-4444-4444-8444-444444444444";
const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SHA_C = "c".repeat(64);

const issue = {
  ok: true,
  case_id: CASE_ID,
  authorized: true,
  authority_id: AUTHORITY_ID,
  authority_version: "v1_dgt_homologado",
  authority_material_sha256: SHA_A,
  authorization_pdf: {
    id: DOCUMENT_ID,
    sha256: SHA_B,
    mime: "application/pdf",
    size_bytes: 4096,
    custody: "private_server_storage",
  },
  authorization_document_binding: {
    authority_material_sha256: SHA_A,
    generated_document_id: DOCUMENT_ID,
    generated_document_sha256: SHA_B,
    generated_document_version: "v1_dgt_homologado",
    document_nonce: NONCE,
    issuance_attestation_sha256: SHA_C,
  },
};

test("issued authorization is exact and cryptographically cross-bound to its PDF", () => {
  const parsed = parseAuthorizationIssueEnvelope(issue, CASE_ID);
  assert.equal(parsed.pdf.id, DOCUMENT_ID);
  assert.equal(parsed.binding.document_nonce, NONCE);

  assert.throws(() =>
    parseAuthorizationIssueEnvelope(
      {
        ...issue,
        authorization_document_binding: {
          ...issue.authorization_document_binding,
          generated_document_sha256: SHA_C,
        },
      },
      CASE_ID
    )
  );
  assert.throws(() =>
    parseAuthorizationIssueEnvelope({ ...issue, download_url: "https://evil.example" }, CASE_ID)
  );
});

test("signed candidate upload sends all six opaque binding fields", () => {
  const { binding } = parseAuthorizationIssueEnvelope(issue, CASE_ID);
  const form = appendAuthorizationDocumentBinding(new FormData(), binding);
  assert.deepEqual([...form.keys()].sort(), [
    "authority_material_sha256",
    "document_nonce",
    "generated_document_id",
    "generated_document_sha256",
    "generated_document_version",
    "issuance_attestation_sha256",
  ]);
});

test("uploaded PDF remains a candidate pending human review", () => {
  const parsed = parseAuthorizationCandidateEnvelope(
    {
      ok: true,
      case_id: CASE_ID,
      authorized: true,
      signed_authority_verified: false,
      authorization_evidence: {
        status: "pending_review",
        candidate_document: {
          id: "55555555-5555-4555-8555-555555555555",
          sha256: SHA_C,
          mime: "application/pdf",
          size_bytes: 5000,
          custody: "private_server_storage",
        },
        candidate_attestation_sha256: SHA_A,
      },
    },
    CASE_ID
  );
  assert.equal(parsed.status, "pending_review");
  assert.throws(() =>
    parseAuthorizationCandidateEnvelope(
      {
        ok: true,
        case_id: CASE_ID,
        authorized: true,
        signed_authority_verified: true,
        authorization_evidence: {
          status: "verified",
          candidate_document: issue.authorization_pdf,
          candidate_attestation_sha256: SHA_A,
        },
      },
      CASE_ID
    )
  );
});

test("vehicle preparation consent never becomes legal representation", () => {
  const vehicle = {
    case_type: "vehicle_removal",
    status: "vehicle_removal_paid",
    authorized: true,
    authorization_evidence_status: "verified",
    signed_authority_verified: true,
    vehicle_preparation_consent: true,
  };
  assert.equal(isVehicleRemovalCase(vehicle), true);
  assert.equal(hasVehiclePreparationConsent(vehicle), true);
  assert.equal(isLegalRepresentationVerified(vehicle), false);

  assert.equal(
    isLegalRepresentationVerified({
      case_type: "fine",
      authorization_evidence_status: "verified",
      signed_authority_verified: true,
    }),
    true
  );
  assert.equal(
    isLegalRepresentationVerified({ case_type: "fine", authorized: true }),
    false
  );
});
