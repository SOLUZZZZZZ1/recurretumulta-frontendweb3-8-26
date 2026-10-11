import assert from "node:assert/strict";
import test from "node:test";
import { savedCaseData, savedPublicFamilyLabel, validateOpsWorkspace, SAVED_CASE_DATA_VERSION } from "../src/lib/opsSavedCaseData.js";
import { PUBLIC_SERVICE_FAMILIES } from "../src/data/publicServices.js";

const A = "22222222-2222-4222-8222-222222222222";
const B = "33333333-3333-4333-8333-333333333333";
function fixture() {
  return { ok: true, case_id: A, case: { saved_data_version: SAVED_CASE_DATA_VERSION, authorized: false,
    identity: { full_name: "Ángela Peña FICTICIA", dni_nie: "00000123X", address: "Calle Ñandú 007",
      address_parts: { street: "Calle Ñandú", street_number: "007", floor: "0", door: "02", postal_code: "00123", city: "Ávila", province: "Ávila", internal: "hidden" } },
    contact: { name: "Óscar Contacto FICTICIO", email: "contacto@example.com", phone: "000000000", preferred_contact: "whatsapp", internal: "hidden" },
    customer_comment: "Relato guardado: 30 €.\nSegunda línea.", public_service_family: "bancos", interested_data: { secret: "hidden" } } };
}

test("server fields preserve accents, strings with zeros, address parts and distinct contact", () => {
  const result = savedCaseData(fixture(), A);
  assert.equal(result.interested.full_name, "Ángela Peña FICTICIA");
  assert.equal(result.contact.name, "Óscar Contacto FICTICIO");
  assert.equal(result.interested.dni_nie, "00000123X");
  assert.equal(result.interested.address_parts.postal_code, "00123");
  assert.equal(result.interested.address_parts.street_number, "007");
  assert.equal(result.interested.address_parts.floor, "0");
  assert.equal(result.interested.address_parts.door, "02");
  assert.equal(result.contact.phone, "000000000");
  assert.equal(result.customer_comment, "Relato guardado: 30 €.\nSegunda línea.");
  assert.ok(!JSON.stringify(result).includes("hidden"));
});

test("a successful response for another case or a failed envelope never supplies saved data", () => {
  for (const data of [fixture(), null, { ok: false, case_id: B, case: {} }, { ok: true, case_id: B, case: [] }]) {
    assert.equal(savedCaseData(data, B), null);
    assert.throws(() => validateOpsWorkspace(data, B));
  }
});

const addressKeys = ["street", "street_number", "floor", "door", "postal_code", "city", "province"];
const nullablePaths = [
  ...["full_name", "dni_nie", "address"].map(key => ["case", "identity", key]),
  ...addressKeys.map(key => ["case", "identity", "address_parts", key]),
  ...["name", "email", "phone", "preferred_contact"].map(key => ["case", "contact", key]),
  ["case", "customer_comment"], ["case", "public_service_family"],
];
const containerPaths = [["case"], ["case", "identity"], ["case", "identity", "address_parts"], ["case", "contact"]];
function parentAt(source, path) { return path.slice(0, -1).reduce((value, key) => value[key], source); }
function setAt(source, path, value) { parentAt(source, path)[path.at(-1)] = value; }
function nullIdentity() {
  return { full_name: null, dni_nie: null, address: null,
    address_parts: Object.fromEntries(addressKeys.map(key => [key, null])) };
}

test("explicit null identity stays absent; contact and legacy/browser data are not identity fallbacks", () => {
  const source = fixture(); source.case.identity = nullIdentity();
  source.case.department = "traffic"; source.case.public_service_family = null;
  const value = savedCaseData(source, A);
  assert.deepEqual(value.interested, nullIdentity());
  assert.equal(value.public_service_family, null);
  assert.equal(savedPublicFamilyLabel(value.public_service_family), "No consta");
  assert.equal(value.contact.email, "contacto@example.com");
});

test("a complete projection accepts null for every visible field without requiring customer data", () => {
  const source = fixture();
  for (const path of nullablePaths) setAt(source, path, null);
  assert.deepEqual(savedCaseData(source, A), {
    interested: nullIdentity(),
    contact: { name: null, email: null, phone: null, preferred_contact: null },
    customer_comment: null, public_service_family: null,
  });
});

test("each expected text key must be present as an own property, including nested keys", () => {
  for (const path of nullablePaths) {
    const source = fixture();
    delete parentAt(source, path)[path.at(-1)];
    assert.equal(savedCaseData(source, A), null, "omitted " + path.join("."));
    const inherited = fixture(), parent = parentAt(inherited, path), key = path.at(-1);
    const value = parent[key]; delete parent[key]; Object.setPrototypeOf(parent, { [key]: value });
    assert.equal(savedCaseData(inherited, A), null, "inherited " + path.join("."));
  }
});

test("every text field rejects numbers, booleans, arrays, objects and undefined instead of coercing to null", () => {
  for (const path of nullablePaths) {
    for (const value of [0, 123, false, true, [], ["text"], {}, { value: "text" }, undefined]) {
      const source = fixture(); setAt(source, path, value);
      assert.equal(savedCaseData(source, A), null, "invalid " + path.join(".") + ": " + JSON.stringify(value));
    }
  }
});

test("containers must be own object properties, never null, arrays or scalars", () => {
  for (const path of containerPaths) {
    for (const value of [null, undefined, 42, false, "text", [], ["text"]]) {
      const source = fixture(); setAt(source, path, value);
      assert.equal(savedCaseData(source, A), null, "container " + path.join(".") + ": " + JSON.stringify(value));
    }
    const source = fixture(); delete parentAt(source, path)[path.at(-1)];
    assert.equal(savedCaseData(source, A), null, "omitted container " + path.join("."));
    const inherited = fixture(), parent = parentAt(inherited, path), key = path.at(-1);
    const value = parent[key]; delete parent[key]; Object.setPrototypeOf(parent, { [key]: value });
    assert.equal(savedCaseData(inherited, A), null, "inherited container " + path.join("."));
  }
});

test("version, success and case binding remain mandatory and cannot be inherited", () => {
  for (const path of [["ok"], ["case_id"], ["case", "saved_data_version"]]) {
    const missing = fixture(); delete parentAt(missing, path)[path.at(-1)];
    assert.equal(savedCaseData(missing, A), null);
    const inherited = fixture(), parent = parentAt(inherited, path), key = path.at(-1);
    const value = parent[key]; delete parent[key]; Object.setPrototypeOf(parent, { [key]: value });
    assert.equal(savedCaseData(inherited, A), null);
  }
  for (const version of [null, 1, false, [], {}, "rtm_ops_saved_case_data_v2"]) {
    const source = fixture(); source.case.saved_data_version = version;
    assert.equal(savedCaseData(source, A), null);
  }
  assert.equal(savedCaseData(fixture(), ""), null);
});

test("an invalid saved-data projection does not reject independent workspace readings", () => {
  const source = fixture(); delete source.case.contact.email;
  source.documents = [{ id: "synthetic-document" }];
  assert.equal(validateOpsWorkspace(source, A), source);
  assert.equal(savedCaseData(source, A), null);
  assert.deepEqual(source.documents, [{ id: "synthetic-document" }]);
});

test("text values including empty strings are preserved and additional fields remain filtered", () => {
  const source = fixture();
  source.case.contact.email = "";
  source.case.identity.address_parts.door = "  ";
  assert.equal(savedCaseData(source, A).contact.email, "");
  assert.equal(savedCaseData(source, A).interested.address_parts.door, "  ");
  assert.ok(!JSON.stringify(savedCaseData(source, A)).includes("hidden"));
});

test("all eight common families retain their literal public label and housing stays consultation", () => {
  const common = PUBLIC_SERVICE_FAMILIES.filter(family => family.intake);
  assert.equal(common.length, 8);
  for (const family of common) assert.equal(savedPublicFamilyLabel(family.id), family.title);
  const housing = PUBLIC_SERVICE_FAMILIES.find(family => family.id === "vivienda");
  assert.equal(housing.intake, undefined);
  assert.equal(housing.entryMode, "consultation");
  assert.match(savedPublicFamilyLabel("vivienda"), /consulta previa/);
  assert.equal(savedPublicFamilyLabel("unknown"), "Área guardada no reconocida: unknown");
});
