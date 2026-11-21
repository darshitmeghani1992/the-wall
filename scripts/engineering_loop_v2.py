#!/usr/bin/env python3
"""Fail-closed task selection for The-Wall's proposed external coding-agent loop.

This is a dispatcher foundation, not a persistent coding agent or a release controller.
No hosted writes, merges, deployments, secrets, or external task execution.
"""
import argparse
import json
import os
import re
import shutil
import subprocess
from pathlib import Path

MAX_IMPLEMENTERS = 3
STAGING_ID = "ewintxgdxdvschiqodkq"
PRODUCTION_ID = "wfsfafmgvxevpzrurofz"
ALLOWED_IMPLEMENTATION_ROLES = {"FRONTEND", "BACKEND"}
QUEUE_ROW = re.compile(r"^\|\s*(BETA-[^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|\s*([^|]+)\|")

def read_tasks(status_path: Path):
    text = status_path.read_text(encoding="utf-8")
    tasks = []
    for line in text.splitlines():
        match = QUEUE_ROW.match(line)
        if not match:
            continue
        task, role, acceptance, dependencies, state, next_action = [
            item.strip() for item in match.groups()
        ]
        role = role.split(" ", 1)[0].upper()
        tasks.append({
            "id": task.split(" ", 1)[0],
            "role": role,
            "acceptance": acceptance,
            "dependencies": dependencies,
            "status": state,
            "next_action": next_action,
        })
    return tasks

def eligible(tasks, active_ids=(), max_workers=MAX_IMPLEMENTERS):
    if not 1 <= max_workers <= MAX_IMPLEMENTERS:
        raise ValueError("worker count must be between 1 and 3")
    active_ids = set(active_ids)
    chosen = []
    for task in tasks:
        status = task["status"].lower()
        if task["role"] not in ALLOWED_IMPLEMENTATION_ROLES:
            continue
        if task["id"] in active_ids:
            continue
        if any(term in status for term in ("blocked", "withheld", "on hold", "no-go")):
            continue
        # Task status may describe an implemented but unreviewed draft.
        # Such a task requires review, not a second implementation worker.
        if any(term in status for term in ("implemented draft", "independent review", "awaiting qa")):
            continue
        # No task may be granted automatically if its dependencies require
        # Founder approval or independent review before implementation.
        deps = task["dependencies"].lower()
        if any(term in deps for term in ("founder approval", "reviewer approval", "hosted 0031")):
            continue
        chosen.append(task)
        if len(chosen) == max_workers:
            break
    return chosen

def runtime_probe():
    executable = shutil.which("claude")
    if not executable:
        return {"ready": False, "reason": "No supported external coding-agent executable found"}
    try:
        result = subprocess.run(
            [executable, "--version"], capture_output=True, text=True,
            timeout=10, check=False,
        )
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"ready": False, "reason": type(exc).__name__}
    if result.returncode != 0:
        return {"ready": False, "reason": "Agent executable failed its version smoke test"}
    return {"ready": True, "agent": "claude", "version": result.stdout.strip()}

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--status", default="docs/BUILD_STATUS.md")
    parser.add_argument("--active", nargs="*", default=[])
    parser.add_argument("--workers", type=int, default=3)
    parser.add_argument("--probe", action="store_true")
    args = parser.parse_args()
    if args.probe:
        print(json.dumps(runtime_probe(), indent=2))
        return
    if os.environ.get("THE_WALL_SUPABASE_PROJECT") not in (None, STAGING_ID):
        raise SystemExit("Refusing non-staging Supabase project")
    tasks = read_tasks(Path(args.status))
    if not tasks:
        raise SystemExit("No canonical beta queue found; refusing to invent work")
    print(json.dumps({
        "mode": "dry-run-only",
        "runtime": runtime_probe(),
        "max_workers": MAX_IMPLEMENTERS,
        "production_project_protected": PRODUCTION_ID,
        "tasks": eligible(tasks, args.active, args.workers),
    }, indent=2))

if __name__ == "__main__":
    main()
