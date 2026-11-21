"""No-key, no-network tests for bounded two-task Gemini coding pilot."""
import ast
import importlib.util
import json
import sys
import tempfile
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
sys.path.insert(0,str(ROOT/"scripts"))
spec=importlib.util.spec_from_file_location("gemini_fixture_pilot",ROOT/"scripts/gemini_fixture_pilot_v2.py")
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class FakeResponse:
    def __init__(self,source): self.source=source
    def __enter__(self): return self
    def __exit__(self,*args): return False
    def read(self,limit):
        return json.dumps({"candidates":[{"content":{"parts":[{"text":self.source}]}}]}).encode()

ENV={
    "GEMINI_FIXTURE_PILOT_APPROVED":"true",
    "GEMINI_BILLING_TIER":"free",
    "GEMINI_API_KEY":"this-is-only-a-mock-test-key",
    "GITHUB_EVENT_NAME":"workflow_dispatch",
}

class PilotTests(unittest.TestCase):
    def test_two_consecutive_realistic_mock_requests(self):
        calls=[]
        def opener(req,timeout):
            self.assertEqual(timeout,25)
            calls.append(req)
            return FakeResponse("def add(a, b):\n    return a+b" if len(calls)==1 else "def subtract(a, b):\n    return a-b")
        with tempfile.TemporaryDirectory() as d:
            result=m.run(ENV,opener,state_path=Path(d)/"state.db")
        self.assertEqual(result["requests"],2)
        self.assertEqual(result["tasks"],["FIXTURE-ONE","FIXTURE-TWO"])
        self.assertEqual(len(calls),2)
        for req in calls:
            payload=json.loads(req.data)
            prompt=payload["contents"][0]["parts"][0]["text"]
            self.assertNotIn("AGENTS.md",prompt)
            self.assertNotIn("SUPABASE",prompt)
    def test_generated_artifacts_are_real_files_and_hashes(self):
        import hashlib
        calls=[]
        def opener(req, timeout):
            calls.append(req)
            return FakeResponse("def add(a,b): return a+b" if len(calls)==1
                                else "def subtract(a,b): return a-b")
        with tempfile.TemporaryDirectory() as d:
            folder=Path(d)/"artifacts"
            folder.mkdir()
            result=m.run(ENV,opener,state_path=Path(d)/"state.sqlite",
                         artifact_dir=folder)
            self.assertEqual(len(calls),2)
            self.assertEqual(set(p.name for p in folder.iterdir()),
                             {"generated_add.py","generated_subtract.py"})
            for task,name in [("FIXTURE-ONE","generated_add.py"),
                              ("FIXTURE-TWO","generated_subtract.py")]:
                content=(folder/name).read_bytes()
                self.assertEqual(hashlib.sha256(content).hexdigest(),
                                 result["source_sha256"][task])
                self.assertTrue(content.endswith(b"\\n"))
            self.assertNotIn("GEMINI_API_KEY", (folder/"generated_add.py").read_text())

    def test_artifact_overwrite_and_symlink_rejected(self):
        with tempfile.TemporaryDirectory() as d:
            folder=Path(d)/"artifacts"
            folder.mkdir()
            (folder/"generated_add.py").write_text("existing file")
            with self.assertRaises(ValueError):
                m.save_verified_artifact(folder,"FIXTURE-ONE","def add(a,b): return a+b")
            self.assertEqual((folder/"generated_add.py").read_text(),"existing file")
            link=Path(d)/"link"
            link.symlink_to(folder,target_is_directory=True)
            with self.assertRaises(ValueError):
                m.save_verified_artifact(link,"FIXTURE-TWO","def subtract(a,b): return a-b")

    def test_no_artifact_written_for_malicious_source(self):
        with tempfile.TemporaryDirectory() as d:
            with self.assertRaises(ValueError):
                m.save_verified_artifact(d,"FIXTURE-ONE",
                    "import os\\ndef add(a,b): return a+b")
            self.assertEqual(list(Path(d).iterdir()),[])

    def test_reject_import_call_and_extra_statements(self):
        for source in ["import os\ndef add(a,b): return a+b",
                       "def add(a,b): return os.system('bad')",
                       "def add(a,b):\n print(a)\n return a+b",
                       "def add(a,b): return a-b"]:
            with self.subTest(source=source):
                with self.assertRaises(ValueError):
                    m.verify_synthetic_code(source,"add",ast.Add)
    def test_key_or_free_flag_missing_blocks_before_network(self):
        def no_network(*a,**kw): self.fail("must not issue network request")
        with tempfile.TemporaryDirectory() as d:
            for missing in ["GEMINI_API_KEY","GEMINI_BILLING_TIER","GEMINI_FIXTURE_PILOT_APPROVED"]:
                env=dict(ENV)
                del env[missing]
                with self.assertRaises(ValueError):
                    m.run(env,no_network,Path(d)/"fixture.db")
    def test_forbid_ci_pr_event(self):
        with tempfile.TemporaryDirectory() as d:
            env=dict(ENV,GITHUB_EVENT_NAME="pull_request")
            with self.assertRaises(ValueError):
                m.run(env,lambda *_:self.fail("network called"),Path(d)/"state.db")
    def test_empty_response_rejected(self):
        with self.assertRaises(ValueError):
            m.extract({"candidates":[]})
    def test_fixture_is_ast_only(self):
        self.assertTrue(m.verify_synthetic_code("def add(a,b): return a+b","add",ast.Add))

if __name__=="__main__": unittest.main()
