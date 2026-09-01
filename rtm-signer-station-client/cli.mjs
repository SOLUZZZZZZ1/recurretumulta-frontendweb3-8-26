#!/usr/bin/env node

import {
  defaultDescriptorPath,
  initializeStationDescriptor,
  loadStationDescriptor,
} from "./lib/station-identity.mjs";


function argument(name, fallback = "") {
  const position = process.argv.indexOf(name);
  return position >= 0 ? String(process.argv[position + 1] || "") : fallback;
}

function print(value) {
  process.stdout.write(`${JSON.stringify(value, null, 2)}\n`);
}

function main() {
  const command = String(process.argv[2] || "show").toLowerCase();
  const requestedPath = argument("--path");
  const path = requestedPath || defaultDescriptorPath();
  if (command === "init") {
    const result = initializeStationDescriptor(path, {
      stationLabel: argument("--label", "PC firma RTM"),
      clientVersion: argument("--version", "1.0.0"),
    });
    print({
      ok: true,
      created: result.created,
      path: result.path,
      descriptor: result.descriptor,
      managed_attestation_verified: false,
      local_activation_available: false,
      document_bytes_available: false,
      certificate_access_available: false,
      external_effects_executed: false,
    });
    return;
  }
  if (command === "show") {
    print({
      ok: true,
      path,
      descriptor: loadStationDescriptor(path),
      managed_attestation_verified: false,
      local_activation_available: false,
      document_bytes_available: false,
      certificate_access_available: false,
      external_effects_executed: false,
    });
    return;
  }
  throw new Error("command_not_supported");
}

try {
  main();
} catch (error) {
  print({ ok: false, error: String(error?.message || "local_station_failed") });
  process.exitCode = 1;
}
