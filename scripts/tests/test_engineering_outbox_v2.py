"""Outbox recovery tests: completion cannot lose its next-dispatch intent."""
from pathlib import Path
import sys
import tempfile
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts"))
from engineering_leases_v2 import (
    connect, claim, complete, pending_dispatches, mark_dispatched, completed_ids
)

class OutboxTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.path=Path(self.tmp.name)/"leases.sqlite"
        self.db=connect(self.path)
    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()
    def acquire(self,task="BETA-A"):
        return claim(self.db,task_id=task,branch="codex/cloud-worker-"+task.lower(),
            role="BACKEND",owner="worker",now=100,ttl=300)
    def test_completion_records_dispatch_atomically(self):
        token=self.acquire()
        self.assertTrue(complete(self.db,"BETA-A","worker",token,"done-a",now=101))
        self.assertEqual([v["event_id"] for v in pending_dispatches(self.db)],["done-a"])
        self.assertIn("BETA-A",completed_ids(self.db))
        self.assertFalse(complete(self.db,"BETA-A","worker",token,"done-a",now=101))
        self.assertEqual(len(pending_dispatches(self.db)),1)
    def test_crash_reopen_retains_pending_event(self):
        token=self.acquire()
        self.assertTrue(complete(self.db,"BETA-A","worker",token,"done-a",now=101))
        self.db.close()
        self.db=connect(self.path)
        self.assertEqual(pending_dispatches(self.db)[0]["task_id"],"BETA-A")
        self.assertTrue(mark_dispatched(self.db,"done-a",now=102))
        self.assertEqual(pending_dispatches(self.db),[])
        self.assertFalse(mark_dispatched(self.db,"done-a",now=103))
    def test_stale_owner_cannot_create_outbox(self):
        token=self.acquire()
        self.assertFalse(complete(self.db,"BETA-A","worker",token,"late",now=401))
        self.assertEqual(pending_dispatches(self.db),[])
    def test_duplicate_event_no_second_outbox(self):
        a=self.acquire()
        self.assertTrue(complete(self.db,"BETA-A","worker",a,"same-event",now=101))
        b=self.acquire("BETA-B")
        self.assertFalse(complete(self.db,"BETA-B","worker",b,"same-event",now=102))
        self.assertEqual(len(pending_dispatches(self.db)),1)

if __name__=="__main__":
    unittest.main()
