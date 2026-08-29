from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
PRESENTER = ROOT / "src" / "rtm-presenter"


def source(name: str) -> str:
    return (PRESENTER / name).read_text(encoding="utf-8")


class RtmPresenterFrontendContractTest(unittest.TestCase):
    def test_presenter_route_is_integrated_through_the_individual_session_page(self):
        for name in (
            "RtmPresenterWorkspace.jsx",
            "rtmPresenterApi.js",
            "rtmPresenterModel.js",
            "rtmPresenter.css",
            "index.js",
        ):
            self.assertTrue((PRESENTER / name).is_file(), name)

        app = (ROOT / "src" / "App.jsx").read_text(encoding="utf-8")
        page = (ROOT / "src" / "pages" / "OpsPresenterPage.jsx").read_text(
            encoding="utf-8"
        )
        self.assertIn("OpsPresenterPage", app)
        self.assertIn('path="/ops/case/:caseId/presenter"', app)
        self.assertIn("RtmPresenterWorkspace", page)
        self.assertIn("onUnauthorized={presenterUnauthorized}", page)
        self.assertIn("activeSessionIdRef.current !== expectedSessionId", page)
        self.assertIn('key={`${session.sessionId}:${caseId || ""}`}', page)
        self.assertIn("must_change_password !== false", page)
        self.assertIn("mfa_required !== false", page)
        self.assertIn('`${API}/ops/auth/logout`', page)
        self.assertIn("authStatus?.individual_login_enabled !== true", page)
        self.assertIn(
            "La autenticación individual de RTM Presenter no está habilitada.",
            page,
        )

    def test_normal_surface_uses_metadata_and_never_requests_document_bytes(self):
        component = source("RtmPresenterWorkspace.jsx")
        api = source("rtmPresenterApi.js")
        combined = component + api

        self.assertIn("Preparar presentación", component)
        self.assertIn("Tus documentos permanecen en RTM.", component)
        self.assertIn("solo maneja", component)
        self.assertIn("metadatos", component)
        self.assertIn("ticket de un solo uso", component)
        self.assertIn("No se crea una carpeta local", component)

        for forbidden in (
            "createObjectURL",
            "revokeObjectURL",
            "readInternalPreview",
            "createAttempt",
            "prepareHandoff",
            "confirmHandoff",
            "response.blob",
            "<iframe",
            "/attempts/",
            "/preview",
        ):
            self.assertNotIn(forbidden, combined)

        self.assertNotRegex(component, r">\s*(?:Descargar|ZIP|Exportar)\s*<")

    def test_normal_api_matches_backend_workspace_and_freeze_routes(self):
        api = source("rtmPresenterApi.js")
        model = source("rtmPresenterModel.js")
        self.assertIn(
            "`${RTM_PRESENTER_API_PREFIX}/cases/${id}/workspace`", api
        )
        self.assertIn(
            "`${RTM_PRESENTER_API_PREFIX}/cases/${id}/packages/freeze`", api
        )
        self.assertIn(
            "`${RTM_PRESENTER_API_PREFIX}/cases/${id}/documents/external`", api
        )
        self.assertIn("/deliveries/prepare`", api)
        self.assertIn("/destinations/search?q=", api)
        self.assertIn("destination_profile_id", model)
        self.assertIn("representation_mode", model)
        self.assertIn("authorization_document_version_id", model)
        self.assertIn("document_version_id", model)
        self.assertIn("item_order", model)
        self.assertIn("field_code", model)
        self.assertIn("portal_filename", model)
        self.assertIn('normalized === "interested" ? "self"', model)
        self.assertIn("correspondence", api)
        self.assertIn("data_minimization_confirmed", api)

    def test_external_document_ingress_is_capability_gated_and_ephemeral(self):
        component = source("RtmPresenterWorkspace.jsx")
        api = source("rtmPresenterApi.js")
        model = source("rtmPresenterModel.js")
        combined = component + api

        self.assertIn('"presenter.documents.ingest"', model)
        self.assertIn("hasPresenterDocumentIngestCapability", component)
        self.assertIn("documentIngestAllowed && externalPanelOpen", component)
        self.assertIn("Añadir documento al expediente", component)
        self.assertIn("Es un documento nuevo", component)
        self.assertIn("Sustituye o mejora uno existente", component)
        self.assertIn("supersedesDocumentVersionId", component)
        self.assertIn('form.append("supersedes_document_version_id"', api)
        self.assertIn('form.append("purpose"', api)
        self.assertIn('form.append("file"', api)
        self.assertIn('form.append("synthetic_confirmed", "true")', api)
        for purpose in (
            "main_filing",
            "prejudicial_authorization",
            "representation_authorization",
            "submission_receipt",
            "supporting_evidence",
        ):
            self.assertIn(f'"{purpose}"', api)
        self.assertIn("EXTERNAL_DOCUMENT_PURPOSES.has(normalized)", component)
        self.assertIn("latestPresenterDocumentVersions", component)
        self.assertIn("externalLatestVersionCandidates.map", component)
        self.assertIn("25 * 1024 * 1024", api)
        for media_type in (
            "application/pdf",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "image/jpeg",
            "image/png",
        ):
            self.assertIn(f'"{media_type}"', api)
        self.assertIn("externalFileInputRef.current.value = \"\"", component)
        self.assertIn("if (uploadConfirmed) {", component)
        self.assertIn("setWorkspace(null)", component)
        self.assertIn("copia local del workspace se ha invalidado", component)
        self.assertIn("pendiente de análisis", component)
        self.assertIn("todavía no podrá seleccionarse", component)
        self.assertNotIn("setExternalFile(", component)
        self.assertNotIn("useState(new File", component)
        self.assertNotIn("createObjectURL", combined)
        self.assertNotIn("revokeObjectURL", combined)
        self.assertNotIn("localStorage", combined)
        self.assertNotIn("sessionStorage", combined)

    def test_external_ingress_requires_explicit_synthetic_confirmation(self):
        component = source("RtmPresenterWorkspace.jsx")
        api = source("rtmPresenterApi.js")
        self.assertIn(
            "Confirmo que es un documento completamente sintético y",
            component,
        )
        self.assertIn("datos reales", component)
        self.assertIn("syntheticConfirmed !== true", api)
        self.assertIn("!syntheticConfirmed", component)
        self.assertIn("setSyntheticConfirmed(false)", component)
        self.assertIn("}, [caseId]);", component)

    def test_exception_is_informational_and_has_no_export_transport(self):
        component = source("RtmPresenterWorkspace.jsx")
        model = source("rtmPresenterModel.js")
        api = source("rtmPresenterApi.js")

        self.assertIn("Salida administrativa excepcional", component)
        self.assertIn("Esta pantalla no solicita contraseña", component)
        self.assertIn("ops.documents.export_exceptional", model)
        self.assertNotIn("operatorRole", component)
        self.assertNotIn("adminRole", component)
        self.assertNotIn("/api/ops/auth", api)
        self.assertNotIn("/reauthenticate", api)
        self.assertNotIn("/admin/cases/", api)
        self.assertNotIn("/exports", api)
        self.assertNotIn("reauthentication_evidence", component + api)
        self.assertNotIn("expectedPackageSha256", component + api)

    def test_exception_channel_is_closed_by_default_and_rejects_binary(self):
        api = source("rtmPresenterApi.js")
        component = source("RtmPresenterWorkspace.jsx")
        self.assertIn("El canal permanece cerrado", component)
        self.assertIn("ruta de exportación", component)
        self.assertNotIn("application/zip", api)

    def test_workspace_case_and_frozen_edits_are_fail_closed(self):
        component = source("RtmPresenterWorkspace.jsx")
        model = source("rtmPresenterModel.js")
        self.assertIn(
            'exactCaseId !== String(fallbackCaseId || "")', component
        )
        self.assertIn("Boolean(busyCommand) || Boolean(frozenPackage)", component)
        self.assertIn("disabled={editingLocked}", component)
        self.assertIn("Cambiar la selección", component)
        self.assertIn("supersedesPackageId", component)
        self.assertIn("supersedes_package_id", model)
        self.assertIn("El puente gestionado continúa cerrado", component)
        self.assertIn("No se han entregado bytes", component)
        self.assertIn("ALLOWED_DOCUMENT_KEYS", component)
        self.assertIn("!ALLOWED_DOCUMENT_KEYS.has(key)", component)
        self.assertIn("ALLOWED_PACKAGE_KEYS", component)
        self.assertIn("ALLOWED_PACKAGE_ITEM_KEYS", component)
        for field in (
            "document_version_id",
            "logical_document_id",
            "original_filename",
            "synthetic_only",
        ):
            self.assertIn(f'"{field}"', component)

    def test_frozen_package_projection_does_not_require_delivery_destination(self):
        component = source("RtmPresenterWorkspace.jsx")
        package_projection = component.split(
            "function packageFromResponse", 1
        )[1].split("function deliveryFromResponse", 1)[0]

        self.assertIn("ALLOWED_PACKAGE_KEYS", package_projection)
        self.assertIn("ALLOWED_PACKAGE_ITEM_KEYS", package_projection)
        self.assertIn("value.items.some", package_projection)
        self.assertIn("value.destination_profile_id", package_projection)
        self.assertIn("value.portal_origin", package_projection)
        self.assertIn("exactResponseItems", package_projection)
        self.assertNotIn("!value.destination", package_projection)
        self.assertNotIn(
            "ALLOWED_DELIVERY_DESTINATION_KEYS", package_projection
        )

        delivery_projection = component.split(
            "function deliveryFromResponse", 1
        )[1].split("export default function RtmPresenterWorkspace", 1)[0]
        self.assertIn("!value.destination", delivery_projection)
        self.assertIn(
            "ALLOWED_DELIVERY_DESTINATION_KEYS", delivery_projection
        )

    def test_operator_surface_is_a_guided_human_filing_flow(self):
        component = source("RtmPresenterWorkspace.jsx")
        css = source("rtmPresenter.css")

        for visible_step in (
            "Contenedor del expediente",
            "Documentos disponibles en RTM",
            "Elige cómo sale el expediente",
            "Presentar un escrito o recurso",
            "RTM CORRESPONDENCIA",
            "Enviar una reclamación desde OPS",
            "Buscar sede por organismo o municipio",
            "Buscar empresa, organismo o correo verificado",
            "Sede y procedimiento",
            "Abrir sede en otra pestaña",
            "Entra en la sede y sigue lo que vaya solicitando",
            "La sede pide el archivo; tú lo eliges desde RTM",
            "La sede muestra «Elegir archivo»",
            "La extensión ofrece «Adjuntar desde RTM»",
            "No se prepara un paquete ni una carpeta en el PC",
            "PUENTE PENDIENTE",
            "Traer el justificante al expediente por una de dos vías",
            "Capturar al descargar en la sede",
            "Incorporar justificante a RTM",
            "Conciliar la copia recibida por correo",
            "Estado inicial de ambas vías: pendiente de verificación",
            "Documentos que acompañarán al correo",
            "Elegir desde RTM",
            "Revisar los adjuntos de Correspondencia",
            "Fijar adjuntos elegidos",
            "Empresa jurídica",
            "Canal oficial",
            "Guardar borrador auditado",
            "Revisar y enviar · bloqueado en staging",
            "Preparando",
            "Adjuntos vinculados",
            "Pendiente de envío humano",
            "Pendiente de justificante",
            "Verificar justificante y activar seguimiento",
        ):
            self.assertIn(visible_step, component)
        self.assertIn('className="rtmp-flow-progress"', component)
        self.assertIn('className="rtmp-technical-details"', component)
        self.assertIn('className="rtmp-selected-details"', component)
        self.assertIn("externalPanelOpen", component)
        self.assertIn("openExternalPanel(preferredExternalPurpose(field))", component)
        self.assertIn('setProfileId("");', component)
        self.assertNotIn("setProfileId(next.destinations[0]", component)
        for document_label in (
            "Multa o notificación",
            "Documento de identidad",
            "Recurso o escrito principal",
            "Autorización de representación",
        ):
            self.assertIn(document_label, component)
        self.assertIn(".rtmp-flow-progress", css)
        self.assertIn(".rtmp-destination-search", css)
        self.assertIn(".rtmp-ingest-panel", css)
        self.assertIn(".rtmp-field-status", css)
        self.assertIn(".rtmp-container-list", css)
        self.assertIn(".rtmp-channel-grid", css)
        self.assertIn(".rtmp-correspondence-composer", css)
        self.assertIn(".rtmp-portal-attach-steps", css)
        self.assertIn(".rtmp-receipt-paths", css)
        self.assertIn(".rtmp-status-timeline", css)
        self.assertIn("operador no puede pegar una URL", component)
        self.assertIn("verificación independiente", component)
        self.assertIn("Todavía no contiene el catálogo real de DGT", component)

    def test_portal_is_reactive_and_never_freezes_a_package(self):
        component = source("RtmPresenterWorkspace.jsx")
        freeze_function = component.split("async function freezePackage()", 1)[1].split(
            "async function prepareSelectedDelivery()", 1
        )[0]
        prepare_function = component.split(
            "async function prepareSelectedDelivery()", 1
        )[1].split("if (!boundary.allowed)", 1)[0]
        portal_surface = component.split(
            '{deliveryChannel === "portal" && profile ? (', 1
        )[1].split(
            '{(deliveryChannel === "email" && profile) || externalPanelOpen ? (',
            1,
        )[0]

        self.assertIn('deliveryChannel !== "email"', freeze_function)
        self.assertIn('deliveryChannel !== "email"', prepare_function)
        self.assertNotIn("freezePackage()", portal_surface)
        self.assertNotIn("updateFieldSelection", portal_surface)
        self.assertNotIn("frozenPackage.items", portal_surface)
        self.assertIn("setPortalOpened(true)", portal_surface)
        self.assertIn('target="_blank"', portal_surface)
        self.assertIn('rel="noopener noreferrer"', portal_surface)
        self.assertIn("<PortalReceiptCapturePanel />", portal_surface)

    def test_receipt_capture_has_two_pending_fail_closed_routes(self):
        component = source("RtmPresenterWorkspace.jsx")
        panel = component.split("function PortalReceiptCapturePanel", 1)[1].split(
            "export default function RtmPresenterWorkspace", 1
        )[0]

        self.assertIn("DESDE LA SEDE", panel)
        self.assertIn("DESDE EL CORREO", panel)
        self.assertIn("Incorporar justificante a RTM", panel)
        self.assertIn("Conciliar copia recibida por correo", panel)
        self.assertIn("pendiente de verificación", panel)
        self.assertIn("no acredita por sí solo la presentación", panel)
        self.assertIn("Puente cerrado en staging", panel)
        self.assertIn("Conciliador cerrado en staging", panel)
        self.assertGreaterEqual(panel.count("disabled"), 2)
        self.assertNotIn("onClick=", panel)

    def test_timeline_never_invents_receipt_or_deadline_state(self):
        component = source("RtmPresenterWorkspace.jsx")
        timeline = component.split("function PresenterStatusTimeline", 1)[1].split(
            "export default function RtmPresenterWorkspace", 1
        )[0]

        self.assertIn('state: "pending"', timeline)
        self.assertIn('state: "blocked"', timeline)
        self.assertIn("No existe todavía un justificante conciliado por RTM", timeline)
        self.assertIn("fecha del seguimiento operativo", timeline)
        self.assertIn("Los plazos legales se mostrarán únicamente", timeline)
        self.assertNotIn("receiptVerified", timeline)
        self.assertNotIn("deadlineStartedAt", timeline)

    def test_staging_synthetic_boundary_and_transport_are_fail_closed(self):
        component = source("RtmPresenterWorkspace.jsx")
        model = source("rtmPresenterModel.js")
        api = source("rtmPresenterApi.js")
        page = (ROOT / "src" / "pages" / "OpsPresenterPage.jsx").read_text(
            encoding="utf-8"
        )
        self.assertIn("STAGING · SOLO CASOS SINTÉTICOS", component)
        self.assertIn('environment !== "staging"', model)
        self.assertIn("syntheticOnly !== true", model)
        self.assertIn('credentials: "same-origin"', api)
        self.assertIn('cache: "no-store"', api)
        self.assertNotIn("localStorage", component + api + model + page)
        self.assertNotIn("sessionStorage", component + api + model + page)
        self.assertNotIn("https://", api)
        self.assertIn("individual_login_enabled !== true", page)

    def test_workspace_is_not_a_nested_main_landmark(self):
        component = source("RtmPresenterWorkspace.jsx")
        self.assertNotIn("<main", component)
        self.assertNotIn("</main>", component)


if __name__ == "__main__":
    unittest.main()
