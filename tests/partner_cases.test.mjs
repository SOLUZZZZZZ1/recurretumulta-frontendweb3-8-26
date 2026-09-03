import assert from "node:assert/strict";
import test from "node:test";

import {
  normalizePartnerSearch,
  parsePartnerCasesEnvelope,
  PARTNER_CASE_PAGE_LIMIT,
} from "../src/lib/partnerCases.js";

const CASE_ID = "11111111-1111-4111-8111-111111111111";
const item = {
  case_id: CASE_ID,
  client_name: "Cliente",
  client_email: "cliente@example.com",
  status: "uploaded",
  payment_status: "monthly",
  updated_at: "2026-09-03T12:00:00Z",
  authorization_mode: "partner_custody",
  authorization_received: true,
  authorization_document_uploaded: true,
  authorization_verified: false,
  authorization_evidence_status: "pending_review",
  docs_total: 2,
};

test("partner case pages accept only a strict bounded projection", () => {
  const parsed = parsePartnerCasesEnvelope({
    ok: true,
    partner_name: "Asesoría",
    items: [item],
    next_cursor: null,
  });
  assert.equal(parsed.items[0].case_id, CASE_ID);
  assert.equal(parsed.partnerName, "Asesoría");
  assert.equal(parsed.items[0].authorization_verified, false);

  for (const payload of [
    { ok: true, partner_name: "Asesoría", items: [], next_cursor: null, token: "x" },
    { ok: true, partner_name: "Asesoría", items: Array(PARTNER_CASE_PAGE_LIMIT + 1).fill(item), next_cursor: null },
    { ok: true, partner_name: "Asesoría", items: [{ ...item, case_id: "wrong" }], next_cursor: null },
    { ok: true, partner_name: "Asesoría", items: [{ ...item, authorization_verified: true }], next_cursor: null },
    { ok: true, partner_name: "Asesoría", items: [{ ...item, authorization_evidence_status: "uploaded" }], next_cursor: null },
    { ok: true, partner_name: "Asesoría", items: [item], next_cursor: "raw database id" },
  ]) {
    assert.throws(() => parsePartnerCasesEnvelope(payload));
  }
});

test("partner search is bounded and strips controls fail closed", () => {
  assert.equal(normalizePartnerSearch("  cliente  "), "cliente");
  assert.equal(normalizePartnerSearch("x".repeat(161)), "");
  assert.equal(normalizePartnerSearch("cliente\u0000"), "");
});
