"""
shared/models.py
================

Purpose
-------
Owns the in-memory state for every job application run and mirrors it to disk
so runs survive restarts. This is the single source of truth for run records
and event logging used by every other module.

Inputs
------
- ``STATE_FILE`` env var (optional). Defaults to ``storage/application_history.json``.
- Job url + candidate profile dict (passed to ``new_run``).
- Step/action strings emitted by automation modules.

Outputs
-------
- A dict-shaped run record keyed by uuid in the ``RUNS`` registry.
- JSON file persisted on every state mutation.
- stdout log line for every ``emit`` call.

Responsibility
--------------
Pure data + persistence. No Selenium, no LLM, no HTTP. Other modules import
from here; this module imports from nothing in the project.
"""
from __future__ import annotations

import json
import os
import sys
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict

# Resolve <local_agent>/ as the project root regardless of CWD.
_PROJECT_ROOT = Path(__file__).resolve().parent.parent
_DEFAULT_STATE_PATH = _PROJECT_ROOT / "storage" / "application_history.json"
_LEGACY_STATE_PATH = _PROJECT_ROOT / "agent_state.json"

STATE_FILE = Path(os.environ.get("STATE_FILE") or _DEFAULT_STATE_PATH)
STATE_FILE.parent.mkdir(parents=True, exist_ok=True)

_lock = threading.RLock()
RUNS: Dict[str, Dict[str, Any]] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def load_state() -> None:
    """Read previous runs from disk. Falls back to legacy agent_state.json once."""
    source = STATE_FILE if STATE_FILE.exists() else (
        _LEGACY_STATE_PATH if _LEGACY_STATE_PATH.exists() else None
    )
    if not source:
        return
    try:
        data = json.loads(source.read_text("utf-8"))
        if isinstance(data, dict):
            RUNS.update(data)
            print(f"[agent] restored {len(RUNS)} runs from {source}")
            if source is _LEGACY_STATE_PATH:
                save_state()  # migrate to new location
    except Exception as exc:  # noqa: BLE001
        print(f"[agent] could not read state file: {exc}", file=sys.stderr)


def save_state() -> None:
    try:
        STATE_FILE.write_text(json.dumps(RUNS, indent=2), "utf-8")
    except Exception as exc:  # noqa: BLE001
        print(f"[agent] could not write state file: {exc}", file=sys.stderr)


def new_run(job_url: str, profile: Dict[str, Any]) -> str:
    job_id = str(uuid.uuid4())
    with _lock:
        RUNS[job_id] = {
            "id": job_id,
            "job_url": job_url,
            "profile": profile,
            "status": "queued",
            "progress": 0,
            "current_step": "queued",
            "current_action": "Waiting to start",
            "current_url": "",
            "approved": None,
            "error": "",
            "created_at": _now(),
            "updated_at": _now(),
            "events": [],
        }
        save_state()
    return job_id


def update(job_id: str, **fields: Any) -> None:
    with _lock:
        run = RUNS.get(job_id)
        if not run:
            return
        run.update(fields)
        run["updated_at"] = _now()
        save_state()


def emit(job_id: str, step: str, action: str, *, level: str = "info", url: str = "") -> None:
    with _lock:
        run = RUNS.get(job_id)
        if run is None:
            return
        run["events"].append({
            "ts": _now(), "step": step, "action": action,
            "level": level, "url": url,
        })
        run["updated_at"] = _now()
        save_state()
    print(f"[{level:>7}] {job_id[:8]} {step}: {action}")
