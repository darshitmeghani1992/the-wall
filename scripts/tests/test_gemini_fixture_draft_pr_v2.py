"""No-network contract tests for synthetic GitHub draft PR publisher."""
import json
import sys
import tempfile
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts"))
import gemini_fixture_draft_pr_v2 as m

SHA="a"*40
TREE="b"*40
BLOB="c"*40
NEW_TREE="d"*40
NEW_COMMIT="e"*40
ENV={
  "GITHUB_EVENT_NAME":"workflow_dispatch",
  "GITHUB_REPOSITORY":m.REPOSITORY,
  "GITHUB_REF":"refs/heads/main",
  "GITHUB_ACTOR":"darshitmeghani1992",
  "GITHUB_RUN_ID":"12345",
  "GITHUB_SHA":SHA,
  "GITHUB_TOKEN":"mock-github-token-not-real-xxxxxxxx",
  "GEMINI_FIXTURE_PILOT_APPROVED":"true",
  "GEMINI_BILLING_TIER":"free",
}
class TestDraftWriter(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory()
        self.dir=Path(self.tmp.name)
        (self.dir/"generated_add.py").write_text("def add(a,b): return a+b\n")
        (self.dir/"generated_subtract.py").write_text("def subtract(a,b): return a-b\n")
    def tearDown(self):
        self.tmp.cleanup()

    def fake_transport(self, history, fail_stale=False):
        def call(method,path,data,token):
            history.append((method,path,data))
            self.assertEqual(token,ENV["GITHUB_TOKEN"])
            return {
                "/git/ref/heads/main": {"object":{"sha": "f"*40 if fail_stale else SHA}},
                "/git/commits/"+SHA: {"tree":{"sha":TREE}},
                "/git/blobs": {"sha":BLOB},
                "/git/trees": {"sha":NEW_TREE},
                "/git/commits": {"sha":NEW_COMMIT},
                "/git/refs": {},
                "/pulls": {"html_url":"https://github.com/"+m.REPOSITORY+"/pull/900"},
            }[path]
        return call
    def test_only_two_expected_files_on_draft_pr(self):
        history=[]
        result=m.publish(ENV,self.dir,self.fake_transport(history))
        self.assertEqual(result["status"],"draft_pr_created")
        self.assertEqual([p for _,p,_ in history].count("/git/blobs"),2)
        tree=next(data for method,path,data in history if path=="/git/trees")
        self.assertEqual({p["path"] for p in tree["tree"]},{
            "scripts/fixtures/gemini_generated_add.py",
            "scripts/fixtures/gemini_generated_subtract.py",
        })
        payload=next(data for method,path,data in history if path=="/pulls")
        self.assertTrue(payload["draft"])
        self.assertEqual(payload["base"],"main")
        self.assertEqual(payload["head"],"codex/cloud-worker-fixture-12345")
        self.assertFalse(any(path in ("/merges","/deployments") for _,path,_ in history))
    def test_stale_base_prevents_any_mutation(self):
        history=[]
        with self.assertRaises(ValueError):
            m.publish(ENV,self.dir,self.fake_transport(history,True))
        self.assertEqual([method for method,_,_ in history],["GET"])
    def test_disallowed_actor_and_events_prevent_network(self):
        for changed in [
            {"GITHUB_ACTOR":"attacker"},
            {"GITHUB_REF":"refs/heads/other"},
            {"GITHUB_REPOSITORY":"fork/repo"},
            {"GITHUB_EVENT_NAME":"pull_request"},
            {"GITHUB_RUN_ID":"1234; rm -rf /"},
            {"GITHUB_TOKEN":""},
        ]:
            with self.subTest(changed=changed):
                calls=[]
                with self.assertRaises(ValueError):
                    m.publish(dict(ENV,**changed),self.dir,self.fake_transport(calls))
                self.assertEqual(calls,[])
    def test_malicious_artifacts_prevent_network(self):
        (self.dir/"generated_add.py").write_text(
            "import os\ndef add(a,b): return a+b")
        history=[]
        with self.assertRaises(ValueError):
            m.publish(ENV,self.dir,self.fake_transport(history))
        self.assertEqual(history,[])
    def test_extra_file_or_symlink_prevents_network(self):
        (self.dir/"unapproved.py").write_text("bad")
        with self.assertRaises(ValueError):
            m.load_fixture_blobs(self.dir)
        (self.dir/"unapproved.py").unlink()
        (self.dir/"generated_add.py").unlink()
        (self.dir/"generated_add.py").symlink_to(
            self.dir/"generated_subtract.py")
        with self.assertRaises(ValueError):
            m.load_fixture_blobs(self.dir)
    def test_publisher_never_exposes_key_to_model(self):
        from gemini_fixture_pilot_v2 import TASKS
        self.assertTrue(all("GITHUB_TOKEN" not in prompt for _,prompt in TASKS))

if __name__=="__main__":
    unittest.main()
