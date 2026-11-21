"""Read-only event router contract tests."""
import importlib.util
from pathlib import Path
import unittest

P=Path(__file__).resolve().parents[2]/"scripts/engineering_cloud_event_router_v2.py"
spec=importlib.util.spec_from_file_location("router",P)
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
SHA="a"*40

def fixture():
    return {
        "repository":{"full_name":m.REPO},
        "workflow_run":{
            "id":123,"name":m.TRIGGER_WORKFLOW,
            "event":"workflow_dispatch","status":"completed","conclusion":"success",
            "head_repository":{"full_name":m.REPO},"head_sha":SHA,
        }
    }

class Tests(unittest.TestCase):
    def test_accept_exact_one_expected_pilot(self):
        self.assertEqual(m.validate_event(fixture()),(True,"eligible-for-readonly-reconciliation"))
    def test_reject_forged_and_failed_pilots(self):
        variants=[
            ("repository","full_name","attacker/repo"),
            ("workflow_run","name","Another workflow"),
            ("workflow_run","event","pull_request"),
            ("workflow_run","conclusion","failure"),
            ("workflow_run","status","in_progress"),
            ("workflow_run","head_sha","bad"),
            ("workflow_run","id",0),
        ]
        for parent,key,value in variants:
            event=fixture()
            event[parent][key]=value
            with self.subTest(key=key,value=value):
                self.assertFalse(m.validate_event(event)[0])
    def test_reject_fork_source(self):
        event=fixture()
        event["workflow_run"]["head_repository"]["full_name"]="fork/repo"
        self.assertFalse(m.validate_event(event)[0])
    def test_reject_missing_fields(self):
        for event in [None,[],{},{"repository":{"full_name":m.REPO}}]:
            with self.subTest(event=event):
                self.assertFalse(m.validate_event(event)[0])

if __name__=="__main__":
    unittest.main()
