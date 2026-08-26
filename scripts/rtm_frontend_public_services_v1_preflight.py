"""Preflight offline del catálogo público RTM de nueve familias V1.

No extrae el ZIP, no importa JavaScript, no usa red y no escribe archivos. Un
resultado ``ok`` acredita el contrato estático y la separación frente a RTM
Connect; no acredita revisión jurídica, publicación ni envíos con datos reales.
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
import xml.etree.ElementTree as ET


VERSION = "rtm_frontend_public_services_v1_preflight_v1_0"
CONTRACT_VERSION = "rtm.frontend.public_services.v1"
AUTHORITY = "rtm_frontend_public_services_v1_preflight"

BASE_COMMIT_SHA40 = "e677aeaeda807fc4cee5cf87332c6fc72186de27"
BASE_ARCHIVE_SHA256 = (
    "33dad9d9d7b6d71ea5a4777825a754072373dbe76a5485bdd3583d9cb338d08a"
)
BASE_SNAPSHOT_SHA256 = (
    "b2ee2d7bef950032dc235610e6abeda7b2eaaacfcbb70f3b3c4aa3c419eb94c8"
)
EXPECTED_ARCHIVE_ENTRIES = 120
EXPECTED_BASE_FILES = 111
EXPECTED_UNCHANGED_BASE_FILES = 95
EXPECTED_UNCOMPRESSED_BYTES = 11_266_823
MAX_ARCHIVE_MEMBER_BYTES = 4_000_000

ROOT = Path(__file__).resolve().parents[1]
EVIDENCE_PATH = "docs/rtm_connect/RTM_FRONTEND_PUBLIC_SERVICES_V1_EVIDENCE.json"

FAMILY_IDS = (
    "trafico",
    "viajes",
    "morosidad",
    "administracion",
    "bancos",
    "energia",
    "telecomunicaciones",
    "seguros",
    "vivienda",
)
FAMILY_PATHS = tuple(f"/{family}" for family in FAMILY_IDS)
IMAGE_PATHS = (
    "public/servicios-finanzas.webp",
    "public/servicios-hogar-suministros.webp",
    "public/servicios-proteccion-conectividad.webp",
)
IMAGE_SIZES = {
    "public/servicios-finanzas.webp": 32_044,
    "public/servicios-hogar-suministros.webp": 59_468,
    "public/servicios-proteccion-conectividad.webp": 28_304,
}

REPLACED_BASE_PATHS = (
    "index.html",
    "public/sitemap.xml",
    "src/App.jsx",
    "src/components/Footer.jsx",
    "src/components/Navbar.jsx",
    "src/components/Seo.jsx",
    "src/index.css",
    "src/main.jsx",
    "src/pages/AdministracionHome.jsx",
    "src/pages/Asnef.jsx",
    "src/pages/Contacto.jsx",
    "src/pages/IniciarExpedienteRTM.jsx",
    "src/pages/InicioRTM.jsx",
    "src/pages/MorosidadHome.jsx",
    "src/pages/Trafico.jsx",
    "src/pages/ViajesHome.jsx",
)

NEW_OVERLAY_PATHS = (
    "docs/rtm_connect/RTM_FRONTEND_PUBLIC_SERVICES_V1.md",
    EVIDENCE_PATH,
    *IMAGE_PATHS,
    "scripts/rtm_frontend_public_services_v1_preflight.py",
    "src/components/PublicServiceLanding.jsx",
    "src/data/publicServices.js",
    "src/pages/BancosHome.jsx",
    "src/pages/EnergiaHome.jsx",
    "src/pages/SegurosHome.jsx",
    "src/pages/TelecomunicacionesHome.jsx",
    "src/pages/ViviendaHome.jsx",
    "tests/test_rtm_frontend_public_services_v1_contract.py",
)

OVERLAY_PATHS = tuple(sorted((*REPLACED_BASE_PATHS, *NEW_OVERLAY_PATHS)))
HASHED_OVERLAY_PATHS = tuple(path for path in OVERLAY_PATHS if path != EVIDENCE_PATH)
IGNORED_TREE_PARTS = frozenset(
    {".git", "node_modules", "dist", "qa", "__pycache__", ".pytest_cache"}
)


class PreflightBlocked(RuntimeError):
    """Fallo fail-closed de una comprobación offline."""


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
    return all(part not in {"", ".", ".."} for part in PurePosixPath(name).parts)


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


def _same_content(expected: bytes, actual: bytes) -> bool:
    if expected == actual:
        return True
    expected_text = _canonical_text(expected)
    actual_text = _canonical_text(actual)
    return (
        expected_text is not None
        and actual_text is not None
        and expected_text == actual_text
    )


def _read_text(relative: str) -> str:
    try:
        return (ROOT / relative).read_text(encoding="utf-8")
    except (OSError, UnicodeError) as exc:
        raise PreflightBlocked(f"text_unreadable:{relative}") from exc


def _read_json(relative: str) -> dict[str, Any]:
    try:
        value = json.loads(_read_text(relative))
    except json.JSONDecodeError as exc:
        raise PreflightBlocked(f"json_invalid:{relative}") from exc
    if not isinstance(value, dict):
        raise PreflightBlocked(f"json_not_object:{relative}")
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

            for info in infos:
                mode = _zip_mode(info)
                kind = stat.S_IFMT(mode)
                if stat.S_ISLNK(mode) or kind not in {0, stat.S_IFREG, stat.S_IFDIR}:
                    raise PreflightBlocked("special_archive_entry")
                if not info.is_dir() and info.file_size > MAX_ARCHIVE_MEMBER_BYTES:
                    raise PreflightBlocked("oversized_archive_member")
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
    if sum(map(len, files.values())) != EXPECTED_UNCOMPRESSED_BYTES:
        raise PreflightBlocked("base_archive_size_mismatch")
    snapshot = _archive_snapshot(files)
    if snapshot != BASE_SNAPSHOT_SHA256:
        raise PreflightBlocked("base_archive_snapshot_mismatch")
    if any(path not in files for path in REPLACED_BASE_PATHS):
        raise PreflightBlocked("replaced_base_path_absent")
    if set(NEW_OVERLAY_PATHS) & set(files):
        raise PreflightBlocked("new_overlay_path_present_in_base")

    return (
        {
            "archive_sha256": archive_sha256,
            "archive_commit_comment": comment,
            "entries": len(infos),
            "files": len(files),
            "uncompressed_bytes": sum(map(len, files.values())),
            "snapshot_sha256": snapshot,
            "crc_ok": True,
            "safe_members": True,
        },
        files,
    )


def _walk_local_files() -> tuple[set[str], list[str]]:
    actual: set[str] = set()
    special: list[str] = []
    for current, directories, filenames in os.walk(ROOT, topdown=True, followlinks=False):
        current_path = Path(current)
        directories[:] = [
            name
            for name in directories
            if name not in IGNORED_TREE_PARTS and not (current_path / name).is_symlink()
        ]
        for name in filenames:
            path = current_path / name
            relative = path.relative_to(ROOT)
            if any(part in IGNORED_TREE_PARTS for part in relative.parts):
                continue
            posix = relative.as_posix()
            if path.is_symlink() or not path.is_file():
                special.append(posix)
            else:
                actual.add(posix)
    return actual, special


def _audit_local_tree(base_files: dict[str, bytes]) -> dict[str, Any]:
    actual, special = _walk_local_files()
    if special:
        raise PreflightBlocked(f"local_special_paths:{','.join(special[:8])}")

    expected = (set(base_files) - set(REPLACED_BASE_PATHS)) | set(OVERLAY_PATHS)
    missing = sorted(expected - actual)
    unexpected = sorted(actual - expected)
    if missing:
        raise PreflightBlocked(f"local_paths_missing:{','.join(missing[:8])}")
    if unexpected:
        raise PreflightBlocked(f"unexpected_local_paths:{','.join(unexpected[:8])}")

    unchanged = sorted(set(base_files) - set(REPLACED_BASE_PATHS))
    if len(unchanged) != EXPECTED_UNCHANGED_BASE_FILES:
        raise PreflightBlocked("unchanged_base_file_count_mismatch")
    drifted = [
        name
        for name in unchanged
        if not _same_content(base_files[name], (ROOT / name).read_bytes())
    ]
    if drifted:
        raise PreflightBlocked(f"base_file_drift:{','.join(drifted[:8])}")

    unchanged_connect = [
        name
        for name in unchanged
        if "rtmconnect" in name.casefold() or "opsa1s" in name.casefold()
    ]
    if not unchanged_connect:
        raise PreflightBlocked("rtm_connect_boundary_not_observed")
    return {
        "overlay_paths": list(OVERLAY_PATHS),
        "replaced_base_paths": len(REPLACED_BASE_PATHS),
        "new_overlay_paths": len(NEW_OVERLAY_PATHS),
        "unchanged_base_files": len(unchanged),
        "rtm_connect_files_unchanged": len(unchanged_connect),
        "unexpected_local_paths": 0,
        "special_local_paths": 0,
    }


def _webp_dimensions(data: bytes) -> tuple[int, int]:
    if data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        raise PreflightBlocked("image_not_webp")
    offset = 12
    while offset + 8 <= len(data):
        chunk = data[offset : offset + 4]
        size = int.from_bytes(data[offset + 4 : offset + 8], "little")
        payload = data[offset + 8 : offset + 8 + size]
        if chunk == b"VP8 " and payload[3:6] == b"\x9d\x01\x2a":
            return (
                int.from_bytes(payload[6:8], "little") & 0x3FFF,
                int.from_bytes(payload[8:10], "little") & 0x3FFF,
            )
        if chunk == b"VP8L" and len(payload) >= 5 and payload[0] == 0x2F:
            bits = int.from_bytes(payload[1:5], "little")
            return (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
        if chunk == b"VP8X" and len(payload) >= 10:
            return (
                int.from_bytes(payload[4:7], "little") + 1,
                int.from_bytes(payload[7:10], "little") + 1,
            )
        offset += 8 + size + (size % 2)
    raise PreflightBlocked("image_dimensions_unreadable")


def _audit_contract() -> dict[str, Any]:
    catalog = _read_text("src/data/publicServices.js")
    app = _read_text("src/App.jsx")
    navbar = _read_text("src/components/Navbar.jsx")
    footer = _read_text("src/components/Footer.jsx")
    home = _read_text("src/pages/InicioRTM.jsx")
    intake = _read_text("src/pages/IniciarExpedienteRTM.jsx")
    landing = _read_text("src/components/PublicServiceLanding.jsx")
    contact = _read_text("src/pages/Contacto.jsx")
    main = _read_text("src/main.jsx")

    ids = tuple(re.findall(r'^\s{4}id: "([a-z]+)",$', catalog, re.M))
    paths = tuple(re.findall(r'^\s{4}path: "(/[a-z]+)",$', catalog, re.M))
    if ids != FAMILY_IDS or len(set(ids)) != 9:
        raise PreflightBlocked("public_family_ids_mismatch")
    if paths != FAMILY_PATHS:
        raise PreflightBlocked("public_family_paths_mismatch")
    if catalog.count('intake: { department: "claims", caseTypes: ["consumer"] }') != 4:
        raise PreflightBlocked("consumer_backend_binding_mismatch")

    housing = catalog.split('id: "vivienda"', 1)[-1]
    _require_markers(
        housing,
        (
            'startPath: "/contacto?area=vivienda"',
            'entryMode: "consultation"',
            "no se crea automáticamente un expediente",
        ),
        "housing",
    )
    if "intake:" in housing:
        raise PreflightBlocked("housing_backend_intake_declared")

    for path in (*FAMILY_PATHS, "/asnef"):
        if f'path="{path}"' not in app:
            raise PreflightBlocked(f"app_route_missing:{path}")
    _require_markers(
        main,
        (
            "BrowserRouter as Router",
            'hash.startsWith("#/")',
            'window.history.replaceState(null, "", hash.slice(1))',
        ),
        "router",
    )
    if "HashRouter as Router" in main:
        raise PreflightBlocked("hash_router_still_active")

    for surface, text in (
        ("navbar", navbar),
        ("footer", footer),
        ("home", home),
        ("intake", intake),
    ):
        if "PUBLIC_SERVICE_FAMILIES" not in text:
            raise PreflightBlocked(f"catalog_source_missing:{surface}")

    forbidden_intake = (
        'const department = requestedDepartment || "traffic"',
        "SERVICE_CONFIG[department] || SERVICE_CONFIG.traffic",
    )
    if any(marker in intake for marker in forbidden_intake):
        raise PreflightBlocked("traffic_fallback_present")
    _require_markers(
        intake,
        (
            "invalidDepartment",
            "invalidType",
            "invalidSelection",
            'searchParams.get("service")',
            'searchParams.get("family")',
            "familyMismatch",
            "Área pública seleccionada:",
            "no lo convertimos automáticamente en un expediente de tráfico",
        ),
        "intake_fail_closed",
    )

    _require_markers(
        landing,
        (
            "Imagen ilustrativa generada con IA",
            "Entrada real por reclamación de consumo",
            "Consulta de encaje antes de crear un expediente",
            "alt={landing.imageAlt}",
        ),
        "public_landing",
    )
    _require_markers(
        contact,
        (
            'searchParams.get("area") === "vivienda"',
            "Consulta de encaje · Vivienda · RTM",
            "Esta consulta no crea un expediente automático",
        ),
        "housing_contact",
    )

    issue_files: list[str] = []
    for extension in ("*.js", "*.jsx"):
        for path in (ROOT / "src").rglob(extension):
            if "?issue=" in path.read_text(encoding="utf-8"):
                issue_files.append(path.relative_to(ROOT).as_posix())
    if issue_files:
        raise PreflightBlocked(f"unsupported_issue_links:{','.join(issue_files[:8])}")

    public_boundary_paths = (
        "src/data/publicServices.js",
        "src/components/PublicServiceLanding.jsx",
        "src/pages/BancosHome.jsx",
        "src/pages/EnergiaHome.jsx",
        "src/pages/TelecomunicacionesHome.jsx",
        "src/pages/SegurosHome.jsx",
        "src/pages/ViviendaHome.jsx",
    )
    if any("rtmConnect" in _read_text(path) for path in public_boundary_paths):
        raise PreflightBlocked("rtm_connect_imported_by_public_surface")

    image_results: dict[str, Any] = {}
    total = 0
    for relative in IMAGE_PATHS:
        data = (ROOT / relative).read_bytes()
        if len(data) != IMAGE_SIZES[relative]:
            raise PreflightBlocked(f"image_size_mismatch:{relative}")
        dimensions = _webp_dimensions(data)
        if dimensions != (1280, 853):
            raise PreflightBlocked(f"image_dimensions_mismatch:{relative}")
        total += len(data)
        image_results[relative] = {
            "bytes": len(data),
            "dimensions": list(dimensions),
            "sha256": _sha256_bytes(data),
        }
    if total != 119_816:
        raise PreflightBlocked("image_total_size_mismatch")

    try:
        sitemap = ET.parse(ROOT / "public/sitemap.xml")
    except (ET.ParseError, OSError) as exc:
        raise PreflightBlocked("sitemap_invalid") from exc
    namespace = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    urls = {
        node.text or ""
        for node in sitemap.findall("sm:url/sm:loc", namespace)
    }
    if any(not url.startswith("https://www.recurretumulta.eu/") for url in urls):
        raise PreflightBlocked("sitemap_foreign_domain")
    for path in (*FAMILY_PATHS, "/asnef"):
        if f"https://www.recurretumulta.eu{path}" not in urls:
            raise PreflightBlocked(f"sitemap_route_missing:{path}")

    return {
        "family_ids": list(ids),
        "family_count": len(ids),
        "consumer_backend_families": 4,
        "housing_entry_mode": "consultation",
        "strict_intake_validation": True,
        "traffic_fallback_absent": True,
        "legacy_issue_links_absent": True,
        "browser_router_with_hash_migration": True,
        "public_rtm_connect_imports": 0,
        "generated_image_disclosure_visible": True,
        "images": image_results,
        "image_total_bytes": total,
        "sitemap_public_routes": 10,
    }


def _audit_evidence() -> dict[str, Any]:
    evidence = _read_json(EVIDENCE_PATH)
    required = {
        "version": "rtm_frontend_public_services_v1_evidence_v1_0",
        "contract_version": CONTRACT_VERSION,
        "base_commit_sha40": BASE_COMMIT_SHA40,
        "base_archive_sha256": BASE_ARCHIVE_SHA256,
        "base_snapshot_sha256": BASE_SNAPSHOT_SHA256,
        "production_authorized": False,
        "legal_review_completed": False,
        "external_effects_executed": False,
        "real_case_data_used": False,
        "rtm_connect_changed": False,
    }
    for key, expected in required.items():
        if evidence.get(key) != expected:
            raise PreflightBlocked(f"evidence_field_mismatch:{key}")
    if evidence.get("overlay_paths") != list(OVERLAY_PATHS):
        raise PreflightBlocked("evidence_overlay_allowlist_mismatch")
    hashes = evidence.get("file_sha256")
    if not isinstance(hashes, dict) or set(hashes) != set(HASHED_OVERLAY_PATHS):
        raise PreflightBlocked("evidence_hash_allowlist_mismatch")
    mismatched = [
        path
        for path in HASHED_OVERLAY_PATHS
        if hashes.get(path) != _sha256_file(ROOT / path)
    ]
    if mismatched:
        raise PreflightBlocked(f"overlay_hash_mismatch:{','.join(mismatched[:8])}")
    return {
        "evidence_version": evidence["version"],
        "hashes_verified": len(HASHED_OVERLAY_PATHS),
        "overlay_allowlist_exact": True,
        "production_authorized": False,
    }


def _result(archive_path: Path) -> dict[str, Any]:
    archive, base_files = _audit_archive(archive_path)
    tree = _audit_local_tree(base_files)
    contract = _audit_contract()
    evidence = _audit_evidence()
    return {
        "authority": AUTHORITY,
        "version": VERSION,
        "contract_version": CONTRACT_VERSION,
        "status": "ok",
        "archive": archive,
        "tree": tree,
        "contract": contract,
        "evidence": evidence,
        "limitations": [
            "static_offline_validation_only",
            "no_javascript_or_api_execution",
            "no_legal_review_claimed",
            "no_production_authorization",
            "no_real_case_data_or_external_effects",
        ],
    }


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--archive", required=True, type=Path, help="ZIP base congelado")
    parser.add_argument("--compact", action="store_true", help="JSON en una línea")
    return parser.parse_args()


def main() -> int:
    args = _parse_args()
    try:
        result = _result(args.archive)
    except PreflightBlocked as exc:
        result = {
            "authority": AUTHORITY,
            "version": VERSION,
            "contract_version": CONTRACT_VERSION,
            "status": "blocked",
            "reason": str(exc),
        }
        print(json.dumps(result, ensure_ascii=False, sort_keys=True))
        return 1
    indent = None if args.compact else 2
    print(json.dumps(result, ensure_ascii=False, indent=indent, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
