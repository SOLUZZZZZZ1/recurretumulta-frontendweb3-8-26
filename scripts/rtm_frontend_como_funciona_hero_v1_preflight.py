from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import stat
import struct
import sys
import zipfile


VERSION = "rtm_frontend_como_funciona_hero_v1_preflight_v1_0"
AUTHORITY = "rtm_frontend_como_funciona_hero_v1_preflight"
BASE_COMMIT_SHA40 = "8a86815aea0b9406b00320cd367edebe0624d4f1"
BASE_ARCHIVE_SHA256 = "1d302d802a95e039c41a9391725c73dbff5e6533f80a17362c052b2ff647ae4e"
BASE_FILES = 96
MODIFIED_PATH = "src/pages/ComoFunciona.jsx"
IMAGE_PATH = "public/hero-como-trabajamos.png"
OVERLAY_PATHS = (
    "docs/rtm_connect/RTM_FRONTEND_COMO_FUNCIONA_HERO_V1.md",
    IMAGE_PATH,
    "scripts/rtm_frontend_como_funciona_hero_v1_preflight.py",
    MODIFIED_PATH,
    "tests/test_rtm_frontend_como_funciona_hero_v1_contract.py",
)
NEW_PATHS = tuple(path for path in OVERLAY_PATHS if path != MODIFIED_PATH)
EXPECTED_FILE_SHA256 = {
    "docs/rtm_connect/RTM_FRONTEND_COMO_FUNCIONA_HERO_V1.md": "c23928384d335947e3328d3c6b8eea1c7ecffedab9fd8a992ff24749974db417",
    IMAGE_PATH: "414af4585248b70596345ed7d76c4873ab7744de37e65c4fca2a0fdcfb611c05",
    MODIFIED_PATH: "b58d45dfe98e8357a753c8e864defd188c02c1c12db2fcf583bd1e6eefe0230a",
    "tests/test_rtm_frontend_como_funciona_hero_v1_contract.py": "91f8a4100cda00307c332e7954bb5ecf7f63c4373dbe48967a43b807475a5f0f",
}
IGNORED_TOP_LEVEL = {".git", "node_modules", "dist", "__pycache__"}
MAX_ENTRIES = 1_000
MAX_MEMBER_BYTES = 20_000_000
MAX_ARCHIVE_BYTES = 50_000_000


class PreflightBlocked(RuntimeError):
    pass


def sha256_bytes(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_text_bytes(value: bytes) -> bytes | None:
    if b"\x00" in value:
        return None
    try:
        text = value.decode("utf-8", "strict")
    except UnicodeDecodeError:
        return None
    return text.replace("\r\n", "\n").replace("\r", "\n").encode("utf-8")


def content_equivalent(left: bytes, right: bytes) -> tuple[bool, str]:
    if left == right:
        return True, "raw"
    left_text = canonical_text_bytes(left)
    right_text = canonical_text_bytes(right)
    if left_text is not None and right_text is not None and left_text == right_text:
        return True, "newline"
    return False, "different"


def safe_member_name(name: str) -> bool:
    if not name or "\\" in name or name.startswith(("/", "~")):
        return False
    if len(name) >= 2 and name[1] == ":":
        return False
    path = PurePosixPath(name)
    return all(part not in {"", ".", ".."} for part in path.parts)


def is_regular_zip_member(info: zipfile.ZipInfo) -> bool:
    mode = (info.external_attr >> 16) & 0xFFFF
    if mode == 0 or info.is_dir():
        return True
    return stat.S_ISREG(mode) or stat.S_ISDIR(mode)


def audit_archive(path: Path) -> tuple[dict[str, object], dict[str, bytes]]:
    if not path.is_file():
        raise PreflightBlocked("base_archive_missing")
    archive_sha = sha256_file(path)
    if archive_sha != BASE_ARCHIVE_SHA256:
        raise PreflightBlocked("base_archive_sha256_mismatch")

    with zipfile.ZipFile(path, "r") as archive:
        infos = archive.infolist()
        if len(infos) > MAX_ENTRIES:
            raise PreflightBlocked("archive_too_many_entries")
        names = [info.filename for info in infos]
        if len(names) != len(set(names)):
            raise PreflightBlocked("archive_duplicate_members")
        folded = [name.casefold() for name in names]
        if len(folded) != len(set(folded)):
            raise PreflightBlocked("archive_casefold_duplicate_members")
        if any(not safe_member_name(name.rstrip("/")) for name in names):
            raise PreflightBlocked("archive_unsafe_member")
        if any(not is_regular_zip_member(info) for info in infos):
            raise PreflightBlocked("archive_special_member")
        if any(info.flag_bits & 0x1 for info in infos):
            raise PreflightBlocked("archive_encrypted_member")
        if any(info.file_size > MAX_MEMBER_BYTES for info in infos):
            raise PreflightBlocked("archive_member_too_large")
        total = sum(info.file_size for info in infos)
        if total > MAX_ARCHIVE_BYTES:
            raise PreflightBlocked("archive_uncompressed_size_too_large")
        bad_crc = archive.testzip()
        if bad_crc is not None:
            raise PreflightBlocked(f"archive_crc_failure:{bad_crc}")
        comment = archive.comment.decode("ascii", "strict")
        if comment != BASE_COMMIT_SHA40:
            raise PreflightBlocked("base_archive_commit_comment_mismatch")
        files = {
            info.filename: archive.read(info)
            for info in infos
            if not info.is_dir()
        }

    if len(files) != BASE_FILES:
        raise PreflightBlocked("base_archive_file_count_mismatch")
    if MODIFIED_PATH not in files:
        raise PreflightBlocked("modified_path_absent_from_base")
    unexpected_new_paths = sorted(set(NEW_PATHS) & set(files))
    if unexpected_new_paths:
        raise PreflightBlocked(
            "new_overlay_path_present_in_base:" + ",".join(unexpected_new_paths)
        )

    return (
        {
            "archive_sha256": archive_sha,
            "archive_commit_comment": comment,
            "entries": len(names),
            "files": len(files),
            "uncompressed_bytes": total,
            "crc_ok": True,
            "safe_members": True,
            "overlay_new_paths_absent": True,
            "modified_path_present": True,
        },
        files,
    )


def ignored_relative_path(relative: Path) -> bool:
    return bool(relative.parts) and (
        relative.parts[0] in IGNORED_TOP_LEVEL or "__pycache__" in relative.parts
    )


def audit_local_tree(root: Path, base_files: dict[str, bytes]) -> dict[str, object]:
    actual_files: set[str] = set()
    unexpected_symlinks: list[str] = []
    for current_root, dirs, files in os.walk(root, followlinks=False):
        current = Path(current_root)
        relative_root = current.relative_to(root)
        dirs[:] = [
            name
            for name in dirs
            if not ignored_relative_path(relative_root / name)
        ]
        for name in files:
            path = current / name
            relative = path.relative_to(root)
            if ignored_relative_path(relative):
                continue
            normalized = relative.as_posix()
            if path.is_symlink():
                unexpected_symlinks.append(normalized)
            else:
                actual_files.add(normalized)

    if unexpected_symlinks:
        raise PreflightBlocked(
            "unexpected_symlink:" + ",".join(sorted(unexpected_symlinks))
        )

    expected_files = set(base_files) | set(NEW_PATHS)
    unexpected = sorted(actual_files - expected_files)
    missing = sorted(expected_files - actual_files)
    if unexpected:
        raise PreflightBlocked("unexpected_local_path:" + ",".join(unexpected))
    if missing:
        raise PreflightBlocked("missing_local_path:" + ",".join(missing))

    raw_exact = 0
    newline_equivalent = 0
    for name, archived in base_files.items():
        if name == MODIFIED_PATH:
            continue
        local = (root / name).read_bytes()
        equivalent, mode = content_equivalent(archived, local)
        if not equivalent:
            raise PreflightBlocked(f"base_file_changed:{name}")
        if mode == "raw":
            raw_exact += 1
        else:
            newline_equivalent += 1

    if set(OVERLAY_PATHS) - actual_files:
        raise PreflightBlocked("overlay_allowlist_incomplete")

    return {
        "base_files_verified": len(base_files) - 1,
        "raw_byte_exact_files": raw_exact,
        "newline_canonical_equivalent_files": newline_equivalent,
        "whole_tree_files_verified": len(actual_files),
        "overlay_paths_present": len(OVERLAY_PATHS),
        "overlay_paths_required": len(OVERLAY_PATHS),
        "overlay_allowlist_exact": True,
        "base_tree_content_equivalent_except_modified_path": True,
        "unexpected_paths": [],
        "comparison_mode": "strict_utf8_crlf_to_lf_or_binary_raw_v1",
    }


def read_png_contract(path: Path) -> dict[str, object]:
    value = path.read_bytes()
    if len(value) < 33 or value[:8] != b"\x89PNG\r\n\x1a\n":
        raise PreflightBlocked("hero_asset_not_png")
    ihdr_length = struct.unpack(">I", value[8:12])[0]
    if value[12:16] != b"IHDR" or ihdr_length != 13:
        raise PreflightBlocked("hero_asset_invalid_ihdr")
    width, height, bit_depth, color_type = struct.unpack(">IIBB", value[16:26])
    if (width, height) != (1536, 1024):
        raise PreflightBlocked("hero_asset_dimensions_mismatch")
    if bit_depth != 8 or color_type != 2:
        raise PreflightBlocked("hero_asset_colour_contract_mismatch")
    if not 250_000 <= len(value) <= 3_000_000:
        raise PreflightBlocked("hero_asset_size_out_of_bounds")
    return {
        "path": IMAGE_PATH,
        "sha256": sha256_bytes(value),
        "bytes": len(value),
        "width": width,
        "height": height,
        "bit_depth": bit_depth,
        "colour_type": "rgb",
        "decodable_header": True,
    }


def verify_overlay_hashes(root: Path) -> int:
    for name, expected in EXPECTED_FILE_SHA256.items():
        if expected == "PENDING":
            raise PreflightBlocked(f"overlay_hash_pending:{name}")
        actual = sha256_file(root / name)
        if actual != expected:
            raise PreflightBlocked(f"overlay_sha256_mismatch:{name}")
    return len(EXPECTED_FILE_SHA256)


def audit_source(root: Path) -> dict[str, bool]:
    source = (root / MODIFIED_PATH).read_text(encoding="utf-8")
    required = {
        "asset_reference_exact": 'url("/hero-como-trabajamos.png")' in source,
        "visible_ai_label_present": (
            "Imagen ilustrativa generada con IA" in source
        ),
        "accessible_non_real_disclosure_present": (
            "no representa personas, hechos ni expedientes reales" in source
        ),
        "existing_caption_preserved": "Un proceso ordenado y trazable" in source,
        "existing_cover_crop_preserved": "center/cover no-repeat" in source,
        "no_dynamic_html_injected": "dangerouslySetInnerHTML" not in source,
    }
    missing = sorted(name for name, passed in required.items() if not passed)
    if missing:
        raise PreflightBlocked("source_contract_missing:" + ",".join(missing))
    return required


def base_result() -> dict[str, object]:
    return {
        "authority": AUTHORITY,
        "version": VERSION,
        "base_commit_sha40": BASE_COMMIT_SHA40,
        "base_archive_sha256": BASE_ARCHIVE_SHA256,
        "synthetic_only": True,
        "read_only": True,
        "offline_only": True,
        "network_used": False,
        "database_touched": False,
        "external_effects_executed": False,
        "provider_contacted": False,
        "administration_contacted": False,
        "real_data_used": False,
        "routes_published": False,
        "runtime_wired": False,
        "production_authorized": False,
        "live_verdict": "no_go",
        "public_visual_fix_only": True,
        "ai_generated_image_disclosed": True,
    }


def run(archive_path: Path) -> dict[str, object]:
    root = Path(__file__).resolve().parents[1]
    archive, base_files = audit_archive(archive_path)
    local_tree = audit_local_tree(root, base_files)
    image = read_png_contract(root / IMAGE_PATH)
    verified_hashes = verify_overlay_hashes(root)
    source_checks = audit_source(root)
    checks = {
        "exact_base_archive_sha256": True,
        "exact_base_commit_comment": True,
        "archive_crc_valid": True,
        "archive_members_safe": True,
        "overlay_allowlist_exact": True,
        "base_tree_unchanged_except_allowlisted_page": True,
        "hero_asset_present_and_valid_png": True,
        "hero_asset_dimensions_exact": True,
        "hero_reference_exact": True,
        "visible_ai_disclosure_present": True,
        "accessible_non_real_disclosure_present": True,
        "no_routes_api_or_connect_runtime_changed": True,
    }
    result = base_result()
    result.update(
        {
            "ok": True,
            "safe": True,
            "blockers": [],
            "gate_status": "passed_offline_visual_contract",
            "archive_extracted": False,
            "archive": archive,
            "local_tree": local_tree,
            "image": image,
            "source_checks": source_checks,
            "overlay_files_hash_verified": verified_hashes,
            "checks": checks,
            "frontend_build_status": "not_executed_by_static_preflight",
            "scope_limitations": [
                "preflight_does_not_execute_vite_or_a_browser",
                "windows_local_build_and_visual_browser_checks_remain_required",
                "visible_label_is_prudential_and_not_a_legal_compliance_claim",
                "asset_hash_and_archive_comment_do_not_prove_authorship_or_provenance",
                "rtm_connect_runtime_real_data_external_effects_and_production_remain_no_go",
            ],
        }
    )
    return result


def main() -> int:
    parser = argparse.ArgumentParser(description=AUTHORITY)
    parser.add_argument("--archive", required=True)
    parser.add_argument("--compact", action="store_true")
    args = parser.parse_args()
    try:
        result = run(Path(args.archive).resolve())
        exit_code = 0
    except Exception as exc:  # fail closed at the CLI boundary
        result = base_result()
        result.update(
            {
                "ok": False,
                "safe": False,
                "gate_status": "blocked",
                "blockers": [
                    f"como_funciona_hero_v1_blocked:{type(exc).__name__}:{exc}"
                ],
            }
        )
        exit_code = 1
    if args.compact:
        print(json.dumps(result, ensure_ascii=False, separators=(",", ":")))
    else:
        print(json.dumps(result, ensure_ascii=False, indent=2, sort_keys=True))
    return exit_code


if __name__ == "__main__":
    sys.exit(main())
