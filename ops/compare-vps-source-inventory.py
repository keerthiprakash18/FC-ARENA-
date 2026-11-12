#!/usr/bin/env python3
"""Classify previously inventoried live VPS source changes against tested CI.

Read-only; runs ON fcarena-prod with two JSON reports under /root/fcarena-safety.
Compares the 483-path drift at the time of inventory, never mutates production,
and never exports source, credentials, player data or DB information.
"""
from __future__ import annotations
import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import secrets
import socket

PRIVATE_ROOT = Path("/root/fcarena-safety")


def resolve_private(path: str) -> Path:
    candidate = Path(path)
    if not candidate.is_file() or candidate.is_symlink():
        raise ValueError("Input report missing or is a symlink")
    if not candidate.resolve().is_relative_to(PRIVATE_ROOT.resolve()):
        raise ValueError("Input report must reside in private root-only safety folder")
    if candidate.stat().st_size > 10 * 1024 * 1024:
        raise ValueError("Input report unreasonably large")
    return candidate


def assess(inventory: dict, candidate: dict) -> dict:
    if inventory.get("reportVersion") != 1 or candidate.get("schemaVersion") != 1:
        raise ValueError("Unsupported inventory or release manifest version")
    sha = candidate.get("commitSha", "")
    if not isinstance(sha, str) or not re.fullmatch("[0-9a-f]{40}", sha):
        raise ValueError("Candidate must have a fixed 40-character commit")
    files = candidate.get("files")
    if not isinstance(files, dict) or candidate.get("fileCount") != len(files):
        raise ValueError("Missing or incomplete candidate hashes")
    rows = inventory.get("candidateFiles")
    if not isinstance(rows, list):
        raise ValueError("Missing source candidate inventory")
    categories = inventory.get("categoryCounts")
    if not isinstance(categories, dict):
        raise ValueError("Missing categorized drift counts")

    matching, differing, extra, absent, unsafe = [], [], [], [], []
    for row in rows:
        path = row.get("path")
        if not isinstance(path, str) or not path or ".." in Path(path).parts:
            unsafe.append("<invalid-path>")
            continue
        if row.get("state") != "present":
            (absent if row.get("state") == "deleted" else unsafe).append(path)
            continue
        sha_local = row.get("sha256")
        if not isinstance(sha_local, str) or not re.fullmatch("[a-f0-9]{64}", sha_local):
            unsafe.append(path)
        elif path not in files:
            extra.append(path)
        elif sha_local != files[path]:
            differing.append(path)
        else:
            matching.append(path)

    total = inventory.get("trackedChangedCount", 0) + inventory.get("untrackedCount", 0)
    if sum(categories.values()) != total or len(rows) != categories.get("source_candidate", 0):
        raise ValueError("Inventory category totals do not reconcile: refuse comparison")
    # Even if all source candidates match, the excluded app/server-only files
    # need a separate preservation plan. Counts are not production QA evidence.
    status = "NO_SOURCE_CONFLICTS_FOUND" if not (differing or extra or absent or unsafe) else "BLOCKED_SOURCE_DRIFT"
    return {
        "schemaVersion": 1,
        "status": status,
        "testedCandidateSha": sha,
        "serverWorkingHead": inventory.get("gitHead"),
        "reportedModifiedAndUntracked": total,
        "candidateTrackedFiles": len(files),
        "matchingDirtySourceFiles": len(matching),
        "conflictingDirtySourceFiles": differing,
        "vpsOnlySourceFiles": extra,
        "deletedOrMissingSourceFiles": absent,
        "unsafeOrUnhashedSourceFiles": unsafe,
        "excludedGeneratedOrPrivateCount": total - len(rows),
        "limitations": [
            "Read-only classification of listed dirty source paths only, not an exhaustive overlay diff.",
            "Generated/user-upload/credential files are excluded and must be preserved separately.",
            "VPS remote git ref, running web/API build IDs and live DB are not verified by this comparison.",
            "Even NO_SOURCE_CONFLICTS_FOUND does not authorize production deployment.",
        ],
    }


def main() -> None:
    os.umask(0o077)
    if socket.gethostname().split(".")[0] != "fcarena-prod" or os.geteuid() != 0:
        raise SystemExit("BLOCKED: run as root only on verified fcarena-prod VPS")
    parser = argparse.ArgumentParser()
    parser.add_argument("--inventory", required=True)
    parser.add_argument("--candidate", required=True)
    args = parser.parse_args()
    src = json.loads(resolve_private(args.inventory).read_text(encoding="utf-8"))
    dst = json.loads(resolve_private(args.candidate).read_text(encoding="utf-8"))
    report = assess(src, dst)
    report["createdAtUTC"] = dt.datetime.now(dt.timezone.utc).isoformat()
    out = PRIVATE_ROOT / (
        f"vps-source-reconciliation-{secrets.token_hex(6)}.json"
    )
    with out.open("x", encoding="utf-8") as stream:
        json.dump(report, stream, indent=2)
        stream.write("\n")
    out.chmod(0o600)
    print(f"SOURCE_RECONCILIATION={report['status']}")
    print(f"reported_modified_untracked={report['reportedModifiedAndUntracked']}")
    print(f"matching_source_files={report['matchingDirtySourceFiles']}")
    print(f"conflicts={len(report['conflictingDirtySourceFiles']) + len(report['vpsOnlySourceFiles']) + len(report['deletedOrMissingSourceFiles']) + len(report['unsafeOrUnhashedSourceFiles'])}")
    print("Private report stored under /root/fcarena-safety; no production files changed.")


if __name__ == "__main__":
    main()
