from __future__ import annotations

import ast
import hashlib
import importlib.util
from pathlib import Path
import struct
import unittest


ROOT = Path(__file__).resolve().parents[1]
IMAGE = ROOT / "public" / "hero-como-trabajamos.png"
PAGE = ROOT / "src" / "pages" / "ComoFunciona.jsx"
DOC = ROOT / "docs" / "rtm_connect" / "RTM_FRONTEND_COMO_FUNCIONA_HERO_V1.md"
PREFLIGHT = ROOT / "scripts" / "rtm_frontend_como_funciona_hero_v1_preflight.py"


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def load_preflight():
    spec = importlib.util.spec_from_file_location("hero_v1_preflight", PREFLIGHT)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


class ComoFuncionaHeroV1ImageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.value = IMAGE.read_bytes()
        cls.preflight = load_preflight()

    def test_asset_exists_and_is_bounded(self):
        self.assertTrue(IMAGE.is_file())
        self.assertGreaterEqual(len(self.value), 250_000)
        self.assertLessEqual(len(self.value), 3_000_000)

    def test_asset_has_exact_png_signature(self):
        self.assertEqual(self.value[:8], b"\x89PNG\r\n\x1a\n")

    def test_asset_has_exact_dimensions_and_rgb_contract(self):
        self.assertEqual(self.value[12:16], b"IHDR")
        width, height, depth, colour = struct.unpack(">IIBB", self.value[16:26])
        self.assertEqual((width, height), (1536, 1024))
        self.assertEqual(depth, 8)
        self.assertEqual(colour, 2)

    def test_asset_hash_is_frozen(self):
        self.assertEqual(
            sha256_file(IMAGE),
            self.preflight.EXPECTED_FILE_SHA256[
                "public/hero-como-trabajamos.png"
            ],
        )


class ComoFuncionaHeroV1PageTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.page = PAGE.read_text(encoding="utf-8")

    def test_page_uses_exact_same_origin_asset(self):
        self.assertIn('url("/hero-como-trabajamos.png")', self.page)
        self.assertNotIn("http://", self.page)
        self.assertNotIn("https://", self.page)
        self.assertNotIn("data:image", self.page)

    def test_page_preserves_cover_crop_and_existing_caption(self):
        self.assertIn("center/cover no-repeat", self.page)
        self.assertIn("Un proceso ordenado y trazable", self.page)
        self.assertIn("Desde la revisión inicial hasta el cierre.", self.page)

    def test_visible_ai_label_is_present(self):
        self.assertIn(
            '<span className="cw-ai-label">Imagen ilustrativa generada con IA</span>',
            self.page,
        )

    def test_accessible_label_excludes_real_persons_facts_and_cases(self):
        self.assertIn(
            "no representa personas, hechos ni expedientes reales",
            self.page,
        )

    def test_label_has_desktop_and_mobile_layout(self):
        self.assertIn(".cw-ai-label{position:absolute", self.page)
        self.assertIn(".cw-ai-label{top:12px", self.page)

    def test_no_dynamic_html_or_script_injection(self):
        self.assertNotIn("dangerouslySetInnerHTML", self.page)
        self.assertNotIn("<script", self.page.lower())


class ComoFuncionaHeroV1DocsAndPreflightTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = DOC.read_text(encoding="utf-8")
        cls.preflight = load_preflight()
        cls.script = PREFLIGHT.read_text(encoding="utf-8")

    def test_base_identity_is_exact(self):
        self.assertEqual(
            self.preflight.BASE_COMMIT_SHA40,
            "8a86815aea0b9406b00320cd367edebe0624d4f1",
        )
        self.assertEqual(
            self.preflight.BASE_ARCHIVE_SHA256,
            "1d302d802a95e039c41a9391725c73dbff5e6533f80a17362c052b2ff647ae4e",
        )
        self.assertIn(self.preflight.BASE_COMMIT_SHA40, self.doc)
        self.assertIn(self.preflight.BASE_ARCHIVE_SHA256, self.doc)

    def test_overlay_allowlist_is_exact(self):
        self.assertEqual(
            set(self.preflight.OVERLAY_PATHS),
            {
                "docs/rtm_connect/RTM_FRONTEND_COMO_FUNCIONA_HERO_V1.md",
                "public/hero-como-trabajamos.png",
                "scripts/rtm_frontend_como_funciona_hero_v1_preflight.py",
                "src/pages/ComoFunciona.jsx",
                "tests/test_rtm_frontend_como_funciona_hero_v1_contract.py",
            },
        )

    def test_preflight_hashes_every_non_self_overlay_file(self):
        expected = set(self.preflight.OVERLAY_PATHS) - {
            "scripts/rtm_frontend_como_funciona_hero_v1_preflight.py"
        }
        self.assertEqual(set(self.preflight.EXPECTED_FILE_SHA256), expected)
        for name, digest in self.preflight.EXPECTED_FILE_SHA256.items():
            self.assertRegex(digest, r"^[0-9a-f]{64}$")
            self.assertEqual(sha256_file(ROOT / name), digest, name)

    def test_preflight_has_no_network_or_process_surface(self):
        tree = ast.parse(self.script)
        forbidden_roots = {
            "http",
            "requests",
            "socket",
            "subprocess",
            "urllib",
        }
        imports = set()
        calls = set()
        for node in ast.walk(tree):
            if isinstance(node, ast.Import):
                imports.update(alias.name.split(".")[0] for alias in node.names)
            elif isinstance(node, ast.ImportFrom) and node.module:
                imports.add(node.module.split(".")[0])
            elif isinstance(node, ast.Call) and isinstance(node.func, ast.Name):
                calls.add(node.func.id)
        self.assertFalse(imports & forbidden_roots)
        self.assertFalse(calls & {"eval", "exec", "compile", "__import__"})

    def test_docs_explain_the_exact_missing_asset_failure(self):
        self.assertIn("`/hero-como-trabajamos.png`", self.doc)
        self.assertIn("no contenía", self.doc)
        self.assertIn("fallback HTML", self.doc)

    def test_docs_do_not_claim_legal_compliance(self):
        self.assertIn("no acredita conformidad", self.doc)
        self.assertIn("califica como *deepfake*", self.doc)
        self.assertIn("política prudencial", self.doc)

    def test_docs_keep_connect_live_no_go(self):
        self.assertIn("permanece", self.doc)
        self.assertIn("`no_go`", self.doc)


if __name__ == "__main__":
    unittest.main()
