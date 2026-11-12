"""Unit tests for read-only VPS source collision classification (no VPS access)."""
from __future__ import annotations

import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("vps_reconcile", ROOT / "compare-vps-source-inventory.py")
assert spec is not None and spec.loader is not None
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


def candidate() -> dict:
    return {
        "schemaVersion": 1,
        "commitSha": "a" * 40,
        "fileCount": 2,
        "files": {
            "apps/web/src/index.ts": "a" * 64,
            "apps/api/src/main.ts": "b" * 64,
        },
    }


def inventory(paths: list[dict]) -> dict:
    return {
        "reportVersion": 1,
        "gitHead": "b" * 40,
        "trackedChangedCount": len(paths),
        "untrackedCount": 1,
        "categoryCounts": {
            "source_candidate": len(paths),
            "restricted": 1,
        },
        "candidateFiles": paths,
    }


class SourceReconciliationTest(unittest.TestCase):
    def test_matching_dirty_source_does_not_claim_approval(self):
        obj = module.assess(
            inventory([{
                "path": "apps/web/src/index.ts", "state": "present",
                "sha256": "a" * 64, "kind": "tracked_changed",
            }]), candidate(),
        )
        self.assertEqual(obj["status"], "NO_SOURCE_CONFLICTS_FOUND")
        self.assertEqual(obj["matchingDirtySourceFiles"], 1)
        self.assertEqual(obj["excludedGeneratedOrPrivateCount"], 1)
        self.assertTrue(any("does not authorize" in entry for entry in obj["limitations"]))

    def test_vps_only_untracked_source_blocks_release(self):
        obj = module.assess(inventory([{
            "path": "custom-prod-only-module.ts", "state": "present",
            "sha256": "c" * 64, "kind": "untracked",
        }]), candidate())
        self.assertEqual(obj["status"], "BLOCKED_SOURCE_DRIFT")
        self.assertEqual(obj["vpsOnlySourceFiles"], ["custom-prod-only-module.ts"])

    def test_modified_source_conflicts_are_explicit(self):
        obj = module.assess(inventory([{
            "path": "apps/web/src/index.ts", "state": "present",
            "sha256": "d" * 64, "kind": "tracked_changed",
        }]), candidate())
        self.assertEqual(obj["conflictingDirtySourceFiles"], ["apps/web/src/index.ts"])
        self.assertEqual(obj["status"], "BLOCKED_SOURCE_DRIFT")

    def test_bad_totals_fail_closed(self):
        broken = inventory([])
        broken["trackedChangedCount"] = 483
        with self.assertRaisesRegex(ValueError, "do not reconcile"):
            module.assess(broken, candidate())

    def test_missing_candidate_manifest_fails_closed(self):
        bad = candidate()
        bad["fileCount"] = 200
        with self.assertRaisesRegex(ValueError, "Missing or incomplete"):
            module.assess(inventory([]), bad)


if __name__ == "__main__":
    unittest.main()
