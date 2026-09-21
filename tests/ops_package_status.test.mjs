import assert from "node:assert/strict";
import test from "node:test";
import { buildPackageStatus } from "../src/lib/opsPackageStatus.js";

const verified = { case_type: "fine", authorized: true, signed_authority_verified: true, authorization_evidence_status: "verified" };
const document = kind => ({ kind, mime: "application/pdf" });
const fixtureDocuments = ["original", "identity_front", "identity_back", "authorization_pdf", "authorization_signed_candidate"].map(document);

test("the five fixture documents do not contain a generated resource", () => {
  const result = buildPackageStatus(fixtureDocuments, { authorized: true, signed_authority_verified: false, authorization_evidence_status: "pending_review" });
  assert.equal(result.hasRecurso, false);
  assert.equal(result.recursoDoc, null);
  assert.equal(result.hasAutorizacion, false);
  assert.equal(result.hasOriginal, true);
  assert.equal(result.documentsComplete, false);
});
test("only explicit resource kinds with PDF MIME identify a resource", () => {
  for (const kind of ["authorization_pdf", "autorizacion_cliente_pdf", "identity_pdf", "receipt_pdf", "pdf", "rtm_generated_docx", "original_pdf"])
    assert.equal(buildPackageStatus([document(kind)], verified).hasRecurso, false, kind);
  for (const kind of ["recurso_pdf", "rtm_generated_pdf", "final_resource_pdf"]) {
    const resource = document(kind);
    const result = buildPackageStatus([...fixtureDocuments, resource], verified);
    assert.equal(result.recursoDoc, resource);
    assert.equal(result.hasRecurso, true);
    assert.equal(result.documentsComplete, true);
    assert.equal(buildPackageStatus([{ ...resource, mime: "text/plain" }], verified).hasRecurso, false);
  }
});
test("a signed upload or a legacy authorized flag cannot complete the package", () => {
  const docs = [...fixtureDocuments, document("rtm_generated_pdf"), document("authorization_signed_verified")];
  for (const status of [{ authorized: true }, { signed_authority_verified: true }, { authorization_evidence_status: "verified" }, { ...verified, case_type: "vehicle_removal" }])
    assert.equal(buildPackageStatus(docs, status).documentsComplete, false);
  assert.equal(buildPackageStatus(null, verified).documentsComplete, false);
});
