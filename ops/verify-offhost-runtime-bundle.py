#!/usr/bin/env python3
"""Offline-only verifier for an FC ARENA GitHub Actions runtime tarball.

Does not extract files, contact servers, access production credentials, or
change the archive. This is a pre-deployment gate, NOT deployment approval.
"""
import argparse
import hashlib
from pathlib import Path
import posixpath
import re
import tarfile

SHA = re.compile(r"[0-9a-f]{40}\Z")
HASH_LINE = re.compile(r"([0-9a-f]{64})  (fcarena-runtime-[0-9a-f]{40}\.tar\.gz)\Z")
REQUIRED = {"package.json", "package-lock.json", "apps/web/.next/BUILD_ID"}
ROOTS = ("node_modules/", "packages/", "apps/api/", "apps/web/")
DATA_DIRS = {"storage", "uploads", "backups", "user-data", "user_uploads"}


class UnsafeBundle(ValueError):
    pass


def verify(directory: Path, release: str) -> int:
    if not SHA.fullmatch(release):
        raise UnsafeBundle("invalid release identity")
    name = f"fcarena-runtime-{release}.tar.gz"
    archive = directory / name
    manifest = directory / "SHA256SUMS"
    release_file = directory / "RELEASE_SHA.txt"
    if any(p.is_symlink() or not p.is_file() for p in (archive, manifest, release_file)):
        raise UnsafeBundle("missing or symlinked artifact component")
    if release_file.read_text(encoding="ascii").strip() != release:
        raise UnsafeBundle("artifact release SHA mismatch")
    lines = manifest.read_text(encoding="ascii").splitlines()
    if len(lines) != 1:
        raise UnsafeBundle("expected exactly one checksum")
    match = HASH_LINE.fullmatch(lines[0])
    if not match or match.group(2) != name:
        raise UnsafeBundle("checksum filename or format mismatch")
    digest = hashlib.sha256()
    with archive.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    if digest.hexdigest() != match.group(1):
        raise UnsafeBundle("artifact checksum mismatch")

    seen: set[str] = set()
    regular: set[str] = set()
    directories: set[str] = set()
    hardlinks: dict[str, str] = {}
    count = 0
    with tarfile.open(archive, "r:gz") as bundle:
        for member in bundle:
            count += 1
            if count > 300000:
                raise UnsafeBundle("unexpectedly large archive member count")
            raw = member.name.removeprefix("./").rstrip("/")
            parts = raw.split("/")
            if (not raw or raw.startswith("/") or
                    any(p in ("", ".", "..") for p in parts) or "\\" in raw):
                raise UnsafeBundle("unsafe archive path")
            if not (raw in ("package.json", "package-lock.json") or
                    raw.startswith(ROOTS) or raw in ("node_modules", "packages", "apps", "apps/api", "apps/web")):
                raise UnsafeBundle("unexpected archive root: " + raw[:120])
            if raw.startswith(("apps/api/", "apps/web/", "packages/")):
                if any(p in DATA_DIRS or p == ".env" or p.startswith(".env.") for p in parts):
                    raise UnsafeBundle("persistent data or env bundled: " + raw[:120])
                if any(p in (".git", "id_rsa", "id_ed25519") for p in parts):
                    raise UnsafeBundle("private source or credentials bundled")
            if member.issym() or member.islnk():
                target = member.linkname
                if not target or target.startswith("/") or "\\" in target:
                    raise UnsafeBundle("unsafe archive link")
                linked = posixpath.normpath(posixpath.join(
                    posixpath.dirname(raw), target
                ) if member.issym() else target)
                if linked == ".." or linked.startswith("../") or linked.startswith("/"):
                    raise UnsafeBundle("escaping archive link")
                if member.islnk():
                    hardlinks[raw] = linked
            elif member.isfile():
                regular.add(raw)
            elif member.isdir():
                directories.add(raw)
            else:
                raise UnsafeBundle("special archive file type")
            if raw in seen:
                raise UnsafeBundle("duplicate archive entry: " + raw[:120])
            seen.add(raw)
    # Tar extraction must never traverse a member that is a symlink, hardlink,
    # or regular file. Validate after reading all headers so archive order
    # cannot conceal a link ancestor. Implicit directories are permitted.
    non_directories = seen - directories
    for raw in seen:
        parent = posixpath.dirname(raw)
        while parent:
            if parent in non_directories:
                raise UnsafeBundle("non-directory archive ancestor: " + parent[:120])
            parent = posixpath.dirname(parent)
    for target in hardlinks.values():
        if target not in regular:
            raise UnsafeBundle("hardlink target must be a regular archived file")
    if not REQUIRED.issubset(regular):
        raise UnsafeBundle("missing required compiled runtime files (regular files required)")
    if not any(n in regular for n in ("apps/api/dist/main.js", "apps/api/dist/main")):
        raise UnsafeBundle("missing compiled API entrypoint")
    print(f"OFFHOST_BUNDLE_SAFETY=PASS RELEASE={release} ENTRIES={count}")
    print("PRODUCTION_DEPLOYMENT_AUTHORIZED=NO")
    return count


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output-dir", type=Path, required=True)
    parser.add_argument("--release", required=True)
    args = parser.parse_args()
    try:
        verify(args.output_dir, args.release)
    except (UnsafeBundle, OSError, tarfile.TarError) as e:
        raise SystemExit("OFFHOST_BUNDLE_SAFETY=BLOCKED " + str(e)) from e


if __name__ == "__main__":
    main()
