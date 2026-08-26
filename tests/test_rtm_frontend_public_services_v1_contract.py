from __future__ import annotations

import hashlib
import json
import re
from pathlib import Path
import unittest
import xml.etree.ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
CATALOG = SRC / "data" / "publicServices.js"
APP = SRC / "App.jsx"
NAVBAR = SRC / "components" / "Navbar.jsx"
FOOTER = SRC / "components" / "Footer.jsx"
LANDING = SRC / "components" / "PublicServiceLanding.jsx"
HOME = SRC / "pages" / "InicioRTM.jsx"
INTAKE = SRC / "pages" / "IniciarExpedienteRTM.jsx"
CONTACT = SRC / "pages" / "Contacto.jsx"
MAIN = SRC / "main.jsx"
SITEMAP = ROOT / "public" / "sitemap.xml"
PREFLIGHT = ROOT / "scripts" / "rtm_frontend_public_services_v1_preflight.py"
GUIDE = ROOT / "docs" / "rtm_connect" / "RTM_FRONTEND_PUBLIC_SERVICES_V1.md"
EVIDENCE = (
    ROOT
    / "docs"
    / "rtm_connect"
    / "RTM_FRONTEND_PUBLIC_SERVICES_V1_EVIDENCE.json"
)

FAMILY_IDS = (
    "trafico",
    "viajes",
    "morosidad",
    "administracion",
    "bancos",
    "energia",
    "telecomunicaciones",
    "seguros",
    "vivienda",
)

FAMILY_PATHS = (
    "/trafico",
    "/viajes",
    "/morosidad",
    "/administracion",
    "/bancos",
    "/energia",
    "/telecomunicaciones",
    "/seguros",
    "/vivienda",
)

NEW_PAGE_FILES = (
    "BancosHome.jsx",
    "EnergiaHome.jsx",
    "TelecomunicacionesHome.jsx",
    "SegurosHome.jsx",
    "ViviendaHome.jsx",
)

IMAGE_FILES = (
    "servicios-finanzas.webp",
    "servicios-hogar-suministros.webp",
    "servicios-proteccion-conectividad.webp",
)


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def webp_dimensions(path: Path) -> tuple[int, int]:
    data = path.read_bytes()
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise AssertionError(f"{path.name} no es WebP RIFF")

    offset = 12
    while offset + 8 <= len(data):
        chunk = data[offset : offset + 4]
        size = int.from_bytes(data[offset + 4 : offset + 8], "little")
        payload = data[offset + 8 : offset + 8 + size]
        if chunk == b"VP8 " and payload[3:6] == b"\x9d\x01\x2a":
            width = int.from_bytes(payload[6:8], "little") & 0x3FFF
            height = int.from_bytes(payload[8:10], "little") & 0x3FFF
            return width, height
        if chunk == b"VP8L" and len(payload) >= 5 and payload[0] == 0x2F:
            bits = int.from_bytes(payload[1:5], "little")
            return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
        if chunk == b"VP8X" and len(payload) >= 10:
            width = int.from_bytes(payload[4:7], "little") + 1
            height = int.from_bytes(payload[7:10], "little") + 1
            return width, height
        offset += 8 + size + (size % 2)
    raise AssertionError(f"No se pudieron leer las dimensiones de {path.name}")


class PublicServicesCatalogTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.catalog = read(CATALOG)
        cls.app = read(APP)

    def test_catalog_contains_exactly_nine_unique_family_ids(self):
        ids = re.findall(r'^\s{4}id: "([a-z]+)",$', self.catalog, re.M)
        self.assertEqual(ids, list(FAMILY_IDS))
        self.assertEqual(len(ids), len(set(ids)))

    def test_catalog_contains_all_public_landing_paths(self):
        paths = re.findall(r'^\s{4}path: "(/[a-z]+)",$', self.catalog, re.M)
        self.assertEqual(paths, list(FAMILY_PATHS))

    def test_every_family_has_menu_summary_action_and_start_path(self):
        self.assertEqual(self.catalog.count("    summary:"), 9)
        self.assertEqual(self.catalog.count("    action:"), 9)
        self.assertEqual(self.catalog.count("    startPath:"), 9)
        self.assertEqual(self.catalog.count("    menuLinks:"), 9)

    def test_new_consumer_families_bind_to_real_backend_type(self):
        for family in ("bancos", "energia", "telecomunicaciones", "seguros"):
            marker = f'withFamily(CONSUMER_INTAKE_PATH, "{family}")'
            self.assertGreaterEqual(self.catalog.count(marker), 2, family)
        self.assertEqual(
            self.catalog.count('intake: { department: "claims", caseTypes: ["consumer"] }'),
            4,
        )

    def test_housing_is_consultation_only(self):
        housing = self.catalog.split('id: "vivienda"', 1)[1]
        self.assertIn('startPath: "/contacto?area=vivienda"', housing)
        self.assertIn('entryMode: "consultation"', housing)
        self.assertNotIn("intake:", housing)
        self.assertIn("no se crea automáticamente un expediente", housing)

    def test_app_wires_all_nine_landings_and_asnef(self):
        for path in FAMILY_PATHS + ("/asnef",):
            self.assertIn(f'path="{path}"', self.app, path)

    def test_legacy_asnef_paths_redirect_to_real_public_route(self):
        for path in ("/deudas", "/deudas/asnef", "/morosidad/asnef"):
            self.assertIn(f'path="{path}"', self.app)
        self.assertIn('to="/asnef"', self.app)
        self.assertIn(
            'to="/iniciar-expediente/debt/asnef_equifax?family=morosidad"',
            self.app,
        )

    def test_clean_public_routes_keep_legacy_hash_links_compatible(self):
        main = read(MAIN)
        self.assertIn("BrowserRouter as Router", main)
        self.assertNotIn("HashRouter as Router", main)
        self.assertIn('hash.startsWith("#/")', main)
        self.assertIn('window.history.replaceState(null, "", hash.slice(1))', main)
        vercel = read(ROOT / "vercel.json")
        self.assertIn('"src": "/(.*)"', vercel)
        self.assertIn('"dest": "/index.html"', vercel)


class PublicServicesSurfaceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.navbar = read(NAVBAR)
        cls.footer = read(FOOTER)
        cls.home = read(HOME)
        cls.intake = read(INTAKE)
        cls.landing = read(LANDING)
        cls.contact = read(CONTACT)

    def test_catalog_is_the_shared_source_for_four_surfaces(self):
        self.assertIn("PUBLIC_SERVICE_FAMILIES", self.navbar)
        self.assertIn("PUBLIC_SERVICE_FAMILIES", self.footer)
        self.assertIn("PUBLIC_SERVICE_FAMILIES", self.home)
        self.assertIn("PUBLIC_SERVICE_FAMILIES", self.intake)

    def test_megamenu_is_generated_not_hardcoded(self):
        self.assertIn("PUBLIC_SERVICE_FAMILIES.map", self.navbar)
        self.assertIn("SERVICE_GROUPS.map", self.navbar)
        self.assertIn("grid-template-columns: repeat(3", self.navbar)

    def test_home_renders_nine_family_catalog(self):
        self.assertIn("const SERVICES = PUBLIC_SERVICE_FAMILIES", self.home)
        self.assertIn("SERVICES.map", self.home)
        self.assertIn("Nueve familias públicas", self.home)
        self.assertIn("Consulta de encaje", self.home)

    def test_selector_renders_same_nine_families(self):
        self.assertIn("const services = PUBLIC_SERVICE_FAMILIES", self.intake)
        self.assertIn("navigate(service.startPath)", self.intake)
        self.assertIn("Expediente disponible", self.intake)

    def test_unknown_department_never_falls_back_to_traffic(self):
        forbidden = (
            'const department = requestedDepartment || "traffic"',
            "SERVICE_CONFIG[department] || SERVICE_CONFIG.traffic",
        )
        for marker in forbidden:
            self.assertNotIn(marker, self.intake)
        self.assertIn("invalidDepartment", self.intake)
        self.assertIn("invalidSelection", self.intake)
        self.assertIn("no lo convertimos automáticamente en un expediente de tráfico", self.intake)

    def test_unknown_case_type_and_legacy_service_are_fail_closed(self):
        self.assertIn("invalidType", self.intake)
        self.assertIn('searchParams.get("service")', self.intake)
        self.assertIn("Boolean(ambiguousLegacyService)", self.intake)

    def test_selected_family_is_preserved_in_url_and_payload(self):
        self.assertIn('searchParams.get("family")', self.intake)
        self.assertIn("Área pública seleccionada:", self.intake)
        self.assertIn("Área pública elegida:", self.intake)
        self.assertIn("familyMismatch", self.intake)

    def test_family_restricts_available_case_types(self):
        self.assertIn("selectedFamily?.intake?.caseTypes", self.intake)
        self.assertIn("availableCaseTypes.includes(form.case_type)", self.intake)
        self.assertIn("availableCaseTypes.map", self.intake)

    def test_old_unpersisted_issue_parameters_are_not_presented(self):
        for path in SRC.rglob("*.jsx"):
            self.assertNotIn("?issue=", read(path), str(path.relative_to(ROOT)))
        for path in SRC.rglob("*.js"):
            self.assertNotIn("?issue=", read(path), str(path.relative_to(ROOT)))

    def test_five_new_pages_use_shared_real_landing(self):
        for filename in NEW_PAGE_FILES:
            text = read(SRC / "pages" / filename)
            self.assertIn("PublicServiceLanding", text, filename)
            self.assertIn("getPublicService", text, filename)

    def test_shared_landing_has_visible_ai_disclosure_and_boundaries(self):
        self.assertIn("Imagen ilustrativa generada con IA", self.landing)
        self.assertIn("Entrada real por reclamación de consumo", self.landing)
        self.assertIn("Consulta de encaje antes de crear un expediente", self.landing)
        self.assertIn('alt={landing.imageAlt}', self.landing)

    def test_housing_contact_has_specific_subject_and_no_auto_case_notice(self):
        self.assertIn('searchParams.get("area") === "vivienda"', self.contact)
        self.assertIn("Consulta de encaje · Vivienda · RTM", self.contact)
        self.assertIn("Esta consulta no crea un expediente automático", self.contact)

    def test_rtm_connect_is_not_imported_by_public_catalog_or_landings(self):
        public_files = [CATALOG, LANDING]
        public_files.extend(SRC / "pages" / name for name in NEW_PAGE_FILES)
        for path in public_files:
            self.assertNotIn("rtmConnect", read(path), str(path.relative_to(ROOT)))


class PublicServicesAssetAndSeoTests(unittest.TestCase):
    def test_three_images_are_valid_bounded_webp(self):
        total = 0
        for name in IMAGE_FILES:
            path = ROOT / "public" / name
            self.assertTrue(path.is_file(), name)
            self.assertEqual(webp_dimensions(path), (1280, 853), name)
            self.assertLess(path.stat().st_size, 100_000, name)
            total += path.stat().st_size
        self.assertLess(total, 200_000)

    def test_catalog_references_only_same_origin_generated_assets(self):
        catalog = read(CATALOG)
        for name in IMAGE_FILES:
            self.assertIn(f'image: "/{name}"', catalog)
        self.assertNotRegex(catalog, r'image: "https?://')

    def test_sitemap_is_valid_and_contains_public_routes(self):
        tree = ET.parse(SITEMAP)
        namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        urls = {
            node.text
            for node in tree.findall("sm:url/sm:loc", namespace)
            if node.text
        }
        for path in FAMILY_PATHS + ("/asnef",):
            self.assertIn(f"https://www.recurretumulta.eu{path}", urls)

    def test_no_foreign_sitemap_domain_remains(self):
        sitemap = read(SITEMAP)
        self.assertNotIn("mediazion.eu", sitemap)
        tree = ET.parse(SITEMAP)
        namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
        for node in tree.findall("sm:url/sm:loc", namespace):
            self.assertTrue((node.text or "").startswith("https://www.recurretumulta.eu/"))


class PublicServicesDeliveryTests(unittest.TestCase):
    def test_preflight_freezes_base_and_checks_full_tree(self):
        preflight = read(PREFLIGHT)
        self.assertIn(
            'BASE_COMMIT_SHA40 = "e677aeaeda807fc4cee5cf87332c6fc72186de27"',
            preflight,
        )
        self.assertIn(
            '"33dad9d9d7b6d71ea5a4777825a754072373dbe76a5485bdd3583d9cb338d08a"',
            preflight,
        )
        self.assertIn("base_file_drift", preflight)
        self.assertIn("rtm_connect_files_unchanged", preflight)
        self.assertIn("duplicate_archive_member", preflight)
        self.assertIn("encrypted_archive_member", preflight)

    def test_delivery_guide_declares_backend_boundary_and_rollback(self):
        guide = read(GUIDE)
        for route in FAMILY_PATHS + ("/asnef",):
            self.assertIn(f"`{route}`", guide)
        self.assertIn("`claims/consumer`", guide)
        self.assertIn("no crea un expediente automático", guide)
        self.assertIn("RTM Connect permanece separado", guide)
        self.assertIn("reversión limpia", guide)
        self.assertIn("no autoriza producción", guide)

    def test_evidence_allowlist_and_file_hashes_are_exact(self):
        evidence = json.loads(read(EVIDENCE))
        overlay_paths = evidence["overlay_paths"]
        hashes = evidence["file_sha256"]
        self.assertEqual(len(overlay_paths), 30)
        self.assertEqual(len(overlay_paths), len(set(overlay_paths)))
        self.assertEqual(
            set(hashes),
            set(overlay_paths) - {EVIDENCE.relative_to(ROOT).as_posix()},
        )
        for relative, expected in hashes.items():
            actual = hashlib.sha256((ROOT / relative).read_bytes()).hexdigest()
            self.assertEqual(actual, expected, relative)

    def test_evidence_keeps_publication_and_real_effects_disabled(self):
        evidence = json.loads(read(EVIDENCE))
        self.assertFalse(evidence["production_authorized"])
        self.assertFalse(evidence["routes_published"])
        self.assertFalse(evidence["external_effects_executed"])
        self.assertFalse(evidence["real_case_data_used"])
        self.assertFalse(evidence["rtm_connect_changed"])
        self.assertEqual(evidence["public_family_count"], 9)


if __name__ == "__main__":
    unittest.main()
