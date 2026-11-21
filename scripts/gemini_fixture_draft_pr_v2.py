#!/usr/bin/env python3
"""Founder-authorized, manual-only synthetic Gemini draft-PR publisher.

Never merges or deploys. Only two exact AST-validated files can be written,
and only on a unique isolated branch. No GitHub credentials are given to the
model request step; this publisher receives a token in its own later step.

This is a first real write-path pilot, NOT general repository code editing.
"""
import ast
import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

from gemini_fixture_pilot_v2 import verify_synthetic_code
from free_worker_preflight import POLICY, assert_free_first_preparation

REPOSITORY = "darshitmeghani1992/the-wall"
BASE_BRANCH = "main"
PATHS = (
    ("generated_add.py", "scripts/fixtures/gemini_generated_add.py", "add", ast.Add),
    ("generated_subtract.py", "scripts/fixtures/gemini_generated_subtract.py", "subtract", ast.Sub),
)

def load_fixture_blobs(directory):
    path = Path(directory)
    if not path.is_dir() or path.is_symlink():
        raise ValueError("invalid artifact directory")
    files = {p.name for p in path.iterdir()}
    if files != {entry[0] for entry in PATHS}:
        raise ValueError("artifact directory must contain exactly two allowed files")
    blobs = []
    for name, target, fn, operation in PATHS:
        file = path / name
        if file.is_symlink() or not file.is_file() or file.stat().st_size > 2048:
            raise ValueError("invalid fixture file")
        source = file.read_text(encoding="utf-8")
        verify_synthetic_code(source, fn, operation)
        blobs.append((target, source))
    return blobs

def validate_context(env):
    assert_free_first_preparation(POLICY, env)
    if env.get("GITHUB_EVENT_NAME") != "workflow_dispatch":
        raise ValueError("only explicit workflow_dispatch permits synthetic PR pilot")
    if env.get("GEMINI_FIXTURE_PILOT_APPROVED") != "true":
        raise ValueError("manual approval missing")
    if env.get("GEMINI_BILLING_TIER") != "free":
        raise ValueError("free tier missing")
    if env.get("GITHUB_REPOSITORY") != REPOSITORY or env.get("GITHUB_REF") != "refs/heads/main":
        raise ValueError("must execute from exact repository default branch")
    if env.get("GITHUB_ACTOR") != "darshitmeghani1992":
        raise ValueError("only authorized founder can dispatch write pilot")
    run_id = env.get("GITHUB_RUN_ID", "")
    if not re.fullmatch(r"[1-9][0-9]{0,19}", run_id):
        raise ValueError("invalid GitHub run ID")
    sha = env.get("GITHUB_SHA", "")
    if not re.fullmatch(r"[a-f0-9]{40}", sha):
        raise ValueError("missing immutable checkout SHA")
    token = env.get("GITHUB_TOKEN", "")
    if len(token) < 20:
        raise ValueError("GitHub token missing")
    return "codex/cloud-worker-fixture-" + run_id, sha, token

def publish(env=os.environ, artifacts=None, transport=None):
    branch, checkout_sha, token = validate_context(env)
    files = load_fixture_blobs(artifacts)
    # Transport is an injected function for completely offline unit tests:
    # transport(method, endpoint, data, token) -> parsed JSON
    if transport is None:
        transport = github_call

    base = transport("GET", "/git/ref/heads/" + BASE_BRANCH, None, token)
    if (base.get("object") or {}).get("sha") != checkout_sha:
        raise ValueError("base changed; refusing stale write")

    commit = transport("GET", "/git/commits/" + checkout_sha, None, token)
    tree_sha = (commit.get("tree") or {}).get("sha")
    if not isinstance(tree_sha, str) or not re.fullmatch(r"[a-f0-9]{40}", tree_sha):
        raise ValueError("invalid base tree SHA")

    entries = []
    for path, source in files:
        blob = transport("POST", "/git/blobs", {"content": source, "encoding": "utf-8"}, token)
        blob_sha = blob.get("sha")
        if not isinstance(blob_sha, str) or not re.fullmatch(r"[a-f0-9]{40}", blob_sha):
            raise ValueError("invalid generated blob SHA")
        entries.append({"path":path,"mode":"100644","type":"blob","sha":blob_sha})

    new_tree = transport("POST", "/git/trees", {"base_tree":tree_sha,"tree":entries}, token)
    new_tree_sha = new_tree.get("sha")
    if not isinstance(new_tree_sha,str) or not re.fullmatch(r"[a-f0-9]{40}",new_tree_sha):
        raise ValueError("invalid generated tree SHA")
    new_commit = transport("POST", "/git/commits", {
        "message":"test(agent): add safe Gemini synthetic fixture evidence",
        "tree":new_tree_sha,
        "parents":[checkout_sha],
    }, token)
    new_commit_sha = new_commit.get("sha")
    if not isinstance(new_commit_sha,str) or not re.fullmatch(r"[a-f0-9]{40}",new_commit_sha):
        raise ValueError("invalid new commit SHA")
    transport("POST", "/git/refs", {
        "ref":"refs/heads/" + branch, "sha":new_commit_sha,
    }, token)
    pr = transport("POST", "/pulls", {
        "title":"test(agent): generated Gemini synthetic fixture pilot",
        "head":branch,"base":BASE_BRANCH,"draft":True,
        "body":"Synthetic fixed-function AI coding evidence only. Two AST-verified files; "
               "no source modification, no code execution, no deployment. "
               "Independent review and QA still required; never auto-merge.",
    }, token)
    url=pr.get("html_url")
    if not isinstance(url,str) or not url.startswith("https://github.com/" + REPOSITORY + "/pull/"):
        raise ValueError("draft PR URL missing; verify published branch manually")
    return {"status":"draft_pr_created","url":url,"head_sha":new_commit_sha}

def github_call(method, endpoint, data, token):
    allowed = ("/git/ref/heads/main", "/git/commits/", "/git/blobs",
               "/git/trees", "/git/refs", "/pulls")
    if not endpoint.startswith(allowed) or method not in ("GET","POST"):
        raise ValueError("non-allowlisted GitHub API route")
    req = urllib.request.Request(
        "https://api.github.com/repos/" + REPOSITORY + endpoint,
        data=(json.dumps(data).encode() if data is not None else None),
        method=method,
        headers={"Authorization":"Bearer " + token,
                 "Accept":"application/vnd.github+json",
                 "X-GitHub-Api-Version":"2022-11-28",
                 "Content-Type":"application/json"},
    )
    with urllib.request.urlopen(req, timeout=20) as res:
        return json.loads(res.read(128000))

if __name__ == "__main__":
    try:
        result=publish(artifacts=os.environ.get("GEMINI_PILOT_ARTIFACTS"))
        print(json.dumps(result))
    except urllib.error.HTTPError as error:
        print("GitHub synthetic draft PR pilot failed: HTTP " + str(error.code), file=sys.stderr)
        sys.exit(1)
    except Exception:
        print("GitHub synthetic draft PR pilot blocked or failed; no details logged.", file=sys.stderr)
        sys.exit(1)
