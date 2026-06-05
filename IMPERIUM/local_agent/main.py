"""
Imperium Local Automation Agent — fully offline FastAPI edition.

No Supabase. No cloud. No API keys. Everything runs on this machine.

Endpoints (default http://127.0.0.1:8000):
    GET  /health                 → { ok, chrome, runs }
    POST /apply                  → { job_id }              body: { job_url, profile? }
    POST /approve                → { ok }                  body: { job_id }
    POST /reject                 → { ok }                  body: { job_id }
    GET  /status/{job_id}        → full run + events
    GET  /runs                   → list of all runs (most recent first)
    GET  /events/{job_id}        → just the events array (for polling)

Run:
    pip install -r requirements.txt
    cp .env.example .env       # optional, defaults are fine
    python main.py
"""
from __future__ import annotations

import json
import os
import sys
import threading
import time
import traceback
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import uvicorn

load_dotenv()

try:
    import undetected_chromedriver as uc
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    from selenium.common.exceptions import (
        NoSuchElementException,
        TimeoutException,
        WebDriverException,
    )
    SELENIUM_OK = True
except ImportError as exc:  # noqa: BLE001
    print(f"[agent] selenium missing ({exc}). Run: pip install -r requirements.txt", file=sys.stderr)
    SELENIUM_OK = False


HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8000"))
HEADLESS = os.environ.get("HEADLESS", "0") == "1"
STATE_FILE = Path(os.environ.get("STATE_FILE", "./agent_state.json"))
CORS_ORIGINS = [o.strip() for o in os.environ.get("CORS_ORIGINS", "*").split(",") if o.strip()]


# ─────────────────────────── in-memory state ────────────────────────────

_lock = threading.RLock()
_runs: Dict[str, Dict[str, Any]] = {}


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _load_state() -> None:
    if not STATE_FILE.exists():
        return
    try:
        data = json.loads(STATE_FILE.read_text("utf-8"))
        if isinstance(data, dict):
            _runs.update(data)
            print(f"[agent] restored {len(_runs)} runs from {STATE_FILE}")
    except Exception as exc:  # noqa: BLE001
        print(f"[agent] could not read state file: {exc}", file=sys.stderr)


def _save_state() -> None:
    try:
        STATE_FILE.write_text(json.dumps(_runs, indent=2), "utf-8")
    except Exception as exc:  # noqa: BLE001
        print(f"[agent] could not write state file: {exc}", file=sys.stderr)


def _new_run(job_url: str, profile: Dict[str, Any]) -> str:
    job_id = str(uuid.uuid4())
    with _lock:
        _runs[job_id] = {
            "id": job_id,
            "job_url": job_url,
            "profile": profile,
            "status": "queued",
            "progress": 0,
            "current_step": "queued",
            "current_action": "Waiting to start",
            "current_url": "",
            "approved": None,           # None | True | False
            "error": "",
            "created_at": _now(),
            "updated_at": _now(),
            "events": [],
        }
        _save_state()
    return job_id


def _update(job_id: str, **fields: Any) -> None:
    with _lock:
        run = _runs.get(job_id)
        if not run:
            return
        run.update(fields)
        run["updated_at"] = _now()
        _save_state()


def emit(job_id: str, step: str, action: str, *, level: str = "info", url: str = "") -> None:
    with _lock:
        run = _runs.get(job_id)
        if run is None:
            return
        run["events"].append(
            {
                "ts": _now(),
                "step": step,
                "action": action,
                "level": level,
                "url": url,
            }
        )
        run["updated_at"] = _now()
        _save_state()
    print(f"[{level:>7}] {job_id[:8]} {step}: {action}")


# ─────────────────────────── form filling ───────────────────────────────

PROFILE_FIELD_MAP = {
    "first":     ["first name", "given name"],
    "last":      ["last name", "surname", "family name"],
    "name":      ["full name", "your name", "name"],
    "email":     ["email", "e-mail"],
    "phone":     ["phone", "mobile", "telephone"],
    "location":  ["location", "city", "address"],
    "linkedin":  ["linkedin"],
    "github":    ["github"],
    "portfolio": ["portfolio", "website"],
    "summary":   ["summary", "about you", "cover letter"],
}


def _label_for(el) -> str:
    for attr in ("aria-label", "placeholder", "name", "id"):
        v = el.get_attribute(attr) or ""
        if v.strip():
            return v.strip().lower()
    try:
        return (el.text or "").strip().lower()
    except Exception:  # noqa: BLE001
        return ""


def _profile_value(label: str, profile: Dict[str, Any], name_parts: Dict[str, str]) -> Optional[str]:
    label = label.lower()
    for key, needles in PROFILE_FIELD_MAP.items():
        if any(n in label for n in needles):
            if key == "first": return name_parts.get("first")
            if key == "last":  return name_parts.get("last")
            if key == "name":  return profile.get("name")
            if key == "linkedin":  return profile.get("linkedin_url") or profile.get("linkedin")
            if key == "github":    return profile.get("github_url") or profile.get("github")
            if key == "portfolio": return profile.get("portfolio_url") or profile.get("portfolio")
            return profile.get(key)
    return None


def fill_application(driver, job_id: str, profile: Dict[str, Any]) -> int:
    full_name = (profile.get("name") or "").strip()
    parts = full_name.split(" ", 1)
    name_parts = {"first": parts[0] if parts else "", "last": parts[1] if len(parts) > 1 else ""}

    inputs = driver.find_elements(By.CSS_SELECTOR, "input, textarea")
    emit(job_id, "scan", f"Found {len(inputs)} input fields", url=driver.current_url)

    filled = 0
    for el in inputs:
        try:
            t = (el.get_attribute("type") or "text").lower()
            if t in {"hidden", "submit", "button", "checkbox", "radio", "file"}:
                continue
            if not el.is_displayed() or not el.is_enabled():
                continue
            label = _label_for(el)
            val = _profile_value(label, profile, name_parts)
            if not val:
                continue
            el.clear()
            el.send_keys(val)
            emit(job_id, "fill", f"Filled '{label}' = {val}", level="success")
            filled += 1
            time.sleep(0.15)
        except WebDriverException as exc:
            emit(job_id, "fill", f"Skipped a field: {exc.msg}", level="warn")
    return filled


# ─────────────────────────── run executor ───────────────────────────────

def run_job(job_id: str) -> None:
    if not SELENIUM_OK:
        _update(job_id, status="failed", error="Selenium not installed")
        emit(job_id, "error", "Selenium is not installed on this machine", level="error")
        return

    run = _runs.get(job_id)
    if not run:
        return
    url = run["job_url"]
    profile = run.get("profile") or {}

    _update(job_id, status="running", progress=5, current_step="boot", current_action="Starting Chrome")
    emit(job_id, "boot", "Launching local Chrome with Selenium")

    opts = uc.ChromeOptions()
    if HEADLESS:
        opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1280,860")

    driver = None
    try:
        driver = uc.Chrome(options=opts)
        _update(job_id, progress=20, current_step="navigate", current_action=f"Opening {url}", current_url=url)
        emit(job_id, "navigate", f"Opening {url}", url=url)
        driver.get(url)
        WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        time.sleep(1.5)
        _update(job_id, progress=40, current_step="loaded", current_action="Page loaded", current_url=driver.current_url)
        emit(job_id, "loaded", "Page loaded", level="success", url=driver.current_url)

        filled = fill_application(driver, job_id, profile)
        _update(job_id, progress=70, current_step="filled", current_action=f"Filled {filled} fields")
        emit(job_id, "filled", f"Auto-filled {filled} field(s). Awaiting your approval to submit.", level="success")

        _update(job_id, status="awaiting_approval", progress=80, current_step="approval", current_action="Waiting for human approval")
        emit(job_id, "approval", "Click Approve or Reject in the web app.", level="warn")

        deadline = time.time() + 600
        decision: Optional[str] = None
        while time.time() < deadline:
            time.sleep(1)
            r = _runs.get(job_id) or {}
            if r.get("status") == "cancelled":
                emit(job_id, "cancel", "Cancelled", level="warn")
                return
            if r.get("approved") is True:
                decision = "approve"
                break
            if r.get("approved") is False:
                decision = "reject"
                break

        if decision == "approve":
            submit = None
            for sel in ["button[type='submit']", "input[type='submit']"]:
                try:
                    submit = driver.find_element(By.CSS_SELECTOR, sel)
                    break
                except NoSuchElementException:
                    continue
            if submit:
                emit(job_id, "submit", "Clicking submit", level="success")
                submit.click()
                time.sleep(3)
                _update(job_id, status="submitted", progress=100, current_step="submitted", current_action="Application submitted")
                emit(job_id, "submitted", "Application submitted ✓", level="success")
            else:
                _update(job_id, status="failed", error="No submit button found")
                emit(job_id, "submit", "Could not find a submit button", level="error")
        elif decision == "reject":
            _update(job_id, status="rejected", current_step="rejected", current_action="Rejected by user")
            emit(job_id, "reject", "Rejected before submit", level="warn")
        else:
            _update(job_id, status="failed", error="Approval timeout")
            emit(job_id, "timeout", "Timed out waiting for approval", level="error")

    except TimeoutException as exc:
        _update(job_id, status="failed", error=f"Timeout: {exc.msg}")
        emit(job_id, "error", f"Page timed out: {exc.msg}", level="error")
    except Exception as exc:  # noqa: BLE001
        _update(job_id, status="failed", error=str(exc))
        emit(job_id, "error", f"Unhandled error: {exc}", level="error")
        traceback.print_exc()
    finally:
        if driver:
            try: driver.quit()
            except Exception: pass


# ─────────────────────────── HTTP API ───────────────────────────────────

app = FastAPI(title="Imperium Local Agent", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS or ["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ApplyBody(BaseModel):
    job_url: str = Field(..., min_length=4)
    profile: Dict[str, Any] = Field(default_factory=dict)


class JobIdBody(BaseModel):
    job_id: str


@app.get("/health")
def health() -> Dict[str, Any]:
    return {
        "ok": True,
        "chrome": SELENIUM_OK,
        "headless": HEADLESS,
        "runs": len(_runs),
        "version": "2.0.0",
    }


@app.post("/apply")
def apply(body: ApplyBody) -> Dict[str, Any]:
    job_id = _new_run(body.job_url, body.profile)
    emit(job_id, "queued", f"Queued application for {body.job_url}")
    t = threading.Thread(target=run_job, args=(job_id,), daemon=True)
    t.start()
    return {"job_id": job_id}


@app.post("/approve")
def approve(body: JobIdBody) -> Dict[str, bool]:
    if body.job_id not in _runs:
        raise HTTPException(404, "job not found")
    _update(body.job_id, approved=True)
    emit(body.job_id, "approve", "User approved", level="success")
    return {"ok": True}


@app.post("/reject")
def reject(body: JobIdBody) -> Dict[str, bool]:
    if body.job_id not in _runs:
        raise HTTPException(404, "job not found")
    _update(body.job_id, approved=False)
    emit(body.job_id, "reject", "User rejected", level="warn")
    return {"ok": True}


@app.get("/status/{job_id}")
def status(job_id: str) -> Dict[str, Any]:
    run = _runs.get(job_id)
    if not run:
        raise HTTPException(404, "job not found")
    return run


@app.get("/events/{job_id}")
def events(job_id: str) -> Dict[str, Any]:
    run = _runs.get(job_id)
    if not run:
        raise HTTPException(404, "job not found")
    return {"events": run["events"], "status": run["status"], "progress": run["progress"]}


@app.get("/runs")
def runs() -> List[Dict[str, Any]]:
    items = list(_runs.values())
    items.sort(key=lambda r: r.get("created_at", ""), reverse=True)
    # strip events for list view
    return [{k: v for k, v in r.items() if k != "events"} for r in items]


# ─────────────────────────── entrypoint ─────────────────────────────────

def main() -> None:
    _load_state()
    print(f"[agent] Imperium Local Agent (offline) — http://{HOST}:{PORT}")
    print(f"[agent] Chrome ready: {SELENIUM_OK} | headless={HEADLESS} | state={STATE_FILE}")
    uvicorn.run(app, host=HOST, port=PORT, log_level="info")


if __name__ == "__main__":
    main()
