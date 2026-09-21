import assert from "node:assert/strict";
import test from "node:test";
import { readOpsAuthStatus, validateOpsAuthStatus } from "../src/ops-auth/opsAuthApi.js";
import { localOpsDevelopmentEnabled } from "../src/ops-auth/opsLocalDevelopment.js";

const LOCAL_STATUS = Object.freeze({
  ok: true,
  individual_login_enabled: true,
  configuration_valid: true,
  auth_environment: "development",
  auth_profile: "local_development",
  local_only: true,
  staging_only: false,
  shared_ops_login_accepted: false,
});
const LOCAL_RUNTIME = Object.freeze({
  development: true,
  enabled: "1",
  origin: "http://127.0.0.1:5173",
});
const localOptions = Object.freeze({ allowLocalDevelopment: true, localRuntimeEnabled: true });
const rejected = (error) => error.code === "ops_auth.status_contract_invalid";

test("local runtime requires a development build, explicit opt-in and exact origin", () => {
  assert.equal(localOpsDevelopmentEnabled(LOCAL_RUNTIME), true);
  for (const changed of [
    { development: false }, { development: "true" }, { development: undefined },
    { enabled: undefined }, { enabled: "0" }, { enabled: true }, { enabled: " 1" },
    { origin: undefined }, { origin: "http://localhost:5173" },
    { origin: "https://127.0.0.1:5173" }, { origin: "http://127.0.0.1:5174" },
    { origin: "http://127.0.0.1:5173.attacker.test" },
    { origin: "http://127.0.0.1:5173/" },
    { origin: "https://recurretumulta.eu" },
  ]) assert.equal(localOpsDevelopmentEnabled({ ...LOCAL_RUNTIME, ...changed }), false, JSON.stringify(changed));
});

test("local status is accepted only for the complete explicit local contract", () => {
  assert.deepEqual(validateOpsAuthStatus(LOCAL_STATUS, localOptions), {
    individualLoginEnabled: true,
    configurationValid: true,
    sharedOpsLoginAccepted: false,
    authEnvironment: "development",
    authProfile: "local_development",
    localOnly: true,
  });
  for (const changed of [
    { ok: false }, { configuration_valid: false }, { individual_login_enabled: "true" },
    { auth_environment: "staging" }, { auth_environment: "production" },
    { auth_profile: "staging" }, { local_only: false }, { local_only: "true" },
    { staging_only: true }, { staging_only: "false" }, { shared_ops_login_accepted: true },
  ]) assert.throws(() => validateOpsAuthStatus({ ...LOCAL_STATUS, ...changed }, localOptions), rejected, JSON.stringify(changed));
  for (const field of Object.keys(LOCAL_STATUS)) {
    const incomplete = { ...LOCAL_STATUS };
    delete incomplete[field];
    assert.throws(() => validateOpsAuthStatus(incomplete, localOptions), rejected, field);
  }
});

test("local status cannot use missing caller opt-in or an unavailable local runtime", () => {
  for (const options of [undefined, {},
    { allowLocalDevelopment: false, localRuntimeEnabled: true },
    { allowLocalDevelopment: true, localRuntimeEnabled: false },
    { allowLocalDevelopment: "true", localRuntimeEnabled: true },
    { allowLocalDevelopment: true, localRuntimeEnabled: "true" },
  ]) assert.throws(() => validateOpsAuthStatus(LOCAL_STATUS, options), rejected);
});

test("the transport cannot enable local status using caller opt-in alone", async () => {
  for (const allowLocalDevelopment of [false, true]) {
    await assert.rejects(readOpsAuthStatus({
      allowLocalDevelopment,
      fetchImpl: async () => ({ ok: true, status: 200, text: async () => JSON.stringify(LOCAL_STATUS) }),
    }), rejected);
  }
});

test("local opt-in does not weaken staging or permit contradictory profile markers", () => {
  const staging = {
    ok: true, individual_login_enabled: true, configuration_valid: true,
    staging_only: true, shared_ops_login_accepted: false,
  };
  assert.deepEqual(validateOpsAuthStatus(staging, localOptions), {
    individualLoginEnabled: true, configurationValid: true, sharedOpsLoginAccepted: false,
  });
  for (const changed of [
    { shared_ops_login_accepted: true }, { configuration_valid: false },
    { local_only: true }, { auth_profile: "local_development" },
    { auth_environment: "development" },
  ]) assert.throws(() => validateOpsAuthStatus({ ...staging, ...changed }, localOptions), rejected);
});
