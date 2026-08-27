import assert from "node:assert/strict";
import test from "node:test";

import {
  OPS_PUBLIC_FAMILIES,
  publicFamilyLabel,
  publicFamilyOf,
} from "../src/lib/opsFamilies.js";


test("OPS exposes the nine public families plus Other", () => {
  assert.deepEqual(
    OPS_PUBLIC_FAMILIES.map((family) => family.key),
    [
      "trafico",
      "viajes",
      "morosidad",
      "administracion",
      "bancos",
      "energia",
      "telecomunicaciones",
      "seguros",
      "vivienda",
      "other",
    ],
  );
});

test("a structured public family wins over technical department", () => {
  const item = {
    department: "claims",
    case_type: "consumer",
    public_service_family: "energia",
  };
  assert.equal(publicFamilyOf(item), "energia");
  assert.equal(publicFamilyLabel(item), "Energía");
});

test("legacy intake comments recover the original public family", () => {
  assert.equal(
    publicFamilyOf({
      department: "claims",
      case_type: "consumer",
      customer_comment: "Área pública seleccionada: Telecomunicaciones\n\nCaso sintético.",
    }),
    "telecomunicaciones",
  );
});

test("safe fallbacks classify known departments without inventing a consumer family", () => {
  assert.equal(publicFamilyOf({ department: "traffic", case_type: "fine" }), "trafico");
  assert.equal(publicFamilyOf({ department: "debt", case_type: "other" }), "morosidad");
  assert.equal(publicFamilyOf({ department: "administration", case_type: "aeat" }), "administracion");
  assert.equal(publicFamilyOf({ department: "claims", case_type: "airline" }), "viajes");
  assert.equal(publicFamilyOf({ department: "claims", case_type: "consumer" }), "other");
});
