"""Preflight offline de la firma publica RTM «Resuelve tus movidas» V1.

No importa JavaScript, no extrae el ZIP, no usa red, no escribe archivos y no
ejecuta el frontend. Un resultado ``ok`` solo acredita el contrato estatico
declarado; no acredita derechos de marca, conformidad legal ni produccion.
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


VERSION = "rtm_frontend_brand_tagline_v1_preflight_v1_1"
AUTHORITY = "rtm_frontend_brand_tagline_v1_preflight"
CONTRACT_VERSION = "rtm.frontend.brand.tagline.v1"

BASE_COMMIT_SHA40 = "809a7e21f9453522df8f2728033c1ee3d6583014"
BASE_ARCHIVE_SHA256 = (
    "ebe091f9a0f85d52dc8af2eb88b4aab80eae77fd7cc327dc7e035e614d433453"
)
BASE_SNAPSHOT_SHA256 = (
    "954298840c3d7f899c1f798e63075ffb5a4dc5dbcf516629f1dc17e2cdf9e9d9"
)
EXPECTED_ARCHIVE_ENTRIES = 116
EXPECTED_BASE_FILES = 107
EXPECTED_UNCHANGED_BASE_FILES = 101
EXPECTED_UNCOMPRESSED_BYTES = 11_204_110
MAX_ARCHIVE_MEMBER_BYTES = 4_000_000

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_PATH = "docs/rtm_connect/RTM_FRONTEND_BRAND_TAGLINE_V1_EVIDENCE.json"
REPLACED_BASE_PATHS = (
    "index.html",
    "src/components/Footer.jsx",
    "src/components/Navbar.jsx",
    "src/components/Seo.jsx",
    "src/index.css",
    "src/pages/InicioRTM.jsx",
)
NEW_OVERLAY_PATHS = (
    "docs/rtm_connect/RTM_FRONTEND_BRAND_TAGLINE_V1.md",
    EVIDENCE_PATH,
    "scripts/rtm_frontend_brand_tagline_v1_preflight.py",
    "tests/test_rtm_frontend_brand_tagline_v1_contract.py",
)
OVERLAY_PATHS = (
    "docs/rtm_connect/RTM_FRONTEND_BRAND_TAGLINE_V1.md",
    EVIDENCE_PATH,
    "index.html",
    "scripts/rtm_frontend_brand_tagline_v1_preflight.py",
    "src/components/Footer.jsx",
    "src/components/Navbar.jsx",
    "src/components/Seo.jsx",
    "src/index.css",
    "src/pages/InicioRTM.jsx",
    "tests/test_rtm_frontend_brand_tagline_v1_contract.py",
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
    if b"\0" in value:
        return None
    try:
        text = value.decode("utf-8", "strict")
    except UnicodeDecodeError:
        return None
    if "\r" in text.replace("\r\n", ""):
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
        raise PreflightBlocked(f"{boundary}_markers_missing:{','.join(missing[:8])}")


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
                if stat.S_ISLNK(mode) or file_type not in {0, stat.S_IFREG, stat.S_IFDIR}:
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
            f"new_overlay_present_in_base:{','.join(unexpected_overlay)}"
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
            "new_overlay_absent_from_base_archive": True,
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
            if name not in IGNORED_TREE_PARTS and not (current_path / name).is_symlink()
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
        "base_tree_content_equivalent_except_declared_replacements": True,
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
        "version": "rtm_frontend_brand_tagline_v1_evidence_v1_1",
        "contract_version": CONTRACT_VERSION,
        "status": "passed_windows_build_and_full_suite_operator_report",
        "gate_status": "blocked_pending_visual_and_legal_review",
        "live_verdict": "no_go",
        "base_commit_sha40": BASE_COMMIT_SHA40,
        "base_archive_sha256": BASE_ARCHIVE_SHA256,
        "base_snapshot_sha256": BASE_SNAPSHOT_SHA256,
        "public_brand_signature": "RTM · Resuelve tus movidas",
        "public_tagline": "Resuelve tus movidas",
        "frontend_build_status": "passed_operator_console_report",
        "test_status": "passed_full_suite_operator_console_report",
    }
    for field, expected in exact_fields.items():
        if evidence.get(field) != expected:
            raise PreflightBlocked(f"evidence_field_mismatch:{field}")

    exact_booleans = {
        "existing_logo_asset_changed": False,
        "new_raster_brand_asset_added": False,
        "og_asset_changed": False,
        "legacy_service_identity_removed": False,
        "legal_compliance_claimed": False,
        "brand_rights_verified": False,
        "trademark_clearance_completed": False,
        "legal_review_completed": False,
        "commercial_tagline_intended_as_result_guarantee": False,
        "visible_no_results_guarantee_preserved": True,
        "route_literal_surface_changed": False,
        "api_surface_changed": False,
        "data_processing_surface_changed": False,
        "network_surface_added": False,
        "database_touched": False,
        "external_effects_executed": False,
        "provider_contacted": False,
        "administration_contacted": False,
        "ocu_contacted": False,
        "real_case_data_used": False,
        "runtime_executed": False,
        "routes_published": False,
        "production_authorized": False,
        "production_safe": False,
        "live_visual_verified": False,
        "computed_accessible_name_verified": False,
        "windows_local_build_verification_required": False,
        "windows_local_build_verification_completed": True,
        "frontend_build_attempted_for_current_revision": True,
        "frontend_build_executed_for_current_revision": True,
        "frontend_build_console_report_cryptographically_verified": False,
        "frontend_build_artifacts_hash_frozen": False,
        "full_suite_console_report_cryptographically_verified": False,
    }
    for field, expected in exact_booleans.items():
        if evidence.get(field) is not expected:
            raise PreflightBlocked(f"evidence_boundary_mismatch:{field}")

    exact_counts = {
        "brand_contract_tests_passed": 19,
        "frontend_build_modules_transformed": 81,
        "full_suite_tests_discovered": 122,
        "full_suite_tests_passed": 122,
        "full_suite_tests_failed": 0,
    }
    for field, expected in exact_counts.items():
        if evidence.get(field) != expected:
            raise PreflightBlocked(f"evidence_count_mismatch:{field}")
    if evidence.get("full_suite_status") != "passed_operator_console_report":
        raise PreflightBlocked("evidence_full_suite_status_mismatch")
    if evidence.get("full_suite_failure_scope") != "none_reported":
        raise PreflightBlocked("evidence_full_suite_scope_mismatch")
    if evidence.get("frontend_build_reported_duration_seconds") != 8.07:
        raise PreflightBlocked("evidence_build_duration_mismatch")
    if evidence.get("frontend_build_warnings") != [
        "baseline_browserslist_caniuse_lite_is_outdated",
        "baseline_minified_chunk_exceeds_500_kb",
    ]:
        raise PreflightBlocked("evidence_build_warnings_mismatch")

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
    required_checks = {
        "exact_live_tagline_in_navbar",
        "accessible_home_link_name_declared",
        "logo_is_decorative_inside_named_link",
        "keyboard_focus_style_present",
        "current_main_navigation_page_announced",
        "tagline_rules_declared_at_breakpoints",
        "exact_brand_signature_in_home_metadata_and_footer",
        "legacy_domain_and_legal_links_preserved",
        "no_results_guarantee_preserved",
        "travel_landing_duplicate_removed_without_destination_change",
        "no_route_api_or_connect_runtime_change",
        "no_new_network_process_or_dynamic_html_surface",
        "overlay_allowlist_exact",
    }
    if not isinstance(checks, dict) or set(checks) != required_checks:
        raise PreflightBlocked("evidence_checks_manifest_mismatch")
    if any(value is not True for value in checks.values()):
        raise PreflightBlocked("evidence_checks_not_true")

    return {
        "evidence_manifest_exact": True,
        "evidence_files_verified": len(HASHED_OVERLAY_PATHS),
        "status": evidence["status"],
        "gate_status": evidence["gate_status"],
        "test_status": evidence["test_status"],
        "brand_contract_tests_passed": 19,
        "full_suite_status": evidence["full_suite_status"],
        "full_suite_tests_discovered": 122,
        "full_suite_tests_passed": 122,
        "full_suite_tests_failed": 0,
        "frontend_build_status": evidence["frontend_build_status"],
        "frontend_build_modules_transformed": 81,
        "frontend_build_reported_duration_seconds": 8.07,
        "frontend_build_console_report_cryptographically_verified": False,
        "frontend_build_artifacts_hash_frozen": False,
        "full_suite_console_report_cryptographically_verified": False,
        "windows_local_build_verification_required": False,
        "live_visual_verified": False,
        "computed_accessible_name_verified": False,
        "brand_rights_verified": False,
        "legal_compliance_claimed": False,
    }


def _css_block(css: str, selector: str) -> str:
    match = re.search(re.escape(selector) + r"\s*\{([^{}]*)\}", css, re.S)
    if not match:
        raise PreflightBlocked(f"css_selector_missing:{selector}")
    return match.group(1)


def _audit_static_contract(base_files: dict[str, bytes]) -> dict[str, Any]:
    navbar = (ROOT / "src/components/Navbar.jsx").read_text(encoding="utf-8")
    footer = (ROOT / "src/components/Footer.jsx").read_text(encoding="utf-8")
    seo = (ROOT / "src/components/Seo.jsx").read_text(encoding="utf-8")
    home = (ROOT / "src/pages/InicioRTM.jsx").read_text(encoding="utf-8")
    css = (ROOT / "src/index.css").read_text(encoding="utf-8")
    index = (ROOT / "index.html").read_text(encoding="utf-8")
    changed_sources = {
        "src/components/Navbar.jsx": navbar,
        "src/components/Footer.jsx": footer,
        "src/components/Seo.jsx": seo,
        "src/pages/InicioRTM.jsx": home,
        "index.html": index,
    }

    _require_markers(
        navbar,
        (
            'aria-label="RTM — Resuelve tus movidas. Ir al inicio"',
            '<span className="rtm-navbar-logo-frame" aria-hidden="true">',
            '<img src={logo} alt="" className="rtm-navbar-logo" />',
            '<span className="rtm-navbar-tagline">Resuelve tus movidas</span>',
            'landingLabel: "Ver todos los servicios de viajes"',
            'aria-current={pathname === "/" ? "page" : undefined}',
            'aria-current={servicesActive ? "true" : undefined}',
            'pathname === group.landing ? "page" : undefined',
            'aria-current={active ? "page" : undefined}',
        ),
        "navbar_brand",
    )
    if navbar.count('pathname === group.landing ? "page" : undefined') < 2:
        raise PreflightBlocked("service_landing_current_page_not_fully_announced")
    if navbar.count('aria-current={active ? "page" : undefined}') < 2:
        raise PreflightBlocked("active_service_and_main_links_not_fully_announced")
    if navbar.count('landing: "/viajes"') != 1:
        raise PreflightBlocked("travel_landing_not_exactly_once")
    if "rtm-navbar-tagline-lead" in navbar or "rtm-navbar-tagline-accent" in navbar:
        raise PreflightBlocked("tagline_fragmented_in_dom")

    brand_block = _css_block(css, ".rtm-navbar-brand")
    tagline_block = _css_block(css, ".rtm-navbar-tagline")
    focus_block = _css_block(css, ".rtm-navbar-brand:focus-visible")
    _require_markers(
        tagline_block,
        (
            "border-left: 1px solid rgba(255,255,255,.42)",
            "color: #a7f57a",
            "font-size: 17px",
            "font-style: italic",
            "font-weight: 850",
            "white-space: nowrap",
        ),
        "tagline_css",
    )
    _require_markers(brand_block, ("min-width: 0", "display: flex"), "brand_css")
    _require_markers(
        focus_block,
        ("outline: 3px solid #fff", "outline-offset: -4px"),
        "focus_css",
    )
    if any(marker in tagline_block for marker in ("display: none", "opacity: 0", "visibility: hidden")):
        raise PreflightBlocked("tagline_hidden_in_base_css")
    if css.count(".rtm-navbar-tagline {") != 4:
        raise PreflightBlocked("tagline_breakpoint_contract_mismatch")
    _require_markers(
        css,
        (
            "@media (max-width: 980px)",
            "font-size: 16px",
            "@media (max-width: 640px)",
            "max-width: 105px",
            "font-size: 13px",
            "@media (max-width: 380px)",
            "max-width: 72px",
            "font-size: 11px",
            ".rtm-footer-brand-tagline",
        ),
        "responsive_brand_css",
    )
    if "rtm-navbar-tagline-lead" in css or "rtm-navbar-tagline-accent" in css:
        raise PreflightBlocked("obsolete_tagline_css_present")
    base_css = base_files["src/index.css"].decode("utf-8", "strict")
    for token in ("@import", "javascript:"):
        if css.count(token) != base_css.count(token):
            raise PreflightBlocked(f"css_surface_count_changed:{token}")
    content_property = re.compile(r"(?:^|\n)\s*content\s*:", re.I)
    if len(content_property.findall(css)) != len(content_property.findall(base_css)):
        raise PreflightBlocked("css_surface_count_changed:content_property")

    _require_markers(
        index,
        (
            '<html lang="es">',
            "<title>RTM · Resuelve tus movidas</title>",
            'href="/favicon-32.png"',
            'href="/favicon-16.png"',
            '<div id="root"></div>',
            'src="/src/main.jsx"',
        ),
        "index_metadata",
    )
    _require_markers(
        seo,
        (
            'title = "RTM · Resuelve tus movidas"',
            'canonical = "https://www.recurretumulta.eu/"',
            'image = "https://www.recurretumulta.eu/og-recurretumulta.png?v=2"',
            'content="RTM · Resuelve tus movidas"',
        ),
        "seo_brand",
    )
    _require_markers(
        home,
        (
            'title="RTM · Resuelve tus movidas"',
            "RTM · Resuelve tus movidas",
            "¿En qué asunto necesita ayuda?",
            "Seleccione el área relacionada con su problema.",
        ),
        "home_brand",
    )
    _require_markers(
        footer,
        (
            '<span className="rtm-footer-brand-name">RTM</span>',
            '<span className="rtm-footer-brand-tagline">Resuelve tus movidas</span>',
            "RTM · Resuelve tus movidas",
            "soporte@recurretumulta.eu",
            'to="/aviso-legal"',
            'to="/privacidad"',
            'to="/cookies"',
            "RTM presta servicios de asistencia y, cuando corresponde, asesoramiento",
            "jurídico; no garantiza un resultado favorable.",
            "www.recurretumulta.eu",
        ),
        "footer_brand_and_legal",
    )

    forbidden_runtime_markers = (
        "fetch(",
        "XMLHttpRequest",
        "WebSocket",
        "EventSource",
        "navigator.sendBeacon",
        "dangerouslySetInnerHTML",
        "eval(",
        "new Function",
    )
    for path, actual in changed_sources.items():
        baseline = base_files[path].decode("utf-8", "strict")
        for marker in forbidden_runtime_markers:
            if actual.count(marker) != baseline.count(marker):
                raise PreflightBlocked(f"runtime_surface_count_changed:{path}:{marker}")

    route_literal = re.compile(r'''["'](/[^"']*)["']''')
    for path, actual in changed_sources.items():
        baseline = base_files[path].decode("utf-8", "strict")
        if set(route_literal.findall(actual)) != set(route_literal.findall(baseline)):
            raise PreflightBlocked(f"route_literal_surface_changed:{path}")
    base_css_urls = set(re.findall(r"url\(([^)]+)\)", base_css))
    current_css_urls = set(re.findall(r"url\(([^)]+)\)", css))
    if current_css_urls != base_css_urls:
        raise PreflightBlocked("css_url_surface_changed")

    logo_path = ROOT / "public/rtm-logo-transparente-recortado.png"
    if not logo_path.is_file():
        raise PreflightBlocked("existing_logo_asset_missing")

    return {
        "javascript_parsed_as_text_only": True,
        "javascript_imported": False,
        "runtime_executed": False,
        "exact_live_tagline_in_navbar": True,
        "accessible_home_link_name_declared": True,
        "logo_is_decorative_inside_named_link": True,
        "existing_logo_asset_present": True,
        "existing_logo_asset_changed": False,
        "keyboard_focus_style_present": True,
        "current_main_navigation_page_announced": True,
        "tagline_breakpoints_declared": [980, 640, 380],
        "tagline_not_hidden_by_declared_rules": True,
        "brand_signature_in_home_metadata_and_footer": True,
        "legacy_domain_and_legal_links_preserved": True,
        "no_results_guarantee_preserved": True,
        "travel_landing_count": 1,
        "travel_landing_destination_preserved": True,
        "route_literal_surface_changed": False,
        "api_surface_changed": False,
        "data_processing_surface_changed": False,
        "new_network_or_dynamic_html_surface_absent": True,
        "og_asset_url_preserved": True,
    }


def run(archive_path: Path) -> dict[str, Any]:
    archive, base_files = _audit_archive(archive_path)
    local_tree = _audit_local_tree(base_files)
    evidence = _audit_evidence()
    static_contract = _audit_static_contract(base_files)
    checks = {
        "exact_base_archive_sha256": archive["archive_sha256"] == BASE_ARCHIVE_SHA256,
        "exact_base_commit_comment": archive["archive_commit_comment"] == BASE_COMMIT_SHA40,
        "exact_base_snapshot": archive["full_base_snapshot_sha256"] == BASE_SNAPSHOT_SHA256,
        "exact_archive_shape": (
            archive["entries"] == EXPECTED_ARCHIVE_ENTRIES
            and archive["files"] == EXPECTED_BASE_FILES
            and archive["uncompressed_bytes"] == EXPECTED_UNCOMPRESSED_BYTES
        ),
        "archive_crc_valid": archive["crc_ok"] is True,
        "archive_members_safe": archive["safe_members"] is True,
        "base_101_files_content_equivalent": (
            local_tree["base_files_verified_unchanged"] == EXPECTED_UNCHANGED_BASE_FILES
        ),
        "six_declared_base_replacements": len(local_tree["replaced_base_paths"]) == 6,
        "brand_overlay_allowlist_exact": (
            local_tree["overlay_allowlist_exact"] is True
            and local_tree["overlay_paths_present"] == 10
        ),
        "evidence_manifest_exact": evidence["evidence_manifest_exact"] is True,
        "evidence_hashes_exact": evidence["evidence_files_verified"] == 9,
        "exact_live_tagline_in_navbar": static_contract["exact_live_tagline_in_navbar"] is True,
        "accessible_brand_link_declared": static_contract["accessible_home_link_name_declared"] is True,
        "current_main_navigation_page_announced": static_contract["current_main_navigation_page_announced"] is True,
        "tagline_responsive_source_contract": (
            static_contract["tagline_not_hidden_by_declared_rules"] is True
            and static_contract["tagline_breakpoints_declared"] == [980, 640, 380]
        ),
        "brand_signature_consistent": static_contract["brand_signature_in_home_metadata_and_footer"] is True,
        "legal_and_legacy_identity_preserved": (
            static_contract["legacy_domain_and_legal_links_preserved"] is True
            and static_contract["no_results_guarantee_preserved"] is True
        ),
        "travel_duplicate_removed": static_contract["travel_landing_count"] == 1,
        "no_route_api_or_network_surface_added": (
            static_contract["route_literal_surface_changed"] is False
            and static_contract["api_surface_changed"] is False
            and static_contract["data_processing_surface_changed"] is False
            and static_contract["new_network_or_dynamic_html_surface_absent"] is True
        ),
        "production_gate_remains_blocked": evidence["gate_status"] == "blocked_pending_visual_and_legal_review",
    }
    failed = sorted(name for name, passed in checks.items() if passed is not True)
    if failed:
        raise PreflightBlocked(f"derived_checks_failed:{','.join(failed)}")

    return {
        "ok": True,
        "static_contract_passed": True,
        "preflight_read_only": True,
        "authority": AUTHORITY,
        "version": VERSION,
        "contract_version": CONTRACT_VERSION,
        "base_commit_sha40": BASE_COMMIT_SHA40,
        "base_archive_sha256": BASE_ARCHIVE_SHA256,
        "base_snapshot_sha256": BASE_SNAPSHOT_SHA256,
        "archive": archive,
        "local_tree": local_tree,
        "evidence": evidence,
        "static_contract": static_contract,
        "checks": checks,
        "blockers": [],
        "public_brand_signature": "RTM · Resuelve tus movidas",
        "public_tagline": "Resuelve tus movidas",
        "public_brand_signature_included": True,
        "existing_logo_asset_changed": False,
        "new_raster_brand_asset_added": False,
        "offline_only": True,
        "static_analysis_only": True,
        "network_used": False,
        "database_touched": False,
        "external_effects_executed": False,
        "provider_contacted": False,
        "administration_contacted": False,
        "ocu_contacted": False,
        "real_case_data_used": False,
        "route_literal_surface_changed": False,
        "api_surface_changed": False,
        "data_processing_surface_changed": False,
        "routes_published": False,
        "runtime_executed": False,
        "production_authorized": False,
        "production_safe": False,
        "legal_compliance_claimed": False,
        "brand_rights_verified": False,
        "trademark_clearance_completed": False,
        "live_visual_verified": False,
        "computed_accessible_name_verified": False,
        "frontend_build_status": evidence["frontend_build_status"],
        "gate_status": evidence["gate_status"],
        "live_verdict": "no_go",
        "scope_limitations": [
            "preflight_is_static_offline_and_does_not_execute_javascript",
            "source_contract_cannot_prove_visual_clipping_reflow_or_zoom",
            "source_contract_cannot_prove_computed_accessibility_tree",
            "colour_literal_check_is_not_a_rendered_contrast_measurement",
            "existing_og_asset_url_is_preserved_but_not_fetched",
            "windows_build_and_full_suite_are_unattested_operator_console_reports",
            "build_artifacts_are_not_hash_frozen",
            "archive_hash_and_comment_do_not_prove_authorship_or_git_ancestry",
            "commercial_signature_does_not_establish_trademark_rights",
            "commercial_intent_record_is_not_a_legal_classification",
            "no_legal_compliance_conclusion_is_made",
            "real_data_external_effects_and_rtm_connect_production_remain_no_go",
        ],
    }


def _blocked(exc: Exception) -> dict[str, Any]:
    return {
        "ok": False,
        "static_contract_passed": False,
        "preflight_read_only": True,
        "authority": AUTHORITY,
        "version": VERSION,
        "contract_version": CONTRACT_VERSION,
        "blockers": [f"frontend_brand_tagline_v1_blocked:{type(exc).__name__}:{exc}"],
        "public_brand_signature": "RTM · Resuelve tus movidas",
        "public_tagline": "Resuelve tus movidas",
        "offline_only": True,
        "static_analysis_only": True,
        "network_used": False,
        "database_touched": False,
        "external_effects_executed": False,
        "route_literal_surface_changed": None,
        "api_surface_changed": None,
        "data_processing_surface_changed": None,
        "routes_published": False,
        "runtime_executed": False,
        "production_authorized": False,
        "production_safe": False,
        "legal_compliance_claimed": False,
        "brand_rights_verified": False,
        "trademark_clearance_completed": False,
        "live_visual_verified": False,
        "computed_accessible_name_verified": False,
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
    sys.exit(main())
