import { PUBLIC_SERVICE_FAMILIES } from "../data/publicServices.js";

const PUBLIC_FAMILY_CODES = new Set(PUBLIC_SERVICE_FAMILIES.map((family) => family.id));
const TRAVEL_CASE_TYPES = new Set([
  "airline",
  "flight_cancelled",
  "flight_delayed",
  "baggage",
  "overbooking",
  "cruise",
  "travel_agency",
]);

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

const LEGACY_MARKERS = PUBLIC_SERVICE_FAMILIES.flatMap((family) =>
  [family.title, family.menuTitle]
    .filter(Boolean)
    .map((label) => ({
      marker: `area publica seleccionada: ${normalize(label)}`,
      code: family.id,
    })),
);

export const OPS_PUBLIC_FAMILIES = [
  ...PUBLIC_SERVICE_FAMILIES.map((family) => ({
    key: family.id,
    icon: family.icon,
    label: family.menuTitle || family.title,
    entryMode: family.entryMode || "intake",
  })),
  {
    key: "other",
    icon: "📂",
    label: "Otros / por clasificar",
    entryMode: "intake",
  },
];

export function publicFamilyOf(item) {
  const explicit = normalize(item?.public_service_family);
  if (PUBLIC_FAMILY_CODES.has(explicit)) return explicit;

  const comment = normalize(item?.customer_comment);
  const legacy = LEGACY_MARKERS.find(({ marker }) => comment.includes(marker));
  if (legacy) return legacy.code;

  const department = normalize(item?.department);
  const caseType = normalize(item?.case_type);
  if (department === "traffic") return "trafico";
  if (department === "debt") return "morosidad";
  if (department === "administration") return "administracion";
  if (department === "claims" && TRAVEL_CASE_TYPES.has(caseType)) return "viajes";
  return "other";
}

export function publicFamilyLabel(item) {
  const code = publicFamilyOf(item);
  return OPS_PUBLIC_FAMILIES.find((family) => family.key === code)?.label || "Otros / por clasificar";
}
