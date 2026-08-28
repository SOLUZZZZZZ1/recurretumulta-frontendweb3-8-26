from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]


def source(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


class CaseAccessHardeningContractTest(unittest.TestCase):
    def test_capability_is_session_scoped_and_scrubbed_from_url(self):
        access = source("src/lib/caseAccess.js")
        main = source("src/main.jsx")
        self.assertIn('"X-RTM-Case-Token"', access)
        self.assertIn("window.sessionStorage", access)
        self.assertNotIn("window.localStorage", access)
        self.assertIn('current.searchParams.delete("access_token")', access)
        self.assertIn("redactCaseAccessToken", access)
        self.assertIn("bootstrapCaseAccessFromUrl();", main)

    def test_new_and_legacy_intake_capture_the_server_capability(self):
        intake = source("src/pages/IniciarExpedienteRTM.jsx")
        multa = source("src/pages/Multas.jsx")
        upload = source("src/components/UploadDocumento.jsx")
        for current in (intake, multa, upload):
            self.assertIn("rememberCaseAccessToken", current)
            self.assertIn("case_access_token", current)
        self.assertIn('authority_version: "v1_dgt_homologado"', intake)
        self.assertIn("representation_confirmed: true", intake)

    def test_authority_and_pdf_calls_use_the_capability_aware_transport(self):
        api = source("src/lib/api.js")
        authorize = source("src/pages/Autorizar.jsx")
        generic = source("src/pages/RTMAutorizacion.jsx")
        checklist = source("src/components/ChecklistAprobacion.jsx")
        self.assertIn("caseAccessOptions(caseId, options)", api)
        for current in (authorize, generic, checklist):
            self.assertIn("openCaseFile", current)
            self.assertIn('authority_version: "v1_dgt_homologado"', current)
            self.assertIn("representation_confirmed: true", current)


if __name__ == "__main__":
    unittest.main()
