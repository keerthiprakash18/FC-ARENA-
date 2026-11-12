#!/usr/bin/env python3
"""Generate a release manifest from the exact archived Git tree, never build output.

Both the ZIP/tar release candidate and manifest MUST describe the same bytes.
CI builds can regenerate tracked Prisma or Next.js files after checkout.
Hashing the working tree after the build would be an unsafe false match.
"""
from __future__ import annotations

import argparse
import datetime as dt
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import tarfile

RESTRICTED_SUFFIXES = (".pem", ".key", ".p12", ".pfx", ".jks", ".keystore")
RESTRICTED_PARTS = {"secrets", "credentials", ".ssh", "private_keys"}
HASH_MAX_SIZE = 128 * 1024 * 1024


def git(*args: str) -> bytes:
    return subprocess.check_output(["git", *args], stderr=subprocess.DEVNULL)


def build_manifest(archive_path: Path, sha: str) -> dict:
    if not re.fullmatch(r"[a-f0-9]{40}", sha):
        raise ValueError("Invalid exact commit SHA")
    tracked = {
        item.decode("utf-8", errors="strict")
        for item in git("ls-files", "-z").split(b"\0") if item
    }
    files: dict[str, str] = {}
    with tarfile.open(archive_path, "r:gz") as archive:
        for item in archive:
            name = item.name.removeprefix("./")
            if name in {"", "."} or item.isdir():
                continue
            if not item.isfile() or item.issym() or item.islnk():
                raise ValueError("Nonregular or linked Git archive entry blocked")
            path = PurePosixPath(name)
            if path.is_absolute() or ".." in path.parts or name not in tracked:
                raise ValueError("Untracked or unsafe path in release archive")
            leaf = path.name.lower()
            if (leaf == ".env" or
                leaf.startswith(".env.") and leaf not in
                {".env.example", ".env.template", ".env.sample"} or
                leaf.endswith(RESTRICTED_SUFFIXES) or
                any(part.lower() in RESTRICTED_PARTS for part in path.parts)):
                raise ValueError("Tracked sensitive source path: manifest generation blocked")
            if item.size > HASH_MAX_SIZE or name in files:
                raise ValueError("Oversized or duplicate release archive path")
            stream = archive.extractfile(item)
            if stream is None:
                raise ValueError("Cannot read release archive entry")
            digest = hashlib.sha256()
            for chunk in iter(lambda: stream.read(1024 * 1024), b""):
                digest.update(chunk)
            files[name] = digest.hexdigest()
    if set(files) != tracked:
        raise ValueError("Git archive and tracked Git paths do not match")
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
    parser.add_argument("--source-archive", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    if os.environ.get("CI") != "true":
        raise SystemExit("BLOCKED: staging manifest must be built by tested CI only")
    sha = git("rev-parse", "HEAD").decode("ascii").strip()
    archive = Path(args.source_archive).resolve()
    if not archive.is_file() or archive.is_symlink():
        raise SystemExit("BLOCKED: source archive missing or a symlink")
    obj = build_manifest(archive, sha)
    out = Path(args.output).resolve()
    if not out.parent.is_dir() or out.exists():
        raise SystemExit("BLOCKED: output folder absent or manifest already exists")
    with out.open("x", encoding="utf-8") as stream:
        json.dump(obj, stream, indent=2)
        stream.write("\n")
    print(f"STAGING_SOURCE_MANIFEST=PASS files={obj['fileCount']} commit={sha[:12]} exact_archive_bytes=true")


if __name__ == "__main__":
    main()
