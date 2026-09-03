import test from "node:test";
import assert from "node:assert/strict";

import {
  canAccessOpsWorkspace,
  canSuperviseOpsWorkspace,
} from "../src/ops-auth/opsAuthorization.js";

const operator = (roleCode, permissions) => ({ roleCode, permissions });

test("general OPS accepts only operational roles with ops.view", () => {
  assert.equal(canAccessOpsWorkspace(operator("rtm.operator", ["ops.view"])), true);
  assert.equal(canAccessOpsWorkspace(operator("rtm.supervisor", ["ops.view"])), true);
  assert.equal(canAccessOpsWorkspace(operator("rtm.signer", ["ops.view"])), false);
  assert.equal(canAccessOpsWorkspace(operator("rtm.operator", [])), false);
  assert.equal(canAccessOpsWorkspace(operator("rtm.supervisor", ["ops.supervise"])), false);
});

test("legacy mutations require the supervisor role and both permissions", () => {
  assert.equal(
    canSuperviseOpsWorkspace(
      operator("rtm.supervisor", ["ops.view", "ops.supervise"])
    ),
    true
  );
  assert.equal(
    canSuperviseOpsWorkspace(
      operator("rtm.operator", ["ops.view", "ops.supervise"])
    ),
    false
  );
  assert.equal(
    canSuperviseOpsWorkspace(operator("rtm.supervisor", ["ops.view"])),
    false
  );
  assert.equal(
    canSuperviseOpsWorkspace(operator("rtm.signer", ["ops.view", "ops.supervise"])),
    false
  );
});
