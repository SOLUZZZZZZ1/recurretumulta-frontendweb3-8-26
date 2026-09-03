import test from "node:test";
import assert from "node:assert/strict";

import {
  OPS_AUTH_LOGIN_ROUTE,
  OPS_AUTH_LOGOUT_ROUTE,
  OPS_AUTH_STATUS_ROUTE,
  OpsAuthError,
  buildOpsAuthenticatedRequest,
  loginOpsOperator,
  logoutOpsOperator,
  readOpsAuthStatus,
} from "../src/ops-auth/opsAuthApi.js";

const TOKEN = "T".repeat(64);
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const DEVICE_ID = "22222222-2222-4222-8222-222222222222";

function jsonResponse(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  };
}

function loginEnvelope(overrides = {}) {
  return {
    ok: true,
    token_type: "bearer",
    token: TOKEN,
    session_id: SESSION_ID,
    expires_at: "2099-09-02T19:00:00+00:00",
    absolute_expires_at: "2099-09-02T23:00:00+00:00",
    device_id: DEVICE_ID,
    operator: {
      id: "33333333-3333-4333-8333-333333333333",
      email: "operador@example.com",
      display_name: "Operador sintético",
      role_code: "rtm.operator",
      permissions: ["ops.view"],
      must_change_password: false,
      mfa_required: false,
    },
    request_id: "request-1",
    shared_ops_login_accepted: false,
    ...overrides,
  };
}

test("authenticated transport accepts only allowlisted relative OPS routes", () => {
  const request = buildOpsAuthenticatedRequest({
    url: "/api/ops/cases/123?view=a%2Fb",
    bearerToken: TOKEN,
    options: { method: "GET" },
  });
  assert.equal(request.url, "/api/ops/cases/123?view=a%2Fb");

  for (const url of [
    "https://evil.example/api/ops/cases/123",
    "//evil.example/api/ops/cases/123",
    "/api/cases/123",
    "/api/ops/../billing/status/123",
    "/api/ops/%2e%2e/billing/status/123",
    "/api/ops/cases%2f123",
    "/api/ops/cases/123#fragment",
  ]) {
    assert.throws(
      () => buildOpsAuthenticatedRequest({ url, bearerToken: TOKEN }),
      (error) =>
        error instanceof OpsAuthError &&
        ["ops_auth.api_route_required", "ops_auth.api_route_invalid"].includes(error.code),
      url
    );
  }
});

test("authenticated transport replaces reserved headers and security options", () => {
  const request = buildOpsAuthenticatedRequest({
    url: "/api/ops/queue",
    bearerToken: TOKEN,
    options: {
      headers: {
        Authorization: "Bearer attacker",
        "X-Operator-Token": "legacy",
        "X-Operator-Actor": "impersonated",
        "X-RTM-Device": "forged",
        "Content-Type": "application/json",
      },
      cache: "force-cache",
      credentials: "omit",
      mode: "no-cors",
      redirect: "follow",
      referrerPolicy: "unsafe-url",
    },
  });

  assert.equal(request.options.headers.get("Authorization"), `Bearer ${TOKEN}`);
  assert.equal(request.options.headers.has("X-Operator-Token"), false);
  assert.equal(request.options.headers.has("X-Operator-Actor"), false);
  assert.equal(request.options.headers.has("X-RTM-Device"), false);
  assert.equal(request.options.headers.get("Content-Type"), "application/json");
  assert.equal(request.options.cache, "no-store");
  assert.equal(request.options.credentials, "same-origin");
  assert.equal(request.options.mode, "same-origin");
  assert.equal(request.options.redirect, "error");
  assert.equal(request.options.referrerPolicy, "same-origin");
});

test("reads the individual staging gate without accepting shared OPS login", async () => {
  const calls = [];
  const result = await readOpsAuthStatus({
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({
        ok: true,
        individual_login_enabled: true,
        configuration_valid: true,
        staging_only: true,
        shared_ops_login_accepted: false,
        legacy_login_unchanged: true,
      });
    },
  });

  assert.deepEqual(result, {
    individualLoginEnabled: true,
    configurationValid: true,
    sharedOpsLoginAccepted: false,
  });
  assert.equal(calls[0].url, OPS_AUTH_STATUS_ROUTE);
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.equal(calls[0].options.cache, "no-store");
});

test("the deprecated legacy flag cannot override the shared-login authority", async () => {
  const status = await readOpsAuthStatus({
    fetchImpl: async () =>
      jsonResponse({
        ok: true,
        individual_login_enabled: true,
        configuration_valid: true,
        staging_only: true,
        shared_ops_login_accepted: false,
        legacy_login_unchanged: true,
        legacy_login_retired_in_staging: true,
        non_staging_legacy_login_unchanged: true,
      }),
  });
  const login = await loginOpsOperator({
    email: "operador@example.com",
    password: "temporary-password",
    fetchImpl: async () =>
      jsonResponse(
        loginEnvelope({
          legacy_login_unchanged: true,
          legacy_login_retired_in_staging: true,
          non_staging_legacy_login_unchanged: true,
        })
      ),
  });

  assert.equal(status.sharedOpsLoginAccepted, false);
  assert.equal(login.sessionId, SESSION_ID);
});

test("logs in with email and password while device possession stays in HttpOnly cookie", async () => {
  const calls = [];
  const session = await loginOpsOperator({
    email: " operador@example.com ",
    password: "temporary-password",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse(loginEnvelope());
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, OPS_AUTH_LOGIN_ROUTE);
  assert.equal(calls[0].options.method, "POST");
  assert.equal(calls[0].options.credentials, "same-origin");
  assert.equal(calls[0].options.headers.Authorization, undefined);
  assert.equal(calls[0].options.headers["X-Operator-Token"], undefined);
  assert.deepEqual(JSON.parse(calls[0].options.body), {
    email: "operador@example.com",
    password: "temporary-password",
  });
  assert.equal(session.bearerToken, TOKEN);
  assert.equal(session.sessionId, SESSION_ID);
  assert.equal(session.deviceId, DEVICE_ID);
  assert.deepEqual(session.operator.permissions, ["ops.view"]);
});

test("strict login parsing rejects malformed identity fields and closes the token candidate", async () => {
  for (const overrides of [
    {
      operator: {
        ...loginEnvelope().operator,
        permissions: ["ops.view", "ops.view"],
      },
    },
    { expires_at: "not-a-timestamp" },
    {
      expires_at: "2000-01-01T12:00:00Z",
      absolute_expires_at: "2000-01-01T13:00:00Z",
    },
    {
      expires_at: "2026-09-03T12:00:00Z",
      absolute_expires_at: "2026-09-03T11:59:59Z",
    },
  ]) {
    const calls = [];
    await assert.rejects(
      loginOpsOperator({
        email: "operador@example.com",
        password: "temporary-password",
        fetchImpl: async (url) => {
          calls.push(url);
          return jsonResponse(loginEnvelope(overrides));
        },
      }),
      (error) =>
        error instanceof OpsAuthError &&
        ["ops_auth.operator_contract_invalid", "ops_auth.login_contract_invalid"].includes(
          error.code
        )
    );
    assert.deepEqual(calls, [OPS_AUTH_LOGIN_ROUTE, OPS_AUTH_LOGOUT_ROUTE]);
  }
});

test("rejects a server that still accepts the shared OPS login", async () => {
  await assert.rejects(
    readOpsAuthStatus({
      fetchImpl: async () =>
        jsonResponse({
          ok: true,
          individual_login_enabled: true,
          configuration_valid: true,
          staging_only: true,
          shared_ops_login_accepted: true,
        }),
    }),
    (error) => error instanceof OpsAuthError && error.code === "ops_auth.status_contract_invalid"
  );

  await assert.rejects(
    loginOpsOperator({
      email: "operador@example.com",
      password: "temporary-password",
      fetchImpl: async () =>
        jsonResponse(loginEnvelope({ shared_ops_login_accepted: true })),
    }),
    (error) => error instanceof OpsAuthError && error.code === "ops_auth.login_contract_invalid"
  );
});

test("rejects status and login responses that omit the retired shared-login flag", async () => {
  await assert.rejects(
    readOpsAuthStatus({
      fetchImpl: async () =>
        jsonResponse({
          ok: true,
          individual_login_enabled: true,
          configuration_valid: true,
          staging_only: true,
        }),
    }),
    (error) => error instanceof OpsAuthError && error.code === "ops_auth.status_contract_invalid"
  );

  const loginWithoutFlag = loginEnvelope();
  delete loginWithoutFlag.shared_ops_login_accepted;
  await assert.rejects(
    loginOpsOperator({
      email: "operador@example.com",
      password: "temporary-password",
      fetchImpl: async () => jsonResponse(loginWithoutFlag),
    }),
    (error) => error instanceof OpsAuthError && error.code === "ops_auth.login_contract_invalid"
  );
});

test("rejects an invalid individual-auth configuration", async () => {
  await assert.rejects(
    readOpsAuthStatus({
      fetchImpl: async () =>
        jsonResponse({
          ok: true,
          individual_login_enabled: true,
          configuration_valid: false,
          staging_only: true,
          shared_ops_login_accepted: false,
        }),
    }),
    (error) => error instanceof OpsAuthError && error.code === "ops_auth.status_contract_invalid"
  );
});

test("closes the exact bearer session on the server", async () => {
  const calls = [];
  const result = await logoutOpsOperator({
    bearerToken: TOKEN,
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return jsonResponse({ ok: true, status: "closed", request_id: "request-2" });
    },
  });
  assert.deepEqual(result, { closed: true });
  assert.equal(calls[0].url, OPS_AUTH_LOGOUT_ROUTE);
  assert.equal(calls[0].options.headers.Authorization, `Bearer ${TOKEN}`);
  assert.equal(calls[0].options.credentials, "same-origin");
});

test("does not echo backend evidence when credentials are rejected", async () => {
  await assert.rejects(
    loginOpsOperator({
      email: "operador@example.com",
      password: "temporary-password",
      fetchImpl: async () => jsonResponse({ detail: "SECRET_EVIDENCE" }, 401),
    }),
    (error) => {
      assert.equal(error.status, 401);
      assert.equal(error.message, "El email o la contraseña no son correctos.");
      assert.equal(error.message.includes("SECRET_EVIDENCE"), false);
      return true;
    }
  );
});
