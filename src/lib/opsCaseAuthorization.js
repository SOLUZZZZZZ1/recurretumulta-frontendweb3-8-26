import { normalizeCaseId } from "./caseAccess.js";

/** The workspace's legacy `authorized` flag does not describe the evidence review.
 * Join only the explicit review projection from GET /ops/cases/{id}, for this case.
 */
export function withOpsAuthorizationStatus(workspaceCase = {}, record, expectedCaseId) {
  const result = {
    ...workspaceCase,
    authorization_evidence_status: null,
    signed_authority_verified: null,
  };
  const caseId = normalizeCaseId(expectedCaseId);
  if (!caseId || normalizeCaseId(record?.id) !== caseId) return result;
  if (workspaceCase.case_type && record.case_type !== workspaceCase.case_type) return result;
  const status = record.authorization_evidence_status;
  const verified = record.signed_authority_verified;
  if (typeof status !== "string" || !status || typeof verified !== "boolean") return result;
  if ((status === "verified") !== verified) return result;
  return {
    ...result,
    authorization_evidence_status: status,
    signed_authority_verified: verified,
  };
}
