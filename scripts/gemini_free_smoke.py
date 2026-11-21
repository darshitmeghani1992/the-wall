#!/usr/bin/env python3
"""One-request Gemini free-model authentication smoke. No repository content sent.

Never print credentials or response bodies. No retries, tools, workspace changes,
repo writes, third-party paid fallback, or privileged API access.
"""
import json
import os
import sys
import urllib.error
import urllib.request

MODEL = "gemini-2.5-flash-lite"
ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/" + MODEL + ":generateContent"

def request_payload():
    return {
        "contents": [{"role": "user", "parts": [{"text": "Respond exactly with READY."}]}],
        "generationConfig": {"maxOutputTokens": 12, "temperature": 0},
    }

def check_response(value):
    if not isinstance(value, dict):
        raise ValueError("Expected Gemini response object")
    candidates = value.get("candidates") or []
    texts = [
        part.get("text", "")
        for candidate in candidates
        for part in (candidate.get("content") or {}).get("parts", [])
        if isinstance(part, dict)
    ]
    if not texts or not "".join(texts).strip():
        raise ValueError("Gemini returned no text")
    return True

def run(env=os.environ, opener=urllib.request.urlopen):
    # Security preflight must pass and must prevent bypass through YAML.
    from free_worker_preflight import POLICY, assert_free_first_preparation
    assert_free_first_preparation(POLICY, env)
    if env.get("GEMINI_FREE_SMOKE_APPROVED") != "true":
        raise ValueError("An explicit one-request smoke approval is required")
    if env.get("GEMINI_BILLING_TIER") != "free":
        raise ValueError("Free-tier project declaration missing")
    secret = env.get("GEMINI_API_KEY")
    if not secret or len(secret) < 16:
        raise ValueError("GEMINI_API_KEY is missing from secrets")
    req = urllib.request.Request(
        ENDPOINT,
        data=json.dumps(request_payload()).encode("utf-8"),
        headers={"Content-Type": "application/json", "x-goog-api-key": secret},
        method="POST",
    )
    with opener(req, timeout=20) as response:
        result = json.loads(response.read(65536).decode("utf-8"))
    check_response(result)
    return {"status": "ok", "model": MODEL, "requests": 1}

if __name__ == "__main__":
    try:
        result = run()
        print(json.dumps(result))
    except urllib.error.HTTPError as err:
        # NEVER print provider exception bodies, URLs, headers, or key.
        print("Gemini authentication smoke failed (HTTP status %d)." % err.code, file=sys.stderr)
        sys.exit(1)
    except (ValueError, AssertionError, urllib.error.URLError, OSError) as err:
        # Avoid dumping arbitrary network exception that could contain request URL/headers.
        if isinstance(err, (urllib.error.URLError, OSError)):
            print("Gemini authentication smoke failed due to network/runtime error.", file=sys.stderr)
        else:
            print("Gemini authentication smoke blocked or invalid: " + str(err), file=sys.stderr)
        sys.exit(1)
