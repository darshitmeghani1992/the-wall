"""Two real state-machine ticks with no AI/network/billing."""
import importlib.util
import sys
from pathlib import Path
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
from engineering_leases_v2 import connect, snapshot, renew
from engineering_handoff_sim_v2 import dispatch_once, complete_and_dispatch

def task(identifier, role="BACKEND", status="Partially source tested"):
    return dict(id=identifier,role=role,status=status,dependencies="baseline")

class HandoffTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.db=connect(Path(self.tmp.name)/"state.sqlite")
        self.tasks=[task("BETA-A"),task("BETA-B","FRONTEND"),task("BETA-C")]
    def tearDown(self):
        self.db.close()
        self.tmp.cleanup()
    def test_two_consecutive_tasks_without_hourly_wait(self):
        first=dispatch_once(self.db,self.tasks,owner="runner-1",now=100,slots=1)
        self.assertEqual([x["task_id"] for x in first],["BETA-A"])
        second=complete_and_dispatch(self.db,self.tasks,task_id="BETA-A",
                token=first[0]["token"],owner="runner-1",event_id="completed-a",
                now=101,slots=1)
        self.assertEqual([x["task_id"] for x in second],["BETA-B"])
        self.assertEqual([x["task_id"] for x in snapshot(self.db,now=101)],["BETA-B"])
    def test_blocked_tasks_never_assigned(self):
        values=[task("SECRET",status="Blocked: security approval"),task("BETA-A")]
        selected=dispatch_once(self.db,values,owner="runner-1",now=100,slots=3)
        self.assertEqual([x["task_id"] for x in selected],["BETA-A"])
    def test_stale_completion_rejected(self):
        first=dispatch_once(self.db,self.tasks,owner="runner-1",now=100,slots=1)[0]
        self.assertFalse(renew(self.db,"BETA-A","runner-1",first["token"],now=500))
        next_items=complete_and_dispatch(self.db,self.tasks,task_id="BETA-A",
                token=first["token"],owner="runner-1",event_id="stale-event",
                now=500,slots=1)
        self.assertEqual(next_items,[])
    def test_no_duplicate_completion_dispatch(self):
        first=dispatch_once(self.db,self.tasks,owner="runner-1",now=100,slots=1)[0]
        options=dict(task_id="BETA-A",token=first["token"],owner="runner-1",
                     event_id="completed-a",now=101,slots=1)
        self.assertEqual(len(complete_and_dispatch(self.db,self.tasks,**options)),1)
        self.assertEqual(complete_and_dispatch(self.db,self.tasks,**options),[])

if __name__=="__main__":
    unittest.main()
