from __future__ import annotations

import hashlib
import importlib.util
import json
import re
import shutil
import subprocess
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
CONTRACT = ROOT / "src/lib/rtmConnectA1SF2Contract.js"
RUNTIME = ROOT / "src/lib/rtmConnectA1SF2Runtime.js"
PAGE = ROOT / "src/pages/OpsA1SSyntheticReadOnly.jsx"
APP = ROOT / "src/App.jsx"
DOC = ROOT / "docs/rtm_connect/RTM_FRONTEND_CONNECT_A1S_F2.md"
EVIDENCE = ROOT / "docs/rtm_connect/RTM_FRONTEND_CONNECT_A1S_F2_EVIDENCE.json"
PREFLIGHT = ROOT / "scripts/rtm_frontend_connect_a1s_f2_preflight.py"

EXPECTED_OVERLAY_PATHS = (
    "docs/rtm_connect/RTM_FRONTEND_CONNECT_A1S_F2.md",
    "docs/rtm_connect/RTM_FRONTEND_CONNECT_A1S_F2_EVIDENCE.json",
    "scripts/rtm_frontend_connect_a1s_f2_preflight.py",
    "src/App.jsx",
    "src/lib/rtmConnectA1SF2Contract.js",
    "src/lib/rtmConnectA1SF2Runtime.js",
    "src/pages/OpsA1SSyntheticReadOnly.jsx",
    "tests/test_rtm_frontend_connect_a1s_f2_contract.py",
)


JS_FIXTURE = r"""
import {
  RTM_CONNECT_A1S_F2_BASE_ARCHIVE_SHA256,
  RTM_CONNECT_A1S_F2_BASE_COMMIT,
  RTM_CONNECT_A1S_F2_CONTRACT_VERSION,
  RTM_CONNECT_A1S_F2_LOGIN_ROUTE,
  RTM_CONNECT_A1S_F2_LOGOUT_ROUTE,
  RTM_CONNECT_A1S_F2_PRIVATE_ROUTE,
  assertRtmConnectA1SF2LoginEnvelope,
  assertRtmConnectA1SF2LogoutEnvelope,
  evaluateRtmConnectA1SF2Gate,
  requireRtmConnectA1SF2Email,
} from './src/lib/rtmConnectA1SF2Contract.js';
import {
  createRtmConnectA1SF2Session,
  loadVerifiedRtmConnectA1SF2QueueTraversal,
} from './src/lib/rtmConnectA1SF2Runtime.js';

const FX_OPERATOR_ID = '11111111-1111-4111-8111-111111111111';
const FX_SESSION_ID = '22222222-2222-4222-8222-222222222222';
const FX_TENANT_ID = '33333333-3333-4333-8333-333333333333';
const FX_DEVICE_ID = '44444444-4444-4444-8444-444444444444';
const FX_TASK_ID = '55555555-5555-4555-8555-555555555555';
const FX_CASE_ID = '66666666-6666-4666-8666-666666666666';
const FX_TOKEN = 'A'.repeat(40);
const FX_TOKEN_2 = 'B'.repeat(40);

const FX_RUNTIME_CONTEXT = Object.freeze({
  hostname: 'recurretumulta-frontend-staging.vercel.app',
  protocol: 'https:',
  port: '',
  buildTarget: 'a1s-synthetic-read',
  environment: 'staging',
  uiEnabled: '1',
  operatorAuthEnabled: '1',
  documentInputPolicy: 'synthetic_only',
  frontendBaseCommit: '92aeac70f93d7f1df645019b0e7f3d83b230ea4d',
  backendCommit: 'eb5ead955ba54bcb829c56ee9afdc5c939ec36da',
  backendContractVersion: 'rtm.connect.a1s.human_filing.v1',
  realDataAllowed: '0',
  externalEffectsAllowed: '0',
  providerAllowed: '0',
  administrationContactAllowed: '0',
  ocuContactAllowed: '0',
  b2Allowed: '0',
  productionAuthorized: '0',
});

const FX_BOUNDARY = Object.freeze({
  gate: Object.freeze({allowed: true}),
  f1RuntimeContext: FX_RUNTIME_CONTEXT,
});

const FX_STATUS = Object.freeze({
  ok: true,
  version: 'v1',
  individual_login_enabled: true,
  configuration_valid: true,
  staging_only: true,
  legacy_login_unchanged: true,
  operator_creation_available: false,
});

const FX_LOGIN = Object.freeze({
  ok: true,
  token_type: 'bearer',
  token: FX_TOKEN,
  session_id: FX_SESSION_ID,
  expires_at: '2099-01-01T00:00:00Z',
  absolute_expires_at: '2099-01-02T00:00:00Z',
  device_token: null,
  device_id: FX_DEVICE_ID,
  operator: Object.freeze({
    id: FX_OPERATOR_ID,
    email: 'operator@example.com',
    display_name: 'Synthetic Operator',
    role_code: null,
    permissions: Object.freeze([]),
    must_change_password: false,
    mfa_required: false,
  }),
  request_id: 'request-login',
  legacy_login_unchanged: true,
});

const FX_ME = Object.freeze({
  session_id: FX_SESSION_ID,
  operator: Object.freeze({
    id: FX_OPERATOR_ID,
    display_name: 'Synthetic Operator',
    role_code: null,
    must_change_password: false,
    mfa_required: false,
  }),
  expires_at: FX_LOGIN.expires_at,
  absolute_expires_at: FX_LOGIN.absolute_expires_at,
});

const FX_TENANTS = Object.freeze({
  items: Object.freeze([
    Object.freeze({
      tenant_id: FX_TENANT_ID,
      display_name: 'Synthetic Tenant',
      role: 'reviewer',
    }),
  ]),
  items_truncated: false,
});

function fxResponse(body, status = 200, options = {}) {
  const raw = Object.prototype.hasOwnProperty.call(options, 'raw')
    ? options.raw
    : JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        if (String(name).toLowerCase() === 'content-length') {
          return options.declaredLength ?? null;
        }
        return null;
      },
    },
    text: async () => raw,
  };
}

function fxDeferred() {
  let resolve;
  let reject;
  const promise = new Promise((nextResolve, nextReject) => {
    resolve = nextResolve;
    reject = nextReject;
  });
  return {promise, resolve, reject};
}

function fxDefaultFetch(calls = [], overrides = {}) {
  return async (url, options = {}) => {
    calls.push({url, options});
    if (url === '/api/ops/auth/status') {
      return overrides.statusResponse ?? fxResponse(FX_STATUS);
    }
    if (url === '/api/ops/auth/login') {
      return overrides.loginResponse ?? fxResponse(FX_LOGIN);
    }
    if (url === '/api/ops/auth/logout') {
      return overrides.logoutResponse ?? fxResponse({
        ok: true,
        status: 'closed',
        request_id: 'request-logout',
      });
    }
    throw new Error(`unexpected fetch: ${url}`);
  };
}

function fxTaskEnvelope(extraTask = {}) {
  return {
    task: {
      task_id: FX_TASK_ID,
      tenant_id: FX_TENANT_ID,
      case_id: FX_CASE_ID,
      task_code: 'SIM-001',
      status: 'reviewing',
      version: 1,
      due_at: '2098-12-01T00:00:00Z',
      package_sha256: 'a'.repeat(64),
      external_reference: 'synthetic-reference',
      created_at: '2098-01-01T00:00:00Z',
      updated_at: '2098-01-02T00:00:00Z',
      replayed: false,
      artifacts: [],
      artifacts_truncated: false,
      approvals: [],
      receipt_summary: null,
      events: [],
      events_truncated: false,
      ...extraTask,
    },
    allowed_actions: ['release', 'submit'],
    backend_private_payload: 'SECRET_RAW_PAYLOAD',
  };
}

function fxDefaultClient(overrides = {}) {
  return {
    operatorMe: async () => FX_ME,
    tenants: async () => FX_TENANTS,
    tenantContext: async () => ({
      tenant_id: FX_TENANT_ID,
      current_membership: {role: 'reviewer', permissions: []},
      participants: [],
      participants_truncated: false,
    }),
    tasks: async (_tenantId, {limit, offset}) => ({
      pagination: {total: 0, limit, offset},
      items: [],
    }),
    task: async () => fxTaskEnvelope(),
    ...overrides,
  };
}

function fxSession({fetchImpl = null, readClientFactory = null} = {}) {
  return createRtmConnectA1SF2Session({
    fetchImpl: fetchImpl ?? fxDefaultFetch(),
    runtimeBoundary: FX_BOUNDARY,
    readClientFactory: readClientFactory ?? (() => fxDefaultClient()),
  });
}
"""


def run_node(source: str, *, fixture: bool = True, timeout: int = 20):
    node = shutil.which("node")
    if not node:
        raise unittest.SkipTest("node no disponible")
    script = f"{JS_FIXTURE}\n{source}" if fixture else source
    completed = subprocess.run(
        [node, "--input-type=module", "--eval", script],
        cwd=ROOT,
        check=False,
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    if completed.returncode != 0:
        raise AssertionError(
            f"node failed ({completed.returncode}):\n"
            f"STDOUT:\n{completed.stdout}\nSTDERR:\n{completed.stderr}"
        )
    try:
        return json.loads(completed.stdout)
    except json.JSONDecodeError as exc:
        raise AssertionError(f"node did not return JSON: {completed.stdout!r}") from exc


def load_preflight():
    if not PREFLIGHT.is_file():
        raise AssertionError(f"Falta el preflight F2: {PREFLIGHT}")
    spec = importlib.util.spec_from_file_location("rtm_frontend_a1s_f2_preflight", PREFLIGHT)
    if not spec or not spec.loader:
        raise AssertionError("No se pudo cargar el preflight F2")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class FrontendA1SF2IdentityAndStaticTests(unittest.TestCase):
    def test_contract_identity_and_routes_are_exact(self):
        result = run_node(
            """
            console.log(JSON.stringify({
              contractVersion: RTM_CONNECT_A1S_F2_CONTRACT_VERSION,
              baseCommit: RTM_CONNECT_A1S_F2_BASE_COMMIT,
              archive: RTM_CONNECT_A1S_F2_BASE_ARCHIVE_SHA256,
              privateRoute: RTM_CONNECT_A1S_F2_PRIVATE_ROUTE,
              loginRoute: RTM_CONNECT_A1S_F2_LOGIN_ROUTE,
              logoutRoute: RTM_CONNECT_A1S_F2_LOGOUT_ROUTE,
            }));
            """
        )
        self.assertEqual(
            result,
            {
                "contractVersion": "rtm.connect.frontend.a1s.synthetic_read_session.v1",
                "baseCommit": "47fbb165c16f93217b0f0e445631258fbfbe3f18",
                "archive": "4a1c42178e00429c914b04c4498bcc13987ef1b4f6b62e3d47c7ca422a32abe8",
                "privateRoute": "/ops/connect/a1s",
                "loginRoute": "/api/ops/auth/login",
                "logoutRoute": "/api/ops/auth/logout",
            },
        )

    def test_javascript_and_jsx_parse(self):
        node = shutil.which("node")
        if not node:
            self.skipTest("node no disponible")
        for path in (CONTRACT, RUNTIME):
            completed = subprocess.run(
                [node, "--check", str(path)],
                cwd=ROOT,
                capture_output=True,
                text=True,
                timeout=15,
            )
            self.assertEqual(completed.returncode, 0, completed.stderr)
        result = run_node(
            """
            import fs from 'node:fs';
            import {parse} from '@babel/parser';
            const files = ['src/App.jsx', 'src/pages/OpsA1SSyntheticReadOnly.jsx'];
            const parsed = files.map(file => {
              parse(fs.readFileSync(file, 'utf8'), {
                sourceType: 'module',
                plugins: ['jsx'],
              });
              return file;
            });
            console.log(JSON.stringify(parsed));
            """,
            fixture=False,
        )
        self.assertEqual(result, ["src/App.jsx", "src/pages/OpsA1SSyntheticReadOnly.jsx"])

    def test_f2_http_surface_has_only_two_post_sites(self):
        runtime = RUNTIME.read_text(encoding="utf-8")
        methods = re.findall(r'method\s*:\s*["\']([A-Z]+)["\']', runtime)
        self.assertEqual(methods, ["POST", "POST"])
        for method in ("PUT", "PATCH", "DELETE"):
            self.assertNotIn(f'method: "{method}"', runtime)
        self.assertNotIn("http://", runtime)
        self.assertNotIn("https://", runtime)
        self.assertEqual(runtime.count('credentials: "same-origin"'), 2)
        self.assertEqual(runtime.count('cache: "no-store"'), 2)
        self.assertEqual(runtime.count('redirect: "error"'), 2)
        self.assertEqual(runtime.count('referrerPolicy: "same-origin"'), 2)

    def test_no_persistent_or_legacy_credentials_in_f2_code(self):
        joined = "\n".join(
            path.read_text(encoding="utf-8") for path in (CONTRACT, RUNTIME, PAGE, APP)
        )
        for forbidden in (
            "localStorage",
            "sessionStorage",
            "indexedDB",
            "document.cookie",
            "ops_token",
            "X-Operator-Token",
            "BroadcastChannel",
            "sendBeacon",
            "WebSocket",
            "EventSource",
            "dangerouslySetInnerHTML",
        ):
            self.assertNotIn(forbidden, joined)

    def test_app_wires_only_the_exact_gated_lazy_private_route(self):
        app = APP.read_text(encoding="utf-8")
        self.assertIn('import a1sF2RouteEnabled, {', app)
        self.assertIn('() => import("./pages/OpsA1SSyntheticReadOnly.jsx")', app)
        self.assertIn("{privateA1SEnabled ? (", app)
        self.assertIn("path={a1sF2PrivateRoute}", app)
        self.assertIn("caseSensitive", app)
        self.assertIn("isA1SF2Route ? (", app)
        self.assertNotIn("RTM_CONNECT_A1S", app)


class FrontendA1SF2GateAndEnvelopeTests(unittest.TestCase):
    def test_gate_accepts_only_the_exact_matrix(self):
        result = run_node(
            """
            const valid = {
              hostname: 'recurretumulta-frontend-staging.vercel.app',
              protocol: 'https:', port: '', environment: 'staging',
              buildTarget: 'a1s-synthetic-read', uiEnabled: '1',
              operatorAuthEnabled: '1', documentInputPolicy: 'synthetic_only',
              f2BaseCommit: '47fbb165c16f93217b0f0e445631258fbfbe3f18',
              f2BaseArchiveSha256: '4a1c42178e00429c914b04c4498bcc13987ef1b4f6b62e3d47c7ca422a32abe8',
              f1BaseCommit: '92aeac70f93d7f1df645019b0e7f3d83b230ea4d',
              backendCommit: 'eb5ead955ba54bcb829c56ee9afdc5c939ec36da',
              backendContractVersion: 'rtm.connect.a1s.human_filing.v1',
              lawyerReview: 'approved', dpoReview: 'approved',
              authenticatedSmoke: 'passed', realCaseDataAllowed: '0',
              operatorPrivacyNotice: 'published',
              stagingAccessProtection: 'verified', backendProxyAudit: 'passed',
              externalEffectsAllowed: '0', providerAllowed: '0',
              administrationContactAllowed: '0', ocuContactAllowed: '0',
              b2Allowed: '0', productionAuthorized: '0', mutationsAllowed: '0',
            };
            const mutations = {};
            for (const key of Object.keys(valid)) {
              const changed = {...valid};
              delete changed[key];
              mutations[`missing:${key}`] = evaluateRtmConnectA1SF2Gate(changed).allowed;
            }
            for (const [name, patch] of Object.entries({
              production: {hostname: 'recurretumulta.eu'},
              nearHost: {hostname: 'recurretumulta-frontend-staging.vercel.app.attacker.test'},
              localhost: {hostname: 'localhost'},
              http: {protocol: 'http:'},
              port: {port: '443'},
              booleanFalse: {mutationsAllowed: false},
              realData: {realCaseDataAllowed: '1'},
            })) {
              mutations[name] = evaluateRtmConnectA1SF2Gate({...valid, ...patch}).allowed;
            }
            console.log(JSON.stringify({valid: evaluateRtmConnectA1SF2Gate(valid), mutations}));
            """
        )
        self.assertTrue(result["valid"]["allowed"])
        self.assertEqual(result["valid"]["liveVerdict"], "no_go")
        self.assertTrue(result["valid"]["readOnly"])
        self.assertFalse(result["valid"]["mutationsAvailable"])
        self.assertTrue(all(value is False for value in result["mutations"].values()))

    def test_blocked_gate_constructs_no_session_and_executes_no_fetch(self):
        result = run_node(
            """
            let calls = 0;
            let code = null;
            try {
              createRtmConnectA1SF2Session({
                fetchImpl: async () => { calls += 1; },
                runtimeBoundary: {gate: {allowed: false}},
              });
            } catch (error) { code = error.code; }
            console.log(JSON.stringify({calls, code}));
            """
        )
        self.assertEqual(result, {"calls": 0, "code": "a1s_f2.gate_blocked"})

    def test_login_and_logout_envelopes_are_exact_and_fail_closed(self):
        result = run_node(
            """
            const rejectLogin = value => {
              try { assertRtmConnectA1SF2LoginEnvelope(value); return null; }
              catch (error) { return error.code; }
            };
            const rejectLogout = value => {
              try { assertRtmConnectA1SF2LogoutEnvelope(value); return null; }
              catch (error) { return error.code; }
            };
            const extra = {...FX_LOGIN, unexpected: true};
            const missing = {...FX_LOGIN}; delete missing.device_id;
            const reversed = {...FX_LOGIN,
              expires_at: '2099-01-03T00:00:00Z',
              absolute_expires_at: '2099-01-02T00:00:00Z'};
            const expired = {...FX_LOGIN,
              expires_at: '2020-01-01T00:00:00Z',
              absolute_expires_at: '2020-01-02T00:00:00Z'};
            const unsafeOperator = {...FX_LOGIN,
              operator: {...FX_LOGIN.operator, mfa_required: true}};
            const badBearer = {...FX_LOGIN, token: 'short'};
            const badDevice = {...FX_LOGIN, device_token: 'short'};
            console.log(JSON.stringify({
              accepted: assertRtmConnectA1SF2LoginEnvelope(FX_LOGIN),
              extra: rejectLogin(extra), missing: rejectLogin(missing),
              reversed: rejectLogin(reversed), expired: rejectLogin(expired),
              unsafeOperator: rejectLogin(unsafeOperator),
              badBearer: rejectLogin(badBearer), badDevice: rejectLogin(badDevice),
              logoutAccepted: assertRtmConnectA1SF2LogoutEnvelope({
                ok: true, status: 'closed', request_id: 'out'}),
              logoutExtra: rejectLogout({ok: true, status: 'closed', request_id: 'out', extra: 1}),
            }));
            """
        )
        self.assertEqual(result["accepted"]["sessionId"], "22222222-2222-4222-8222-222222222222")
        self.assertEqual(result["extra"], "a1s_f2.unexpected_fields")
        self.assertEqual(result["missing"], "a1s_f2.unexpected_fields")
        self.assertEqual(result["reversed"], "a1s_f2.session_clock_invalid")
        self.assertEqual(result["expired"], "a1s_f2.session_expired")
        self.assertEqual(result["unsafeOperator"], "a1s_f2.operator_not_operational")
        self.assertEqual(result["badBearer"], "a1s_f2.invalid_bearer")
        self.assertEqual(result["badDevice"], "a1s_f2.invalid_device_token")
        self.assertEqual(result["logoutAccepted"], {"ok": True, "status": "closed"})
        self.assertEqual(result["logoutExtra"], "a1s_f2.unexpected_fields")

    def test_email_contract_rejects_non_string_values(self):
        result = run_node(
            """
            const rejected = value => {
              try { requireRtmConnectA1SF2Email(value); return false; }
              catch { return true; }
            };
            console.log(JSON.stringify({
              stringAccepted: requireRtmConnectA1SF2Email(' operator@example.com '),
              objectRejected: rejected({toString: () => 'operator@example.com'}),
              numberRejected: rejected(12345),
            }));
            """
        )
        self.assertEqual(result["stringAccepted"], "operator@example.com")
        self.assertTrue(result["objectRejected"])
        self.assertTrue(result["numberRejected"])


class FrontendA1SF2QueueTraversalTests(unittest.TestCase):
    def test_queue_boundaries_and_fail_closed_reasons(self):
        result = run_node(
            """
            const item = id => ({task_id: id});
            async function run(pages) {
              let call = 0;
              const value = await loadVerifiedRtmConnectA1SF2QueueTraversal({
                tasks: async (_tenant, request) => {
                  const page = pages[Math.min(call, pages.length - 1)];
                  call += 1;
                  return typeof page === 'function' ? page(request, call) : page;
                },
              }, FX_TENANT_ID);
              return {value, calls: call};
            }
            const zero = await run([{pagination:{total:0,limit:200,offset:0},items:[]}]);
            const one = await run([{pagination:{total:1,limit:200,offset:0},items:[item('one')]}]);
            const multi = await run([
              {pagination:{total:201,limit:200,offset:0},items:Array.from({length:200},(_,i)=>item(`m-${i}`))},
              {pagination:{total:201,limit:200,offset:200},items:[item('m-200')]},
            ]);
            const max = await run(Array.from({length:10},(_,page)=>({
              pagination:{total:2000,limit:200,offset:page*200},
              items:Array.from({length:200},(_,i)=>item(`x-${page*200+i}`)),
            })));
            const tooMany = await run([{pagination:{total:2001,limit:200,offset:0},items:[]}]);
            const totalDrift = await run([
              {pagination:{total:400,limit:200,offset:0},items:Array.from({length:200},(_,i)=>item(`d-${i}`))},
              {pagination:{total:399,limit:200,offset:200},items:Array.from({length:199},(_,i)=>item(`d-${200+i}`))},
            ]);
            const offsetDrift = await run([{pagination:{total:1,limit:200,offset:1},items:[item('o')]}]);
            const limitDrift = await run([{pagination:{total:1,limit:50,offset:0},items:[item('l')]}]);
            const duplicate = await run([{pagination:{total:2,limit:200,offset:0},items:[item('same'),item('same')]}]);
            const short = await run([{pagination:{total:201,limit:200,offset:0},items:[item('short')]}]);
            console.log(JSON.stringify({zero,one,multi,max,tooMany,totalDrift,offsetDrift,limitDrift,duplicate,short}));
            """
        )
        for name, count in (("zero", 0), ("one", 1), ("multi", 201), ("max", 2000)):
            value = result[name]["value"]
            self.assertTrue(value["paginationVerified"], name)
            self.assertFalse(value["snapshotGuaranteed"], name)
            self.assertFalse(value["emptyStateAuthoritative"], name)
            self.assertEqual(len(value["items"]), count, name)
        self.assertEqual(result["max"]["calls"], 10)
        expected_reasons = {
            "tooMany": "queue_limit_exceeded",
            "totalDrift": "pagination_drift",
            "offsetDrift": "pagination_drift",
            "limitDrift": "pagination_drift",
            "duplicate": "duplicate_task",
            "short": "pagination_incomplete",
        }
        for name, reason in expected_reasons.items():
            value = result[name]["value"]
            self.assertFalse(value["paginationVerified"], name)
            self.assertEqual(value["items"], [], name)
            self.assertEqual(value["reason"], reason, name)

    def test_filters_and_offsets_are_forwarded_on_every_page(self):
        result = run_node(
            """
            const requests = [];
            await loadVerifiedRtmConnectA1SF2QueueTraversal({
              tasks: async (tenantId, request) => {
                requests.push({tenantId, ...request});
                const remaining = 201 - request.offset;
                const length = Math.min(200, remaining);
                return {
                  pagination:{total:201,limit:request.limit,offset:request.offset},
                  items:Array.from({length},(_,i)=>({task_id:`task-${request.offset+i}`})),
                };
              },
            }, FX_TENANT_ID, {
              status:'reviewing', assigneeOperatorId:FX_OPERATOR_ID, overdueOnly:true,
            });
            console.log(JSON.stringify(requests));
            """
        )
        self.assertEqual([item["offset"] for item in result], [0, 200])
        for request in result:
            self.assertEqual(request["tenantId"], "33333333-3333-4333-8333-333333333333")
            self.assertEqual(request["limit"], 200)
            self.assertEqual(request["status"], "reviewing")
            self.assertEqual(request["assigneeOperatorId"], "11111111-1111-4111-8111-111111111111")
            self.assertTrue(request["overdueOnly"])

    def test_mutable_offset_dataset_never_claims_snapshot(self):
        result = run_node(
            """
            let page = 0;
            const value = await loadVerifiedRtmConnectA1SF2QueueTraversal({
              tasks: async (_tenant, request) => {
                page += 1;
                const ids = page === 1
                  ? Array.from({length:200},(_,i)=>`task-${i}`)
                  : [...Array.from({length:199},(_,i)=>`task-${201+i}`),'task-new'];
                return {
                  pagination:{total:400,limit:request.limit,offset:request.offset},
                  items:ids.map(task_id=>({task_id})),
                };
              },
            }, FX_TENANT_ID);
            console.log(JSON.stringify({
              value,
              hasMissingItem:value.items.some(item=>item.task_id==='task-200'),
              hasNewItem:value.items.some(item=>item.task_id==='task-new'),
            }));
            """
        )
        self.assertTrue(result["value"]["paginationVerified"])
        self.assertFalse(result["value"]["snapshotGuaranteed"])
        self.assertFalse(result["value"]["emptyStateAuthoritative"])
        self.assertFalse(result["hasMissingItem"])
        self.assertTrue(result["hasNewItem"])

    def test_page_failure_throws_without_returning_partial_items(self):
        result = run_node(
            """
            let calls = 0;
            let returned = null;
            let message = null;
            try {
              returned = await loadVerifiedRtmConnectA1SF2QueueTraversal({
                tasks: async (_tenant, request) => {
                  calls += 1;
                  if (calls === 2) throw new Error('page failed');
                  return {
                    pagination:{total:201,limit:request.limit,offset:request.offset},
                    items:Array.from({length:200},(_,i)=>({task_id:`partial-${i}`})),
                  };
                },
              }, FX_TENANT_ID);
            } catch (error) { message = error.message; }
            console.log(JSON.stringify({calls, returned, message}));
            """
        )
        self.assertEqual(result, {"calls": 2, "returned": None, "message": "page failed"})


class FrontendA1SF2SessionLifecycleTests(unittest.TestCase):
    def test_status_login_bootstrap_and_logout_http_contract(self):
        result = run_node(
            """
            const calls = [];
            const session = fxSession({fetchImpl:fxDefaultFetch(calls)});
            const before = session.hasSession();
            await session.authStatus();
            const auth = await session.login({email:' operator@example.com ',password:'secret'});
            const after = session.hasSession();
            const logout = await session.logout();
            console.log(JSON.stringify({before,after,final:session.hasSession(),auth,logout,calls}));
            """
        )
        self.assertFalse(result["before"])
        self.assertTrue(result["after"])
        self.assertFalse(result["final"])
        self.assertEqual(
            result["auth"],
            {
                "operator": {
                    "display_name": "Synthetic Operator",
                    "role_code": None,
                },
                "expiresAt": "2099-01-01T00:00:00Z",
                "tenants": [
                    {
                        "tenant_id": "33333333-3333-4333-8333-333333333333",
                        "display_name": "Synthetic Tenant",
                        "role": "reviewer",
                    }
                ],
            },
        )
        serialized_auth = json.dumps(result["auth"]).lower()
        for forbidden in (
            "token",
            "operator@example.com",
            "sessionid",
            "operatorid",
            "permissions",
            "absoluteexpiresat",
            "tenantstruncated",
        ):
            self.assertNotIn(forbidden, serialized_auth)
        calls = result["calls"]
        self.assertEqual([item["url"] for item in calls], [
            "/api/ops/auth/status", "/api/ops/auth/login", "/api/ops/auth/logout"
        ])
        self.assertEqual([item["options"]["method"] for item in calls], ["GET", "POST", "POST"])
        login = calls[1]["options"]
        self.assertEqual(json.loads(login["body"]), {
            "email": "operator@example.com", "password": "secret"
        })
        self.assertNotIn("Authorization", login["headers"])
        self.assertEqual(
            calls[2]["options"]["headers"]["Authorization"],
            "Bearer " + "A" * 40,
        )

    def test_login_requires_fresh_status_and_rejects_concurrent_or_active_session(self):
        result = run_node(
            """
            const loginDeferred = fxDeferred();
            const calls = [];
            const fetchImpl = async (url, options={}) => {
              calls.push({url,options});
              if (url.endsWith('/status')) return fxResponse(FX_STATUS);
              if (url.endsWith('/login')) return loginDeferred.promise;
              if (url.endsWith('/logout')) return fxResponse({ok:true,status:'closed',request_id:'out'});
            };
            const session = fxSession({fetchImpl});
            let beforeStatus = null;
            try { await session.login({email:'operator@example.com',password:'x'}); }
            catch (error) { beforeStatus = error.code; }
            await session.authStatus();
            const first = session.login({email:'operator@example.com',password:'x'});
            let concurrent = null;
            try { await session.login({email:'operator@example.com',password:'x'}); }
            catch (error) { concurrent = error.code; }
            loginDeferred.resolve(fxResponse(FX_LOGIN));
            await first;
            let active = null;
            try { await session.login({email:'operator@example.com',password:'x'}); }
            catch (error) { active = error.code; }
            console.log(JSON.stringify({beforeStatus,concurrent,active,loginPosts:calls.filter(x=>x.url.endsWith('/login')).length}));
            """
        )
        self.assertEqual(result["beforeStatus"], "a1s_f2.auth_status_required")
        self.assertEqual(result["concurrent"], "a1s_f2.login_in_progress")
        self.assertEqual(result["active"], "a1s_f2.session_already_active")
        self.assertEqual(result["loginPosts"], 1)

    def test_session_is_not_observable_until_full_bootstrap_succeeds(self):
        result = run_node(
            """
            const meDeferred = fxDeferred();
            const session = fxSession({
              readClientFactory:()=>fxDefaultClient({operatorMe:()=>meDeferred.promise}),
            });
            await session.authStatus();
            const pending = session.login({email:'operator@example.com',password:'x'});
            await new Promise(resolve=>setTimeout(resolve,0));
            const duringBootstrap = session.hasSession();
            meDeferred.resolve(FX_ME);
            await pending;
            console.log(JSON.stringify({duringBootstrap,after:session.hasSession()}));
            """
        )
        self.assertFalse(result["duringBootstrap"])
        self.assertTrue(result["after"])

    def test_bootstrap_identity_clock_and_scope_failures_revoke_once(self):
        result = run_node(
            """
            async function run(overrides) {
              const calls=[];
              const session=fxSession({
                fetchImpl:fxDefaultFetch(calls),
                readClientFactory:()=>fxDefaultClient(overrides),
              });
              await session.authStatus();
              let code=null;
              try { await session.login({email:'operator@example.com',password:'x'}); }
              catch(error) { code=error.code; }
              return {code,hasSession:session.hasSession(),logoutCalls:calls.filter(x=>x.url.endsWith('/logout')).length};
            }
            const identity=await run({operatorMe:async()=>({...FX_ME,session_id:FX_TASK_ID})});
            const clock=await run({operatorMe:async()=>({...FX_ME,expires_at:'2099-01-01T00:00:01Z'})});
            const truncated=await run({tenants:async()=>({...FX_TENANTS,items_truncated:true})});
            console.log(JSON.stringify({identity,clock,truncated}));
            """
        )
        for name in ("identity", "clock"):
            self.assertEqual(result[name]["code"], "a1s_f2.session_identity_changed")
            self.assertFalse(result[name]["hasSession"])
            self.assertEqual(result[name]["logoutCalls"], 1)
        self.assertEqual(result["truncated"]["code"], "a1s_f2.tenant_scope_truncated")
        self.assertFalse(result["truncated"]["hasSession"])
        self.assertEqual(result["truncated"]["logoutCalls"], 1)

    def test_malformed_success_envelope_with_valid_token_is_revoked(self):
        result = run_node(
            """
            const calls=[];
            const malformed={...FX_LOGIN,unexpected:true};
            const session=fxSession({fetchImpl:fxDefaultFetch(calls,{loginResponse:fxResponse(malformed)})});
            await session.authStatus();
            let code=null;
            try { await session.login({email:'operator@example.com',password:'x'}); }
            catch(error) { code=error.code; }
            const logout=calls.find(item=>item.url.endsWith('/logout'));
            console.log(JSON.stringify({code,hasSession:session.hasSession(),logout,calls:calls.length}));
            """
        )
        self.assertEqual(result["code"], "a1s_f2.unexpected_fields")
        self.assertFalse(result["hasSession"])
        self.assertEqual(result["calls"], 3)
        self.assertEqual(
            result["logout"]["options"]["headers"]["Authorization"],
            "Bearer " + "A" * 40,
        )

    def test_dispose_during_login_never_revives_session_and_revokes_candidate(self):
        result = run_node(
            """
            const loginDeferred=fxDeferred();
            const calls=[];
            const fetchImpl=async(url,options={})=>{
              calls.push({url,options});
              if(url.endsWith('/status'))return fxResponse(FX_STATUS);
              if(url.endsWith('/login'))return loginDeferred.promise;
              if(url.endsWith('/logout'))return fxResponse({ok:true,status:'closed',request_id:'out'});
            };
            const session=fxSession({fetchImpl});
            await session.authStatus();
            const pending=session.login({email:'operator@example.com',password:'x'});
            session.dispose();
            loginDeferred.resolve(fxResponse(FX_LOGIN));
            let code=null;try{await pending}catch(error){code=error.code}
            console.log(JSON.stringify({code,hasSession:session.hasSession(),logoutCalls:calls.filter(x=>x.url.endsWith('/logout')).length}));
            """
        )
        self.assertEqual(result, {
            "code": "a1s_f2.request_aborted", "hasSession": False, "logoutCalls": 1
        })

    def test_invalid_abort_signal_does_not_poison_future_login(self):
        result = run_node(
            """
            const session=fxSession();await session.authStatus();
            let invalid=null;try{await session.login({email:'operator@example.com',password:'x',signal:{}})}catch(error){invalid=error.code}
            let retry=null;try{await session.login({email:'operator@example.com',password:'x'});retry='ok'}catch(error){retry=error.code}
            console.log(JSON.stringify({invalid,retry,hasSession:session.hasSession()}));
            """
        )
        self.assertEqual(result["invalid"], "a1s_f2.abort_signal_invalid")
        self.assertEqual(result["retry"], "ok")
        self.assertTrue(result["hasSession"])

    def test_logout_during_login_closes_each_issued_token_at_most_once(self):
        result = run_node(
            """
            const meDeferred=fxDeferred();const calls=[];
            const session=fxSession({fetchImpl:fxDefaultFetch(calls),readClientFactory:()=>fxDefaultClient({operatorMe:()=>meDeferred.promise})});
            await session.authStatus();
            const pending=session.login({email:'operator@example.com',password:'x'}).catch(error=>error.code);
            await new Promise(resolve=>setTimeout(resolve,0));
            await session.logout();
            meDeferred.resolve(FX_ME);
            const code=await pending;
            console.log(JSON.stringify({code,hasSession:session.hasSession(),logoutCalls:calls.filter(x=>x.url.endsWith('/logout')).length}));
            """
        )
        self.assertEqual(result["code"], "a1s_f2.request_aborted")
        self.assertFalse(result["hasSession"])
        self.assertEqual(result["logoutCalls"], 1)

    def test_clear_aborts_active_read_and_suppresses_late_result(self):
        result = run_node(
            """
            const contextDeferred=fxDeferred();let factories=0;
            const session=fxSession({readClientFactory:()=>{
              factories+=1;
              return factories===1?fxDefaultClient():fxDefaultClient({tenantContext:()=>contextDeferred.promise});
            }});
            await session.authStatus();await session.login({email:'operator@example.com',password:'x'});
            const pending=session.tenantOverview(FX_TENANT_ID).then(()=>({returned:true}),error=>({returned:false,code:error.code}));
            await new Promise(resolve=>setTimeout(resolve,0));
            session.clear();
            contextDeferred.resolve({tenant_id:FX_TENANT_ID,current_membership:{role:'reviewer',permissions:[]},participants:[],participants_truncated:false});
            const settled=await pending;
            console.log(JSON.stringify({settled,hasSession:session.hasSession()}));
            """
        )
        self.assertEqual(result, {
            "settled": {"returned": False, "code": "a1s_f2.request_aborted"},
            "hasSession": False,
        })

    def test_context_failure_starts_no_queue_pages(self):
        result = run_node(
            """
            let factories=0;let taskCalls=0;
            const session=fxSession({readClientFactory:()=>{
              factories+=1;
              if(factories===1)return fxDefaultClient();
              return fxDefaultClient({
                tenantContext:async()=>{const error=new Error('invalid context');error.name='RtmConnectA1SContractError';throw error},
                tasks:async()=>{taskCalls+=1;throw new Error('must not run')},
              });
            }});
            await session.authStatus();await session.login({email:'operator@example.com',password:'x'});
            let failure=null;
            try{await session.tenantOverview(FX_TENANT_ID)}
            catch(error){failure={name:error.name,code:error.code,message:error.message}}
            console.log(JSON.stringify({failure,taskCalls,hasSession:session.hasSession()}));
            """
        )
        self.assertEqual(result["failure"]["name"], "RtmConnectA1SF2RuntimeError")
        self.assertEqual(
            result["failure"]["code"], "a1s_f2.response_contract_invalid"
        )
        self.assertNotIn("invalid context", result["failure"]["message"])
        self.assertEqual(result["taskCalls"], 0)
        self.assertFalse(result["hasSession"])

    def test_tenant_overview_exposes_only_the_verified_queue_projection(self):
        result = run_node(
            """
            const session=fxSession();
            await session.authStatus();
            await session.login({email:'operator@example.com',password:'x'});
            const overview=await session.tenantOverview(FX_TENANT_ID);
            console.log(JSON.stringify({
              keys:Object.keys(overview).sort(),
              queueKeys:Object.keys(overview.queue).sort(),
              serialized:JSON.stringify(overview),
              frozen:Object.isFrozen(overview),
              queueFrozen:Object.isFrozen(overview.queue),
            }));
            """
        )
        self.assertEqual(result["keys"], ["queue"])
        self.assertEqual(
            result["queueKeys"],
            [
                "emptyStateAuthoritative",
                "items",
                "paginationVerified",
                "reason",
                "reportedTotal",
                "snapshotGuaranteed",
            ],
        )
        self.assertNotIn("permissions", result["serialized"])
        self.assertNotIn("participants", result["serialized"])
        self.assertNotIn("current_membership", result["serialized"])
        self.assertTrue(result["frozen"])
        self.assertTrue(result["queueFrozen"])

    def test_logout_clears_memory_before_remote_result_and_keeps_it_clear_on_failure(self):
        result = run_node(
            """
            const logoutDeferred=fxDeferred();
            const fetchImpl=async(url)=>{
              if(url.endsWith('/status'))return fxResponse(FX_STATUS);
              if(url.endsWith('/login'))return fxResponse(FX_LOGIN);
              if(url.endsWith('/logout'))return logoutDeferred.promise;
            };
            const session=fxSession({fetchImpl});await session.authStatus();await session.login({email:'operator@example.com',password:'x'});
            const pending=session.logout().then(()=>({resolved:true}),error=>({resolved:false,code:error.code}));
            await new Promise(resolve=>setTimeout(resolve,0));
            const whilePending=session.hasSession();
            logoutDeferred.reject(new Error('network unavailable'));
            const settled=await pending;
            console.log(JSON.stringify({whilePending,settled,after:session.hasSession()}));
            """
        )
        self.assertFalse(result["whilePending"])
        self.assertFalse(result["after"])
        self.assertEqual(result["settled"], {
            "resolved": False, "code": "a1s_f2.transport_failed"
        })

    def test_later_truncated_scope_invalidates_the_session(self):
        result = run_node(
            """
            let factories=0;
            const session=fxSession({readClientFactory:()=>{
              factories+=1;
              return factories===1?fxDefaultClient():fxDefaultClient({tenants:async()=>({...FX_TENANTS,items_truncated:true})});
            }});
            await session.authStatus();await session.login({email:'operator@example.com',password:'x'});
            let code=null;try{await session.tenantOverview(FX_TENANT_ID)}catch(error){code=error.code}
            console.log(JSON.stringify({code,hasSession:session.hasSession()}));
            """
        )
        self.assertEqual(result["code"], "a1s_f2.tenant_scope_truncated")
        self.assertFalse(result["hasSession"])

    def test_stale_auth_status_cannot_overwrite_a_newer_success(self):
        result = run_node(
            """
            const oldStatus=fxDeferred();let statusCalls=0;
            const fetchImpl=async(url,options={})=>{
              if(url.endsWith('/status')){
                statusCalls+=1;
                return statusCalls===1?oldStatus.promise:fxResponse(FX_STATUS);
              }
              if(url.endsWith('/login'))return fxResponse(FX_LOGIN);
              if(url.endsWith('/logout'))return fxResponse({ok:true,status:'closed',request_id:'out'});
            };
            const session=fxSession({fetchImpl});
            const stale=session.authStatus().catch(error=>error.code);
            await session.authStatus();
            oldStatus.resolve(fxResponse({detail:'old failure'},500));
            await stale;
            let login=null;try{await session.login({email:'operator@example.com',password:'x'});login='ok'}catch(error){login=error.code}
            console.log(JSON.stringify({login,hasSession:session.hasSession()}));
            """
        )
        self.assertEqual(result["login"], "ok")
        self.assertTrue(result["hasSession"])

    def test_stale_login_cleanup_cannot_destroy_a_newer_session(self):
        result = run_node(
            """
            const oldLogin=fxDeferred();let loginCalls=0;const calls=[];
            const fetchImpl=async(url,options={})=>{
              calls.push({url,options});
              if(url.endsWith('/status'))return fxResponse(FX_STATUS);
              if(url.endsWith('/login')){
                loginCalls+=1;
                return loginCalls===1?oldLogin.promise:fxResponse({...FX_LOGIN,token:FX_TOKEN_2});
              }
              if(url.endsWith('/logout'))return fxResponse({ok:true,status:'closed',request_id:'out'});
            };
            const session=fxSession({fetchImpl});
            await session.authStatus();
            const stale=session.login({email:'operator@example.com',password:'x'}).catch(error=>error.code);
            session.clear();
            await session.authStatus();
            await session.login({email:'operator@example.com',password:'x'});
            oldLogin.resolve(fxResponse(FX_LOGIN));
            const staleCode=await stale;
            console.log(JSON.stringify({staleCode,hasSession:session.hasSession(),logoutCalls:calls.filter(x=>x.url.endsWith('/logout')).length}));
            """
        )
        self.assertEqual(result["staleCode"], "a1s_f2.request_aborted")
        self.assertTrue(result["hasSession"])
        self.assertEqual(result["logoutCalls"], 1)

    def test_runtime_requires_revalidation_after_failure_and_logout(self):
        result = run_node(
            """
            let loginCalls=0;
            const fetchImpl=async(url)=>{
              if(url.endsWith('/status'))return fxResponse(FX_STATUS);
              if(url.endsWith('/login')){
                loginCalls+=1;
                return loginCalls===1?fxResponse({detail:'bad credentials'},401):fxResponse(FX_LOGIN);
              }
              if(url.endsWith('/logout'))return fxResponse({ok:true,status:'closed',request_id:'out'});
            };
            const session=fxSession({fetchImpl});await session.authStatus();
            let first=null;try{await session.login({email:'operator@example.com',password:'wrong'})}catch(error){first=error.code}
            let withoutStatus=null;try{await session.login({email:'operator@example.com',password:'x'})}catch(error){withoutStatus=error.code}
            await session.authStatus();await session.login({email:'operator@example.com',password:'x'});await session.logout();
            let afterLogout=null;try{await session.login({email:'operator@example.com',password:'x'})}catch(error){afterLogout=error.code}
            console.log(JSON.stringify({first,withoutStatus,afterLogout}));
            """
        )
        self.assertEqual(result, {
            "first": "a1s_f2.auth_failed",
            "withoutStatus": "a1s_f2.auth_status_required",
            "afterLogout": "a1s_f2.auth_status_required",
        })


class FrontendA1SF2SanitizationAndProjectionTests(unittest.TestCase):
    def test_auth_http_errors_never_reflect_backend_or_credentials(self):
        result = run_node(
            """
            const secret=`SECRET_PASSWORD_${FX_TOKEN}_operator@example.com`;
            const outcomes={};
            for(const status of [401,403,429,500]){
              const session=fxSession({fetchImpl:fxDefaultFetch([],{
                loginResponse:fxResponse({detail:secret,error:{message:secret},token:secret},status),
              })});
              await session.authStatus();
              try{await session.login({email:'operator@example.com',password:'SECRET_PASSWORD'})}
              catch(error){outcomes[status]={code:error.code,status:error.status,message:error.message,serialized:JSON.stringify(error)}}
            }
            console.log(JSON.stringify({secret,outcomes}));
            """
        )
        secret = result["secret"]
        for status in ("401", "403", "429", "500"):
            outcome = result["outcomes"][status]
            self.assertEqual(outcome["code"], "a1s_f2.auth_failed")
            self.assertEqual(outcome["status"], int(status))
            self.assertNotIn(secret, outcome["message"])
            self.assertNotIn("SECRET_PASSWORD", outcome["serialized"])
            self.assertNotIn("operator@example.com", outcome["serialized"])
            self.assertNotIn("A" * 40, outcome["serialized"])

    def test_malformed_json_and_oversized_auth_responses_are_generic(self):
        result = run_node(
            """
            async function run(response){
              const session=fxSession({fetchImpl:fxDefaultFetch([],{loginResponse:response})});
              await session.authStatus();
              try{await session.login({email:'operator@example.com',password:'x'});return null}
              catch(error){return {code:error.code,message:error.message,status:error.status}}
            }
            const invalid=await run(fxResponse(null,200,{raw:'SECRET_NOT_JSON'}));
            const declared=await run(fxResponse(FX_LOGIN,200,{declaredLength:300000}));
            const actual=await run(fxResponse(null,200,{raw:'S'.repeat(256001)}));
            console.log(JSON.stringify({invalid,declared,actual}));
            """
        )
        self.assertEqual(result["invalid"]["code"], "a1s_f2.response_not_json")
        self.assertEqual(result["declared"]["code"], "a1s_f2.response_too_large")
        self.assertEqual(result["actual"]["code"], "a1s_f2.response_too_large")
        self.assertNotIn("SECRET_NOT_JSON", json.dumps(result))

    def test_read_errors_do_not_escape_with_backend_secrets(self):
        result = run_node(
            """
            const secret=`SECRET_BACKEND_${FX_TOKEN}`;let factories=0;
            const session=fxSession({readClientFactory:()=>{
              factories+=1;
              if(factories===1)return fxDefaultClient();
              return fxDefaultClient({tenantContext:async()=>{
                const error=new Error(secret);error.name='RtmConnectA1SReadError';error.code='backend.echo';error.status=500;throw error;
              }});
            }});
            await session.authStatus();await session.login({email:'operator@example.com',password:'x'});
            let outcome=null;try{await session.tenantOverview(FX_TENANT_ID)}catch(error){outcome={message:error.message,serialized:JSON.stringify(error),status:error.status}}
            console.log(JSON.stringify({secret,outcome,hasSession:session.hasSession()}));
            """
        )
        self.assertNotIn(result["secret"], result["outcome"]["message"])
        self.assertNotIn("A" * 40, result["outcome"]["serialized"])
        self.assertEqual(result["outcome"]["status"], 500)
        self.assertTrue(result["hasSession"])

    def test_detail_projection_drops_backend_actions_and_raw_payload(self):
        result = run_node(
            """
            let factories=0;
            const session=fxSession({readClientFactory:()=>{
              factories+=1;
              return fxDefaultClient({task:async()=>fxTaskEnvelope({
                artifacts:[{artifact_code:'artifact',kind:'fixture',sha256:'b'.repeat(64),verified_at:null,created_at:'2098-01-01T00:00:00Z'}],
                approvals:[{approval_type:'human_review',decision:'approved_in_simulation',attestation_sha256:'c'.repeat(64),approved_at:'2098-01-01T00:00:00Z'}],
                events:[{sequence_number:1,event_type:'prepared',actor_type:'operator',from_status:null,to_status:'prepared',reason_code:'fixture',payload_sha256:'d'.repeat(64),created_at:'2098-01-01T00:00:00Z'}],
                raw_document:'SECRET_RAW_DOCUMENT',
                allowed_actions:['release'],
              })});
            }});
            await session.authStatus();await session.login({email:'operator@example.com',password:'x'});
            const detail=await session.taskDetail(FX_TENANT_ID,FX_TASK_ID);
            console.log(JSON.stringify({detail,frozen:Object.isFrozen(detail),actionsFrozen:Object.isFrozen(detail.workflowActions)}));
            """
        )
        serialized = json.dumps(result["detail"], sort_keys=True)
        self.assertNotIn("SECRET_RAW", serialized)
        self.assertNotIn("allowed_actions", serialized)
        self.assertEqual(result["detail"]["workflowActions"], [])
        self.assertTrue(result["detail"]["readOnly"])
        self.assertTrue(result["detail"]["syntheticOnly"])
        self.assertTrue(result["frozen"])
        self.assertTrue(result["actionsFrozen"])


class FrontendA1SF2PageAndDocsTests(unittest.TestCase):
    def test_page_revalidates_auth_after_failure_logout_clear_and_expiry(self):
        page = PAGE.read_text(encoding="utf-8")
        self.assertIn("const verifyAuthStatus = useCallback", page)
        self.assertIn("setAuthReady(false);", page)
        self.assertIn("await verifyAuthStatus({ clearError: false });", page)
        self.assertIn("void verifyAuthStatus({ clearError: false });", page)
        self.assertRegex(
            page,
            r"catch \(loginError\)[\s\S]{0,500}await verifyAuthStatus\(\{ clearError: false \}\)",
        )
        self.assertRegex(
            page,
            r"session\.clear\(\);[\s\S]{0,300}void verifyAuthStatus\(\{ clearError: false \}\)",
        )
        self.assertRegex(
            page,
            r"const closeSession[\s\S]{0,900}await verifyAuthStatus\(\{ clearError: false \}\)",
        )

    def test_password_is_removed_from_react_state_before_login_callback(self):
        page = PAGE.read_text(encoding="utf-8")
        submit = re.search(
            r"function submit\(event\) \{(?P<body>[\s\S]*?)\n  \}",
            page,
        )
        self.assertIsNotNone(submit)
        body = submit.group("body")
        self.assertIn("const submittedPassword = password", body)
        self.assertIn('setPassword("")', body)
        self.assertIn("onSubmit({ email, password: submittedPassword })", body)
        self.assertLess(body.index('setPassword("")'), body.index("onSubmit("))

    def test_filter_changes_reset_busy_state_and_abort_reads(self):
        page = PAGE.read_text(encoding="utf-8")
        effect = re.search(
            r"useEffect\(\(\) => \{(?P<body>[\s\S]*?)\}, \[tenantId, status, overdueOnly\]\);",
            page,
        )
        self.assertIsNotNone(effect)
        body = effect.group("body")
        self.assertIn("setLoadingQueue(false)", body)
        self.assertIn("setDetailLoading(false)", body)
        self.assertIn("queueAbortRef.current?.abort()", body)
        self.assertIn("detailAbortRef.current?.abort()", body)

    def test_page_never_overclaims_snapshot_or_empty_queue(self):
        page = PAGE.read_text(encoding="utf-8")
        doc = DOC.read_text(encoding="utf-8")
        self.assertIn("no ofrece cursor ni una instantánea consistente", page)
        self.assertIn("no se afirma una instantánea transaccional", page)
        self.assertIn("PAGINACIÓN VERIFICADA PARA ESTOS FILTROS", page)
        self.assertIn("no convierte la lectura en una instantánea consistente", page)
        self.assertIn("no constituye una garantía de instantánea consistente", page)
        self.assertNotIn("COLA COMPLETA", page)
        self.assertIn("snapshotGuaranteed === false", doc)
        self.assertIn("no demuestra una", doc)

    def test_human_review_ai_privacy_and_no_effect_copy_is_visible(self):
        page = PAGE.read_text(encoding="utf-8")
        for copy in (
            "SOLO LECTURA · SIN EFECTO JURÍDICO",
            "PRODUCCIÓN NO AUTORIZADA",
            "revisión humana sustantiva",
            "persona competente y autorizada",
            "corregir, rechazar o detener",
            "no presenta escritos",
            "no contacta con la Administración",
            "No introduzcas nombres de clientes",
        ):
            self.assertIn(copy, page)
        self.assertNotIn("error.message", page)
        self.assertNotIn("dangerouslySetInnerHTML", page)


class FrontendA1SF2PreflightManifestTests(unittest.TestCase):
    def test_preflight_identity_and_overlay_allowlist_are_exact(self):
        preflight = load_preflight()
        self.assertEqual(preflight.BASE_COMMIT_SHA40, "47fbb165c16f93217b0f0e445631258fbfbe3f18")
        self.assertEqual(
            preflight.BASE_ARCHIVE_SHA256,
            "4a1c42178e00429c914b04c4498bcc13987ef1b4f6b62e3d47c7ca422a32abe8",
        )
        self.assertEqual(
            preflight.BASE_SNAPSHOT_SHA256,
            "87bff1b9c8a372e855e8b620a0417efb4d495bebcdb47e126bfa1902deed0bc2",
        )
        self.assertEqual(preflight.EXPECTED_ARCHIVE_ENTRIES, 109)
        self.assertEqual(preflight.EXPECTED_BASE_FILES, 100)
        self.assertEqual(preflight.EXPECTED_UNCOMPRESSED_BYTES, 11_003_084)
        self.assertEqual(tuple(preflight.OVERLAY_PATHS), EXPECTED_OVERLAY_PATHS)

    def test_evidence_hashes_every_non_self_overlay_file(self):
        self.assertTrue(EVIDENCE.is_file(), f"Falta evidencia F2: {EVIDENCE}")
        evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))
        expected = set(EXPECTED_OVERLAY_PATHS) - {
            "docs/rtm_connect/RTM_FRONTEND_CONNECT_A1S_F2_EVIDENCE.json"
        }
        self.assertEqual(set(evidence["file_sha256"]), expected)
        for name, digest in evidence["file_sha256"].items():
            self.assertRegex(digest, r"^[0-9a-f]{64}$")
            self.assertEqual(hashlib.sha256((ROOT / name).read_bytes()).hexdigest(), digest, name)
        self.assertEqual(evidence.get("live_verdict"), "no_go")
        self.assertIs(evidence.get("synthetic_case_data_only"), True)
        self.assertIs(evidence.get("read_only_domain"), True)
        self.assertIs(evidence.get("production_authorized"), False)
        self.assertIs(evidence.get("snapshot_guaranteed"), False)

    def test_evidence_records_windows_build_without_overclaiming(self):
        evidence = json.loads(EVIDENCE.read_text(encoding="utf-8"))
        self.assertEqual(evidence["frontend_build_status"], "passed")
        self.assertIs(evidence["windows_local_build_verification_required"], False)
        self.assertIs(evidence["windows_local_build_verification_completed"], True)
        self.assertIs(evidence["frontend_build_attempted_for_current_revision"], True)
        self.assertIs(evidence["frontend_build_executed_for_current_revision"], True)
        self.assertEqual(evidence["frontend_build_execution_environment"], "windows_local")
        self.assertEqual(evidence["frontend_build_result_source"], "operator_console_report")
        self.assertIs(
            evidence["frontend_build_console_report_cryptographically_verified"],
            False,
        )
        self.assertEqual(evidence["frontend_build_tool"], "vite 5.4.21")
        self.assertEqual(evidence["frontend_build_modules_transformed"], 81)
        self.assertEqual(evidence["frontend_build_reported_duration_seconds"], 10.83)
        self.assertEqual(
            evidence["frontend_build_warnings"],
            [
                "baseline_browserslist_caniuse_lite_is_outdated",
                "baseline_navbar_travel_object_has_duplicate_landing_key",
                "baseline_minified_chunk_exceeds_500_kb",
            ],
        )
        self.assertNotIn(
            "windows_build_and_visual_review_not_executed",
            evidence["production_blockers"],
        )
        self.assertIn(
            "visual_responsive_review_not_executed",
            evidence["production_blockers"],
        )
        self.assertIn(
            "frontend_build_passed_per_operator_console_report_but_the_report_is_not_hash_attested",
            evidence["scope_limitations"],
        )

    def test_docs_record_windows_build_and_keep_visual_review_open(self):
        doc = DOC.read_text(encoding="utf-8")
        self.assertIn("81 módulos transformados", doc)
        self.assertIn("built in 10.83s", doc)
        self.assertIn("no está firmado ni hash-congelado", doc)
        self.assertIn("revisión visual responsiva", doc)


if __name__ == "__main__":
    unittest.main()
