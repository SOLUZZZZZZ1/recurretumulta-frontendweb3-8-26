import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  RTM_LOCAL_STATION_DESCRIPTOR_VERSION,
  createStationDescriptor,
  initializeStationDescriptor,
  loadStationDescriptor,
  validateStationDescriptor,
} from "../lib/station-identity.mjs";


const INSTANCE_ID = "44444444-4444-4444-8444-444444444444";

test("descriptor contains only public synthetic candidate metadata", () => {
  const entropy = Buffer.alloc(32, 7);
  const descriptor = createStationDescriptor({
    randomUuid: () => INSTANCE_ID,
    entropy: () => entropy,
  });

  assert.equal(descriptor.descriptor_version, RTM_LOCAL_STATION_DESCRIPTOR_VERSION);
  assert.equal(descriptor.client_instance_id, INSTANCE_ID);
  assert.match(descriptor.client_binding_sha256, /^[0-9a-f]{64}$/);
  assert.equal(descriptor.managed_attestation_verified, false);
  assert.equal(descriptor.certificate_material_present, false);
  assert.equal(descriptor.customer_data_present, false);
  assert.equal(entropy.every((value) => value === 0), true);
  for (const forbidden of ["secret", "token", "certificate", "private_key", "cookie"])
    assert.equal(Object.hasOwn(descriptor, forbidden), false);
});

test("descriptor validation rejects extra or optimistic fields", () => {
  const descriptor = createStationDescriptor({ randomUuid: () => INSTANCE_ID });
  assert.throws(
    () => validateStationDescriptor({ ...descriptor, certificate: "forbidden" }),
    /extra_field/
  );
  assert.throws(
    () => validateStationDescriptor({ ...descriptor, managed_attestation_verified: true }),
    /descriptor_invalid/
  );
});

test("initialization is create-once and reuses the same public descriptor", () => {
  const directory = mkdtempSync(join(tmpdir(), "rtm-station-"));
  const path = join(directory, "station-candidate.json");
  try {
    const first = initializeStationDescriptor(path, { randomUuid: () => INSTANCE_ID });
    const second = initializeStationDescriptor(path, { randomUuid: () => { throw new Error("must-not-run"); } });
    assert.equal(first.created, true);
    assert.equal(second.created, false);
    assert.deepEqual(second.descriptor, first.descriptor);
    assert.deepEqual(loadStationDescriptor(path), first.descriptor);
    assert.equal(readFileSync(path, "utf8").includes("private_key"), false);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
