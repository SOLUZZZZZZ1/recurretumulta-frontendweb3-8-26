from pathlib import Path
import unittest


ROOT = Path(__file__).resolve().parents[1]
APP = (ROOT / "src" / "App.jsx").read_text(encoding="utf-8")
AUTH = (ROOT / "src" / "ops-auth" / "OpsAuthContext.jsx").read_text(
    encoding="utf-8"
)
AUTH_API = (ROOT / "src" / "ops-auth" / "opsAuthApi.js").read_text(
    encoding="utf-8"
)
AUTHORIZATION = (
    ROOT / "src" / "ops-auth" / "opsAuthorization.js"
).read_text(encoding="utf-8")
OPS_PAGES = tuple(
    ROOT / "src" / "pages" / name
    for name in (
        "OpsDashboard.jsx",
        "OpsFollowups.jsx",
        "OPSQueueSmart.jsx",
        "OpsVehicleRemoval.jsx",
        "OpsCaseDetail.jsx",
        "OpsCaseDetailPro.jsx",
        "OpsPresenterPage.jsx",
        "AdminRestaurantes.jsx",
    )
)


class OpsIndividualAuthFrontendContractTest(unittest.TestCase):
    def test_one_memory_only_provider_wraps_every_general_ops_route(self):
        self.assertIn("OpsWorkspaceRoute", APP)
        self.assertIn("<Route element={<OpsWorkspaceRoute />}>", APP)
        for route in (
            'path="/ops"',
            'path="/ops/followups"',
            'path="/ops/queue-smart"',
            'path="/ops/vehicle-removal"',
            'path="/ops/case/:caseId"',
            'path="/ops/case/:caseId/presenter"',
            'path="/ops/review/:caseId"',
            'path="/__admin-restaurantes"',
        ):
            self.assertIn(route, APP)
        self.assertIn("const bearerRef = useRef", AUTH)
        self.assertNotIn("setSession(authenticated)", AUTH)
        session_projection = AUTH.split("setSession({", 1)[1].split("});", 1)[0]
        self.assertNotIn("bearerToken", session_projection)
        self.assertNotIn("localStorage", AUTH + AUTH_API)
        self.assertNotIn("sessionStorage", AUTH + AUTH_API)
        self.assertNotIn("document.cookie", AUTH + AUTH_API)

    def test_general_ops_requires_permission_and_exact_operational_role(self):
        self.assertIn('OPS_VIEW_PERMISSION = "ops.view"', AUTHORIZATION)
        self.assertIn('new Set(["rtm.operator", "rtm.supervisor"])', AUTHORIZATION)
        self.assertIn("canAccessOpsWorkspace(authenticated.operator)", AUTH)
        self.assertIn('operator?.roleCode === "rtm.supervisor"', AUTHORIZATION)
        self.assertIn("canSuperviseOpsWorkspace(session?.operator)", AUTH)

    def test_restaurant_admin_uses_only_the_individual_supervisor_session(self):
        restaurant_admin = (
            ROOT / "src" / "pages" / "AdminRestaurantes.jsx"
        ).read_text(encoding="utf-8")
        self.assertIn("useOpsAuth", restaurant_admin)
        self.assertIn("authFetch", restaurant_admin)
        self.assertIn("canSupervise", restaurant_admin)
        self.assertIn("createLockRef.current", restaurant_admin)
        self.assertNotIn("sessionStorage", restaurant_admin)
        self.assertNotIn("admin_token", restaurant_admin.lower())
        self.assertNotIn("x-admin-token", restaurant_admin.lower())

    def test_device_is_server_managed_and_every_request_is_same_origin(self):
        self.assertIn('credentials: "same-origin"', AUTH_API)
        self.assertIn("deviceId: payload.device_id", AUTH_API)
        self.assertNotIn("device_token", AUTH_API)
        self.assertIn('url.startsWith("/api/")', AUTH_API)
        self.assertIn('Object.freeze(["/api/ops/"])', AUTH_API)
        self.assertIn("OPS_AUTHENTICATED_PATH_PREFIXES.some", AUTH_API)
        self.assertIn('target.origin !== "https://rtm.invalid"', AUTH_API)
        self.assertIn('headers.delete("Authorization")', AUTH_API)
        self.assertIn('headers.delete("X-Operator-Token")', AUTH_API)
        self.assertIn('headers.delete("X-RTM-Device")', AUTH_API)
        self.assertIn('headers.set("Authorization"', AUTH_API)
        self.assertIn('cache: "no-store"', AUTH_API)
        self.assertIn('mode: "same-origin"', AUTH_API)
        self.assertIn('redirect: "error"', AUTH_API)
        self.assertIn("buildOpsAuthenticatedRequest", AUTH)

    def test_all_general_ops_pages_use_the_shared_authenticated_transport(self):
        combined = "\n".join(path.read_text(encoding="utf-8") for path in OPS_PAGES)
        for forbidden in (
            "ops_token",
            "X-Operator-Token",
            "PIN operador",
            "/api/ops/login",
            "/ops/login",
        ):
            self.assertNotIn(forbidden, combined)
        for path in OPS_PAGES:
            self.assertIn("useOpsAuth", path.read_text(encoding="utf-8"), path.name)

    def test_first_login_and_remote_logout_are_shared_by_ops_and_presenter(self):
        self.assertIn("InitialPasswordCard", AUTH)
        self.assertIn("changeTemporaryOperatorPassword", AUTH)
        self.assertIn("authenticated.operator.mustChangePassword", AUTH)
        self.assertIn(
            "if (!controller.signal.aborted && mountedRef.current)", AUTH
        )
        self.assertIn("logoutOpsOperator", AUTH)
        self.assertIn("keepalive: true", AUTH)
        presenter = (ROOT / "src" / "pages" / "OpsPresenterPage.jsx").read_text(
            encoding="utf-8"
        )
        self.assertIn("fetchImpl: authFetch", presenter)
        self.assertIn("apiClient={presenterClient}", presenter)
        self.assertNotIn("getAuthHeaders", AUTH)

    def test_retired_shared_login_is_explicit_and_legacy_flag_is_not_authority(self):
        onboarding = (
            ROOT / "src" / "rtm-presenter" / "rtmOperatorOnboardingApi.js"
        ).read_text(encoding="utf-8")
        combined = AUTH + AUTH_API + onboarding
        self.assertNotIn("legacy_login_unchanged", combined)
        self.assertGreaterEqual(
            combined.count("shared_ops_login_accepted !== false"),
            3,
        )

    def test_supervisor_automation_and_retired_bridges_fail_closed(self):
        dashboard = (ROOT / "src" / "pages" / "OpsDashboard.jsx").read_text(
            encoding="utf-8"
        )
        detail = (ROOT / "src" / "pages" / "OpsCaseDetail.jsx").read_text(
            encoding="utf-8"
        )
        pro = (ROOT / "src" / "pages" / "OpsCaseDetailPro.jsx").read_text(
            encoding="utf-8"
        )
        legacy_detail = (
            ROOT / "src" / "components" / "OpsCaseDetail.jsx"
        ).read_text(encoding="utf-8")
        vehicle = (ROOT / "src" / "pages" / "OpsVehicleRemoval.jsx").read_text(
            encoding="utf-8"
        )
        self.assertIn("canSupervise", dashboard)
        self.assertIn("if(!canSupervise||tickLockRef.current)return", dashboard)
        self.assertIn("const canManageLegacy = canSupervise", detail)
        self.assertIn("const canManageLegacy = canSupervise", pro)
        self.assertIn("const canManageLegacy = canSupervise", vehicle)
        self.assertNotIn("/billing/status/", detail)
        self.assertNotIn("/ai/expediente/run", pro)
        self.assertNotIn("/upload-receipt", pro)
        self.assertNotIn("/save-ai-overrides", pro)
        self.assertNotIn("/override-family-and-regenerate", pro)
        self.assertNotIn("/rewrite-hecho-and-regenerate", pro)
        self.assertNotIn("/mark-paid", vehicle)
        self.assertIn("mutationLockRef.current", vehicle)
        self.assertIn("setAssigning(caseId)", vehicle)
        self.assertIn("setCompleting(caseId)", vehicle)
        self.assertNotIn("/mark-submitted", legacy_detail)
        self.assertNotIn("/upload-justificante", legacy_detail)
        self.assertIn("Pago pendiente de confirmación externa", vehicle)
        self.assertIn("Reanálisis CORE pendiente", pro)
        self.assertIn("Edición CORE pendiente", pro)
        self.assertIn("Aprobación CORE pendiente", pro)
        self.assertIn("El justificante se incorpora desde RTM Presenter", pro)
        self.assertIn("caseControlsDisabled", pro)
        self.assertIn("simulación: no se guardan y se perderán al salir", pro)
        self.assertNotIn("LISTO PARA ENVIAR", pro)
        self.assertIn("DOCUMENTACIÓN COMPLETA · REVISIÓN PENDIENTE", pro)
        self.assertNotIn("window.open", pro)
        self.assertIn("Abrir sede · activación pendiente", pro)


if __name__ == "__main__":
    unittest.main()
