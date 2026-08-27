from __future__ import annotations

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
INTAKE = ROOT / "src" / "pages" / "IniciarExpedienteRTM.jsx"
DASHBOARD = ROOT / "src" / "pages" / "OpsDashboard.jsx"
FOLLOWUPS = ROOT / "src" / "pages" / "OpsFollowups.jsx"
FAMILIES = ROOT / "src" / "lib" / "opsFamilies.js"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


class OpsPublicServiceFamiliesContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.intake = read(INTAKE)
        cls.dashboard = read(DASHBOARD)
        cls.followups = read(FOLLOWUPS)
        cls.families = read(FAMILIES)

    def test_new_intakes_send_the_structured_public_family(self):
        self.assertIn('public_service_family: selectedFamily?.id || ""', self.intake)

    def test_dashboard_uses_the_shared_nine_family_catalog(self):
        self.assertIn("OPS_PUBLIC_FAMILIES.map", self.dashboard)
        self.assertIn("publicFamilyOf", self.dashboard)
        for code in (
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
        ):
            self.assertIn(f"{code}:", self.dashboard)

    def test_vivienda_is_visible_as_consultation_not_automatic_intake(self):
        self.assertIn('f.entryMode==="consultation"', self.dashboard)
        self.assertIn("consulta previa", self.dashboard)

    def test_followups_show_and_search_the_public_family(self):
        self.assertIn("publicFamilyLabel(item)", self.followups)
        self.assertIn("item.public_service_family", self.followups)

    def test_legacy_comment_fallback_is_preserved(self):
        self.assertIn("area publica seleccionada:", self.families)
        self.assertIn("comment.includes(marker)", self.families)


if __name__ == "__main__":
    unittest.main()
