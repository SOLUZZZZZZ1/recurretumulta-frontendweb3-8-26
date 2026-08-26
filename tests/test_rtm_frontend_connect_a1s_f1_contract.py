from __future__ import annotations

import hashlib
import importlib.util
import json
import shutil
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "src/lib/rtmConnectA1SReadContract.js"
CLIENT = ROOT / "src/lib/rtmConnectA1SReadClient.js"
DOC = ROOT / "docs/rtm_connect/RTM_FRONTEND_CONNECT_A1S_F1.md"
EVIDENCE = ROOT / "docs/rtm_connect/RTM_FRONTEND_CONNECT_A1S_F1_EVIDENCE.json"
PREFLIGHT = ROOT / "scripts/rtm_frontend_connect_a1s_f1_preflight.py"


def load_preflight():
    spec = importlib.util.spec_from_file_location("rtm_frontend_a1s_f1_preflight", PREFLIGHT)
    module = importlib.util.module_from_spec(spec)
    assert spec and spec.loader
    spec.loader.exec_module(module)
    return module


def run_node(source: str) -> dict:
    node = shutil.which("node")
    if not node:
        raise unittest.SkipTest("node no disponible")
    completed = subprocess.run(
        [node, "--input-type=module", "--eval", source],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=15,
    )
    if completed.returncode != 0:
        raise AssertionError(
            f"node failed ({completed.returncode}):\n{completed.stdout}\n{completed.stderr}"
        )
    return json.loads(completed.stdout)


class FrontendA1SF1IdentityTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.preflight = load_preflight()
        cls.evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))

    def test_contract_identity_is_exact(self):
        text = CONTRACT.read_text(encoding="utf-8")
        self.assertIn("rtm.connect.frontend.a1s.read.v1", text)
        self.assertIn("rtm.connect.a1s.human_filing.v1", text)
        self.assertIn("92aeac70f93d7f1df645019b0e7f3d83b230ea4d", text)
        self.assertIn("eb5ead955ba54bcb829c56ee9afdc5c939ec36da", text)

    def test_base_identity_is_exact(self):
        self.assertEqual(
            self.preflight.BASE_ARCHIVE_SHA256,
            "d9e032668f2c1dce22196c3d1a801cf31e90afb289c4c24c7b7b9233870e64d5",
        )
        self.assertEqual(
            self.preflight.BASE_COMMIT_SHA40,
            "92aeac70f93d7f1df645019b0e7f3d83b230ea4d",
        )
        self.assertEqual(self.preflight.EXPECTED_BASE_FILES, 90)

    def test_overlay_allowlist_is_six_paths(self):
        self.assertEqual(len(self.preflight.OVERLAY_PATHS), 6)
        self.assertEqual(self.evidence["overlay_paths"], list(self.preflight.OVERLAY_PATHS))

    def test_evidence_hashes_every_non_self_overlay_file(self):
        expected = set(self.preflight.OVERLAY_PATHS) - {
            self.preflight.EVIDENCE_PATH
        }
        self.assertEqual(set(self.evidence["file_sha256"]), expected)
        for name, digest in self.evidence["file_sha256"].items():
            actual = hashlib.sha256((ROOT / name).read_bytes()).hexdigest()
            self.assertEqual(actual, digest, name)


class FrontendA1SF1StaticBoundaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.contract = CONTRACT.read_text(encoding="utf-8")
        cls.client = CLIENT.read_text(encoding="utf-8")
        cls.joined = cls.contract + "\n" + cls.client

    def test_all_fourteen_backend_states_are_frozen(self):
        statuses = {
            "prepared",
            "assigned",
            "reviewing",
            "ready_for_release",
            "released",
            "in_progress",
            "awaiting_receipt",
            "outcome_unknown",
            "reconciling",
            "receipt_submitted",
            "verified",
            "completed",
            "manual_review",
            "permanent_failed",
        }
        for status in statuses:
            self.assertIn(f'"{status}"', self.contract)

    def test_client_contains_only_get_transport(self):
        self.assertIn('method: "GET"', self.client)
        for method in ("POST", "PUT", "PATCH", "DELETE"):
            self.assertNotIn(f'method: "{method}"', self.client)

    def test_client_is_same_origin_and_no_store(self):
        self.assertIn('cache: "no-store"', self.client)
        self.assertIn('credentials: "same-origin"', self.client)
        self.assertIn('redirect: "error"', self.client)
        self.assertNotIn("http://", self.client)
        self.assertNotIn("https://", self.client)

    def test_no_persistent_or_legacy_token_storage(self):
        for token in (
            "localStorage",
            "sessionStorage",
            "document.cookie",
            "ops_token",
            "X-Operator-Token",
        ):
            self.assertNotIn(token, self.joined)

    def test_no_generic_exported_request(self):
        self.assertNotIn("export function request", self.client)
        self.assertNotIn("export async function request", self.client)

    def test_read_surface_is_closed(self):
        for method in (
            "operatorMe",
            "tenants",
            "tenantContext",
            "preparationOptions",
            "tasks",
            "task",
            "receiptOptions",
        ):
            self.assertIn(f"async {method}", self.client)

    def test_runtime_entries_do_not_import_f1(self):
        for name in (
            "src/App.jsx",
            "src/main.jsx",
            "src/pages/OpsCaseDetail.jsx",
            "src/pages/OpsCaseDetailPro.jsx",
            "src/components/OpsCaseDetail.jsx",
        ):
            text = (ROOT / name).read_text(encoding="utf-8")
            self.assertNotIn("rtmConnectA1SRead", text, name)
            self.assertNotIn("RTM_CONNECT_A1S", text, name)

    def test_package_has_no_f1_runtime_script_or_dependency(self):
        package = json.loads((ROOT / "package.json").read_text(encoding="utf-8"))
        self.assertNotIn("a1s", json.dumps(package, sort_keys=True).lower())

    def test_visual_files_are_outside_overlay(self):
        paths = set(load_preflight().OVERLAY_PATHS)
        self.assertFalse(any(path.endswith(".css") for path in paths))
        self.assertFalse(any(path.startswith("public/") for path in paths))
        self.assertFalse(any(path.startswith("src/pages/") for path in paths))


class FrontendA1SF1JavascriptContractTests(unittest.TestCase):
    def test_javascript_files_parse(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("node no disponible")
        for path in (CONTRACT, CLIENT):
            completed = subprocess.run(
                [node, "--check", str(path)],
                cwd=ROOT,
                capture_output=True,
                text=True,
                timeout=15,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)

    def test_gate_accepts_only_exact_synthetic_staging_matrix(self):
        result = run_node(
            """
            import { evaluateA1SFrontendGate as gate } from './src/lib/rtmConnectA1SReadContract.js';
            const base = {
              hostname: 'recurretumulta-frontend-staging.vercel.app',
              protocol: 'https:', port: '',
              buildTarget: 'a1s-synthetic-read', environment: 'staging', uiEnabled: '1',
              operatorAuthEnabled: '1',
              frontendBaseCommit: '92aeac70f93d7f1df645019b0e7f3d83b230ea4d',
              backendCommit: 'eb5ead955ba54bcb829c56ee9afdc5c939ec36da',
              backendContractVersion: 'rtm.connect.a1s.human_filing.v1',
              documentInputPolicy: 'synthetic_only', realDataAllowed: '0',
              externalEffectsAllowed: '0', providerAllowed: '0',
              administrationContactAllowed: '0', ocuContactAllowed: '0',
              b2Allowed: '0', productionAuthorized: '0'
            };
            const valid = gate(base);
            const production = gate({...base, hostname: 'recurretumulta.eu'});
            const nearHost = gate({...base, hostname: 'recurretumulta-frontend-staging.vercel.app.attacker.test'});
            const localhost = gate({...base, hostname: 'localhost'});
            const http = gate({...base, protocol: 'http:'});
            const port = gate({...base, port: '443'});
            const realData = gate({...base, realDataAllowed: '1'});
            console.log(JSON.stringify({valid, production, nearHost, localhost, http, port, realData}));
            """
        )
        self.assertTrue(result["valid"]["allowed"])
        self.assertFalse(result["production"]["allowed"])
        self.assertFalse(result["nearHost"]["allowed"])
        self.assertFalse(result["localhost"]["allowed"])
        self.assertFalse(result["http"]["allowed"])
        self.assertFalse(result["port"]["allowed"])
        self.assertFalse(result["realData"]["allowed"])
        self.assertEqual(result["valid"]["liveVerdict"], "no_go")

    def test_gate_requires_every_false_boundary_explicitly(self):
        result = run_node(
            """
            import { evaluateA1SFrontendGate as gate } from './src/lib/rtmConnectA1SReadContract.js';
            const value = gate({
              hostname: 'recurretumulta-frontend-staging.vercel.app',
              protocol: 'https:', port: '', buildTarget: 'a1s-synthetic-read',
              environment: 'staging', uiEnabled: '1',
              documentInputPolicy: 'synthetic_only'
            });
            console.log(JSON.stringify(value));
            """
        )
        self.assertFalse(result["allowed"])
        self.assertGreaterEqual(len(result["blockers"]), 7)

    def test_gate_rejects_wrong_identity_feature_and_auth(self):
        result = run_node(
            """
            import { evaluateA1SFrontendGate as gate } from './src/lib/rtmConnectA1SReadContract.js';
            const base = {
              hostname: 'recurretumulta-frontend-staging.vercel.app', protocol: 'https:', port: '',
              buildTarget: 'a1s-synthetic-read', environment: 'staging', uiEnabled: '1',
              operatorAuthEnabled: '1', documentInputPolicy: 'synthetic_only',
              frontendBaseCommit: '92aeac70f93d7f1df645019b0e7f3d83b230ea4d',
              backendCommit: 'eb5ead955ba54bcb829c56ee9afdc5c939ec36da',
              backendContractVersion: 'rtm.connect.a1s.human_filing.v1', realDataAllowed: '0',
              externalEffectsAllowed: '0', providerAllowed: '0', administrationContactAllowed: '0',
              ocuContactAllowed: '0', b2Allowed: '0', productionAuthorized: '0'
            };
            console.log(JSON.stringify({
              wrongFrontend: gate({...base, frontendBaseCommit: '0'.repeat(40)}),
              wrongBackend: gate({...base, backendCommit: '0'.repeat(40)}),
              wrongContract: gate({...base, backendContractVersion: 'other'}),
              featureOff: gate({...base, uiEnabled: '0'}),
              authOff: gate({...base, operatorAuthEnabled: '0'}),
              production: gate({...base, environment: 'production'})
            }));
            """
        )
        for value in result.values():
            self.assertFalse(value["allowed"])

    def test_unsafe_runtime_claim_is_rejected(self):
        result = run_node(
            """
            import { assertSafeA1SEnvelope } from './src/lib/rtmConnectA1SReadContract.js';
            let code = null;
            try { assertSafeA1SEnvelope({ok:true, synthetic_only:true, nested:{production_authorized:true}}); }
            catch (error) { code = error.code; }
            console.log(JSON.stringify({code}));
            """
        )
        self.assertEqual(result["code"], "a1s.unsafe_runtime_claim")

    def test_non_synthetic_claim_is_rejected(self):
        result = run_node(
            """
            import { assertSafeA1SEnvelope } from './src/lib/rtmConnectA1SReadContract.js';
            let code = null;
            try { assertSafeA1SEnvelope({ok:true, synthetic_only:false}); }
            catch (error) { code = error.code; }
            console.log(JSON.stringify({code}));
            """
        )
        self.assertEqual(result["code"], "a1s.synthetic_claim_invalid")

    def test_generic_ok_envelope_and_camel_case_production_alias_are_rejected(self):
        result = run_node(
            """
            import { assertSafeA1SEnvelope } from './src/lib/rtmConnectA1SReadContract.js';
            const rejected = value => {
              try { assertSafeA1SEnvelope(value); return null; }
              catch (error) { return error.code; }
            };
            console.log(JSON.stringify({
              generic: rejected({ok:true}),
              camel: rejected({ok:true, synthetic_only:true, productionAuthorized:true})
            }));
            """
        )
        self.assertEqual(result["generic"], "a1s.synthetic_boundary_missing")
        self.assertEqual(result["camel"], "a1s.unsafe_runtime_claim")

    def test_operator_role_null_is_valid_but_unavailable_auth_status_is_rejected(self):
        result = run_node(
            """
            import {
              assertOperatorMeEnvelope, assertOperatorAuthStatusEnvelope
            } from './src/lib/rtmConnectA1SReadContract.js';
            const id='11111111-1111-4111-8111-111111111111';
            let roleNull=false, authCode=null, redacted=false;
            try {
              const session=assertOperatorMeEnvelope({ok:true,session_id:id,
                expires_at:'2027-01-01T00:00:00Z',absolute_expires_at:'2027-01-02T00:00:00Z',
                operator:{id,email:'operador@example.com',display_name:'Operador',role_code:null,
                permissions:[],must_change_password:false,mfa_required:false}});
              roleNull=session.operator.role_code === null;
              redacted=!('email' in session.operator) && !('permissions' in session.operator);
            } catch {}
            try {
              assertOperatorAuthStatusEnvelope({ok:true,version:'v1',staging_only:true,
                legacy_login_unchanged:true,
                operator_creation_available:false,individual_login_enabled:false,
                configuration_valid:true});
            } catch(error) { authCode=error.code; }
            console.log(JSON.stringify({roleNull,redacted,authCode}));
            """
        )
        self.assertTrue(result["roleNull"])
        self.assertTrue(result["redacted"])
        self.assertEqual(result["authCode"], "a1s.operator_auth_unavailable")

    def test_unknown_tenant_permissions_are_rejected(self):
        result = run_node(
            """
            import { assertTenantListEnvelope } from './src/lib/rtmConnectA1SReadContract.js';
            const id='11111111-1111-4111-8111-111111111111';
            let code=null;
            try { assertTenantListEnvelope({ok:true,request_id:'req-1',read_only:true,
              items_limit:50,items_truncated:false,items:[{tenant_id:id,tenant_code:'t',
              display_name:'Tenant',membership_id:id,principal_id:id,operator_id:id,
              role:'requester',permissions:['connect.human_filing.delete'],version:1}]}); }
            catch(error) { code=error.code; }
            console.log(JSON.stringify({code}));
            """
        )
        self.assertIsNotNone(result["code"])

    def test_receipt_options_reject_transport_content_and_provider_fields(self):
        result = run_node(
            """
            import { assertReceiptOptionsEnvelope } from './src/lib/rtmConnectA1SReadContract.js';
            const id='11111111-1111-4111-8111-111111111111';
            const base={document_id:id,document_sha256:'a'.repeat(64),
              kind:'rtm_connect_a1s_synthetic_receipt_fixture',media_type:'application/json',size_bytes:12};
            const rejected = extra => {
              try { assertReceiptOptionsEnvelope({ok:true,request_id:'req-1',tenant_id:id,task_id:id,
                options:[{...base,...extra}],options_limit:50,options_truncated:false,read_only:true},id,id); return false; }
              catch { return true; }
            };
            console.log(JSON.stringify({url:rejected({url:'https://example.test/r'}),
              content:rejected({content:'receipt'}),provider:rejected({provider:'ocu'})}));
            """
        )
        self.assertTrue(all(result.values()))

    def test_wrong_tenant_task_detail_is_rejected(self):
        result = run_node(
            """
            import { assertTaskProjection } from './src/lib/rtmConnectA1SReadContract.js';
            const a='11111111-1111-4111-8111-111111111111';
            const b='22222222-2222-4222-8222-222222222222';
            const task={task_id:a,tenant_id:b,case_binding_id:a,case_id:a,
              representation_evidence_id:a,action_id:a,attempt_id:a,connector_id:a,
              authorization_id:a,authorization_version:1,
              task_code:'rtm-a1s-human-'+'a'.repeat(24),status:'prepared',version:1,
              status_version:1,requester_membership_id:null,requester_principal_id:null,
              requester_operator_id:null,assignee_operator_id:null,assignee_membership_id:null,
              assignee_principal_id:null,release_operator_id:null,release_membership_id:null,
              release_principal_id:null,verified_by_operator_id:null,
              verified_by_membership_id:null,verified_by_principal_id:null,
              due_at:'2027-01-01T00:00:00Z',package_sha256:'a'.repeat(64),
              review_attestation_sha256:null,release_attestation_sha256:null,
              verification_attestation_sha256:null,external_reference:null,
              created_at:'2026-01-01T00:00:00Z',updated_at:'2026-01-01T00:00:00Z',
              replayed:false};
            let code=null;
            try { assertTaskProjection(task,a); } catch(error){ code=error.code; }
            console.log(JSON.stringify({code}));
            """
        )
        self.assertEqual(result["code"], "a1s.tenant_mismatch")

    def test_unknown_allowed_actions_are_never_exposed(self):
        result = run_node(
            """
            import { assertTaskDetailEnvelope } from './src/lib/rtmConnectA1SReadContract.js';
            const id='11111111-1111-4111-8111-111111111111';
            const nullableIds=['requester_membership_id','requester_principal_id','requester_operator_id',
              'assignee_operator_id','assignee_membership_id','assignee_principal_id','release_operator_id',
              'release_membership_id','release_principal_id','verified_by_operator_id',
              'verified_by_membership_id','verified_by_principal_id'];
            const task={task_id:id,tenant_id:id,case_binding_id:id,case_id:id,
              representation_evidence_id:id,action_id:id,attempt_id:id,connector_id:id,
              authorization_id:id,authorization_version:1,task_code:'rtm-a1s-human-'+'a'.repeat(24),
              status:'prepared',version:1,status_version:1,due_at:'2027-01-01T00:00:00Z',
              package_sha256:'a'.repeat(64),review_attestation_sha256:null,
              release_attestation_sha256:null,verification_attestation_sha256:null,
              external_reference:null,created_at:'2026-01-01T00:00:00Z',
              updated_at:'2026-01-01T00:00:00Z',replayed:false,
              package_manifest:null,approvals:[],artifacts_truncated:false,artifacts:[],
              receipt_summary:null,events_truncated:false,events:[],summary_limit:50,
              allowed_actions:['delete_everything'],allowed_actions_authoritative:false,
              commands_revalidate:true};
            for (const field of nullableIds) task[field]=null;
            let code=null;
            try { assertTaskDetailEnvelope({ok:true,request_id:'req-1',task},id,id); }
            catch(error) { code=error.code; }
            console.log(JSON.stringify({code}));
            """
        )
        self.assertIsNotNone(result["code"])

    def test_exact_backend_shaped_task_detail_is_accepted_and_action_hints_hidden(self):
        result = run_node(
            """
            import { assertTaskDetailEnvelope } from './src/lib/rtmConnectA1SReadContract.js';
            const id='11111111-1111-4111-8111-111111111111';
            const created='2026-01-01T00:00:00Z';
            const due='2027-01-01T00:00:00Z';
            const hash='a'.repeat(64);
            const task={task_id:id,tenant_id:id,case_binding_id:id,case_id:id,
              representation_evidence_id:id,action_id:id,attempt_id:id,connector_id:id,
              authorization_id:id,authorization_version:1,
              task_code:'rtm-a1s-human-'+'a'.repeat(24),status:'prepared',version:1,
              status_version:1,requester_membership_id:id,requester_principal_id:id,
              requester_operator_id:id,assignee_operator_id:null,assignee_membership_id:null,
              assignee_principal_id:null,release_operator_id:null,release_membership_id:null,
              release_principal_id:null,verified_by_operator_id:null,
              verified_by_membership_id:null,verified_by_principal_id:null,due_at:due,
              package_sha256:hash,review_attestation_sha256:null,
              release_attestation_sha256:null,verification_attestation_sha256:null,
              external_reference:null,created_at:created,updated_at:created,replayed:false,
              package_manifest:{contract_version:'rtm.connect.a1s.human_filing.v1',
                task_id:id,tenant_id:id,case_binding_id:id,representation_evidence_id:id,
                action_id:id,attempt_id:id,authorization_id:id,authorization_version:1,
                case_snapshot_sha256:hash,representation_evidence_sha256:hash,
                request_sha256:hash,document_hashes:[hash],
                destination_ref:'synthetic-a1s-administration',due_at:due,
                checklist:['confirm_synthetic_case_binding','confirm_frozen_core_authority',
                  'confirm_synthetic_representation','confirm_exact_package_hash',
                  'simulate_human_filing_without_external_contact','capture_synthetic_receipt',
                  'verify_receipt_with_independent_principal'],created_by_operator_id:id,
                created_at:created,synthetic_marker:'RTM_A1S_SYNTHETIC_ONLY',
                synthetic_only:true,network_used:false,b2_used:false,
                provider_contacted:false,legal_submission_executed:false},
              approvals:[],artifacts_truncated:false,artifacts:[],receipt_summary:null,
              events_truncated:false,events:[],summary_limit:50,
              allowed_actions:['assign_human_filing'],allowed_actions_authoritative:false,
              commands_revalidate:true};
            const value=assertTaskDetailEnvelope({ok:true,request_id:'req-1',task},id,id);
            console.log(JSON.stringify({ok:value.ok,actions:value.task.allowed_actions,
              synthetic:value.task.package_manifest.synthetic_only}));
            """
        )
        self.assertTrue(result["ok"])
        self.assertEqual(result["actions"], [])
        self.assertTrue(result["synthetic"])

    def test_read_client_builds_same_origin_task_list_get(self):
        result = run_node(
            """
            import { createRtmConnectA1SReadClient } from './src/lib/rtmConnectA1SReadClient.js';
            const tenant='11111111-1111-4111-8111-111111111111';
            const runtimeContext={hostname:'recurretumulta-frontend-staging.vercel.app',protocol:'https:',port:'',
              buildTarget:'a1s-synthetic-read',environment:'staging',uiEnabled:'1',operatorAuthEnabled:'1',
              documentInputPolicy:'synthetic_only',frontendBaseCommit:'92aeac70f93d7f1df645019b0e7f3d83b230ea4d',
              backendCommit:'eb5ead955ba54bcb829c56ee9afdc5c939ec36da',
              backendContractVersion:'rtm.connect.a1s.human_filing.v1',realDataAllowed:'0',
              externalEffectsAllowed:'0',providerAllowed:'0',administrationContactAllowed:'0',
              ocuContactAllowed:'0',b2Allowed:'0',productionAuthorized:'0'};
            const calls=[];
            const fetchImpl=async(path,options)=>{
              calls.push({path,options});
              if (path.endsWith('/auth/me')) return {ok:true,status:200,text:async()=>JSON.stringify({
                ok:true,session_id:tenant,expires_at:'2027-01-01T00:00:00Z',
                absolute_expires_at:'2027-01-02T00:00:00Z',operator:{id:tenant,
                email:'operator@example.com',display_name:'Operator',role_code:null,
                permissions:[],must_change_password:false,mfa_required:false}})};
              if (path.endsWith('/human-filings/tenants')) return {ok:true,status:200,
                text:async()=>JSON.stringify({ok:true,request_id:'req-tenant',read_only:true,
                items_limit:50,items_truncated:false,items:[{tenant_id:tenant,tenant_code:'t',
                display_name:'Synthetic tenant',membership_id:tenant,principal_id:tenant,
                operator_id:tenant,role:'requester',permissions:['connect.human_filing.read'],version:1}]})};
              return {ok:true,status:200,text:async()=>JSON.stringify({ok:true,request_id:'req-1',items:[],pagination:{limit:50,offset:0,total:0}})};
            };
            const client=createRtmConnectA1SReadClient({fetchImpl,bearerToken:'x'.repeat(64),runtimeContext});
            await client.operatorMe();
            await client.tenants();
            await client.tasks(tenant);
            console.log(JSON.stringify(calls[2]));
            """
        )
        self.assertEqual(result["options"]["method"], "GET")
        self.assertTrue(result["path"].startswith("/api/ops/connect/human-filings?"))
        self.assertIn("tenant_id=11111111-1111-4111-8111-111111111111", result["path"])
        self.assertNotIn("http", result["path"])

    def test_read_client_rejects_invalid_bearer(self):
        result = run_node(
            """
            import { createRtmConnectA1SReadClient } from './src/lib/rtmConnectA1SReadClient.js';
            const runtimeContext={hostname:'recurretumulta-frontend-staging.vercel.app',protocol:'https:',port:'',
              buildTarget:'a1s-synthetic-read',environment:'staging',uiEnabled:'1',operatorAuthEnabled:'1',
              documentInputPolicy:'synthetic_only',frontendBaseCommit:'92aeac70f93d7f1df645019b0e7f3d83b230ea4d',
              backendCommit:'eb5ead955ba54bcb829c56ee9afdc5c939ec36da',
              backendContractVersion:'rtm.connect.a1s.human_filing.v1',realDataAllowed:'0',
              externalEffectsAllowed:'0',providerAllowed:'0',administrationContactAllowed:'0',
              ocuContactAllowed:'0',b2Allowed:'0',productionAuthorized:'0'};
            let code=null;
            try { createRtmConnectA1SReadClient({fetchImpl:async()=>{},bearerToken:'short',runtimeContext}); }
            catch(error){ code=error.code; }
            console.log(JSON.stringify({code}));
            """
        )
        self.assertEqual(result["code"], "a1s.bearer_invalid")

    def test_read_client_requires_valid_runtime_gate_and_boolean_overdue(self):
        result = run_node(
            """
            import { createRtmConnectA1SReadClient } from './src/lib/rtmConnectA1SReadClient.js';
            const tenant='11111111-1111-4111-8111-111111111111';
            const valid={hostname:'recurretumulta-frontend-staging.vercel.app',protocol:'https:',port:'',
              buildTarget:'a1s-synthetic-read',environment:'staging',uiEnabled:'1',operatorAuthEnabled:'1',
              documentInputPolicy:'synthetic_only',frontendBaseCommit:'92aeac70f93d7f1df645019b0e7f3d83b230ea4d',
              backendCommit:'eb5ead955ba54bcb829c56ee9afdc5c939ec36da',
              backendContractVersion:'rtm.connect.a1s.human_filing.v1',realDataAllowed:'0',
              externalEffectsAllowed:'0',providerAllowed:'0',administrationContactAllowed:'0',
              ocuContactAllowed:'0',b2Allowed:'0',productionAuthorized:'0'};
            const attempt = context => {
              try { createRtmConnectA1SReadClient({fetchImpl:async()=>{},bearerToken:'x'.repeat(64),
                ...(context === undefined ? {} : {runtimeContext:context})}); return null; }
              catch(error) { return error.code; }
            };
            const fetchImpl=async(path)=>{
              if (path.endsWith('/auth/me')) return {ok:true,status:200,text:async()=>JSON.stringify({
                ok:true,session_id:tenant,expires_at:'2027-01-01T00:00:00Z',
                absolute_expires_at:'2027-01-02T00:00:00Z',operator:{id:tenant,
                email:'operator@example.com',display_name:'Operator',role_code:null,
                permissions:[],must_change_password:false,mfa_required:false}})};
              if (path.endsWith('/human-filings/tenants')) return {ok:true,status:200,
                text:async()=>JSON.stringify({ok:true,request_id:'req-tenant',read_only:true,
                items_limit:50,items_truncated:false,items:[{tenant_id:tenant,tenant_code:'t',
                display_name:'Synthetic tenant',membership_id:tenant,principal_id:tenant,
                operator_id:tenant,role:'requester',permissions:['connect.human_filing.read'],version:1}]})};
              throw new Error('unexpected fetch');
            };
            const unvalidated=createRtmConnectA1SReadClient({fetchImpl,bearerToken:'x'.repeat(64),runtimeContext:valid});
            let session=null;
            try { await unvalidated.tasks(tenant); } catch(error) { session=error.code; }
            const client=createRtmConnectA1SReadClient({fetchImpl,bearerToken:'x'.repeat(64),runtimeContext:valid});
            await client.operatorMe();
            await client.tenants();
            let overdue=null;
            try { await client.tasks(tenant,{overdueOnly:'false'}); }
            catch(error) { overdue=error.code; }
            console.log(JSON.stringify({missing:attempt(undefined),invalid:attempt({...valid,protocol:'http:'}),session,overdue}));
            """
        )
        self.assertIsNotNone(result["missing"])
        self.assertIsNotNone(result["invalid"])
        self.assertEqual(result["session"], "a1s.operator_session_not_validated")
        self.assertEqual(result["overdue"], "a1s.overdue_only_invalid")


class FrontendA1SF1EvidenceAndDocsTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))
        cls.doc = DOC.read_text(encoding="utf-8")

    def test_evidence_records_offline_contract_pass(self):
        self.assertEqual(self.evidence["status"], "passed_offline_contract")
        self.assertEqual(self.evidence["gate_status"], "passed_offline_contract")
        self.assertEqual(self.evidence["live_verdict"], "no_go")

    def test_evidence_keeps_every_effect_boundary_false(self):
        for field in (
            "runtime_wired",
            "routes_published",
            "mutations_available",
            "production_authorized",
            "production_safe",
            "real_data_used",
            "network_used",
            "provider_contacted",
            "administration_contacted",
            "ocu_contacted",
            "b2_used",
            "external_effects_executed",
            "visual_refresh_included",
            "banking_family_included",
        ):
            self.assertIs(self.evidence[field], False, field)

    def test_evidence_is_synthetic_read_only_and_offline(self):
        self.assertIs(self.evidence["synthetic_only"], True)
        self.assertIs(self.evidence["read_only"], True)
        self.assertIs(self.evidence["offline_only"], True)

    def test_evidence_does_not_overclaim_payload_origin_or_token_lineage(self):
        self.assertIs(self.evidence["synthetic_data_origin_frontend_verified"], False)
        self.assertIs(self.evidence["backend_synthetic_scope_authoritative"], True)
        self.assertIs(
            self.evidence["bearer_audience_cryptographically_verified_by_frontend"],
            False,
        )
        self.assertIs(self.evidence["runtime_context_cryptographically_attested"], False)

    def test_evidence_does_not_claim_legal_completion_and_records_windows_build(self):
        self.assertIs(self.evidence["legal_compliance_claimed"], False)
        self.assertEqual(self.evidence["frontend_build_status"], "passed")
        self.assertIs(self.evidence["windows_local_build_verification_required"], False)
        self.assertIs(self.evidence["windows_local_build_verification_completed"], True)
        self.assertIs(
            self.evidence["frontend_build_console_report_cryptographically_verified"],
            False,
        )
        self.assertEqual(self.evidence["frontend_build_result_source"], "operator_console_report")
        self.assertEqual(self.evidence["frontend_build_modules_transformed"], 75)
        self.assertEqual(len(self.evidence["frontend_build_warnings"]), 3)

    def test_docs_separate_f1_f2_f3(self):
        self.assertIn("F1 — contrato offline", self.doc)
        self.assertIn("F2 — acceso sintético privado", self.doc)
        self.assertIn("F3 — flujo asistido", self.doc)

    def test_docs_record_no_runtime_wiring(self):
        self.assertIn("no está importado desde", self.doc)
        self.assertIn(
            "La ausencia de cableado de aplicación forma parte del cierre F1",
            self.doc,
        )

    def test_docs_defer_banking_family_to_separate_overlay(self):
        self.assertIn("Bancos y servicios financieros", self.doc)
        self.assertIn("`banca`", self.doc)
        self.assertIn("`claims.banking`", self.doc)

    def test_docs_freeze_ai_act_transparency_and_literacy_sources(self):
        self.assertIn("Artículo 4 — alfabetización en IA", self.doc)
        self.assertIn("Artículo 50 — transparencia", self.doc)
        self.assertIn("Anexo III — administración de justicia y ADR", self.doc)

    def test_docs_require_effective_human_review(self):
        self.assertIn("revisión humana real, competente y con autoridad", self.doc)
        self.assertIn("decisiones exclusivamente automatizadas", self.doc)
        self.assertIn("solicitar revisión humana", self.doc)

    def test_docs_require_generated_image_label(self):
        self.assertIn(
            "Imagen ilustrativa generada con inteligencia artificial.",
            self.doc,
        )


class FrontendA1SF1PreflightUnitTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.preflight = load_preflight()

    def test_safe_member_rejects_traversal_and_windows_paths(self):
        for value in ("../x", "/x", "C:/x", "a\\b", "a/../b"):
            self.assertFalse(self.preflight._safe_member(value), value)
        self.assertTrue(self.preflight._safe_member("src/lib/example.js"))

    def test_newline_canonical_comparison_is_narrow(self):
        self.assertEqual(
            self.preflight._compare_content(b"a\nb\n", b"a\r\nb\r\n"),
            "newline_canonical",
        )
        self.assertIsNone(self.preflight._compare_content(b"a\n", b"b\n"))

    def test_binary_comparison_requires_raw_identity(self):
        self.assertEqual(self.preflight._compare_content(b"\xff", b"\xff"), "raw")
        self.assertIsNone(self.preflight._compare_content(b"\xff", b"\xfe"))

    def test_blocked_output_never_claims_authority(self):
        result = self.preflight._blocked(self.preflight.PreflightBlocked("test"))
        self.assertFalse(result["ok"])
        self.assertFalse(result["safe"])
        self.assertFalse(result["production_authorized"])
        self.assertFalse(result["routes_published"])
        self.assertEqual(result["live_verdict"], "no_go")


if __name__ == "__main__":
    unittest.main()
