"""No network/credentials in unit tests for the free-tier Gemini smoke."""
import importlib.util
import json
import sys
from pathlib import Path
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
spec = importlib.util.spec_from_file_location("gemini_free_smoke", ROOT / "scripts/gemini_free_smoke.py")
m = importlib.util.module_from_spec(spec)
spec.loader.exec_module(m)

class Response:
    def __enter__(self):
        return self
    def __exit__(self, *args):
        return False
    def read(self, size):
        return json.dumps({"candidates": [{"content": {"parts": [{"text": "READY"}]}}]}).encode()

class Tests(unittest.TestCase):
    def test_exact_single_mock_request(self):
        calls = []
        def opener(request, timeout):
            calls.append((request, timeout))
            return Response()
        environment = {
            "GEMINI_FREE_SMOKE_APPROVED": "true", "GEMINI_BILLING_TIER": "free",
            "GEMINI_API_KEY": "test-key-not-real-0123456789",
            "THE_WALL_SUPABASE_PROJECT": "ewintxgdxdvschiqodkq",
        }
        self.assertEqual(m.run(environment, opener)["requests"], 1)
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0][0].get_method(), "POST")
        self.assertEqual(json.loads(calls[0][0].data), m.request_payload())
        self.assertEqual(calls[0][1], 20)
    def test_missing_free_tier_declines_before_network(self):
        good = {
            "GEMINI_FREE_SMOKE_APPROVED": "true",
            "GEMINI_API_KEY": "test-key-not-real-0123456789",
        }
        def never(*args, **kwargs):
            self.fail("Never contact remote model on failed preflight")
        with self.assertRaises(ValueError):
            m.run(good, never)
    def test_requires_explicit_approval(self):
        with self.assertRaises(ValueError):
            m.run({"GEMINI_BILLING_TIER": "free", "GEMINI_API_KEY": "dummy-test-key-123456789"}, lambda *_: None)
    def test_no_workspace_content_in_request(self):
        payload = json.dumps(m.request_payload())
        self.assertNotIn("AGENTS.md", payload)
        self.assertNotIn("supabase", payload.lower())
        self.assertEqual(m.MODEL, "gemini-2.5-flash-lite")
    def test_empty_model_answer_rejected(self):
        with self.assertRaises(ValueError):
            m.check_response({"candidates": []})

if __name__ == "__main__":
    unittest.main()
