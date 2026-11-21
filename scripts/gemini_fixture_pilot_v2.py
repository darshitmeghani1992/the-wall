#!/usr/bin/env python3
"""Bounded Gemini coding-worker pilot against synthetic public fixture tasks only.

The model receives ZERO repository content. Generated Python is parsed as AST
but NEVER executed. No GitHub write, network fallback, staging/production,
credentials in output, or unattended scheduler. Requires explicit manual gate.
"""
import ast
import hashlib
import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

from engineering_leases_v2 import claim, complete, connect, pending_dispatches, mark_dispatched
from free_worker_preflight import POLICY, assert_free_first_preparation

MODEL = "gemini-2.5-flash-lite"
ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent"
TASKS = [
    ("FIXTURE-ONE", "Write Python code defining function add(a, b) that returns a + b. "
     "Only one def and return; no imports, calls or annotations."),
    ("FIXTURE-TWO", "Write Python code defining function subtract(a, b) that returns a - b. "
     "Only one def and return; no imports, calls or annotations."),
]

def extract(response):
    candidates = response.get("candidates") or []
    parts = (candidates[0].get("content") or {}).get("parts") if candidates else None
    text = "".join(p.get("text", "") for p in (parts or []) if isinstance(p, dict)).strip()
    if text.startswith("```python"):
        text = text[len("```python"):].strip()
    if text.startswith("```"):
        text = text[3:].strip()
    if text.endswith("```"):
        text = text[:-3].strip()
    if len(text) > 2000 or not text:
        raise ValueError("empty or oversized model output")
    return text

def verify_synthetic_code(source, expected_name, expected_op):
    try:
        tree = ast.parse(source)
    except SyntaxError as exc:
        raise ValueError("invalid fixture syntax") from exc
    if len(tree.body) != 1 or not isinstance(tree.body[0], ast.FunctionDef):
        raise ValueError("fixture must contain exactly one function")
    fn = tree.body[0]
    if fn.name != expected_name or fn.decorator_list or fn.returns is not None:
        raise ValueError("unexpected fixture function metadata")
    if [a.arg for a in fn.args.args] != ["a", "b"] or fn.args.defaults or fn.args.kwonlyargs:
        raise ValueError("unexpected fixture signature")
    if len(fn.body) != 1 or not isinstance(fn.body[0], ast.Return):
        raise ValueError("unexpected fixture body")
    expression = fn.body[0].value
    if not isinstance(expression, ast.BinOp) or not isinstance(expression.op, expected_op):
        raise ValueError("unexpected fixture operation")
    if not isinstance(expression.left, ast.Name) or expression.left.id != "a":
        raise ValueError("unexpected left operand")
    if not isinstance(expression.right, ast.Name) or expression.right.id != "b":
        raise ValueError("unexpected right operand")
    # Deliberately never compile/exec generated code.
    return True

def ask_model(task, key, opener=urllib.request.urlopen):
    request = urllib.request.Request(
        ENDPOINT,
        data=json.dumps({
            "contents": [{"role": "user", "parts": [{"text":
                "Generate only valid Python source for this harmless offline fixture. "
                "No markdown, no imports, no side effects. " + task}]}],
            "generationConfig": {"temperature": 0, "maxOutputTokens": 180},
        }).encode(),
        headers={"Content-Type": "application/json", "x-goog-api-key": key},
        method="POST",
    )
    with opener(request, timeout=25) as response:
        payload = json.loads(response.read(8192).decode("utf-8"))
    return extract(payload)

def save_verified_artifact(directory, task_id, code):
    """Save only AST-verified synthetic source under an allowlisted filename.

    This is a disposable GitHub Actions artifact, never a repository write.
    """
    filenames = {"FIXTURE-ONE": "generated_add.py", "FIXTURE-TWO": "generated_subtract.py"}
    if task_id not in filenames:
        raise ValueError("unrecognized synthetic task")
    expected_name, operation = (
        ("add", ast.Add) if task_id == "FIXTURE-ONE" else ("subtract", ast.Sub)
    )
    verify_synthetic_code(code, expected_name, operation)
    output_dir = Path(directory).resolve(strict=True)
    if not output_dir.is_dir() or output_dir.is_symlink():
        raise ValueError("invalid artifact directory")
    output = output_dir / filenames[task_id]
    if output.exists() or output.is_symlink():
        raise ValueError("refusing to overwrite artifact")
    normalized = code.rstrip() + "\\n"
    output.write_text(normalized, encoding="utf-8")
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

def run(env=os.environ, opener=urllib.request.urlopen, state_path=None, artifact_dir=None):
    assert_free_first_preparation(POLICY, env)
    if env.get("GEMINI_FIXTURE_PILOT_APPROVED") != "true":
        raise ValueError("explicit manual pilot approval missing")
    if env.get("GEMINI_BILLING_TIER") != "free":
        raise ValueError("free-tier confirmation missing")
    if env.get("GITHUB_EVENT_NAME") not in (None, "workflow_dispatch"):
        raise ValueError("only a manually dispatched pilot is permitted")
    key = env.get("GEMINI_API_KEY", "")
    if len(key) < 16:
        raise ValueError("Gemini secret unavailable")
    if state_path is None:
        raise ValueError("scratch DB path required")
    if artifact_dir is not None:
        artifact = Path(artifact_dir)
        if not artifact.is_dir() or artifact.is_symlink():
            raise ValueError("safe existing artifact directory required")
    db = connect(Path(state_path))
    try:
        completed = []
        source_digests = {}
        for index, (task_id, task_prompt) in enumerate(TASKS):
            token = claim(db, task_id=task_id,
                          branch="codex/cloud-worker-fixture-" + str(index),
                          role="BACKEND", owner="fixture-pilot", ttl=240,
                          max_workers=1)
            if token is None:
                raise ValueError("fixture lease unavailable")
            code = ask_model(task_prompt, key, opener)
            verify_synthetic_code(code, "add" if index == 0 else "subtract",
                                  ast.Add if index == 0 else ast.Sub)
            if artifact_dir is not None:
                source_digests[task_id] = save_verified_artifact(artifact_dir, task_id, code)
            event_id = "synthetic-completed-" + str(index)
            if not complete(db, task_id, "fixture-pilot", token, event_id):
                raise ValueError("fixture completion rejected")
            # Intent for the next synthetic job is durable before acknowledgement.
            if not any(row["event_id"] == event_id for row in pending_dispatches(db)):
                raise ValueError("handoff event lost")
            if not mark_dispatched(db, event_id):
                raise ValueError("handoff acknowledgement failed")
            completed.append(task_id)
        return {"status": "pilot_pass", "model": MODEL, "requests": 2,
                "tasks": completed, "source_sha256": source_digests}
    finally:
        db.close()

if __name__ == "__main__":
    try:
        result = run(state_path=os.environ.get("GEMINI_PILOT_STATE"),
                     artifact_dir=os.environ.get("GEMINI_PILOT_ARTIFACTS"))
        print(json.dumps(result))
    except urllib.error.HTTPError as exc:
        print("Gemini pilot failed (HTTP status %d)." % exc.code, file=sys.stderr)
        sys.exit(1)
    except Exception:
        # Do not leak provider responses, keys, prompt contents or local data.
        print("Gemini fixture pilot failed or was blocked (details suppressed).", file=sys.stderr)
        sys.exit(1)
