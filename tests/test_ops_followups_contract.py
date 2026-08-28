from __future__ import annotations

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / "src" / "App.jsx"
DASHBOARD = ROOT / "src" / "pages" / "OpsDashboard.jsx"
FOLLOWUPS = ROOT / "src" / "pages" / "OpsFollowups.jsx"
DETAIL = ROOT / "src" / "pages" / "OpsCaseDetail.jsx"
INDEX_CSS = ROOT / "src" / "index.css"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


class OpsFollowupsContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.app = read(APP)
        cls.dashboard = read(DASHBOARD)
        cls.followups = read(FOLLOWUPS)
        cls.detail = read(DETAIL)
        cls.index_css = read(INDEX_CSS)

    def test_global_followups_route_is_wired(self):
        self.assertIn('import OpsFollowups from "./pages/OpsFollowups.jsx"', self.app)
        self.assertIn('path="/ops/followups"', self.app)
        self.assertIn("element={<OpsFollowups />}", self.app)

    def test_dashboard_alert_is_actionable(self):
        self.assertIn('to="/ops/followups"', self.dashboard)
        self.assertIn('to="/ops/followups?scope=due"', self.dashboard)
        self.assertIn("seguimientos vencidos/próximos · Ver", self.dashboard)

    def test_global_page_loads_protected_read_only_endpoint(self):
        self.assertIn("/ops/followups?status=all&limit=500", self.followups)
        self.assertIn('"X-Operator-Token": token', self.followups)
        self.assertNotIn('method: "POST"', self.followups)
        self.assertNotIn('method: "DELETE"', self.followups)

    def test_global_page_supports_fast_search_and_filters(self):
        for field in (
            "contact_name",
            "contact_email",
            "case_id",
            "expediente_ref",
            "organismo",
            "matricula",
            "title",
            "description",
        ):
            self.assertIn(f"item.{field}", self.followups)

        for label in (
            "Todos los estados",
            "Solo vencidos",
            "Próximos 7 días",
            "Pendientes sin fecha",
        ):
            self.assertIn(label, self.followups)

    def test_every_followup_links_to_its_case(self):
        self.assertIn("function caseLink(item)", self.followups)
        self.assertIn("/ops/vehicle-removal?case_id=", self.followups)
        self.assertIn("to={caseLink(item)}", self.followups)
        self.assertIn("Abrir expediente", self.followups)

    def test_case_detail_links_back_to_global_followups(self):
        self.assertIn('to="/ops/followups"', self.detail)
        self.assertIn("Todos los seguimientos", self.detail)

    def test_case_detail_controls_clear_the_overhanging_brand(self):
        self.assertEqual(
            self.detail.count('className="sr-container ops-case-main"'), 4
        )
        self.assertNotIn('className="sr-container py-', self.detail)
        self.assertRegex(
            self.index_css,
            r"\.ops-case-main\s*\{[^}]*padding-top:\s*42px;[^}]*\}",
        )

    def test_vehicle_removal_link_focuses_the_exact_case(self):
        vehicle_removal = read(ROOT / "src" / "pages" / "OpsVehicleRemoval.jsx")
        self.assertIn('searchParams.get("case_id")', vehicle_removal)
        self.assertIn("String(item.case_id) === focusCaseId", vehicle_removal)
        self.assertIn("Ver todas las solicitudes", vehicle_removal)
        self.assertIn('to="/ops/followups"', vehicle_removal)

    def test_returns_to_ops_use_a_full_direct_navigation(self):
        for relative in (
            "src/pages/OpsCaseDetail.jsx",
            "src/pages/OpsFollowups.jsx",
            "src/pages/OPSQueueSmart.jsx",
            "src/pages/OpsVehicleRemoval.jsx",
        ):
            with self.subTest(relative=relative):
                source = read(ROOT / relative)
                self.assertIn('href="/ops"', source)
                self.assertNotIn('to="/ops"', source)


if __name__ == "__main__":
    unittest.main()
