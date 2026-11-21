#!/usr/bin/env python3
"""Preflight that refuses live AI execution, payment, or production access."""
import json
import os
from pathlib import Path

POLICY_PATH = Path(__file__).resolve().parents[1] / "config/engineering-cloud-v2.json"
POLICY = json.loads(POLICY_PATH.read_text(encoding="utf-8"))

def assert_free_first_preparation(policy, env):
    assert policy["enabled"] is False, "Live agent activation forbidden"
    assert policy["mode"] == "preparation_only", "Not a preparation-only configuration"
    assert policy["financial_limit_usd"] == 0, "Only zero-spend preparations are allowed"
    assert policy["coding_agent"] == "unconfigured", "AI provider must not be activated here"
    assert policy["max_implementation_workers"] <= 3, "Hard worker cap exceeded"
    assert policy["allowed_supabase_project"] == "ewintxgdxdvschiqodkq"
    assert policy["forbidden_supabase_project"] == "wfsfafmgvxevpzrurofz"
    assert env.get("THE_WALL_SUPABASE_PROJECT") in (None, "ewintxgdxdvschiqodkq")
    for forbidden in (
        "allow_auto_merge", "allow_deploy", "allow_hosted_writes",
        "allow_invitations", "allow_secret_or_media_activation",
        "allow_domain_or_apple_setup",
    ):
        assert policy[forbidden] is False, forbidden

if __name__ == "__main__":
    assert_free_first_preparation(POLICY, os.environ)
    print("PASS: cloud worker remains off; free/no-secret dry-run preparation only.")
