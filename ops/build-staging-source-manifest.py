#!/usr/bin/env python3
"""Build a public *source-only* hash manifest from the checked Git commit.

No access to VPS or production data. Called by CI only after integration QA.
"""
from __future__ import annotations
import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess

RESTRICTED_SUFFIXES = (".pem", ".key", ".p12", ".pfx", ".jks", ".keystore")
RESTRICTED_PARTS = {"secrets", "credentials", ".ssh", "private_keys"}
HASH_MAX_SIZE = 128 * 1024 * 1024


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", *args], stderr=subprocess.DEVNULL)


def file_hash(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def build_manifest(repo: Path, sha: str) -> dict:
    if not re.fullmatch("[a-f0-9]{40}", sha):
        raise ValueError("Invalid exact commit SHA")
    paths = git("ls-files", "-z").split(b"\0")
    files: dict[str, str] = {}
    for encoded in paths:
        if not encoded:
            continue
        relative = encoded.decode("utf-8", errors="strict")
        parts = Path(relative).parts
        leaf = parts[-1].lower()
        if (leaf == ".env" or leaf.startswith(".env.") and
                leaf not in {".env.example", ".env.template", ".env.sample"} or
                leaf.endswith(RESTRICTED_SUFFIXES) or
                any(part.lower() in RESTRICTED_PARTS for part in parts)):
            raise ValueError("Tracked sensitive source path: manifest generation blocked")
        path = repo / relative
        if path.is_symlink() or not path.is_file() or path.stat().st_size > HASH_MAX_SIZE:
            raise ValueError("Nonregular/oversized tracked source path blocked")
        files[relative] = file_hash(path)
    return {
        "schemaVersion": 1,
        "commitSha": sha,
        "generatedAtUTC": dt.datetime.now(dt.timezone.utc).isoformat(),
        "hash": "sha256",
        "sourceOnly": True,
        "fileCount": len(files),
        "files": dict(sorted(files.items())),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    if os.environ.get("CI") != "true":
        raise SystemExit("BLOCKED: staging manifest must be built by tested CI only")
    repo = Path.cwd().resolve()
    sha = git("rev-parse", "HEAD").decode("ascii").strip()
    obj = build_manifest(repo, sha)
    out = Path(args.output).resolve()
    if not out.parent.is_dir():
        raise SystemExit("BLOCKED: output directory missing")
    with out.open("x", encoding="utf-8") as stream:
        json.dump(obj, stream, indent=2)
        stream.write("\n")
    print(f"STAGING_SOURCE_MANIFEST=PASS files={obj['fileCount']} commit={sha[:12]}")


if __name__ == "__main__":
    main()
