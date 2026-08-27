from __future__ import annotations

from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
DETAIL = ROOT / "src" / "pages" / "OpsCaseDetail.jsx"
DASHBOARD = ROOT / "src" / "pages" / "OpsDashboard.jsx"
PAYMENT = ROOT / "src" / "lib" / "opsPayment.js"


def read(path: Path) -> str:
    return path.read_text(encoding="utf-8")


class OpsPaymentIntegrityContractTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.detail = read(DETAIL)
        cls.dashboard = read(DASHBOARD)
        cls.payment = read(PAYMENT)

    def test_payment_is_loaded_independently_from_core_workspace(self):
        self.assertIn("/ops/core/cases/${caseId}/workspace", self.detail)
        self.assertIn("/billing/status/${caseId}", self.detail)
        self.assertIn("const [ws, payment, ds, es, fs]", self.detail)

    def test_workspace_failure_never_invents_pending_payment(self):
        self.assertIn("if (!workspace)", self.detail)
        self.assertIn("RTM · EXPEDIENTE EN MODO SEGURO", self.detail)
        self.assertIn("no se infieren datos", self.detail)
        self.assertNotIn(
            '{paid ? "Pago confirmado" : "Pago pendiente"}',
            self.detail,
        )

    def test_detail_has_three_explicit_payment_states(self):
        for label in (
            "Pago confirmado",
            "No consta pago",
            "Estado de pago no disponible",
        ):
            self.assertIn(label, self.payment)

    def test_paid_case_remains_actionable_when_workspace_fails(self):
        self.assertIn("Estado de pago independiente", self.detail)
        self.assertIn(
            "debe permanecer en la cola de pagados pendientes de revisión",
            self.detail,
        )
        self.assertIn("Mientras el espacio jurídico no cargue", self.detail)

    def test_dashboard_has_direct_paid_review_filter(self):
        self.assertIn("function isPaidCase(x)", self.dashboard)
        self.assertIn("function needsPaidReview(x)", self.dashboard)
        self.assertIn('setState("paid")', self.dashboard)
        self.assertIn("pagados por revisar", self.dashboard)
        self.assertIn('option value="paid"', self.dashboard)

    def test_paid_cases_are_never_classified_as_waiting_for_customer(self):
        self.assertIn("function isWaiting(x){return !isPaidCase(x)", self.dashboard)
        self.assertIn("function needsWork(x){return needsPaidReview(x)", self.dashboard)

    def test_dashboard_shows_payment_source_field_and_prioritizes_paid(self):
        self.assertIn("x.payment_status", self.dashboard)
        self.assertIn("Pago confirmado", self.dashboard)
        self.assertIn("Sin pago confirmado", self.dashboard)
        self.assertIn("const paidPriority", self.dashboard)


if __name__ == "__main__":
    unittest.main()
