from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
DETAIL = (ROOT / "src" / "pages" / "OpsCaseDetail.jsx").read_text(
    encoding="utf-8"
)
PRO = (ROOT / "src" / "pages" / "OpsCaseDetailPro.jsx").read_text(
    encoding="utf-8"
)


class OpsCaseSwitchGuardContractTest(unittest.TestCase):
    def test_both_views_clear_the_previous_projection_before_paint(self):
        for source in (DETAIL, PRO):
            self.assertIn("useLayoutEffect", source)
            self.assertIn("activeCaseIdRef.current = caseId || \"\"", source)
            self.assertIn("loadedCaseIdRef.current = \"\"", source)
            self.assertIn("setLoadedCaseId(\"\")", source)
            self.assertIn("loadAbortRef.current?.abort()", source)
            self.assertIn("mutationAbortRef.current?.abort()", source)
            self.assertIn("loadGenerationRef.current += 1", source)
            self.assertIn("mutationGenerationRef.current += 1", source)

    def test_late_reads_are_aborted_and_generation_checked_before_commit(self):
        for source in (DETAIL, PRO):
            self.assertIn("new AbortController()", source)
            self.assertIn("isCurrentOpsCaseRequest", source)
            self.assertIn("requestedCaseId", source)
            self.assertIn("requestGeneration", source)
            self.assertIn("activeGeneration", source)
            self.assertIn("signal: controller.signal", source)
            self.assertIn("if (!isCurrentLoad()) return", source)

    def test_mutations_use_the_loaded_case_identity_not_a_new_route_value(self):
        for source in (DETAIL, PRO):
            self.assertIn(
                "const requestedCaseId = loadedCaseIdRef.current", source
            )
            self.assertIn("isCurrentMutation", source)
            self.assertIn("encodeURIComponent(requestedCaseId)", source)
        self.assertIn("followupMutationLockRef.current", DETAIL)
        self.assertIn("manualLockRef.current", PRO)

    def test_navigation_invalidates_case_specific_mutation_feedback(self):
        for source in (DETAIL, PRO):
            self.assertIn("mutationAbortRef.current?.abort()", source)
            self.assertIn("mutationGenerationRef.current += 1", source)
        self.assertIn("setMessage(\"\")", DETAIL)
        self.assertIn("setDebug(\"\")", DETAIL)
        self.assertIn("setError(\"\")", PRO)
        self.assertIn("setPlanningMsg(\"\")", PRO)


if __name__ == "__main__":
    unittest.main()
