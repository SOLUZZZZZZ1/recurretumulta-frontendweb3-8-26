from __future__ import annotations

import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "src"
API = SRC / "lib" / "api.js"
MAIN = SRC / "main.jsx"

PAYMENT_FLOW = (
    SRC / "pages" / "IniciarExpedienteRTM.jsx",
    SRC / "pages" / "ResumenExpediente.jsx",
    SRC / "components" / "PagarPresentar.jsx",
    SRC / "pages" / "PagoOk.jsx",
    SRC / "pages" / "Autorizar.jsx",
    SRC / "pages" / "RTMAutorizacion.jsx",
)


class StagingApiIsolationContractTest(unittest.TestCase):
    def test_public_source_contains_no_rtm_render_origin(self):
        offenders = []
        for path in SRC.rglob("*"):
            if path.suffix not in {".js", ".jsx"}:
                continue
            source = path.read_text(encoding="utf-8")
            if "recurretumulta-backend" in source:
                offenders.append(str(path.relative_to(ROOT)))
        self.assertEqual(offenders, [])

    def test_only_authoritative_api_module_reads_public_api_variables(self):
        offenders = []
        for path in SRC.rglob("*"):
            if path.suffix not in {".js", ".jsx"} or path == API:
                continue
            source = path.read_text(encoding="utf-8")
            if "VITE_API_BASE_URL" in source or "VITE_API_URL" in source:
                offenders.append(str(path.relative_to(ROOT)))
        self.assertEqual(offenders, [])

    def test_deployed_api_is_same_origin_and_single_target(self):
        source = API.read_text(encoding="utf-8")
        self.assertIn('configuredDevelopmentBase || "/api"', source)
        self.assertIn("import.meta.env.DEV", source)
        self.assertIn(
            "RTM_API_CANDIDATES = Object.freeze([RTM_API_BASE])",
            source,
        )
        self.assertNotIn("DIRECT_BACKEND", source)

    def test_payment_flow_uses_authoritative_api_module(self):
        for path in PAYMENT_FLOW:
            with self.subTest(path=path.name):
                source = path.read_text(encoding="utf-8")
                self.assertIn('from "../lib/api.js"', source)
                self.assertNotIn("DIRECT_BACKEND", source)
                self.assertNotIn("BACKEND_URL", source)

    def test_global_fetch_monkeypatch_is_no_longer_needed(self):
        source = MAIN.read_text(encoding="utf-8")
        self.assertNotIn("KNOWN_BACKEND_ORIGINS", source)
        self.assertNotIn("window.fetch =", source)
        self.assertNotIn("XMLHttpRequest.prototype.open", source)


if __name__ == "__main__":
    unittest.main()
