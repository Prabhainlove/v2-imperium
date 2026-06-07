"""
shared/callbacks.py
===================

Purpose
-------
B8 — Post terminal run state from the local Python agent back to the
Imperium web app, signed with an HMAC-SHA256 shared secret so the web app
can trust the payload without the agent ever holding a Supabase key.

Inputs
------
- ``IMPERIUM_CALLBACK_URL`` env var (e.g. https://your.app/api/public/agent-callback)
- ``IMPERIUM_CALLBACK_SECRET`` env var (shared with the web app)
- A run record dict from ``shared.models``.

Outputs
-------
- HTTP POST with body {"job_id","status","job_url","error","events":[...]}
  and header ``X-Imperium-Signature: sha256=<hex>``.

Responsibility
--------------
Best-effort, fire-and-forget transport. Never raises into the orchestrator.
"""
from __future__ import annotations

import hmac
import json
import os
import sys
import urllib.request
import urllib.error
from hashlib import sha256
from typing import Any, Dict

CALLBACK_URL = os.environ.get("IMPERIUM_CALLBACK_URL", "").strip()
CALLBACK_SECRET = os.environ.get("IMPERIUM_CALLBACK_SECRET", "").strip()
CALLBACK_TIMEOUT_S = float(os.environ.get("IMPERIUM_CALLBACK_TIMEOUT", "10"))


def configured() -> bool:
    return bool(CALLBACK_URL and CALLBACK_SECRET)


def _sign(body: bytes) -> str:
    mac = hmac.new(CALLBACK_SECRET.encode("utf-8"), body, sha256).hexdigest()
    return f"sha256={mac}"


def post_run_callback(run: Dict[str, Any]) -> None:
    """Fire-and-forget HMAC-signed POST. Silent on failure."""
    if not configured():
        return
    try:
        payload = {
            "job_id": run.get("id"),
            "status": run.get("status"),
            "job_url": run.get("job_url"),
            "current_url": run.get("current_url"),
            "error": run.get("error") or "",
            "events": (run.get("events") or [])[-25:],  # tail only
            "updated_at": run.get("updated_at"),
        }
        body = json.dumps(payload, separators=(",", ":")).encode("utf-8")
        req = urllib.request.Request(
            CALLBACK_URL,
            data=body,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "X-Imperium-Signature": _sign(body),
                "User-Agent": "ImperiumLocalAgent/3.2",
            },
        )
        with urllib.request.urlopen(req, timeout=CALLBACK_TIMEOUT_S) as resp:
            resp.read()  # drain
    except (urllib.error.URLError, urllib.error.HTTPError, TimeoutError, OSError) as exc:
        print(f"[agent] callback POST failed: {exc}", file=sys.stderr)
