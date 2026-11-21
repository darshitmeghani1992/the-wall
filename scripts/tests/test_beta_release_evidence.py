"""Offline release evidence contracts; never contacts staging or GitHub."""
import importlib.util
from pathlib import Path
import unittest

ROOT=Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location("beta_release_evidence",ROOT/"scripts/beta_release_evidence.py")
m=importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)
SHA="a"*40
URL="https://github.com/darshitmeghani1992/the-wall/actions/runs/123"

def all_green():
    return {
        "candidate_sha": SHA,
        "supabase_project": m.STAGING,
        "gates": {
            gate: {"status":"verified","sha":SHA,"url":URL,
                   "independent":True if gate in ("independent_reviewer","independent_behavioral_qa") else None}
            for gate in m.REQUIRED
        }
    }

class ReleaseEvidenceTests(unittest.TestCase):
    def test_missing_everything_is_no_go(self):
        result=m.assess({})
        self.assertEqual(result["result"],"NO-GO")
        self.assertEqual(len(result["missing"]),len(m.REQUIRED))
    def test_green_ci_cannot_imply_beta_go(self):
        data={"candidate_sha":SHA,"supabase_project":m.STAGING,
              "gates":{"ci_exact_sha":{"status":"verified","sha":SHA,"url":URL}}}
        result=m.assess(data)
        self.assertEqual(result["result"],"NO-GO")
        self.assertIn("otp_delivery",result["missing"])
        self.assertIn("media_runtime",result["missing"])
        self.assertIn("independent_reviewer",result["missing"])
    def test_production_fails_closed(self):
        data=all_green()
        data["supabase_project"]=m.PRODUCTION
        self.assertEqual(m.assess(data)["result"],"NO-GO")
    def test_stale_review_is_no_go(self):
        data=all_green()
        data["gates"]["independent_reviewer"]["sha"]="b"*40
        result=m.assess(data)
        self.assertEqual(result["result"],"NO-GO")
        self.assertIn("independent_reviewer",result["missing"])
    def test_self_review_and_self_qa_rejected(self):
        data=all_green()
        for gate in ("independent_reviewer","independent_behavioral_qa"):
            data["gates"][gate]["independent"]=False
        result=m.assess(data)
        self.assertEqual(result["result"],"NO-GO")
        self.assertIn("independent_reviewer",result["missing"])
        self.assertIn("independent_behavioral_qa",result["missing"])
    def test_missing_evidence_url_rejected(self):
        data=all_green()
        del data["gates"]["otp_delivery"]["url"]
        result=m.assess(data)
        self.assertEqual(result["result"],"NO-GO")
        self.assertIn("otp_delivery",result["missing"])
    def test_complete_matrix_only_means_evidence_complete(self):
        result=m.assess(all_green())
        self.assertEqual(result["verified"],len(m.REQUIRED))
        self.assertEqual(result["result"],"EVIDENCE-COMPLETE (NOT RELEASE AUTHORIZATION)")
    def test_malformed_gate_data_fails(self):
        data=all_green()
        data["gates"]=[]
        self.assertEqual(m.assess(data)["result"],"NO-GO")
    def test_immutable_sha_required(self):
        data=all_green()
        data["candidate_sha"]="a"*7
        self.assertEqual(m.assess(data)["result"],"NO-GO")

if __name__=="__main__":
    unittest.main()
