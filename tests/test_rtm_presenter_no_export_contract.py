from __future__ import annotations

import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
OPS_VIEWS = (
    ROOT / "src" / "pages" / "OpsCaseDetail.jsx",
    ROOT / "src" / "pages" / "OpsCaseDetailPro.jsx",
)
LEGACY_COMPONENT = ROOT / "src" / "components" / "OpsCaseDetail.jsx"
LEGACY_GENERATOR = ROOT / "src" / "components" / "GenerateRecursoDGT.jsx"
PRESENTER_COMPONENT = ROOT / "src" / "rtm-presenter" / "RtmPresenterWorkspace.jsx"
PRESENTER_API = ROOT / "src" / "rtm-presenter" / "rtmPresenterApi.js"
VERCEL_CONFIG = ROOT / "vercel.json"


def _source(path: Path) -> str:
    return path.read_text(encoding="utf-8")


def _download_actions(source: str) -> list[str]:
    actions = []
    pattern = re.compile(
        r"<(button|a|Link)\b[^>]*>(.*?)</\1>",
        flags=re.IGNORECASE | re.DOTALL,
    )
    for match in pattern.finditer(source):
        if re.search(r"\b(?:descargar|zip)\b", match.group(2), re.IGNORECASE):
            actions.append(match.group(0))
    return actions


class RtmPresenterFrontendNoExportContractTest(unittest.TestCase):
    def test_ops_pro_planning_never_persists_case_data_in_browser_storage(self):
        source = _source(OPS_VIEWS[1])
        self.assertNotIn("plannerStorageKey", source)
        self.assertNotIn("ops_case_planning", source)
        self.assertNotIn("localStorage.setItem", source)
        self.assertNotIn("sessionStorage", source)
        self.assertNotIn("indexedDB", source)
        self.assertNotIn("localStorage", source)
        self.assertIn("useOpsAuth", source)
        self.assertIn("authFetch", source)
        self.assertIn("no se guardan en el dispositivo", source)

    def test_vercel_uses_modern_rewrites_and_covers_ops_root(self):
        source = _source(VERCEL_CONFIG)
        self.assertNotIn('"routes"', source)
        self.assertIn('"rewrites"', source)
        self.assertIn('"source": "/api/:path*"', source)
        self.assertIn('"destination": "https://recurretumulta-backend-1.onrender.com/:path*"', source)
        self.assertIn('"source": "/:path*"', source)
        self.assertIn('"source": "/ops"', source)
        self.assertIn('"source": "/ops/:path*"', source)
        self.assertIn('"value": "no-store, max-age=0"', source)
        self.assertIn('"value": "noindex, nofollow, noarchive"', source)

    def test_ops_views_create_no_blob_url_or_download_anchor(self):
        for path in OPS_VIEWS:
            with self.subTest(path=path.name):
                source = _source(path)
                self.assertNotIn("createObjectURL", source)
                self.assertNotRegex(source, r"\.\s*download\s*=")
                self.assertNotRegex(
                    source,
                    r"<a\b[^>]*\bdownload(?:\s*=|\s|>)",
                )

    def test_ops_views_offer_no_zip_or_download_action(self):
        for path in OPS_VIEWS:
            with self.subTest(path=path.name):
                self.assertEqual(_download_actions(_source(path)), [])

    def test_presenter_entry_is_gated_by_server_capability(self):
        regular = _source(OPS_VIEWS[0])
        pro = _source(OPS_VIEWS[1])
        self.assertIn("workspace?.actions?.presenter_available === true", regular)
        self.assertIn("detail?.actions?.presenter_available === true", pro)
        self.assertIn("{presenterAvailable ? (", regular)
        self.assertIn("{presenterAvailable ? (", pro)

    def test_legacy_ops_external_upload_is_replaced_by_individual_presenter(self):
        regular = _source(OPS_VIEWS[0])
        self.assertNotIn("/upload-external-document", regular)
        self.assertNotIn("externalFile", regular)
        self.assertNotIn("externalKind", regular)
        self.assertNotIn("EXTERNAL_KINDS", regular)
        self.assertIn("Abrir RTM Presenter con sesión individual", regular)
        self.assertIn("custodia y versionado", regular)
        self.assertIn("sin copiarlo fuera de OPS", regular)
        self.assertIn("{presenterAvailable ? (", regular)

    def test_pro_cannot_claim_pdf_review_or_approve_without_receipt(self):
        source = _source(OPS_VIEWS[1])
        self.assertNotIn("/approve", source)
        self.assertIn("Aprobación final del recurso · pendiente", source)
        self.assertIn('aria-describedby="approval-blocked-reason"', source)
        self.assertIn('id="approval-blocked-reason"', source)
        self.assertIn('aria-describedby="secure-pdf-review-reason"', source)
        self.assertIn("Revisión del recurso final pendiente de evidencia", source)
        self.assertIn(
            "Este control corresponde al recurso final, no a la autorización firmada",
            source,
        )
        self.assertIn("<OpsAuthorizationReview", source)

    def test_legacy_event_projection_filters_known_storage_coordinates(self):
        for path in OPS_VIEWS:
            with self.subTest(path=path.name):
                source = _source(path)
                for key in (
                    "presigned_url",
                    "storage_path",
                    "document_url",
                    "original_key",
                    "source_keys",
                    "storage_locator",
                ):
                    self.assertIn(f'"{key}"', source)
                self.assertIn("INTERNAL_KEYS.has", source)
                self.assertIn("normalizePayloadKey", source)
                self.assertIn("INTERNAL_VALUE.test", source)
        self.assertNotIn("collectDocumentNames", _source(OPS_VIEWS[0]))
        pro = _source(OPS_VIEWS[1])
        self.assertNotIn("e?.payload?.document_url", pro)
        self.assertIn("JSON.stringify(sanitizePayload(aiResult), null, 2)", pro)

    def test_ops_views_construct_no_document_download_endpoint(self):
        for path in OPS_VIEWS:
            with self.subTest(path=path.name):
                source = _source(path).lower()
                self.assertNotIn("/download", source)

    def test_legacy_component_neither_presigns_nor_projects_storage_fields(self):
        source = _source(LEGACY_COMPONENT)
        lowered = source.lower()
        self.assertNotIn("presign", lowered)
        self.assertNotIn("/files/", lowered)

        storage_property = re.compile(
            r"(?:\.\s*|\[\s*['\"])(?:"
            r"bucket|b2_bucket|b2_key|object_key|storage_bucket|storage_key|key"
            r")[\s'\"]*(?:\]|\b)",
            flags=re.IGNORECASE,
        )
        self.assertIsNone(storage_property.search(source))
        self.assertNotRegex(
            source,
            r"JSON\.stringify\s*\(\s*(?:d|doc|docs|document|documents)\b",
        )
        self.assertNotRegex(
            source,
            r">\s*(?:B2\s+)?(?:bucket|object\s+key|storage\s+key|key)\s*:",
        )

    def test_legacy_generator_keeps_generated_documents_in_rtm(self):
        source = _source(LEGACY_GENERATOR)
        lowered = source.lower()
        self.assertNotIn("presign", lowered)
        self.assertNotIn("window.open", source)
        self.assertNotIn("caseAccessHeaders", source)
        self.assertNotRegex(source, r"\.(?:bucket|key)\b")
        self.assertIn("custodiado en el expediente", source)
        self.assertIn("No se ofrece descarga", source)

    def test_presenter_operator_surface_has_no_binary_viewer_or_normal_export(self):
        source = _source(PRESENTER_COMPONENT) + _source(PRESENTER_API)
        for forbidden in (
            "createObjectURL",
            "revokeObjectURL",
            "response.blob",
            "readInternalPreview",
            "application/zip",
            "/preview",
        ):
            self.assertNotIn(forbidden, source)
        self.assertNotRegex(
            source,
            r"<(?:button|a)\b[^>]*>\s*(?:Descargar|ZIP|Exportar)\s*</",
        )


if __name__ == "__main__":
    unittest.main()
