#!/usr/bin/env python3
"""Read-only GitHub workflow_run filter, not an autonomous dispatch service.

A real coordinator must separately receive trusted credentials, atomic shared
leases and independent approval before dispatching a paid/free coding worker.
"""
import json
import os
import sys
from pathlib import Path

REPO = "darshitmeghani1992/the-wall"
TRIGGER_WORKFLOW = "Gemini two-task coding pilot (manual, no repo writes)"

def validate_event(event):
    if not isinstance(event, dict):
        return False, "invalid-payload"
    repo = event.get("repository") or {}
    run = event.get("workflow_run") or {}
    head_repo = (run.get("head_repository") or {}).get("full_name")
    if repo.get("full_name") != REPO or head_repo != REPO:
        return False, "untrusted-repository"
    if run.get("name") != TRIGGER_WORKFLOW:
        return False, "unexpected-workflow"
    if run.get("event") != "workflow_dispatch" or run.get("conclusion") != "success":
        return False, "not-successful-manual-pilot"
    if run.get("status") != "completed":
        return False, "not-completed"
    if not isinstance(run.get("id"), int) or run["id"] <= 0:
        return False, "invalid-run-id"
    sha = run.get("head_sha")
    if not isinstance(sha, str) or len(sha) != 40:
        return False, "missing-immutable-sha"
    if any(ch not in "0123456789abcdef" for ch in sha):
        return False, "invalid-sha"
    return True, "eligible-for-readonly-reconciliation"

def main():
    if os.environ.get("GITHUB_EVENT_NAME") != "workflow_run":
        raise SystemExit("Only workflow_run reconciliation events allowed")
    file = Path(os.environ.get("GITHUB_EVENT_PATH", ""))
    if not file.is_file() or file.stat().st_size > 1024 * 1024:
        raise SystemExit("Missing or oversized event payload")
    eligible, reason = validate_event(json.loads(file.read_text(encoding="utf-8")))
    # Only fixed status labels, never log external event contents.
    print(json.dumps({"mode":"read-only","eligible":eligible,"reason":reason}))
    return 0

if __name__ == "__main__":
    sys.exit(main())
