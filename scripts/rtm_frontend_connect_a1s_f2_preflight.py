"""Preflight offline y estatico del frontend RTM CONNECT A1-S F2.

No importa JavaScript, no extrae el ZIP, no usa red, no toca base de datos y
no ejecuta el runtime. Un resultado ``ok`` acredita solamente las comprobaciones
estaticas declaradas; el veredicto live permanece ``no_go``.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import stat
import sys
import zipfile
from pathlib import Path, PurePosixPath
from typing import Any


VERSION = "rtm_frontend_connect_a1s_f2_preflight_v1_0"
AUTHORITY = "rtm_frontend_connect_a1s_f2_preflight"
CONTRACT_VERSION = "rtm.connect.frontend.a1s.synthetic_read_session.v1"
BACKEND_CONTRACT_VERSION = "rtm.connect.a1s.human_filing.v1"

BASE_COMMIT_SHA40 = "47fbb165c16f93217b0f0e445631258fbfbe3f18"
BASE_ARCHIVE_SHA256 = (
    "4a1c42178e00429c914b04c4498bcc13987ef1b4f6b62e3d47c7ca422a32abe8"
)
BASE_SNAPSHOT_SHA256 = (
    "87bff1b9c8a372e855e8b620a0417efb4d495bebcdb47e126bfa1902deed0bc2"
)
F1_BASE_COMMIT_SHA40 = "92aeac70f93d7f1df645019b0e7f3d83b230ea4d"
BACKEND_COMMIT_SHA40 = "eb5ead955ba54bcb829c56ee9afdc5c939ec36da"

EXPECTED_ARCHIVE_ENTRIES = 109
EXPECTED_BASE_FILES = 100
EXPECTED_UNCHANGED_BASE_FILES = 99
EXPECTED_UNCOMPRESSED_BYTES = 11_003_084
MAX_ARCHIVE_MEMBER_BYTES = 4_000_000

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_PATH = "docs/rtm_connect/RTM_FRONTEND_CONNECT_A1S_F2_EVIDENCE.json"
REPLACED_BASE_PATHS = ("src/App.jsx",)
NEW_OVERLAY_PATHS = (
    "docs/rtm_connect/RTM_FRONTEND_CONNECT_A1S_F2.md",
    EVIDENCE_PATH,
    "scripts/rtm_frontend_connect_a1s_f2_preflight.py",
    "src/lib/rtmConnectA1SF2Contract.js",
    "src/lib/rtmConnectA1SF2Runtime.js",
    "src/pages/OpsA1SSyntheticReadOnly.jsx",
    "tests/test_rtm_frontend_connect_a1s_f2_contract.py",
)
OVERLAY_PATHS = (
    "docs/rtm_connect/RTM_FRONTEND_CONNECT_A1S_F2.md",
    EVIDENCE_PATH,
    "scripts/rtm_frontend_connect_a1s_f2_preflight.py",
    "src/App.jsx",
    "src/lib/rtmConnectA1SF2Contract.js",
    "src/lib/rtmConnectA1SF2Runtime.js",
    "src/pages/OpsA1SSyntheticReadOnly.jsx",
    "tests/test_rtm_frontend_connect_a1s_f2_contract.py",
)
HASHED_OVERLAY_PATHS = tuple(path for path in OVERLAY_PATHS if path != EVIDENCE_PATH)
IGNORED_TREE_PARTS = frozenset({".git", "node_modules", "dist", "__pycache__"})


class PreflightBlocked(RuntimeError):
    """Fallo fail-closed de una comprobacion offline."""


def _sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def _sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _safe_member(name: str) -> bool:
    if not name or "\\" in name or name.startswith(("/", "~")):
        return False
    if re.match(r"^[A-Za-z]:", name):
        return False
    path = PurePosixPath(name)
    return all(part not in {"", ".", ".."} for part in path.parts)


def _zip_mode(info: zipfile.ZipInfo) -> int:
    return (info.external_attr >> 16) & 0xFFFF


def _archive_snapshot(files: dict[str, bytes]) -> str:
    digest = hashlib.sha256()
    for name in sorted(files):
        digest.update(name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(hashlib.sha256(files[name]).digest())
        digest.update(b"\0")
    return digest.hexdigest()


def _canonical_text(value: bytes) -> bytes | None:
    try:
        text = value.decode("utf-8")
    except UnicodeDecodeError:
        return None
    without_crlf = text.replace("\r\n", "")
    if "\r" in without_crlf:
        return None
    return text.replace("\r\n", "\n").encode("utf-8")


def _compare_content(expected: bytes, actual: bytes) -> str | None:
    if expected == actual:
        return "raw"
    expected_text = _canonical_text(expected)
    actual_text = _canonical_text(actual)
    if expected_text is not None and actual_text is not None and expected_text == actual_text:
        return "newline_canonical"
    return None


def _read_json(path: Path) -> dict[str, Any]:
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise PreflightBlocked(f"json_invalid:{path.name}:{type(exc).__name__}") from exc
    if not isinstance(value, dict):
        raise PreflightBlocked(f"json_not_object:{path.name}")
    return value


def _require_markers(text: str, markers: tuple[str, ...], boundary: str) -> None:
    missing = [marker for marker in markers if marker not in text]
    if missing:
        raise PreflightBlocked(
            f"{boundary}_markers_missing:{','.join(missing[:8])}"
        )


def _audit_archive(path: Path) -> tuple[dict[str, Any], dict[str, bytes]]:
    if not path.is_file():
        raise PreflightBlocked("base_archive_missing")
    archive_sha256 = _sha256_file(path)
    if archive_sha256 != BASE_ARCHIVE_SHA256:
        raise PreflightBlocked("base_archive_sha256_mismatch")

    try:
        with zipfile.ZipFile(path, "r") as archive:
            infos = archive.infolist()
            names = [info.filename for info in infos]
            if len(infos) != EXPECTED_ARCHIVE_ENTRIES:
                raise PreflightBlocked("base_archive_entry_count_mismatch")
            if any(not _safe_member(name.rstrip("/")) for name in names):
                raise PreflightBlocked("unsafe_archive_member")
            if len(names) != len(set(names)):
                raise PreflightBlocked("duplicate_archive_member")
            if len(names) != len({name.casefold() for name in names}):
                raise PreflightBlocked("casefold_duplicate_archive_member")
            if any(info.flag_bits & 0x1 for info in infos):
                raise PreflightBlocked("encrypted_archive_member")

            special_entries: list[str] = []
            for info in infos:
                mode = _zip_mode(info)
                file_type = stat.S_IFMT(mode)
                if stat.S_ISLNK(mode) or file_type not in {
                    0,
                    stat.S_IFREG,
                    stat.S_IFDIR,
                }:
                    special_entries.append(info.filename)
                if not info.is_dir() and info.file_size > MAX_ARCHIVE_MEMBER_BYTES:
                    raise PreflightBlocked("oversized_archive_member")
            if special_entries:
                raise PreflightBlocked("special_archive_entries_present")
            if archive.testzip() is not None:
                raise PreflightBlocked("archive_crc_invalid")
            try:
                comment = archive.comment.decode("ascii")
            except UnicodeDecodeError as exc:
                raise PreflightBlocked("archive_comment_not_ascii") from exc
            if comment != BASE_COMMIT_SHA40:
                raise PreflightBlocked("archive_commit_comment_mismatch")
            files = {
                info.filename: archive.read(info)
                for info in infos
                if not info.is_dir()
            }
    except (zipfile.BadZipFile, OSError) as exc:
        raise PreflightBlocked(f"base_archive_invalid:{type(exc).__name__}") from exc

    if len(files) != EXPECTED_BASE_FILES:
        raise PreflightBlocked("base_archive_file_count_mismatch")
    uncompressed = sum(len(value) for value in files.values())
    if uncompressed != EXPECTED_UNCOMPRESSED_BYTES:
        raise PreflightBlocked("base_archive_size_mismatch")
    snapshot = _archive_snapshot(files)
    if snapshot != BASE_SNAPSHOT_SHA256:
        raise PreflightBlocked("base_archive_snapshot_mismatch")
    if any(path not in files for path in REPLACED_BASE_PATHS):
        raise PreflightBlocked("replaced_base_path_absent_from_archive")
    unexpected_overlay = sorted(set(NEW_OVERLAY_PATHS) & set(files))
    if unexpected_overlay:
        raise PreflightBlocked(
            f"f2_new_overlay_present_in_base:{','.join(unexpected_overlay)}"
        )

    return (
        {
            "archive_sha256": archive_sha256,
            "archive_commit_comment": comment,
            "entries": len(infos),
            "files": len(files),
            "uncompressed_bytes": uncompressed,
            "full_base_snapshot_sha256": snapshot,
            "crc_ok": True,
            "safe_members": True,
            "casefold_duplicates": 0,
            "encrypted_members": 0,
            "special_entries": [],
            "new_f2_overlay_absent_from_base_archive": True,
        },
        files,
    )


def _walk_local_files() -> tuple[set[str], list[str]]:
    actual_files: set[str] = set()
    unexpected_special: list[str] = []
    for current, directories, filenames in os.walk(ROOT, topdown=True, followlinks=False):
        current_path = Path(current)
        for name in directories:
            path = current_path / name
            if name not in IGNORED_TREE_PARTS and path.is_symlink():
                unexpected_special.append(path.relative_to(ROOT).as_posix())
        directories[:] = [
            name
            for name in directories
            if name not in IGNORED_TREE_PARTS
            and not (current_path / name).is_symlink()
        ]
        for name in filenames:
            path = current_path / name
            relative_path = path.relative_to(ROOT)
            if any(part in IGNORED_TREE_PARTS for part in relative_path.parts):
                continue
            relative = relative_path.as_posix()
            if path.is_symlink() or not path.is_file():
                unexpected_special.append(relative)
                continue
            actual_files.add(relative)
    return actual_files, unexpected_special


def _audit_local_tree(base_files: dict[str, bytes]) -> dict[str, Any]:
    unchanged_names = sorted(set(base_files) - set(REPLACED_BASE_PATHS))
    if len(unchanged_names) != EXPECTED_UNCHANGED_BASE_FILES:
        raise PreflightBlocked("unchanged_base_file_count_definition_invalid")

    raw = 0
    newline = 0
    missing: list[str] = []
    mismatched: list[str] = []
    for name in unchanged_names:
        target = ROOT / name
        if not target.is_file():
            missing.append(name)
            continue
        mode = _compare_content(base_files[name], target.read_bytes())
        if mode == "raw":
            raw += 1
        elif mode == "newline_canonical":
            newline += 1
        else:
            mismatched.append(name)
    if missing:
        raise PreflightBlocked(f"base_files_missing:{','.join(missing[:8])}")
    if mismatched:
        raise PreflightBlocked(f"base_files_changed:{','.join(mismatched[:8])}")

    for name in REPLACED_BASE_PATHS:
        target = ROOT / name
        if not target.is_file():
            raise PreflightBlocked(f"replacement_missing:{name}")
        if _compare_content(base_files[name], target.read_bytes()) is not None:
            raise PreflightBlocked(f"declared_replacement_not_changed:{name}")

    missing_overlay = [path for path in OVERLAY_PATHS if not (ROOT / path).is_file()]
    if missing_overlay:
        raise PreflightBlocked(f"overlay_paths_missing:{','.join(missing_overlay)}")

    actual_files, unexpected_special = _walk_local_files()
    permitted = set(base_files) | set(NEW_OVERLAY_PATHS)
    unexpected = sorted(actual_files - permitted)
    missing_permitted = sorted(permitted - actual_files)
    if missing_permitted:
        raise PreflightBlocked(
            f"permitted_tree_paths_missing:{','.join(missing_permitted[:8])}"
        )
    if unexpected_special:
        raise PreflightBlocked(
            f"unexpected_special_tree_paths:{','.join(sorted(unexpected_special)[:8])}"
        )
    if unexpected:
        raise PreflightBlocked(f"unexpected_tree_paths:{','.join(unexpected[:8])}")

    digest = hashlib.sha256()
    for name in sorted(OVERLAY_PATHS):
        digest.update(name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(hashlib.sha256((ROOT / name).read_bytes()).digest())
        digest.update(b"\0")

    return {
        "base_files_total": len(base_files),
        "base_files_verified_unchanged": len(unchanged_names),
        "raw_byte_exact_files": raw,
        "newline_canonical_equivalent_files": newline,
        "base_tree_content_equivalent_except_declared_replacement": True,
        "comparison_mode": "strict_utf8_crlf_to_lf_or_binary_raw_v1",
        "replaced_base_paths": list(REPLACED_BASE_PATHS),
        "new_overlay_paths": list(NEW_OVERLAY_PATHS),
        "overlay_paths_present": len(OVERLAY_PATHS),
        "overlay_paths_required": len(OVERLAY_PATHS),
        "overlay_allowlist_exact": actual_files == permitted,
        "whole_tree_files_verified": len(actual_files),
        "ignored_tree_parts": sorted(IGNORED_TREE_PARTS),
        "overlay_snapshot_sha256": digest.hexdigest(),
        "unexpected_paths": [],
    }


def _audit_evidence() -> dict[str, Any]:
    evidence = _read_json(ROOT / EVIDENCE_PATH)
    exact_fields = {
        "version": "rtm_frontend_connect_a1s_f2_evidence_v1_0",
        "contract_version": CONTRACT_VERSION,
        "backend_contract_version": BACKEND_CONTRACT_VERSION,
        "status": "passed_offline_source_contract",
        "gate_status": "blocked_pending_external_prerequisites",
        "live_verdict": "no_go",
        "base_commit_sha40": BASE_COMMIT_SHA40,
        "base_archive_sha256": BASE_ARCHIVE_SHA256,
        "base_snapshot_sha256": BASE_SNAPSHOT_SHA256,
        "f1_contract_base_commit_sha40": F1_BASE_COMMIT_SHA40,
        "backend_commit_sha40": BACKEND_COMMIT_SHA40,
    }
    for field, expected in exact_fields.items():
        if evidence.get(field) != expected:
            raise PreflightBlocked(f"evidence_field_mismatch:{field}")

    if evidence.get("safe") is True:
        raise PreflightBlocked("evidence_must_not_claim_safe_true")
    deprecated_global_boundaries = {"synthetic_only", "real_data_used"}
    present_deprecated = sorted(deprecated_global_boundaries & set(evidence))
    if present_deprecated:
        raise PreflightBlocked(
            f"evidence_deprecated_global_boundaries:{','.join(present_deprecated)}"
        )

    exact_booleans = {
        "synthetic_case_data_only": True,
        "operator_access_personal_data_in_scope": True,
        "operator_personal_data_processing_expected": True,
        "real_case_or_client_data_allowed": False,
        "real_case_data_used": False,
        "read_only_domain": True,
        "workflow_mutations_available": False,
        "auth_session_posts_present": True,
        "runtime_wired": True,
        "runtime_executed": False,
        "routes_published": False,
        "production_authorized": False,
        "production_safe": False,
        "network_used": False,
        "database_touched": False,
        "provider_contacted": False,
        "administration_contacted": False,
        "ocu_contacted": False,
        "b2_used": False,
        "external_effects_executed": False,
        "solely_automated_legal_decisions_allowed": False,
        "legal_compliance_claimed": False,
        "human_review_required_for_future_real_action": True,
        "pagination_traversal_verified_contract": True,
        "snapshot_guaranteed": False,
        "empty_state_authoritative": False,
        "operator_privacy_notice_runtime_access_verified": False,
        "staging_access_protection_runtime_verified": False,
        "backend_proxy_runtime_verified": False,
        "authenticated_runtime_smoke_executed": False,
        "windows_local_build_verification_completed": True,
        "frontend_build_attempted_for_current_revision": True,
        "frontend_build_executed_for_current_revision": True,
        "frontend_build_console_report_cryptographically_verified": False,
    }
    for field, expected in exact_booleans.items():
        if evidence.get(field) is not expected:
            raise PreflightBlocked(f"evidence_boundary_mismatch:{field}")

    if evidence.get("test_status") != "passed":
        raise PreflightBlocked("evidence_tests_not_passed")
    build_status = evidence.get("frontend_build_status")
    if build_status != "passed":
        raise PreflightBlocked("evidence_frontend_build_status_invalid")
    windows_required = evidence.get("windows_local_build_verification_required")
    if windows_required is not False:
        raise PreflightBlocked("evidence_windows_build_verification_conflicts")
    if evidence.get("frontend_build_execution_environment") != "windows_local":
        raise PreflightBlocked("evidence_frontend_build_environment_invalid")
    if evidence.get("frontend_build_result_source") != "operator_console_report":
        raise PreflightBlocked("evidence_frontend_build_source_invalid")
    if evidence.get("frontend_build_tool") != "vite 5.4.21":
        raise PreflightBlocked("evidence_frontend_build_tool_invalid")
    if evidence.get("frontend_build_modules_transformed") != 81:
        raise PreflightBlocked("evidence_frontend_build_modules_invalid")
    if evidence.get("frontend_build_reported_duration_seconds") != 10.83:
        raise PreflightBlocked("evidence_frontend_build_duration_invalid")
    expected_build_warnings = [
        "baseline_browserslist_caniuse_lite_is_outdated",
        "baseline_navbar_travel_object_has_duplicate_landing_key",
        "baseline_minified_chunk_exceeds_500_kb",
    ]
    if evidence.get("frontend_build_warnings") != expected_build_warnings:
        raise PreflightBlocked("evidence_frontend_build_warnings_invalid")

    if evidence.get("overlay_paths") != list(OVERLAY_PATHS):
        raise PreflightBlocked("evidence_overlay_allowlist_mismatch")
    hashes = evidence.get("file_sha256")
    if not isinstance(hashes, dict) or set(hashes) != set(HASHED_OVERLAY_PATHS):
        raise PreflightBlocked("evidence_file_hash_manifest_mismatch")
    for name in HASHED_OVERLAY_PATHS:
        expected = hashes.get(name)
        if not isinstance(expected, str) or not re.fullmatch(r"[0-9a-f]{64}", expected):
            raise PreflightBlocked(f"evidence_file_hash_invalid:{name}")
        if _sha256_file(ROOT / name) != expected:
            raise PreflightBlocked(f"overlay_file_sha256_mismatch:{name}")

    checks = evidence.get("checks")
    if not isinstance(checks, dict) or not checks:
        raise PreflightBlocked("evidence_checks_not_nonempty_object")
    required_checks = {
        "private_lazy_route_fail_closed",
        "same_origin_http_allowlist_closed",
        "domain_methods_get_only",
        "login_logout_only_post",
        "bearer_not_persisted_by_frontend",
        "session_identity_revalidated_before_domain_reads",
        "stale_auth_results_cannot_reopen_boundary",
        "issued_token_revoked_after_failed_bootstrap",
        "tenant_scope_truncation_invalidates_session",
        "partial_pagination_discarded",
        "snapshot_not_claimed",
        "case_filter_local_after_verified_traversal",
        "task_detail_projection_closed",
        "workflow_actions_empty",
        "synthetic_and_no_legal_effect_labels_visible",
        "human_review_boundary_visible",
        "ai_scope_not_overclaimed",
        "operator_privacy_is_external_activation_blocker",
    }
    missing_checks = sorted(required_checks - set(checks))
    if missing_checks:
        raise PreflightBlocked(
            f"evidence_required_checks_missing:{','.join(missing_checks[:8])}"
        )
    invalid_checks = sorted(name for name, value in checks.items() if value is not True)
    if invalid_checks:
        raise PreflightBlocked(
            f"evidence_checks_not_true:{','.join(invalid_checks[:8])}"
        )

    return {
        "evidence_manifest_exact": True,
        "evidence_files_verified": len(HASHED_OVERLAY_PATHS),
        "status": evidence["status"],
        "gate_status": evidence.get("gate_status", "closed_by_default"),
        "test_status": evidence["test_status"],
        "frontend_build_status": build_status,
        "windows_local_build_verification_required": windows_required is True,
        "windows_local_build_verification_completed": True,
        "frontend_build_result_source": "operator_console_report",
        "frontend_build_console_report_cryptographically_verified": False,
        "frontend_build_modules_transformed": 81,
        "frontend_build_reported_duration_seconds": 10.83,
        "frontend_build_warnings": expected_build_warnings,
        "runtime_wired": True,
        "runtime_executed": False,
        "routes_published": False,
        "live_verdict": "no_go",
    }


def _audit_static_contract() -> dict[str, Any]:
    contract = (ROOT / "src/lib/rtmConnectA1SF2Contract.js").read_text(
        encoding="utf-8"
    )
    runtime = (ROOT / "src/lib/rtmConnectA1SF2Runtime.js").read_text(
        encoding="utf-8"
    )
    page = (ROOT / "src/pages/OpsA1SSyntheticReadOnly.jsx").read_text(
        encoding="utf-8"
    )
    app = (ROOT / "src/App.jsx").read_text(encoding="utf-8")
    read_contract = (ROOT / "src/lib/rtmConnectA1SReadContract.js").read_text(
        encoding="utf-8"
    )
    read_client = (ROOT / "src/lib/rtmConnectA1SReadClient.js").read_text(
        encoding="utf-8"
    )
    code = "\n".join((contract, runtime, page, app))
    f2_runtime_code = "\n".join((contract, runtime, page))

    forbidden_storage = (
        "localStorage",
        "sessionStorage",
        "indexedDB",
        "document.cookie",
        "caches.open",
        "serviceWorker.register",
        "BroadcastChannel",
        "window.name",
    )
    storage_hits = [token for token in forbidden_storage if token in f2_runtime_code]
    if storage_hits:
        raise PreflightBlocked(
            f"persistent_session_surface_present:{','.join(storage_hits)}"
        )
    legacy_hits = [
        token for token in ("ops_token", "X-Operator-Token") if token in code
    ]
    if legacy_hits:
        raise PreflightBlocked(f"legacy_token_reference_present:{','.join(legacy_hits)}")
    if re.search(r"https?://", f2_runtime_code, re.I):
        raise PreflightBlocked("direct_backend_origin_present")

    runtime_methods = re.findall(
        r"method\s*:\s*[\"'](GET|POST|PUT|PATCH|DELETE)[\"']",
        runtime,
        re.I,
    )
    if [method.upper() for method in runtime_methods] != ["POST", "POST"]:
        raise PreflightBlocked("f2_runtime_http_method_surface_mismatch")
    if re.findall(r"method\s*:\s*[\"'](PUT|PATCH|DELETE)[\"']", code, re.I):
        raise PreflightBlocked("a1s_domain_mutation_method_present")
    inherited_read_methods = re.findall(
        r"method\s*:\s*[\"'](GET|POST|PUT|PATCH|DELETE)[\"']",
        read_client,
        re.I,
    )
    if [method.upper() for method in inherited_read_methods] != ["GET"]:
        raise PreflightBlocked("f1_get_transport_surface_mismatch")

    api_literals = set(re.findall(r"[\"'](/api/[^\"']+)[\"']", f2_runtime_code))
    expected_auth_literals = {
        "/api/ops/auth/login",
        "/api/ops/auth/logout",
    }
    if api_literals != expected_auth_literals:
        raise PreflightBlocked("f2_api_literal_allowlist_mismatch")
    forbidden_endpoint_markers = (
        "/heartbeat",
        "preparationOptions(",
        "receiptOptions(",
        "Idempotency-Key",
        "If-Match",
        "assign_human_filing",
        "release_human_filing",
        "submit_receipt_fixture",
    )
    endpoint_hits = [
        marker for marker in forbidden_endpoint_markers if marker in f2_runtime_code
    ]
    if endpoint_hits:
        raise PreflightBlocked(
            f"forbidden_a1s_endpoint_or_command_present:{','.join(endpoint_hits)}"
        )

    _require_markers(
        contract,
        (
            BASE_COMMIT_SHA40,
            BASE_ARCHIVE_SHA256,
            "RTM_CONNECT_A1S_BASE_COMMIT",
            "RTM_CONNECT_A1S_BACKEND_COMMIT",
            "RTM_CONNECT_A1S_BACKEND_CONTRACT_VERSION",
            'RTM_CONNECT_A1S_F2_PRIVATE_ROUTE = "/ops/connect/a1s"',
            'exact("protocol", "https:"',
            'exact("environment", "staging"',
            'exact("buildTarget", "a1s-synthetic-read"',
            'exact("documentInputPolicy", "synthetic_only"',
            'exact("lawyerReview", "approved"',
            'exact("dpoReview", "approved"',
            'exact("authenticatedSmoke", "passed"',
            '"published"',
            '"verified"',
            'exact("backendProxyAudit", "passed"',
            '["mutationsAllowed", "mutations_not_blocked"]',
            'liveVerdict: "no_go"',
        ),
        "gate",
    )
    _require_markers(
        read_contract,
        (
            F1_BASE_COMMIT_SHA40,
            BACKEND_COMMIT_SHA40,
            BACKEND_CONTRACT_VERSION,
        ),
        "inherited_f1_backend_identity",
    )
    false_flag_fields = (
        "realCaseDataAllowed",
        "externalEffectsAllowed",
        "providerAllowed",
        "administrationContactAllowed",
        "ocuContactAllowed",
        "b2Allowed",
        "productionAuthorized",
        "mutationsAllowed",
    )
    if any(field not in contract for field in false_flag_fields):
        raise PreflightBlocked("gate_false_flag_surface_incomplete")

    _require_markers(
        app,
        (
            "lazy(",
            'import("./pages/OpsA1SSyntheticReadOnly.jsx")',
            "a1sF2RouteEnabled()",
            "privateA1SEnabled ? (",
            "path={a1sF2PrivateRoute}",
            "caseSensitive",
            "<Suspense",
            "noindex,nofollow,noarchive,nosnippet",
        ),
        "private_route",
    )
    for public_path in (
        "src/components/Navbar.jsx",
        "src/components/Footer.jsx",
        "public/sitemap.xml",
    ):
        if "/ops/connect/a1s" in (ROOT / public_path).read_text(
            encoding="utf-8", errors="strict"
        ):
            raise PreflightBlocked(f"private_route_publicly_linked:{public_path}")

    _require_markers(
        runtime,
        (
            "let bearerToken = null",
            "let authBoundaryReady = false",
            "let epoch = 0",
            "const activeControllers = new Set()",
            "invalidateMemory",
            "for (const controller of activeControllers) controller.abort()",
            "operation.epoch !== epoch",
            "issuedToken",
            "postLogout(transport, tokenToClose)",
            "async authStatus(",
            "async login(",
            "async logout(",
            "clear()",
            "dispose()",
            "client.operatorMe()",
            "client.tenants()",
            "client.tenantContext(tenantId)",
        ),
        "session_lifecycle",
    )
    _require_markers(
        page,
        (
            "session.authStatus(",
            "session.login(",
            "session.logout(",
            "session.clear()",
            "session.dispose()",
            "new AbortController()",
            "auth.expiresAt",
        ),
        "session_ui_lifecycle",
    )
    if "bearerToken" in page or "bearerToken" in app:
        raise PreflightBlocked("bearer_exposed_to_react_or_app")

    _require_markers(
        contract,
        (
            "RTM_CONNECT_A1S_F2_QUEUE_PAGE_SIZE = 200",
            "RTM_CONNECT_A1S_F2_QUEUE_MAX_ITEMS = 2000",
        ),
        "pagination_constants",
    )
    _require_markers(
        runtime,
        (
            "paginationVerified: false",
            "paginationVerified: true",
            "snapshotGuaranteed: false",
            "emptyStateAuthoritative: false",
            '"pagination_drift"',
            '"queue_limit_exceeded"',
            '"duplicate_task"',
            '"pagination_incomplete"',
            '"page_limit_exceeded"',
            "items: Object.freeze([])",
        ),
        "pagination",
    )
    context_position = runtime.find("await client.tenantContext(tenantId)")
    traversal_position = runtime.find(
        "await loadVerifiedRtmConnectA1SF2QueueTraversal(",
        context_position,
    )
    if context_position < 0 or traversal_position <= context_position:
        raise PreflightBlocked("tenant_context_not_validated_before_pagination")
    _require_markers(
        page,
        (
            "paginationVerified",
            "no ofrece cursor ni una instantánea consistente",
            "no constituye una garantía de instantánea consistente",
        ),
        "pagination_ui",
    )

    for marker in (
        'cache: "no-store"',
        'credentials: "same-origin"',
        'redirect: "error"',
        'referrerPolicy: "same-origin"',
    ):
        if runtime.count(marker) < 2 or marker not in read_client:
            raise PreflightBlocked(f"http_boundary_marker_missing:{marker}")

    return {
        "javascript_parsed_as_text_only": True,
        "javascript_imported": False,
        "runtime_wired": True,
        "runtime_executed": False,
        "private_lazy_route_wired": True,
        "private_route_publicly_linked": False,
        "gate_fail_closed_markers_verified": True,
        "session_lifecycle_markers_verified": True,
        "active_request_abort_markers_verified": True,
        "persistent_bearer_storage_absent": True,
        "legacy_ops_token_reference_absent": True,
        "bearer_exposed_to_react_or_app": False,
        "session_post_methods": 2,
        "session_post_routes": sorted(expected_auth_literals),
        "a1s_domain_get_only": True,
        "a1s_domain_mutations_absent": True,
        "generic_request_export_absent": "export function request" not in read_client,
        "direct_backend_origin_absent": True,
        "tenant_context_precedes_pagination": True,
        "pagination_traversal_bounded": True,
        "pagination_not_claimed_as_snapshot": True,
        "partial_items_discarded": True,
    }


def run(archive_path: Path) -> dict[str, Any]:
    archive, base_files = _audit_archive(archive_path)
    local_tree = _audit_local_tree(base_files)
    evidence = _audit_evidence()
    static_contract = _audit_static_contract()
    checks = {
        "exact_base_archive_sha256": archive["archive_sha256"] == BASE_ARCHIVE_SHA256,
        "exact_base_commit_comment": archive["archive_commit_comment"] == BASE_COMMIT_SHA40,
        "exact_base_snapshot": (
            archive["full_base_snapshot_sha256"] == BASE_SNAPSHOT_SHA256
        ),
        "exact_archive_shape": (
            archive["entries"] == EXPECTED_ARCHIVE_ENTRIES
            and archive["files"] == EXPECTED_BASE_FILES
            and archive["uncompressed_bytes"] == EXPECTED_UNCOMPRESSED_BYTES
        ),
        "archive_crc_valid": archive["crc_ok"] is True,
        "archive_members_safe": archive["safe_members"] is True,
        "base_99_files_content_equivalent": (
            local_tree["base_files_verified_unchanged"]
            == EXPECTED_UNCHANGED_BASE_FILES
            and local_tree["base_tree_content_equivalent_except_declared_replacement"]
            is True
        ),
        "app_only_base_replacement": (
            local_tree["replaced_base_paths"] == ["src/App.jsx"]
        ),
        "f2_overlay_allowlist_exact": (
            local_tree["overlay_allowlist_exact"] is True
            and local_tree["overlay_paths_present"] == 8
        ),
        "evidence_manifest_exact": evidence["evidence_manifest_exact"] is True,
        "evidence_hashes_exact": evidence["evidence_files_verified"] == 7,
        "runtime_wired_in_source": static_contract["runtime_wired"] is True,
        "runtime_not_executed_by_preflight": static_contract["runtime_executed"] is False,
        "private_lazy_gate_present": static_contract["private_lazy_route_wired"] is True,
        "session_lifecycle_static_boundary": (
            static_contract["session_lifecycle_markers_verified"] is True
            and static_contract["active_request_abort_markers_verified"] is True
        ),
        "persistent_bearer_storage_absent": (
            static_contract["persistent_bearer_storage_absent"] is True
        ),
        "legacy_ops_token_reference_absent": (
            static_contract["legacy_ops_token_reference_absent"] is True
        ),
        "a1s_domain_mutations_absent": (
            static_contract["a1s_domain_mutations_absent"] is True
        ),
        "only_login_logout_session_posts": (
            static_contract["session_post_methods"] == 2
        ),
        "tenant_context_before_pagination": (
            static_contract["tenant_context_precedes_pagination"] is True
        ),
        "bounded_pagination_without_snapshot_claim": (
            static_contract["pagination_traversal_bounded"] is True
            and static_contract["pagination_not_claimed_as_snapshot"] is True
        ),
        "routes_not_published": evidence["routes_published"] is False,
        "live_verdict_no_go": evidence["live_verdict"] == "no_go",
        "windows_build_console_report_recorded": (
            evidence["frontend_build_status"] == "passed"
            and evidence["windows_local_build_verification_completed"] is True
            and evidence["frontend_build_console_report_cryptographically_verified"]
            is False
        ),
    }
    failed_checks = sorted(name for name, passed in checks.items() if passed is not True)
    if failed_checks:
        raise PreflightBlocked(f"derived_checks_failed:{','.join(failed_checks)}")

    return {
        "ok": True,
        "authority": AUTHORITY,
        "version": VERSION,
        "contract_version": CONTRACT_VERSION,
        "base_commit_sha40": BASE_COMMIT_SHA40,
        "base_archive_sha256": BASE_ARCHIVE_SHA256,
        "base_snapshot_sha256": BASE_SNAPSHOT_SHA256,
        "f1_contract_base_commit_sha40": F1_BASE_COMMIT_SHA40,
        "backend_commit_sha40": BACKEND_COMMIT_SHA40,
        "backend_contract_version": BACKEND_CONTRACT_VERSION,
        "archive": archive,
        "local_tree": local_tree,
        "evidence": evidence,
        "static_contract": static_contract,
        "checks": checks,
        "blockers": [],
        "offline_only": True,
        "static_analysis_only": True,
        "javascript_imported": False,
        "runtime_wired": True,
        "runtime_executed": False,
        "routes_published": False,
        "route_publication_verified_live": False,
        "session_state_posts_present": True,
        "synthetic_case_data_only": True,
        "operator_access_personal_data_in_scope": True,
        "operator_personal_data_processing_expected": True,
        "real_case_or_client_data_allowed": False,
        "real_case_data_used": False,
        "read_only_domain": True,
        "workflow_mutations_available": False,
        "network_used": False,
        "database_touched": False,
        "external_effects_executed": False,
        "provider_contacted": False,
        "administration_contacted": False,
        "ocu_contacted": False,
        "b2_used": False,
        "production_authorized": False,
        "production_safe": False,
        "solely_automated_legal_decisions_allowed": False,
        "legal_compliance_claimed": False,
        "human_review_required_for_future_real_action": True,
        "snapshot_guaranteed": False,
        "empty_state_authoritative": False,
        "gate_status": evidence["gate_status"],
        "live_verdict": "no_go",
        "scope_limitations": [
            "preflight_is_static_offline_and_does_not_execute_javascript",
            "runtime_source_is_wired_but_was_not_executed",
            "route_source_exists_but_publication_was_not_tested",
            "same_origin_proxy_target_identity_is_not_proved_by_frontend_source",
            "authenticated_browser_smoke_was_not_executed_by_preflight",
            "windows_build_pass_is_an_unattested_operator_console_report",
            "preflight_does_not_execute_or_cryptographically_authenticate_the_build",
            "offset_pagination_does_not_provide_a_transactional_snapshot",
            "frontend_does_not_independently_attest_synthetic_dataset_origin",
            "archive_hash_and_comment_do_not_prove_authorship_or_git_ancestry",
            "real_data_external_effects_and_production_remain_no_go",
        ],
    }


def _source_wiring_present() -> bool:
    try:
        app = (ROOT / "src/App.jsx").read_text(encoding="utf-8")
        return (
            (ROOT / "src/lib/rtmConnectA1SF2Runtime.js").is_file()
            and "OpsA1SSyntheticReadOnly" in app
            and "a1sF2RouteEnabled" in app
        )
    except (OSError, UnicodeError):
        return False


def _blocked(exc: Exception) -> dict[str, Any]:
    return {
        "ok": False,
        "authority": AUTHORITY,
        "version": VERSION,
        "contract_version": CONTRACT_VERSION,
        "blockers": [
            f"frontend_connect_a1s_f2_blocked:{type(exc).__name__}:{exc}"
        ],
        "offline_only": True,
        "static_analysis_only": True,
        "javascript_imported": False,
        "runtime_wired": _source_wiring_present(),
        "runtime_executed": False,
        "routes_published": False,
        "route_publication_verified_live": False,
        "synthetic_case_data_only": True,
        "operator_access_personal_data_in_scope": True,
        "operator_personal_data_processing_expected": True,
        "real_case_or_client_data_allowed": False,
        "real_case_data_used": False,
        "read_only_domain": True,
        "workflow_mutations_available": False,
        "network_used": False,
        "database_touched": False,
        "external_effects_executed": False,
        "production_authorized": False,
        "production_safe": False,
        "solely_automated_legal_decisions_allowed": False,
        "legal_compliance_claimed": False,
        "human_review_required_for_future_real_action": True,
        "snapshot_guaranteed": False,
        "empty_state_authoritative": False,
        "gate_status": "blocked",
        "live_verdict": "no_go",
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--archive", required=True)
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args(argv)
    try:
        result = run(Path(args.archive).expanduser().resolve())
        exit_code = 0
    except Exception as exc:  # fail closed at the CLI boundary
        result = _blocked(exc)
        exit_code = 1
    if args.compact:
        print(
            json.dumps(
                result,
                ensure_ascii=False,
                sort_keys=True,
                separators=(",", ":"),
            )
        )
    else:
        print(json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
