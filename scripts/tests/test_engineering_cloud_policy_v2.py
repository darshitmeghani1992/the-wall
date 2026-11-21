"""Contract for a cloud runner that must remain disabled until separately approved."""
import json
from pathlib import Path
import unittest

POLICY = Path(__file__).resolve().parents[2] / "config" / "engineering-cloud-v2.json"

class CloudPolicyTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.policy = json.loads(POLICY.read_text())

    def test_only_preparation_mode(self):
        self.assertFalse(self.policy["enabled"])
        self.assertEqual(self.policy["mode"], "preparation_only")
        self.assertEqual(self.policy["coding_agent"], "unconfigured")
        self.assertEqual(self.policy["financial_limit_usd"], 0)

    def test_three_worker_limit_with_role_separation(self):
        self.assertEqual(self.policy["max_implementation_workers"], 3)
        self.assertEqual(set(self.policy["allowed_roles"]), {"FRONTEND", "BACKEND"})

    def test_hosted_boundary_and_review(self):
        self.assertEqual(self.policy["allowed_supabase_project"], "ewintxgdxdvschiqodkq")
        self.assertEqual(self.policy["forbidden_supabase_project"], "wfsfafmgvxevpzrurofz")
        for key in (
            "allow_auto_merge", "allow_deploy", "allow_hosted_writes",
            "allow_invitations", "allow_secret_or_media_activation",
            "allow_domain_or_apple_setup",
        ):
            self.assertFalse(self.policy[key], key)
        self.assertTrue(self.policy["draft_pr_only"])
        self.assertTrue(self.policy["require_independent_reviewer"])
        self.assertTrue(self.policy["require_independent_qa"])

if __name__ == "__main__":
    unittest.main()
