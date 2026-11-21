"""Deterministic fail-closed contract tests; no GitHub/Supabase access."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

MODULE = Path(__file__).resolve().parents[1] / "engineering_loop_v2.py"
spec = importlib.util.spec_from_file_location("engineering_loop_v2", MODULE)
loop = importlib.util.module_from_spec(spec)
spec.loader.exec_module(loop)

class LoopTests(unittest.TestCase):
    def setUp(self):
        self.rows = [
            dict(id="BETA-1", role="BACKEND", status="Partial source tested", dependencies="baseline"),
            dict(id="BETA-2", role="FRONTEND", status="Partially source-tested", dependencies="stable candidate"),
            dict(id="BETA-3", role="BACKEND", status="Blocked: SMTP", dependencies="provider"),
            dict(id="BETA-4", role="QA", status="Pending", dependencies="build"),
            dict(id="BETA-5", role="BACKEND", status="Pending", dependencies="Founder approval"),
            dict(id="BETA-6", role="BACKEND", status="Implemented draft", dependencies="baseline"),
        ]
    def test_role_and_block_gates(self):
        self.assertEqual([t["id"] for t in loop.eligible(self.rows)], ["BETA-1", "BETA-2"])
    def test_no_double_lease(self):
        self.assertEqual([t["id"] for t in loop.eligible(self.rows, ["BETA-1"])], ["BETA-2"])
    def test_max_workers_is_hard_cap(self):
        for count in [0, 4, 100]:
            with self.assertRaises(ValueError):
                loop.eligible(self.rows, max_workers=count)
    def test_parse_only_canonical_rows(self):
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory) / "BUILD_STATUS.md"
            file.write_text(
                "| ID | Role | Acceptance | Dependencies | Status | Next |\n"
                "|---|---|---|---|---|---|\n"
                "| BETA-P0-04 Privacy | BACKEND | Denials | staging | Partial | Audit |\n"
            )
            tasks = loop.read_tasks(file)
            self.assertEqual(len(tasks), 1)
            self.assertEqual(tasks[0]["id"], "BETA-P0-04")

if __name__ == "__main__":
    unittest.main()
