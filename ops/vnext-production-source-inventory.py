#!/usr/bin/env python3
"""Inventory divergent FC ARENA VPS source safely, without modifying it.

Operator-only follow-up to the read-only audit: writes a root-only JSON report
under /root/fcarena-safety. Never copies source, DB data, uploads or secrets.
Do not upload this private report to a public GitHub repository.
"""
from __future__ import annotations

import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import secrets
import socket
import stat
import subprocess

ROOT = Path("/opt/fcarena")
REPORT_DIR = Path("/root/fcarena-safety")
MAX_HASH_BYTES = 32 * 1024 * 1024
SKIPPED_PARTS = {
    "node_modules", ".git", ".next", "dist", "build", "coverage",
    "backups", "uploads", "storage", ".cache", "__pycache__",
}
RESTRICTED_PARTS = {".ssh", "secrets", "credentials", "private", "keys"}
RESTRICTED_EXTENSIONS = {".pem", ".key", ".p12", ".pfx", ".crt", ".cer", ".jks"}


def git(*args: str) -> bytes:
    return subprocess.check_output(
        ["git", "-C", str(ROOT), *args],
        stderr=subprocess.DEVNULL,
        timeout=90,
    )


def paths_from_git(*args: str) -> list[str]:
    return [
        part.decode("utf-8", errors="surrogateescape")
        for part in git(*args).split(b"\0")
        if part
    ]


def category(relative: str) -> str:
    parts = [part.lower() for part in Path(relative).parts]
    filename = parts[-1] if parts else ""
    if (any(part in RESTRICTED_PARTS for part in parts)
            or filename.startswith(".env")
            or filename == "id_ed25519"
            or filename == "id_rsa"
            or any(word in filename for word in ("secret", "credential", "password", "token"))
            or Path(filename).suffix in RESTRICTED_EXTENSIONS):
        return "restricted"
    if any(part in SKIPPED_PARTS for part in parts):
        return "generated_or_user_data"
    return "source_candidate"


def safe_detail(relative: str, kind: str) -> dict:
    # Reject references outside root, symlinks and nonregular files.
    path = ROOT / relative
    if not path.resolve(strict=False).is_relative_to(ROOT.resolve()):
        return {"kind": kind, "state": "outside_root_skipped"}
    try:
        info = path.lstat()
    except FileNotFoundError:
        return {"path": relative, "kind": kind, "state": "deleted"}
    if not stat.S_ISREG(info.st_mode):
        return {"path": relative, "kind": kind, "state": "nonregular"}
    if info.st_size > MAX_HASH_BYTES:
        return {"path": relative, "kind": kind, "size": info.st_size, "state": "oversized"}
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return {
        "path": relative,
        "kind": kind,
        "size": info.st_size,
        "sha256": digest.hexdigest(),
        "state": "present",
    }


def main() -> None:
    os.umask(0o077)
    if socket.gethostname().split(".")[0] != "fcarena-prod":
        raise SystemExit("BLOCKED: this inventory targets fcarena-prod only.")
    if not (ROOT / ".git").is_dir() or not REPORT_DIR.is_dir():
        raise SystemExit("BLOCKED: production checkout/safety directory is missing.")
    head = git("rev-parse", "HEAD").decode("ascii").strip()
    tracked = paths_from_git("diff", "--name-only", "-z", "HEAD")
    untracked = paths_from_git("ls-files", "--others", "--exclude-standard", "-z")
    rows: list[dict] = []
    counts: dict[str, int] = {}
    for kind, paths in (("tracked_changed", tracked), ("untracked", untracked)):
        for relative in paths:
            # Do not expose sensitive filenames or hash sensitive content.
            group = category(relative)
            counts[group] = counts.get(group, 0) + 1
            if group == "source_candidate":
                rows.append(safe_detail(relative, kind))
    timestamp = dt.datetime.now(dt.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    filename = f"source-inventory-{timestamp}-{secrets.token_hex(4)}.json"
    destination = REPORT_DIR / filename
    report = {
        "reportVersion": 1,
        "createdAtUTC": dt.datetime.now(dt.timezone.utc).isoformat(),
        "gitHead": head,
        "trackedChangedCount": len(tracked),
        "untrackedCount": len(untracked),
        "categoryCounts": counts,
        "candidateFiles": rows,
        "limitations": [
            "Sensitive and generated/user-data filenames/content excluded.",
            "A private inventory is not a full source backup.",
            "Do not upload this report or any production-only files to public GitHub.",
        ],
    }
    # Atomic, exclusive 0600 write. Report is not placed in the app tree.
    fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as out:
        json.dump(report, out, ensure_ascii=True, indent=2)
        out.write("\n")
    print("SOURCE_INVENTORY_COMPLETE")
    print(f"tracked_changed={len(tracked)} untracked={len(untracked)}")
    print(f"candidate_file_count={len(rows)} restricted_or_generated_count={len(tracked)+len(untracked)-len(rows)}")
    print("Private root-only report created under /root/fcarena-safety.")
    print("No production file, service, database, or secret was changed.")


if __name__ == "__main__":
    main()
