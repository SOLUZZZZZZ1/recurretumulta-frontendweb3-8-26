from __future__ import annotations

import ast
import hashlib
import importlib.util
import json
from pathlib import Path
import re
import subprocess
import unittest


ROOT = Path(__file__).resolve().parents[1]
NAVBAR = ROOT / "src" / "components" / "Navbar.jsx"
FOOTER = ROOT / "src" / "components" / "Footer.jsx"
SEO = ROOT / "src" / "components" / "Seo.jsx"
HOME = ROOT / "src" / "pages" / "InicioRTM.jsx"
CSS = ROOT / "src" / "index.css"
INDEX = ROOT / "index.html"
DOC = ROOT / "docs" / "rtm_connect" / "RTM_FRONTEND_BRAND_TAGLINE_V1.md"
EVIDENCE = ROOT / "docs" / "rtm_connect" / "RTM_FRONTEND_BRAND_TAGLINE_V1_EVIDENCE.json"
INTEGRITY_ADDENDUM = (
    ROOT
    / "docs"
    / "rtm_connect"
    / "RTM_FRONTEND_HISTORICAL_EVIDENCE_INTEGRITY_V1.json"
)
PREFLIGHT = ROOT / "scripts" / "rtm_frontend_brand_tagline_v1_preflight.py"
BRAND_TAGLINE_EVIDENCE_COMMIT_SHA40 = (
    "e677aeaeda807fc4cee5cf87332c6fc72186de27"
)
INTEGRITY_ADDENDUM_SHA256 = (
    "aad8f0e63e8702cb2619973722d31428dd964dead26d189730ac242f5998d5b0"
)
INTEGRITY_ADDENDUM_COMMIT_SHA40 = (
    "2e94c15852a3636c271143b00e56133ca208834c"
)
INTEGRITY_ADDENDUM_GIT_OBJECT_ID = "6782d2c00e21799383bc35aae9d014cec826d663"


def load_preflight():
    spec = importlib.util.spec_from_file_location("brand_tagline_preflight", PREFLIGHT)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def archived_blob(commit: str, relative_path: str) -> bytes:
    result = subprocess.run(
        ["git", "show", f"{commit}:{relative_path}"],
        cwd=ROOT,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if result.returncode != 0:
        raise AssertionError(f"No se pudo leer {relative_path} en {commit}")
    return result.stdout


def archived_object_id(commit: str, relative_path: str) -> str:
    result = subprocess.run(
        ["git", "rev-parse", f"{commit}:{relative_path}"],
        cwd=ROOT,
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    if result.returncode != 0:
        raise AssertionError(f"No se pudo resolver {relative_path} en {commit}")
    return result.stdout.strip()


def css_block(css: str, selector: str) -> str:
    match = re.search(re.escape(selector) + r"\s*\{([^{}]*)\}", css, re.S)
    if not match:
        raise AssertionError(f"missing selector {selector}")
    return match.group(1)


class BrandTaglineNavbarContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.navbar = NAVBAR.read_text(encoding="utf-8")
        cls.css = CSS.read_text(encoding="utf-8")

    def test_exact_visible_tagline_is_single_dom_text_node(self):
        marker = '<span className="rtm-navbar-tagline">Resuelve tus movidas</span>'
        self.assertEqual(self.navbar.count(marker), 1)
        self.assertNotIn("rtm-navbar-tagline-lead", self.navbar)
        self.assertNotIn("rtm-navbar-tagline-accent", self.navbar)

    def test_brand_link_has_exact_accessible_name_and_decorative_image(self):
        self.assertIn(
            'aria-label="RTM — Resuelve tus movidas. Ir al inicio"',
            self.navbar,
        )
        self.assertIn(
            '<span className="rtm-navbar-logo-frame" aria-hidden="true">',
            self.navbar,
        )
        self.assertIn('<img src={logo} alt="" className="rtm-navbar-logo" />', self.navbar)

    def test_keyboard_focus_is_visible(self):
        block = css_block(self.css, ".rtm-navbar-brand:focus-visible")
        self.assertIn("outline: 3px solid #fff", block)
        self.assertIn("outline-offset: -4px", block)

    def test_current_main_navigation_page_is_announced(self):
        self.assertIn(
            'aria-current={pathname === "/" ? "page" : undefined}',
            self.navbar,
        )
        self.assertIn(
            'aria-current={servicesActive ? "true" : undefined}',
            self.navbar,
        )
        self.assertGreaterEqual(
            self.navbar.count(
                'pathname === group.landing ? "page" : undefined'
            ),
            2,
        )
        self.assertGreaterEqual(
            self.navbar.count('aria-current={active ? "page" : undefined}'),
            2,
        )

    def test_tagline_uses_live_text_and_prudent_contrast_colour(self):
        block = css_block(self.css, ".rtm-navbar-tagline")
        self.assertIn("color: #a7f57a", block)
        self.assertIn("font-size: 17px", block)
        self.assertIn("font-style: italic", block)
        self.assertIn("border-left:", block)
        for forbidden in ("display: none", "opacity: 0", "visibility: hidden"):
            self.assertNotIn(forbidden, block)

    def test_tagline_remains_declared_at_three_breakpoints(self):
        self.assertEqual(self.css.count(".rtm-navbar-tagline {"), 4)
        for marker in (
            "@media (max-width: 980px)",
            "font-size: 16px",
            "@media (max-width: 640px)",
            "font-size: 13px",
            "@media (max-width: 380px)",
            "font-size: 11px",
        ):
            self.assertIn(marker, self.css)

    def test_travel_navigation_has_one_catalog_authority_and_no_duplicate_literal(self):
        catalog = (ROOT / "src" / "data" / "publicServices.js").read_text(
            encoding="utf-8"
        )
        self.assertIn(
            "const SERVICE_GROUPS = PUBLIC_SERVICE_FAMILIES.map((family) => ({",
            self.navbar,
        )
        self.assertIn("landing: family.path", self.navbar)
        self.assertIn("landingLabel: family.action", self.navbar)
        self.assertNotIn('landing: "/viajes"', self.navbar)
        self.assertEqual(catalog.count('id: "viajes"'), 1)
        self.assertEqual(catalog.count('path: "/viajes"'), 1)
        self.assertEqual(catalog.count('action: "Ver servicios de viajes"'), 1)
        self.assertEqual(
            catalog.count(
                'withFamily("/iniciar-expediente/claims/airline", "viajes")'
            ),
            1,
        )


class BrandTaglineSurfaceContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.footer = FOOTER.read_text(encoding="utf-8")
        cls.seo = SEO.read_text(encoding="utf-8")
        cls.home = HOME.read_text(encoding="utf-8")
        cls.index = INDEX.read_text(encoding="utf-8")

    def test_exact_signature_is_consistent_in_metadata_home_and_footer(self):
        self.assertIn("<title>RTM · Resuelve tus movidas</title>", self.index)
        self.assertIn('title = "RTM · Resuelve tus movidas"', self.seo)
        self.assertIn('content="RTM · Resuelve tus movidas"', self.seo)
        self.assertGreaterEqual(self.home.count("RTM · Resuelve tus movidas"), 2)
        self.assertIn("RTM · Resuelve tus movidas", self.footer)
        self.assertNotIn('aria-label="RTM — Resuelve tus movidas"', self.footer)

    def test_broad_description_is_consistent(self):
        phrase = (
            "RTM ayuda a comprender y gestionar problemas de tráfico, viajes, "
            "deudas y trámites con la Administración."
        )
        self.assertIn(phrase, self.index)
        self.assertIn(phrase, self.seo)
        self.assertIn(phrase, self.home)

    def test_legacy_domain_canonical_og_and_contact_are_preserved(self):
        self.assertIn('canonical = "https://www.recurretumulta.eu/"', self.seo)
        self.assertIn(
            'image = "https://www.recurretumulta.eu/og-recurretumulta.png?v=2"',
            self.seo,
        )
        self.assertIn("soporte@recurretumulta.eu", self.footer)
        self.assertIn("www.recurretumulta.eu", self.footer)

    def test_legal_links_and_no_result_guarantee_are_preserved(self):
        for route in ("/aviso-legal", "/privacidad", "/cookies"):
            self.assertIn(f'to="{route}"', self.footer)
        self.assertIn(
            "RTM presta servicios de asistencia y, cuando corresponde, asesoramiento",
            self.footer,
        )
        self.assertIn("jurídico; no garantiza un resultado favorable.", self.footer)

    def test_html_shell_and_home_flow_markers_are_preserved(self):
        for marker in ('<html lang="es">', '<div id="root"></div>', 'src="/src/main.jsx"'):
            self.assertIn(marker, self.index)
        for marker in (
            "¿En qué asunto necesita ayuda?",
            "Seleccione el área relacionada con su problema.",
            "navigate(`/resumen?case=${encodeURIComponent(caseKey)}`)",
        ):
            self.assertIn(marker, self.home)

    def test_changed_surfaces_keep_transport_bounded_and_add_no_dynamic_html(self):
        code = "\n".join((self.footer, self.seo, self.home, self.index, NAVBAR.read_text(encoding="utf-8")))
        self.assertEqual(code.count("fetch("), 1)
        self.assertIn("apiFetch(url, { method: \"GET\" })", self.home)
        self.assertIn("for (const base of RTM_API_CANDIDATES)", self.home)
        self.assertNotIn("https://recurretumulta-backend.onrender.com", code)
        for marker in (
            "XMLHttpRequest",
            "WebSocket",
            "EventSource",
            "navigator.sendBeacon",
            "dangerouslySetInnerHTML",
            "new Function",
        ):
            self.assertNotIn(marker, code)


class BrandTaglineEvidenceContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.preflight = load_preflight()
        cls.script = PREFLIGHT.read_text(encoding="utf-8")
        cls.doc = DOC.read_text(encoding="utf-8")
        cls.evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))
        cls.integrity_addendum_bytes = INTEGRITY_ADDENDUM.read_bytes()
        cls.integrity_addendum = json.loads(cls.integrity_addendum_bytes)

    def test_base_identity_is_exact_and_documented(self):
        self.assertEqual(
            self.preflight.BASE_COMMIT_SHA40,
            "809a7e21f9453522df8f2728033c1ee3d6583014",
        )
        self.assertEqual(
            self.preflight.BASE_ARCHIVE_SHA256,
            "ebe091f9a0f85d52dc8af2eb88b4aab80eae77fd7cc327dc7e035e614d433453",
        )
        self.assertEqual(
            self.preflight.BASE_SNAPSHOT_SHA256,
            "954298840c3d7f899c1f798e63075ffb5a4dc5dbcf516629f1dc17e2cdf9e9d9",
        )
        for value in (
            self.preflight.BASE_COMMIT_SHA40,
            self.preflight.BASE_ARCHIVE_SHA256,
            self.preflight.BASE_SNAPSHOT_SHA256,
        ):
            self.assertIn(value, self.doc)

    def test_overlay_allowlist_is_exact(self):
        self.assertEqual(len(self.preflight.OVERLAY_PATHS), 10)
        self.assertEqual(len(self.preflight.REPLACED_BASE_PATHS), 6)
        self.assertEqual(len(self.preflight.NEW_OVERLAY_PATHS), 4)
        self.assertEqual(self.evidence["overlay_paths"], list(self.preflight.OVERLAY_PATHS))

    def test_legacy_manifest_is_archived_and_explicitly_invalidated(self):
        expected = set(self.preflight.OVERLAY_PATHS) - {
            "docs/rtm_connect/RTM_FRONTEND_BRAND_TAGLINE_V1_EVIDENCE.json"
        }
        self.assertEqual(set(self.evidence["file_sha256"]), expected)
        self.assertEqual(
            hashlib.sha256(self.integrity_addendum_bytes).hexdigest(),
            INTEGRITY_ADDENDUM_SHA256,
        )
        addendum_path = INTEGRITY_ADDENDUM.relative_to(ROOT).as_posix()
        self.assertEqual(
            archived_blob(INTEGRITY_ADDENDUM_COMMIT_SHA40, addendum_path),
            self.integrity_addendum_bytes,
        )
        self.assertEqual(
            archived_object_id(INTEGRITY_ADDENDUM_COMMIT_SHA40, addendum_path),
            INTEGRITY_ADDENDUM_GIT_OBJECT_ID,
        )
        self.assertEqual(
            self.integrity_addendum["status"],
            "historical_manifest_discrepancies_recorded",
        )
        self.assertEqual(
            self.integrity_addendum["scope"], "historical_file_integrity_only"
        )
        self.assertIs(self.integrity_addendum["original_manifests_modified"], False)
        self.assertIs(self.integrity_addendum["build_or_test_claims_reattested"], False)
        self.assertIs(self.integrity_addendum["production_authorized"], False)
        record = self.integrity_addendum["records"]["brand_tagline_v1"]
        self.assertEqual(record["source_commit"], BRAND_TAGLINE_EVIDENCE_COMMIT_SHA40)
        self.assertEqual(
            record["manifest_path"], EVIDENCE.relative_to(ROOT).as_posix()
        )
        self.assertIs(record["original_manifest_valid"], False)
        archived_evidence = archived_blob(
            BRAND_TAGLINE_EVIDENCE_COMMIT_SHA40,
            EVIDENCE.relative_to(ROOT).as_posix(),
        )
        self.assertEqual(json.loads(archived_evidence), self.evidence)
        self.assertEqual(
            hashlib.sha256(archived_evidence).hexdigest(),
            record["manifest_git_blob_sha256"],
        )
        self.assertEqual(
            archived_object_id(
                BRAND_TAGLINE_EVIDENCE_COMMIT_SHA40,
                EVIDENCE.relative_to(ROOT).as_posix(),
            ),
            record["manifest_git_object_id"],
        )

        observed = {}
        for name, digest in self.evidence["file_sha256"].items():
            self.assertRegex(digest, r"^[0-9a-f]{64}$")
            observed[name] = hashlib.sha256(
                archived_blob(BRAND_TAGLINE_EVIDENCE_COMMIT_SHA40, name)
            ).hexdigest()

        mismatches = {
            name
            for name, digest in self.evidence["file_sha256"].items()
            if observed[name] != digest
        }
        self.assertEqual(
            mismatches,
            {
                "index.html",
                "src/components/Footer.jsx",
                "src/components/Seo.jsx",
                "src/index.css",
                "src/pages/InicioRTM.jsx",
            },
        )
        self.assertEqual(set(record["mismatches"]), mismatches)
        self.assertEqual(record["declared_file_count"], len(expected))
        self.assertEqual(record["matching_file_count"], len(expected - mismatches))
        self.assertEqual(record["mismatch_count"], len(mismatches))
        for name in mismatches:
            self.assertEqual(
                record["mismatches"][name],
                {
                    "declared_sha256": self.evidence["file_sha256"][name],
                    "git_object_id": archived_object_id(
                        BRAND_TAGLINE_EVIDENCE_COMMIT_SHA40, name
                    ),
                    "git_blob_sha256": observed[name],
                },
                name,
            )

    def test_preflight_is_static_read_only_and_does_not_extract_archive(self):
        tree = ast.parse(self.script)
        imports: set[str] = set()
        calls: set[str] = set()
        attrs: set[str] = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imports.update(alias.name.split(".")[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imports.add(node.module.split(".")[0])
            elif isinstance(node, ast.Call):
                if isinstance(node.func, ast.Name):
                    calls.add(node.func.id)
                elif isinstance(node.func, ast.Attribute):
                    attrs.add(node.func.attr)
        self.assertFalse(imports & {"http", "requests", "socket", "subprocess", "urllib"})
        self.assertFalse(calls & {"eval", "exec", "compile", "__import__", "open"})
        self.assertFalse(attrs & {"extract", "extractall", "write_text", "write_bytes", "unlink"})

    def test_evidence_does_not_overclaim_legal_brand_or_visual_status(self):
        for field in (
            "legal_compliance_claimed",
            "brand_rights_verified",
            "trademark_clearance_completed",
            "legal_review_completed",
            "production_authorized",
            "production_safe",
            "live_visual_verified",
            "computed_accessible_name_verified",
        ):
            self.assertIs(self.evidence[field], False, field)
        self.assertEqual(
            self.evidence["gate_status"],
            "blocked_pending_visual_and_legal_review",
        )
        self.assertEqual(self.evidence["live_verdict"], "no_go")
        self.assertEqual(
            self.evidence["test_status"],
            "passed_full_suite_operator_console_report",
        )
        self.assertEqual(self.evidence["brand_contract_tests_passed"], 19)
        self.assertEqual(
            self.evidence["full_suite_status"],
            "passed_operator_console_report",
        )
        self.assertEqual(
            (
                self.evidence["full_suite_tests_discovered"],
                self.evidence["full_suite_tests_passed"],
                self.evidence["full_suite_tests_failed"],
            ),
            (122, 122, 0),
        )
        self.assertIs(
            self.evidence["frontend_build_console_report_cryptographically_verified"],
            False,
        )
        self.assertIs(
            self.evidence["full_suite_console_report_cryptographically_verified"],
            False,
        )
        self.assertIs(self.evidence["frontend_build_artifacts_hash_frozen"], False)

    def test_document_explains_commercial_and_legal_boundaries(self):
        for marker in (
            "firma publicitaria",
            "no pretende prometer",
            "sujeta a revisión jurídica",
            "no acredita disponibilidad registral",
            "no acredita conformidad legal integral",
            "no se crea un nuevo logotipo registral",
        ):
            self.assertIn(marker, self.doc)


if __name__ == "__main__":
    unittest.main()
