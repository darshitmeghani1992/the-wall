"""Simulated task-to-task handoff for the proposed cloud coding dispatcher.

No subprocess, Gemini invocation, GitHub API write or network use.
"""
from engineering_leases_v2 import claim, complete, completed_ids, snapshot, MAX_WORKERS
from engineering_loop_v2 import eligible

def dispatch_once(conn, tasks, *, owner, now, slots=MAX_WORKERS):
    if not 1 <= slots <= MAX_WORKERS:
        raise ValueError("slots must be 1..3")
    active_ids = {item["task_id"] for item in snapshot(conn, now=now)} | completed_ids(conn)
    selections = eligible(tasks, active_ids=active_ids, max_workers=slots)
    claimed = []
    for task in selections:
        task_id = task["id"]
        # Unique branch name derives ONLY from sanitized canonical task ID.
        safe_id = task_id.lower().replace("_", "-")
        if not safe_id or any(c not in "abcdefghijklmnopqrstuvwxyz0123456789-" for c in safe_id):
            continue
        token = claim(conn, task_id=task_id, branch="codex/cloud-worker-" + safe_id,
                      role=task["role"], owner=owner, now=now, ttl=300, max_workers=slots)
        if token is not None:
            claimed.append({"task_id": task_id, "token": token})
    return claimed

def complete_and_dispatch(conn, tasks, *, task_id, token, owner, event_id, now, slots=MAX_WORKERS):
    """Only an active fenced lease can complete, once per unique event.

    This simulation does NOT mark QA/review complete, merge or deploy.
    Completed tasks are durably excluded even if the input queue remains unchanged.
    """
    if not complete(conn, task_id, owner, token, event_id, now=now):
        return []
    return dispatch_once(conn, tasks, owner=owner, now=now, slots=slots)
