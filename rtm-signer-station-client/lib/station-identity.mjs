import { createHash, randomBytes, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";


export const RTM_LOCAL_STATION_DESCRIPTOR_VERSION =
  "rtm.local.signer.station.descriptor.v1";

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const VERSION_PATTERN =
  /^[0-9]+[.][0-9]+[.][0-9]+(?:[-+][A-Za-z0-9.-]+)?$/;

function cleanLabel(value) {
  const label = String(value || "").trim().replace(/\s+/g, " ");
  if (label.length < 3 || label.length > 80 || /[\u0000-\u001f]/.test(label)) {
    throw new Error("station_label_invalid");
  }
  return label;
}

export function validateStationDescriptor(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("station_descriptor_invalid");
  }
  const descriptor = {
    descriptor_version: String(value.descriptor_version || ""),
    client_instance_id: String(value.client_instance_id || "").toLowerCase(),
    client_binding_sha256: String(value.client_binding_sha256 || "").toLowerCase(),
    station_label: cleanLabel(value.station_label),
    platform: String(value.platform || "").toLowerCase(),
    client_version: String(value.client_version || ""),
    synthetic_only: value.synthetic_only,
    managed_attestation_verified: value.managed_attestation_verified,
    certificate_material_present: value.certificate_material_present,
    customer_data_present: value.customer_data_present,
  };
  if (
    descriptor.descriptor_version !== RTM_LOCAL_STATION_DESCRIPTOR_VERSION ||
    !UUID_PATTERN.test(descriptor.client_instance_id) ||
    !SHA256_PATTERN.test(descriptor.client_binding_sha256) ||
    descriptor.platform !== "windows" ||
    !VERSION_PATTERN.test(descriptor.client_version) ||
    descriptor.client_version.length > 48 ||
    descriptor.synthetic_only !== true ||
    descriptor.managed_attestation_verified !== false ||
    descriptor.certificate_material_present !== false ||
    descriptor.customer_data_present !== false
  ) {
    throw new Error("station_descriptor_invalid");
  }
  const allowed = new Set(Object.keys(descriptor));
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw new Error("station_descriptor_extra_field");
  }
  return Object.freeze(descriptor);
}

export function createStationDescriptor({
  stationLabel = "PC firma RTM",
  clientVersion = "1.0.0",
  randomUuid = randomUUID,
  entropy = randomBytes,
} = {}) {
  const clientInstanceId = String(randomUuid()).toLowerCase();
  const seed = entropy(32);
  if (!UUID_PATTERN.test(clientInstanceId) || !Buffer.isBuffer(seed) || seed.length !== 32) {
    throw new Error("station_secure_random_unavailable");
  }
  const binding = createHash("sha256")
    .update("RTM_LOCAL_SIGNER_CANDIDATE_V1\0", "utf8")
    .update(clientInstanceId, "utf8")
    .update(seed)
    .digest("hex");
  seed.fill(0);
  return validateStationDescriptor({
    descriptor_version: RTM_LOCAL_STATION_DESCRIPTOR_VERSION,
    client_instance_id: clientInstanceId,
    client_binding_sha256: binding,
    station_label: stationLabel,
    platform: "windows",
    client_version: clientVersion,
    synthetic_only: true,
    managed_attestation_verified: false,
    certificate_material_present: false,
    customer_data_present: false,
  });
}

export function defaultDescriptorPath(environment = process.env) {
  const base = String(environment.LOCALAPPDATA || "").trim();
  if (!base) throw new Error("localappdata_required");
  return join(base, "RTM", "SignerStation", "station-candidate.json");
}

export function loadStationDescriptor(path) {
  const raw = readFileSync(path, { encoding: "utf8" });
  if (raw.length > 16_384) throw new Error("station_descriptor_too_large");
  return validateStationDescriptor(JSON.parse(raw));
}

export function initializeStationDescriptor(path, options = {}) {
  if (existsSync(path)) {
    return { descriptor: loadStationDescriptor(path), created: false, path };
  }
  const descriptor = createStationDescriptor(options);
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
  writeFileSync(path, `${JSON.stringify(descriptor, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
    mode: 0o600,
  });
  return { descriptor, created: true, path };
}
