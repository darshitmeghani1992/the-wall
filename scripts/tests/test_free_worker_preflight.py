import importlib.util
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
FILE = ROOT / "scripts" / "free_worker_preflight.py"
spec = importlib.util.spec_from_file_location("free_worker_preflight", FILE)
mod = importlib.util.module_from_spec(spec)
spec.loader.exec_module(mod)

class FreeWorkerPreflightTests(unittest.TestCase):
    def test_default_config_is_disabled(self):
        mod.assert_free_first_preparation(mod.POLICY, {})

    def test_paid_or_live_agent_is_rejected(self):
        for key, value in [
            ("enabled", True), ("financial_limit_usd", 1),
            ("coding_agent", "gemini"), ("allow_auto_merge", True),
            ("allow_hosted_writes", True), ("max_implementation_workers", 4),
        ]:
            with self.subTest(key=key):
                policy = dict(mod.POLICY, **{key: value})
                with self.assertRaises(AssertionError):
                    mod.assert_free_first_preparation(policy, {})

    def test_production_target_rejected(self):
        with self.assertRaises(AssertionError):
            mod.assert_free_first_preparation(mod.POLICY, {
                "THE_WALL_SUPABASE_PROJECT": "wfsfafmgvxevpzrurofz",
            })

if __name__ == "__main__":
    unittest.main()
