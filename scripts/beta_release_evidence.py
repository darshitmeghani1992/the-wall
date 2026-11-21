#!/usr/bin/env python3
"""Fail-closed The-Wall beta release evidence checker.

This is a read-only report, NOT authorization to merge, deploy or invite testers.
All evidence must be independently collected for an immutable candidate SHA.
Do not store personal tester data, API keys or credentials in evidence JSON.
"""
import argparse
import json
import re
from pathlib import Path

REQUIRED = {
    "ci_exact_sha": "All required GitHub checks successful on candidate SHA",
    "independent_reviewer": "Independent Reviewer APPROVE tied to candidate SHA",
    "independent_behavioral_qa": "Independent behavioral QA PASS on candidate",
    "staging_identity": "Correct isolated staging project and nonproduction config",
    "otp_delivery": "Six-digit OTP delivered to authorized real testers",
    "three_actor_http": "Three distinct JWT actors verified over authenticated HTTP",
    "shared_wall_returning": "Private Shared Wall INSERT RETURNING and denial checked",
    "rls_and_definers": "Hosted RLS and SECURITY DEFINER access review",
    "media_runtime": "C2/C3 worker signing, quotas, cleanup, real playback and abuse QA",
    "secret_runtime": "One-time reveal + one-hour scheduled cleanup verified",
    "deletion_runtime": "Migration 0031/worker legal, recovery, rollback and device QA",
    "mobile_device_qa": "Installed Android/iOS device accessibility/offline/retry flows",
    "rollback": "Verified rollback and fail-closed feature disable instructions",
    "release_approvals": "Existing Founder/release approval and release notes"
}
STAGING = "ewintxgdxdvschiqodkq"
PRODUCTION = "wfsfafmgvxevpzrurofz"
SHA = re.compile(r"^[a-f0-9]{40}$")

def assess(data):
    errors = []
    if not isinstance(data, dict):
        return {"result": "NO-GO", "errors": ["invalid evidence object"], "missing": sorted(REQUIRED)}
    sha = data.get("candidate_sha")
    if not isinstance(sha, str) or not SHA.fullmatch(sha):
        errors.append("candidate SHA must be a full immutable 40-character commit hash")
    if data.get("supabase_project") != STAGING:
        errors.append("only isolated staging project is permitted")
    if data.get("supabase_project") == PRODUCTION:
        errors.append("PRODUCTION project is forbidden")
    evidence = data.get("gates", {})
    if not isinstance(evidence, dict):
        evidence = {}
        errors.append("gates must be a structured object")
    missing = []
    for gate in REQUIRED:
        entry = evidence.get(gate)
        if not isinstance(entry, dict) or entry.get("status") != "verified":
            missing.append(gate)
            continue
        if entry.get("sha") != sha:
            missing.append(gate)
            errors.append(gate + ": evidence SHA mismatch")
            continue
        if not isinstance(entry.get("url"), str) or not entry["url"].startswith("https://"):
            missing.append(gate)
            errors.append(gate + ": missing evidence link")
            continue
        # Do not infer Reviewer or QA from author's code, CI status, or comments.
        if gate in ("independent_reviewer", "independent_behavioral_qa"):
            if entry.get("independent") is not True:
                missing.append(gate)
                errors.append(gate + ": cannot self-certify")
    return {
        "result": "EVIDENCE-COMPLETE (NOT RELEASE AUTHORIZATION)" if not missing and not errors else "NO-GO",
        "candidate_sha": sha if isinstance(sha, str) else None,
        "staging_project": data.get("supabase_project"),
        "verified": len(REQUIRED) - len(set(missing)),
        "required": len(REQUIRED),
        "missing": missing,
        "errors": errors,
        "note": "Never merge/deploy on this report alone; independent approvals and existing Founder gates remain binding."
    }

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("evidence", type=Path)
    args = parser.parse_args()
    data = json.loads(args.evidence.read_text(encoding="utf-8"))
    report = assess(data)
    print(json.dumps(report, indent=2))
    if report["result"] == "NO-GO":
        raise SystemExit(1)

if __name__ == "__main__":
    main()
