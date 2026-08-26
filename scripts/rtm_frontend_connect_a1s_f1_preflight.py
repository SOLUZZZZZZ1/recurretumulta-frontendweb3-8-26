"""Preflight offline del contrato frontend RTM CONNECT A1-S F1.

No importa JavaScript, no extrae el archivo, no usa red y no ejecuta runtime.
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


VERSION = "rtm_frontend_connect_a1s_f1_preflight_v1_0"
AUTHORITY = "rtm_frontend_connect_a1s_f1_preflight"
CONTRACT_VERSION = "rtm.connect.frontend.a1s.read.v1"
BASE_COMMIT_SHA40 = "92aeac70f93d7f1df645019b0e7f3d83b230ea4d"
BASE_ARCHIVE_SHA256 = (
    "d9e032668f2c1dce22196c3d1a801cf31e90afb289c4c24c7b7b9233870e64d5"
)
BASE_SNAPSHOT_SHA256 = (
    "68394b4dac2a2e15c2c98f629723181ff688dc6b90856d4a94ebd597e267d541"
)
BACKEND_COMMIT_SHA40 = "eb5ead955ba54bcb829c56ee9afdc5c939ec36da"
EXPECTED_ARCHIVE_ENTRIES = 95
EXPECTED_BASE_FILES = 90
EXPECTED_UNCOMPRESSED_BYTES = 8_968_828
MAX_ARCHIVE_MEMBER_BYTES = 4_000_000

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_PATH = "docs/rtm_connect/RTM_FRONTEND_CONNECT_A1S_F1_EVIDENCE.json"
OVERLAY_PATHS = (
    "docs/rtm_connect/RTM_FRONTEND_CONNECT_A1S_F1.md",
    EVIDENCE_PATH,
    "scripts/rtm_frontend_connect_a1s_f1_preflight.py",
    "src/lib/rtmConnectA1SReadClient.js",
    "src/lib/rtmConnectA1SReadContract.js",
    "tests/test_rtm_frontend_connect_a1s_f1_contract.py",
)
HASHED_OVERLAY_PATHS = tuple(path for path in OVERLAY_PATHS if path != EVIDENCE_PATH)
IGNORED_TREE_PARTS = frozenset({".git", "node_modules", "dist", "__pycache__"})
RUNTIME_WIRING_FILES = (
    "src/App.jsx",
    "src/main.jsx",
    "src/pages/OpsCaseDetail.jsx",
    "src/pages/OpsCaseDetailPro.jsx",
    "src/components/OpsCaseDetail.jsx",
)


class PreflightBlocked(RuntimeError):
    pass


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
    return text.replace("\r\n", "\n").replace("\r", "\n").encode("utf-8")


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
        raise PreflightBlocked(f"evidence_json_invalid:{type(exc).__name__}") from exc
    if not isinstance(value, dict):
        raise PreflightBlocked("evidence_json_not_object")
    return value


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
            special_entries = []
            for info in infos:
                mode = _zip_mode(info)
                if stat.S_ISLNK(mode):
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
    if any(path in files for path in OVERLAY_PATHS):
        raise PreflightBlocked("f1_overlay_not_absent_from_base")

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
            "f1_overlay_absent_from_base_archive": True,
        },
        files,
    )


def _audit_local_tree(base_files: dict[str, bytes]) -> dict[str, Any]:
    raw = 0
    newline = 0
    missing: list[str] = []
    mismatched: list[str] = []
    for name, expected in sorted(base_files.items()):
        target = ROOT / name
        if not target.is_file():
            missing.append(name)
            continue
        mode = _compare_content(expected, target.read_bytes())
        if mode == "raw":
            raw += 1
        elif mode == "newline_canonical":
            newline += 1
        else:
            mismatched.append(name)
    if missing:
        raise PreflightBlocked(f"base_files_missing:{','.join(missing[:5])}")
    if mismatched:
        raise PreflightBlocked(f"base_files_changed:{','.join(mismatched[:5])}")

    missing_overlay = [path for path in OVERLAY_PATHS if not (ROOT / path).is_file()]
    if missing_overlay:
        raise PreflightBlocked(
            f"overlay_paths_missing:{','.join(missing_overlay)}"
        )

    permitted = set(base_files) | set(OVERLAY_PATHS)
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
            relative = path.relative_to(ROOT).as_posix()
            if any(part in IGNORED_TREE_PARTS for part in path.relative_to(ROOT).parts):
                continue
            if path.is_symlink() or not path.is_file():
                unexpected_special.append(relative)
                continue
            actual_files.add(relative)

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
        raise PreflightBlocked(
            f"unexpected_tree_paths:{','.join(unexpected[:8])}"
        )

    digest = hashlib.sha256()
    for name in sorted(OVERLAY_PATHS):
        digest.update(name.encode("utf-8"))
        digest.update(b"\0")
        digest.update(hashlib.sha256((ROOT / name).read_bytes()).digest())
        digest.update(b"\0")
    return {
        "base_files_verified": len(base_files),
        "raw_byte_exact_files": raw,
        "newline_canonical_equivalent_files": newline,
        "base_tree_content_equivalent": True,
        "comparison_mode": "strict_utf8_crlf_to_lf_or_binary_raw_v1",
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
        "version": "rtm_frontend_connect_a1s_f1_evidence_v1_0",
        "contract_version": CONTRACT_VERSION,
        "status": "passed_offline_contract",
        "gate_status": "passed_offline_contract",
        "live_verdict": "no_go",
        "base_commit_sha40": BASE_COMMIT_SHA40,
        "base_archive_sha256": BASE_ARCHIVE_SHA256,
        "backend_commit_sha40": BACKEND_COMMIT_SHA40,
    }
    for field, expected in exact_fields.items():
        if evidence.get(field) != expected:
            raise PreflightBlocked(f"evidence_field_mismatch:{field}")
    exact_booleans = {
        "synthetic_only": True,
        "read_only": True,
        "offline_only": True,
        "runtime_wired": False,
        "routes_published": False,
        "mutations_available": False,
        "production_authorized": False,
        "production_safe": False,
        "real_data_used": False,
        "network_used": False,
        "provider_contacted": False,
        "administration_contacted": False,
        "ocu_contacted": False,
        "b2_used": False,
        "external_effects_executed": False,
        "visual_refresh_included": False,
        "banking_family_included": False,
        "public_ai_transparency_included": False,
        "solely_automated_legal_decisions_allowed": False,
    }
    for field, expected in exact_booleans.items():
        if evidence.get(field) is not expected:
            raise PreflightBlocked(f"evidence_boundary_mismatch:{field}")

    test_status = evidence.get("test_status")
    if test_status != "passed":
        raise PreflightBlocked("evidence_tests_not_passed")

    build_status = evidence.get("frontend_build_status")
    accepted_build_statuses = {
        "passed",
        "not_executed_in_linux_windows_native_dependency",
    }
    if build_status not in accepted_build_statuses:
        raise PreflightBlocked("evidence_frontend_build_status_invalid")
    windows_verification_required = evidence.get(
        "windows_local_build_verification_required"
    )
    if (
        build_status == "not_executed_in_linux_windows_native_dependency"
        and windows_verification_required is not True
    ):
        raise PreflightBlocked("evidence_windows_local_build_verification_not_required")
    if build_status == "passed" and windows_verification_required not in (None, False):
        raise PreflightBlocked("evidence_windows_local_build_verification_conflicts")

    evidence_checks = evidence.get("checks")
    if not isinstance(evidence_checks, dict):
        raise PreflightBlocked("evidence_checks_not_object")
    deprecated_check_names = {
        "response_contract_fail_closed",
        "legacy_ops_token_reuse_absent",
    }
    present_deprecated = sorted(deprecated_check_names & set(evidence_checks))
    if present_deprecated:
        raise PreflightBlocked(
            f"evidence_deprecated_check_names:{','.join(present_deprecated)}"
        )
    for name in (
        "response_schema_fail_closed",
        "legacy_ops_token_reference_absent",
    ):
        if evidence_checks.get(name) is not True:
            raise PreflightBlocked(f"evidence_required_check_not_true:{name}")
    if evidence.get("ai_act_requirements_frozen") is not True:
        raise PreflightBlocked("evidence_ai_act_requirements_not_frozen")
    if evidence.get("human_review_required") is not True:
        raise PreflightBlocked("evidence_human_review_not_required")
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
    return {
        "evidence_manifest_exact": True,
        "evidence_files_verified": len(HASHED_OVERLAY_PATHS),
        "status": evidence["status"],
        "visual_refresh_deferred": evidence.get("visual_refresh_deferred") is True,
        "banking_family_deferred": evidence.get("banking_family_deferred") is True,
        "ai_act_requirements_frozen": True,
        "human_review_required": True,
        "test_status": test_status,
        "frontend_build_status": build_status,
        "windows_local_build_verification_required":
            windows_verification_required is True,
    }


def _audit_static_contract() -> dict[str, Any]:
    contract = (ROOT / "src/lib/rtmConnectA1SReadContract.js").read_text(
        encoding="utf-8"
    )
    client = (ROOT / "src/lib/rtmConnectA1SReadClient.js").read_text(
        encoding="utf-8"
    )
    joined = contract + "\n" + client
    forbidden_tokens = (
        "localStorage",
        "sessionStorage",
        "document.cookie",
        "ops_token",
        "X-Operator-Token",
        "recurretumulta-backend-1.onrender.com",
    )
    present_forbidden = [token for token in forbidden_tokens if token in joined]
    if present_forbidden:
        raise PreflightBlocked(
            f"forbidden_client_tokens:{','.join(present_forbidden)}"
        )
    mutation_methods = re.findall(
        r"method\s*:\s*[\"'](POST|PUT|PATCH|DELETE)[\"']", client, re.I
    )
    if mutation_methods:
        raise PreflightBlocked("a1s_mutation_method_present")
    if re.search(r"https?://", client, re.I):
        raise PreflightBlocked("direct_origin_present_in_client")
    if 'method: "GET"' not in client:
        raise PreflightBlocked("client_get_transport_missing")

    gate_markers = (
        "evaluateA1SFrontendGate," in client,
        "const gate = evaluateA1SFrontendGate(runtimeContext);" in client,
        "if (!gate.allowed)" in client,
        "const gate = requireRuntimeGate(runtimeContext);" in client,
        'input.protocol !== "https:"' in contract,
        "FORBIDDEN_PRODUCTION_HOSTS.has(hostname)" in contract,
        'input.operatorAuthEnabled !== "1"' in contract,
        "input.frontendBaseCommit !== RTM_CONNECT_A1S_BASE_COMMIT" in contract,
        "input.backendCommit !== RTM_CONNECT_A1S_BACKEND_COMMIT" in contract,
    )
    client_runtime_gate_enforced = all(gate_markers)
    if not client_runtime_gate_enforced:
        raise PreflightBlocked("client_runtime_gate_not_enforced")

    response_schema_markers = (
        re.search(r"envelope\.synthetic_only\s*!==\s*true", contract),
        re.search(r"envelope\.read_only\s*!==\s*true", contract),
        re.search(
            r"envelope\.live_verdict\s*!==\s*[\"']no_go[\"']",
            contract,
        ),
    )
    response_schema_fail_closed = all(response_schema_markers)
    if not response_schema_fail_closed:
        raise PreflightBlocked("response_schema_not_fail_closed")
    for marker in (
        'cache: "no-store"',
        'credentials: "same-origin"',
        'redirect: "error"',
        "assertSafeA1SEnvelope",
        "evaluateA1SFrontendGate",
        "receiptOptions",
    ):
        if marker not in joined:
            raise PreflightBlocked(f"required_client_marker_missing:{marker}")

    wiring_hits: list[str] = []
    for name in RUNTIME_WIRING_FILES:
        text = (ROOT / name).read_text(encoding="utf-8")
        if "rtmConnectA1SRead" in text or "RTM_CONNECT_A1S" in text:
            wiring_hits.append(name)
    if wiring_hits:
        raise PreflightBlocked(f"runtime_wiring_present:{','.join(wiring_hits)}")

    package = _read_json(ROOT / "package.json")
    serialized_package = json.dumps(package, sort_keys=True)
    if "a1s" in serialized_package.lower():
        raise PreflightBlocked("package_runtime_wiring_present")

    return {
        "javascript_parsed_as_text_only": True,
        "runtime_modules_imported": False,
        "runtime_wiring_present": False,
        "read_methods_only": True,
        "generic_request_export_absent": "export function request" not in client,
        "persistent_bearer_storage_absent": True,
        "legacy_ops_token_reference_absent": not any(
            token in joined for token in ("ops_token", "X-Operator-Token")
        ),
        "direct_backend_origin_absent": True,
        "response_schema_fail_closed": response_schema_fail_closed,
        "client_runtime_gate_enforced": client_runtime_gate_enforced,
        "visual_files_changed": any(
            path.startswith(("public/", "src/pages/", "src/components/"))
            or path.endswith(".css")
            for path in OVERLAY_PATHS
        ),
    }


def run(archive_path: Path) -> dict[str, Any]:
    archive, base_files = _audit_archive(archive_path)
    local_tree = _audit_local_tree(base_files)
    evidence = _audit_evidence()
    static_contract = _audit_static_contract()
    checks = {
        "exact_base_archive_sha256":
            archive["archive_sha256"] == BASE_ARCHIVE_SHA256,
        "exact_base_commit_comment":
            archive["archive_commit_comment"] == BASE_COMMIT_SHA40,
        "archive_crc_valid": archive["crc_ok"] is True,
        "archive_members_safe": archive["safe_members"] is True,
        "full_base_tree_content_equivalent":
            local_tree["base_tree_content_equivalent"] is True,
        "f1_overlay_absent_from_base_archive":
            archive["f1_overlay_absent_from_base_archive"] is True,
        "f1_overlay_allowlist_exact":
            local_tree["overlay_allowlist_exact"] is True
            and local_tree["overlay_paths_present"] == len(OVERLAY_PATHS),
        "evidence_manifest_exact": evidence["evidence_manifest_exact"] is True,
        "runtime_wiring_absent":
            static_contract["runtime_wiring_present"] is False,
        "a1s_mutations_absent": static_contract["read_methods_only"] is True,
        "same_origin_get_client_only":
            static_contract["read_methods_only"] is True
            and static_contract["direct_backend_origin_absent"] is True,
        "response_schema_fail_closed":
            static_contract["response_schema_fail_closed"] is True,
        "production_gate_blocked":
            static_contract["client_runtime_gate_enforced"] is True,
        "persistent_bearer_storage_absent":
            static_contract["persistent_bearer_storage_absent"] is True,
        "legacy_ops_token_reference_absent":
            static_contract["legacy_ops_token_reference_absent"] is True,
        "tests_passed": evidence["test_status"] == "passed",
        "frontend_build_status_accepted": evidence["frontend_build_status"]
            in {"passed", "not_executed_in_linux_windows_native_dependency"},
        "visual_refresh_deferred": evidence["visual_refresh_deferred"] is True,
        "banking_family_deferred": evidence["banking_family_deferred"] is True,
        "ai_act_requirements_frozen":
            evidence["ai_act_requirements_frozen"] is True,
        "human_review_required_before_runtime":
            evidence["human_review_required"] is True,
    }
    failed_checks = sorted(name for name, passed in checks.items() if passed is not True)
    if failed_checks:
        raise PreflightBlocked(f"derived_checks_failed:{','.join(failed_checks)}")
    return {
        "ok": True,
        "safe": True,
        "authority": AUTHORITY,
        "version": VERSION,
        "contract_version": CONTRACT_VERSION,
        "base_commit_sha40": BASE_COMMIT_SHA40,
        "base_archive_sha256": BASE_ARCHIVE_SHA256,
        "backend_commit_sha40": BACKEND_COMMIT_SHA40,
        "archive": archive,
        "local_tree": local_tree,
        "evidence": evidence,
        "static_contract": static_contract,
        "checks": checks,
        "blockers": [],
        "offline_only": True,
        "read_only": True,
        "synthetic_only": True,
        "runtime_imported": False,
        "runtime_wired": False,
        "routes_published": False,
        "mutations_available": False,
        "network_used": False,
        "database_touched": False,
        "provider_contacted": False,
        "administration_contacted": False,
        "ocu_contacted": False,
        "b2_used": False,
        "real_data_used": False,
        "external_effects_executed": False,
        "production_authorized": False,
        "production_safe": False,
        "visual_refresh_included": False,
        "banking_family_included": False,
        "public_ai_transparency_included": False,
        "ai_act_requirements_frozen": True,
        "human_review_required": True,
        "solely_automated_legal_decisions_allowed": False,
        "gate_status": "passed_offline_contract",
        "live_verdict": "no_go",
        "scope_limitations": [
            "f1_does_not_wire_or_render_a_runtime_ui",
            "f1_does_not_implement_individual_login_or_logout",
            "f1_does_not_execute_http_or_validate_a_live_backend",
            "f1_does_not_expose_a_case_id_queue_filter",
            "f1_does_not_enable_any_a1s_mutation",
            "visual_refresh_and_public_banking_family_are_separate_overlays",
            "archive_hash_and_comment_do_not_prove_commit_authorship",
            "git_archive_does_not_prove_commit_ancestry_or_supply_chain_signature",
            "real_data_live_filing_and_production_remain_no_go",
        ],
    }


def _blocked(exc: Exception) -> dict[str, Any]:
    return {
        "ok": False,
        "safe": False,
        "authority": AUTHORITY,
        "version": VERSION,
        "contract_version": CONTRACT_VERSION,
        "blockers": [f"frontend_connect_a1s_f1_blocked:{type(exc).__name__}:{exc}"],
        "offline_only": True,
        "read_only": True,
        "synthetic_only": True,
        "runtime_imported": False,
        "runtime_wired": False,
        "routes_published": False,
        "mutations_available": False,
        "network_used": False,
        "database_touched": False,
        "provider_contacted": False,
        "administration_contacted": False,
        "ocu_contacted": False,
        "b2_used": False,
        "real_data_used": False,
        "external_effects_executed": False,
        "production_authorized": False,
        "production_safe": False,
        "visual_refresh_included": False,
        "banking_family_included": False,
        "public_ai_transparency_included": False,
        "ai_act_requirements_frozen": True,
        "human_review_required": True,
        "solely_automated_legal_decisions_allowed": False,
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
        print(json.dumps(result, ensure_ascii=False, sort_keys=True, separators=(",", ":")))
    else:
        print(json.dumps(result, ensure_ascii=False, sort_keys=True, indent=2))
    return exit_code


if __name__ == "__main__":
    raise SystemExit(main())
