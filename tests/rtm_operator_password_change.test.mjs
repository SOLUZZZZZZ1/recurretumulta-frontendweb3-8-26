import assert from "node:assert/strict";
import test from "node:test";

import {
  RTM_OPERATOR_PASSWORD_CHANGE_ROUTE,
  RtmOperatorOnboardingError,
  changeTemporaryOperatorPassword,
} from "../src/rtm-presenter/rtmOperatorOnboardingApi.js";

const TOKEN = "t".repeat(64);
const CURRENT_PASSWORD = "temporary-pass-2026";
const NEW_PASSWORD = "private-pass-2026";

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  };
}

function safePasswordChangeResponse() {
  return {
    ok: true,
    operator: {
      operator_id: "11111111-1111-4111-8111-111111111111",
      email: "rtm-staging-operador-02@example.com",
      status: "active",
      role_code: "rtm.operator",
      must_change_password: false,
      password_version: 2,
      auth_epoch: 2,
      sessions_revoked: 1,
      changed: true,
    },
    audit_event_id: "22222222-2222-4222-8222-222222222222",
    password_returned: false,
    reauthentication_required: true,
    legacy_login_unchanged: true,
  };
}

test("changes a temporary password through the exact protected route", async () => {
  const calls = [];
  const result = await changeTemporaryOperatorPassword({
    bearerToken: TOKEN,
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse(safePasswordChangeResponse());
    },
  });

  assert.deepEqual(result, { reauthenticationRequired: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, RTM_OPERATOR_PASSWORD_CHANGE_ROUTE);
  assert.equal(calls[0].url, "/api/ops/auth/password/change");
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(calls[0].options.headers["Content-Type"], "application/json");
  assert.equal(calls[0].options.cache, "no-store");
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.equal(calls[0].options.redirect, "error");
  assert.equal(calls[0].options.referrerPolicy, "same-origin");
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    current_password: CURRENT_PASSWORD,
    new_password: NEW_PASSWORD,
    reason: "Cambio inicial de contraseña temporal",
  });
  assert.equal(JSON.stringify(result).includes(CURRENT_PASSWORD), false);
  assert.equal(JSON.stringify(result).includes(NEW_PASSWORD), false);
});

test("rejects invalid secrets before making a request", async () => {
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    return jsonResponse(safePasswordChangeResponse());
  };

  await assert.rejects(
    changeTemporaryOperatorPassword({
      bearerToken: "short",
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
      fetchImpl,
    }),
    (error) =>
      error instanceof RtmOperatorOnboardingError &&
      error.code === "operator_onboarding.session_required"
  );
  await assert.rejects(
    changeTemporaryOperatorPassword({
      bearerToken: TOKEN,
      currentPassword: CURRENT_PASSWORD,
      newPassword: "too-short",
      fetchImpl,
    }),
    (error) => error.code === "operator_onboarding.new_password_invalid"
  );
  await assert.rejects(
    changeTemporaryOperatorPassword({
      bearerToken: TOKEN,
      currentPassword: CURRENT_PASSWORD,
      newPassword: CURRENT_PASSWORD,
      fetchImpl,
    }),
    (error) => error.code === "operator_onboarding.password_reuse"
  );
  assert.equal(calls, 0);
});

test("does not echo backend evidence when the current password is rejected", async () => {
  const leaked = "SECRET_BACKEND_EVIDENCE";
  await assert.rejects(
    changeTemporaryOperatorPassword({
      bearerToken: TOKEN,
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
      fetchImpl: async () => jsonResponse({ detail: leaked }, 401),
    }),
    (error) => {
      assert.equal(error.status, 401);
      assert.equal(error.message.includes(leaked), false);
      assert.equal(
        error.message,
        "La contraseña temporal no es correcta o la sesión ha caducado."
      );
      return true;
    }
  );
});

test("fails closed when the server does not require a fresh login", async () => {
  const malformed = {
    ...safePasswordChangeResponse(),
    reauthentication_required: false,
  };
  await assert.rejects(
    changeTemporaryOperatorPassword({
      bearerToken: TOKEN,
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
      fetchImpl: async () => jsonResponse(malformed),
    }),
    (error) =>
      error.code === "operator_onboarding.response_contract_invalid"
  );
});

test("reports an aborted request without exposing credentials", async () => {
  const controller = new AbortController();
  controller.abort();
  await assert.rejects(
    changeTemporaryOperatorPassword({
      bearerToken: TOKEN,
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
      signal: controller.signal,
      fetchImpl: async () => {
        throw new Error(`transport ${CURRENT_PASSWORD} ${NEW_PASSWORD}`);
      },
    }),
    (error) => {
      assert.equal(error.code, "operator_onboarding.request_aborted");
      assert.equal(error.message.includes(CURRENT_PASSWORD), false);
      assert.equal(error.message.includes(NEW_PASSWORD), false);
      return true;
    }
  );
});
