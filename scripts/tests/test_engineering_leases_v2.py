"""SQLite lease and event contract tests: no network or accounts."""
import importlib.util
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("leases", ROOT / "scripts/engineering_leases_v2.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class LeaseTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.conn = m.connect(Path(self.tmp.name) / "leases.sqlite")
        self.now = 1000
    def tearDown(self):
        self.conn.close()
        self.tmp.cleanup()
    def claim(self, task, owner="worker-a", branch=None, **options):
        return m.claim(self.conn, task_id=task,
            branch=branch or ("codex/cloud-worker-" + task.lower()),
            role="BACKEND", owner=owner, now=self.now, ttl=30, **options)

    def test_three_worker_limit_and_no_double_claim(self):
        for i in range(3):
            self.assertIsInstance(self.claim("T"+str(i)), int)
        self.assertIsNone(self.claim("T3"))
        self.assertEqual(len(m.snapshot(self.conn, now=self.now)), 3)
        self.assertIsNone(self.claim("T0", owner="worker-b"))
    def test_release_immediately_frees_capacity(self):
        tokens=[self.claim("T"+str(i)) for i in range(3)]
        self.assertTrue(m.release(self.conn,"T1","worker-a",tokens[1],now=self.now))
        self.assertIsNotNone(self.claim("T3"))
        self.assertFalse(m.release(self.conn,"T1","worker-a",tokens[1],now=self.now))
    def test_expiry_fences_previous_owner(self):
        first=self.claim("T0")
        self.now+=31
        second=self.claim("T0",owner="worker-b")
        self.assertGreater(second,first)
        self.assertFalse(m.renew(self.conn,"T0","worker-a",first,now=self.now))
        self.assertFalse(m.release(self.conn,"T0","worker-a",first,now=self.now))
        self.assertTrue(m.renew(self.conn,"T0","worker-b",second,now=self.now))
    def test_branch_isolation(self):
        self.assertIsNotNone(self.claim("T0",branch="codex/cloud-worker-owned"))
        self.assertIsNone(self.claim("T1",branch="codex/cloud-worker-owned"))
        with self.assertRaises(ValueError):
            self.claim("T2",branch="main")
    def test_event_dedup_across_connections(self):
        self.assertTrue(m.record_event(self.conn,"delivery-1",now=self.now))
        connection2=m.connect(Path(self.tmp.name)/"leases.sqlite")
        try:
            self.assertFalse(m.record_event(connection2,"delivery-1",now=self.now+1))
            self.assertTrue(m.record_event(connection2,"delivery-2",now=self.now+1))
        finally:
            connection2.close()
    def test_atomic_cap_across_connections(self):
        conn2=m.connect(Path(self.tmp.name)/"leases.sqlite")
        try:
            for i in range(3):
                self.assertIsNotNone(self.claim("T"+str(i)))
            self.assertIsNone(m.claim(conn2,task_id="T9",branch="codex/cloud-worker-t9",
                role="FRONTEND",owner="worker-other",now=self.now,ttl=30))
        finally:
            conn2.close()
    def test_invalid_params(self):
        with self.assertRaises(ValueError):
            m.claim(self.conn,task_id="T0",branch="codex/cloud-worker-t0",
                role="REVIEWER",owner="someone",now=self.now)
        with self.assertRaises(ValueError):
            m.claim(self.conn,task_id="T0",branch="codex/cloud-worker-t0",
                role="BACKEND",owner="someone",now=self.now,max_workers=4)
        with self.assertRaises(ValueError):
            m.record_event(self.conn,"")
    def test_recycled_branch_after_release(self):
        first=self.claim("T0",branch="codex/cloud-worker-recycled")
        self.assertTrue(m.release(self.conn,"T0","worker-a",first,now=self.now))
        self.assertIsNotNone(self.claim("T1",branch="codex/cloud-worker-recycled"))

if __name__ == "__main__":
    unittest.main()
