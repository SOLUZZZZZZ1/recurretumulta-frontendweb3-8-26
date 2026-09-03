import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the PRO case page exposes the exact review only to individual supervisors", async () => {
  const page = await read("src/pages/OpsCaseDetailPro.jsx");
  assert.match(page, /const \{ authFetch, canSupervise, session \} = useOpsAuth\(\)/);
  assert.match(page, /events\?limit=1000/);
  assert.match(page, /canManageLegacy \? \(/);
  assert.match(page, /<OpsAuthorizationReview/);
  assert.match(page, /sessionId=\{session\?\.sessionId \|\| ""\}/);
});

test("the protected viewer never embeds the PDF and disposes every local capability", async () => {
  const component = await read("src/components/OpsAuthorizationReview.jsx");
  assert.match(component, /window\.open\("about:blank", "_blank", "popup"\)/);
  assert.match(component, /viewer\.opener = null/);
  assert.match(component, /URL\.revokeObjectURL\(blobUrlRef\.current\)/);
  assert.match(component, /window\.addEventListener\("pagehide", closeSensitiveViewer\)/);
  assert.match(component, /window\.addEventListener\("pageshow", restoreSensitiveViewer\)/);
  assert.match(component, /decisionAbortRef\.current\?\.abort\(\)/);
  assert.match(component, /setPassword\(""\)/);
  assert.match(component, /setViewReceipt\(null\)/);
  assert.match(component, /setChecks\(emptyChecks\(\)\)/);
  assert.match(component, /setReasonCode\(""\)/);
  assert.match(component, /submittedPassword = ""/);
  assert.doesNotMatch(component, /<(?:iframe|embed|object)\b/i);
  assert.doesNotMatch(component, /localStorage|sessionStorage/);
});

test("the decision is ordered as view, password step-up and exact review", async () => {
  const component = await read("src/components/OpsAuthorizationReview.jsx");
  const decision = component.slice(component.indexOf("async function decide"));
  const freshIndex = decision.indexOf("isAuthorizationViewFresh");
  const reauthIndex = decision.indexOf("reauthenticateAuthorizationReviewer");
  const reviewIndex = decision.indexOf("submitAuthorizationReview");
  assert.ok(freshIndex >= 0);
  assert.ok(reauthIndex > freshIndex);
  assert.ok(reviewIndex > reauthIndex);
  assert.match(decision, /buildAuthorizationReviewBody\(/);
});
