import assert from "node:assert/strict";
import test from "node:test";

import { isCurrentOpsCaseRequest } from "../src/lib/opsCaseRequestGuard.js";

function requestState(overrides = {}) {
  const controller = new AbortController();
  return {
    controller,
    value: {
      requestedCaseId: "case-a",
      activeCaseId: "case-a",
      requestGeneration: 7,
      activeGeneration: 7,
      signal: controller.signal,
      ...overrides,
    },
  };
}

test("accepts only the live generation for the active case", () => {
  const { value } = requestState();
  assert.equal(isCurrentOpsCaseRequest(value), true);
});

test("rejects a late case A response after navigation to case B", () => {
  const { value } = requestState({ activeCaseId: "case-b" });
  assert.equal(isCurrentOpsCaseRequest(value), false);
});

test("rejects an older reload generation for the same case", () => {
  const { value } = requestState({ activeGeneration: 8 });
  assert.equal(isCurrentOpsCaseRequest(value), false);
});

test("rejects an aborted request even if case and generation still match", () => {
  const { controller, value } = requestState();
  controller.abort();
  assert.equal(isCurrentOpsCaseRequest(value), false);
});

test("fails closed for incomplete request identity", () => {
  assert.equal(isCurrentOpsCaseRequest(), false);
  assert.equal(
    isCurrentOpsCaseRequest({
      requestedCaseId: "case-a",
      activeCaseId: "case-a",
      requestGeneration: Number.NaN,
      activeGeneration: Number.NaN,
    }),
    false
  );
});
