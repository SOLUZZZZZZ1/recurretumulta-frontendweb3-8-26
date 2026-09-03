import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import test from "node:test";

import {
  AUTHORIZATION_VIEW_WINDOW_MS,
  OPS_REAUTHENTICATE_ROUTE,
  OpsAuthorizationReviewError,
  buildAuthorizationReviewBody,
  fetchVerifiedAuthorizationCandidatePdf,
  isAuthorizationViewFresh,
  reauthenticateAuthorizationReviewer,
  resolvePendingAuthorizationCandidates,
  submitAuthorizationReview,
  verifyAuthorizationCandidateAttestation,
} from "../src/lib/opsAuthorizationReview.js";

const CASE_ID = "11111111-1111-4111-8111-111111111111";
const AUTHORITY_ID = "22222222-2222-4222-8222-222222222222";
const ISSUED_ID = "33333333-3333-4333-8333-333333333333";
const NONCE = "44444444-4444-4444-8444-444444444444";
const CANDIDATE_ID = "55555555-5555-4555-8555-555555555555";
const SESSION_ID = "66666666-6666-4666-8666-666666666666";
const SHA_A = "a".repeat(64);
const SHA_B = "b".repeat(64);
const SIGNATURE = "f".repeat(64);
const PDF_BYTES = new TextEncoder().encode("%PDF-1.4\nexact-review\n%%EOF");
const PDF_SHA = createHash("sha256").update(PDF_BYTES).digest("hex");

function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  return `{${Object.keys(value)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
    .join(",")}}`;
}

function fixtures() {
  const uploadedAt = "2026-09-03T12:00:00+00:00";
  const material = {
    format: "rtm_authorization_signature_candidate_v1",
    case_id: CASE_ID,
    authority_id: AUTHORITY_ID,
    authority_version: "v1_dgt_homologado",
    authority_material_sha256: SHA_A,
    issued_document_id: ISSUED_ID,
    issued_document_sha256: SHA_B,
    issued_document_version: "v1_dgt_homologado",
    document_nonce: NONCE,
    issuance_attestation_sha256: SHA_B,
    candidate_document_id: CANDIDATE_ID,
    candidate_document_sha256: PDF_SHA,
    mime: "application/pdf",
    size_bytes: PDF_BYTES.byteLength,
    uploaded_at: uploadedAt,
    review_status: "pending_review",
  };
  const materialSha256 = createHash("sha256")
    .update(canonicalJson(material))
    .digest("hex");
  const document = {
    id: CANDIDATE_ID,
    kind: "authorization_signed_candidate",
    sha256: PDF_SHA,
    mime: "application/pdf",
    size_bytes: PDF_BYTES.byteLength,
    created_at: uploadedAt,
    custody: "rtm_internal_only",
    operator_export_allowed: false,
  };
  const event = {
    type: "authorization_signature_candidate_uploaded",
    payload: {
      material,
      material_sha256: materialSha256,
      signature_sha256: SIGNATURE,
    },
    created_at: "2026-09-03T12:00:01+00:00",
  };
  return { document, event, materialSha256 };
}

function exactCandidate() {
  const { document, event } = fixtures();
  return resolvePendingAuthorizationCandidates({
    caseId: CASE_ID,
    documents: [document],
    events: [event],
  })[0];
}

function pdfResponse(bytes = PDF_BYTES, overrides = {}) {
  return new Response(bytes, {
    status: overrides.status || 200,
    headers: {
      "Cache-Control": "no-store, private, max-age=0",
      "Content-Disposition": `inline; filename="authorization_candidate_${CANDIDATE_ID}.pdf"`,
      "Content-Length": String(bytes.byteLength),
      "Content-Type": "application/pdf",
      "X-Content-Type-Options": "nosniff",
      ...(overrides.headers || {}),
    },
  });
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "Content-Type": "application/json",
    },
  });
}

const COMPLETE_CHECKS = Object.freeze({
  reviewedEntireDocument: true,
  generatedDocumentMatches: true,
  identityMatches: true,
  signaturePresent: true,
});
test("joins the pending document to one exact candidate attestation", async () => {
  const candidate = exactCandidate();
  assert.equal(candidate.caseId, CASE_ID);
  assert.equal(candidate.documentId, CANDIDATE_ID);
  assert.equal(candidate.documentSha256, PDF_SHA);
  assert.equal(candidate.sizeBytes, PDF_BYTES.byteLength);
  assert.equal(candidate.attestationSha256, fixtures().materialSha256);
  assert.equal(
    await verifyAuthorizationCandidateAttestation(candidate, webcrypto),
    true
  );
});

test("candidate discovery fails closed for missing, duplicate, extra or mismatched evidence", () => {
  const { document, event } = fixtures();
  const cases = [
    { documents: [document], events: [] },
    { documents: [document], events: [event, structuredClone(event)] },
    {
      documents: [{ ...document, sha256: SHA_A }],
      events: [event],
    },
    {
      documents: [{ ...document, download_url: "https://evil.example/file" }],
      events: [event],
    },
    {
      documents: [document],
      events: [
        {
          ...event,
          payload: { ...event.payload, injected: true },
        },
      ],
    },
  ];
  for (const value of cases) {
    assert.throws(
      () =>
        resolvePendingAuthorizationCandidates({
          caseId: CASE_ID,
          ...value,
        }),
      OpsAuthorizationReviewError
    );
  }
});

test("returns an empty immutable projection when no candidate document is pending", () => {
  const result = resolvePendingAuthorizationCandidates({
    caseId: CASE_ID,
    documents: [],
    events: [],
  });
  assert.deepEqual(result, []);
  assert.equal(Object.isFrozen(result), true);
});

test("fetches only the exact protected PDF and verifies headers, size and digest", async () => {
  const calls = [];
  const candidate = exactCandidate();
  const result = await fetchVerifiedAuthorizationCandidatePdf({
    candidate,
    cryptoImpl: webcrypto,
    authFetch: async (url, options) => {
      calls.push({ url, options });
      return pdfResponse();
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(
    calls[0].url,
    `/api/ops/cases/${CASE_ID}/authorization-signature-candidate/${CANDIDATE_ID}`
  );
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[0].options.headers.Accept, "application/pdf");
  assert.deepEqual(result.bytes, PDF_BYTES);
  assert.equal(result.mime, "application/pdf");
});

test("refuses a PDF with changed bytes or non-view response headers", async () => {
  const candidate = exactCandidate();
  const changed = new Uint8Array(PDF_BYTES);
  changed[changed.length - 1] ^= 1;

  await assert.rejects(
    fetchVerifiedAuthorizationCandidatePdf({
      candidate,
      cryptoImpl: webcrypto,
      authFetch: async () => pdfResponse(changed),
    }),
    (error) =>
      error instanceof OpsAuthorizationReviewError &&
      error.code === "authorization_review.pdf_digest_mismatch"
  );
  await assert.rejects(
    fetchVerifiedAuthorizationCandidatePdf({
      candidate,
      cryptoImpl: webcrypto,
      authFetch: async () =>
        pdfResponse(PDF_BYTES, { headers: { "Content-Type": "text/html" } }),
    }),
    (error) =>
      error instanceof OpsAuthorizationReviewError &&
      error.code === "authorization_review.pdf_contract_invalid"
  );
});

test("a view receipt is candidate-bound and expires before the server window", () => {
  const candidate = exactCandidate();
  const viewedAt = 1_000_000;
  const receipt = { candidateKey: candidate.key, viewedAt };
  assert.equal(isAuthorizationViewFresh(receipt, candidate, viewedAt), true);
  assert.equal(
    isAuthorizationViewFresh(
      receipt,
      candidate,
      viewedAt + AUTHORIZATION_VIEW_WINDOW_MS - 1
    ),
    true
  );
  assert.equal(
    isAuthorizationViewFresh(receipt, candidate, viewedAt + AUTHORIZATION_VIEW_WINDOW_MS),
    false
  );
  assert.equal(
    isAuthorizationViewFresh(
      { ...receipt, candidateKey: `${candidate.key}-other` },
      candidate,
      viewedAt
    ),
    false
  );
});

test("builds the backend's exact approval and rejection bodies", () => {
  const candidate = exactCandidate();
  assert.deepEqual(
    buildAuthorizationReviewBody({
      decision: "approve",
      candidate,
      checks: COMPLETE_CHECKS,
    }),
    {
      decision: "approve",
      candidate_document_id: CANDIDATE_ID,
      candidate_attestation_sha256: candidate.attestationSha256,
      reviewed_entire_document: true,
      generated_document_matches: true,
      identity_matches: true,
      signature_present: true,
      reason_code: null,
    }
  );
  assert.equal(
    buildAuthorizationReviewBody({
      decision: "reject",
      candidate,
      checks: { ...COMPLETE_CHECKS, signaturePresent: false },
      reasonCode: "signature_missing",
    }).reason_code,
    "signature_missing"
  );
  assert.throws(
    () =>
      buildAuthorizationReviewBody({
        decision: "approve",
        candidate,
        checks: { ...COMPLETE_CHECKS, signaturePresent: false },
      }),
    /aprobación exige/i
  );
  assert.throws(
    () =>
      buildAuthorizationReviewBody({
        decision: "reject",
        candidate,
        checks: COMPLETE_CHECKS,
      }),
    /motivo estructurado/i
  );
});

test("reauthenticates the same session and then posts the exact approval", async () => {
  const candidate = exactCandidate();
  const calls = [];
  const authFetch = async (url, options) => {
    calls.push({ url, options });
    if (url === OPS_REAUTHENTICATE_ROUTE) {
      return jsonResponse({
        ok: true,
        status: "reauthenticated",
        session_id: SESSION_ID,
        reauthenticated_at: "2026-09-03T12:03:00+00:00",
        request_id: "review-request-1",
      });
    }
    return jsonResponse({
      ok: true,
      case_id: CASE_ID,
      candidate_document_id: CANDIDATE_ID,
      authorization_evidence_status: "verified",
      signed_authority_verified: true,
    });
  };

  const reauthenticated = await reauthenticateAuthorizationReviewer({
    authFetch,
    password: "supervisor-secret",
    expectedSessionId: SESSION_ID,
  });
  assert.equal(reauthenticated.sessionId, SESSION_ID);
  assert.equal(calls[0].url, OPS_REAUTHENTICATE_ROUTE);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    password: "supervisor-secret",
  });

  const result = await submitAuthorizationReview({
    authFetch,
    caseId: CASE_ID,
    candidate,
    decision: "approve",
    checks: COMPLETE_CHECKS,
  });
  assert.equal(result.signedAuthorityVerified, true);
  assert.equal(
    calls[1].url,
    `/api/ops/cases/${CASE_ID}/authorization-signature-review`
  );
  assert.deepEqual(JSON.parse(calls[1].options.body),
    buildAuthorizationReviewBody({
      decision: "approve",
      candidate,
      checks: COMPLETE_CHECKS,
    })
  );
});

test("rejects a reauthentication for another session and an ambiguous review response", async () => {
  await assert.rejects(
    reauthenticateAuthorizationReviewer({
      authFetch: async () =>
        jsonResponse({
          ok: true,
          status: "reauthenticated",
          session_id: "77777777-7777-4777-8777-777777777777",
          reauthenticated_at: "2026-09-03T12:03:00+00:00",
          request_id: "review-request-2",
        }),
      password: "supervisor-secret",
      expectedSessionId: SESSION_ID,
    }),
    /misma sesión/i
  );

  const candidate = exactCandidate();
  await assert.rejects(
    submitAuthorizationReview({
      authFetch: async () =>
        jsonResponse({
          ok: true,
          case_id: CASE_ID,
          candidate_document_id: CANDIDATE_ID,
          authorization_evidence_status: "verified",
          signed_authority_verified: true,
          extra: "ambiguous",
        }),
      caseId: CASE_ID,
      candidate,
      decision: "approve",
      checks: COMPLETE_CHECKS,
    }),
    /exactamente la decisión/i
  );
});
