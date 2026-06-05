"""
Imperium Local Automation Agent — pure-stdlib offline edition.

No FastAPI, no Pydantic, no compiled deps. Works on Python 3.14 on a clean
Windows machine without Rust / MSVC / Build Tools.

Endpoints (default http://127.0.0.1:8000):
    GET  /health                 -> { ok, chrome, runs }
    POST /apply                  -> { job_id }   body: { job_url, profile? }
    POST /approve                -> { ok }       body: { job_id }
    POST /reject                 -> { ok }       body: { job_id }
    GET  /status/{job_id}        -> full run + events
    GET  /events/{job_id}        -> { events, status, progress }
    GET  /runs                   -> list of all runs (most recent first)

Run:
    pip install -r requirements.txt
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
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:  # noqa: BLE001
    pass

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

# Chrome profile reuse. Set CHROME_USER_DATA_DIR to your real Chrome "User Data"
# folder to reuse logged-in sessions (LinkedIn, Google, etc.).
#   Windows: C:\Users\<you>\AppData\Local\Google\Chrome\User Data
#   macOS:   /Users/<you>/Library/Application Support/Google/Chrome
#   Linux:   /home/<you>/.config/google-chrome
# CHROME_PROFILE_DIR is the sub-folder (e.g. "Default", "Profile 1").
# IMPORTANT: fully close your normal Chrome before starting the agent, or
# Chrome will refuse to open the profile twice.
def _real_chrome_user_data_dir() -> str:
    home = Path.home()
    if os.name == "nt":
        p = home / "AppData" / "Local" / "Google" / "Chrome" / "User Data"
    elif sys.platform == "darwin":
        p = home / "Library" / "Application Support" / "Google" / "Chrome"
    else:
        p = home / ".config" / "google-chrome"
    return str(p)


def _dedicated_chrome_user_data_dir() -> str:
    # A persistent profile owned by the agent. Survives restarts, keeps
    # LinkedIn / Google logins, and never collides with your real Chrome.
    return str(Path.home() / ".imperium_chrome_profile")


# USE_REAL_CHROME=1  -> reuse your real Chrome "User Data" (you MUST fully
#                      close Chrome first; not recommended).
# Default            -> dedicated persistent profile at ~/.imperium_chrome_profile
USE_REAL_CHROME = os.environ.get("USE_REAL_CHROME", "0") == "1"
# Back-compat with previous env var name:
if os.environ.get("USE_DEFAULT_CHROME") == "1":
    USE_REAL_CHROME = True

CHROME_USER_DATA_DIR = os.environ.get(
    "CHROME_USER_DATA_DIR",
    _real_chrome_user_data_dir() if USE_REAL_CHROME else _dedicated_chrome_user_data_dir(),
)
CHROME_PROFILE_DIR = os.environ.get("CHROME_PROFILE_DIR", "Default")


def _clear_singleton_locks(user_data_dir: str) -> None:
    """Remove stale Chrome lock files that block a fresh launch."""
    try:
        base = Path(user_data_dir)
        if not base.exists():
            base.mkdir(parents=True, exist_ok=True)
            return
        for name in ("SingletonLock", "SingletonCookie", "SingletonSocket"):
            for p in base.glob(name):
                try: p.unlink()
                except Exception: pass
    except Exception as exc:  # noqa: BLE001
        print(f"[agent] could not clear singleton locks: {exc}", file=sys.stderr)


# --------------------------- in-memory state ----------------------------

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
            "approved": None,
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


# --------------------------- run executor -------------------------------

from brain import classify_page, llm_available  # noqa: E402
from adapters import (  # noqa: E402
    page_snapshot, run_adapter, find_submit_button,
)


def _wait_for_decision(job_id: str, timeout: float = 600) -> Optional[str]:
    deadline = time.time() + timeout
    while time.time() < deadline:
        time.sleep(1)
        r = _runs.get(job_id) or {}
        if r.get("status") == "cancelled":
            return "cancel"
        if r.get("approved") is True:  return "approve"
        if r.get("approved") is False: return "reject"
    return None


def run_job(job_id: str) -> None:
    if not SELENIUM_OK:
        _update(job_id, status="failed", error="Selenium not installed")
        emit(job_id, "error", "Selenium is not installed on this machine", level="error")
        return

    run = _runs.get(job_id)
    if not run: return
    url = run["job_url"]
    profile = run.get("profile") or {}

    _update(job_id, status="running", progress=5, current_step="boot",
            current_action="Starting Chrome")
    emit(job_id, "boot", "Launching local Chrome with Selenium")
    emit(job_id, "brain",
         f"Ollama brain {'AVAILABLE' if llm_available() else 'OFFLINE — using heuristics'}",
         level="info" if llm_available() else "warn")

    opts = uc.ChromeOptions()
    if HEADLESS:
        opts.add_argument("--headless=new")
    opts.add_argument("--window-size=1280,860")
    opts.add_argument("--no-first-run")
    opts.add_argument("--no-default-browser-check")
    if CHROME_USER_DATA_DIR:
        _clear_singleton_locks(CHROME_USER_DATA_DIR)
        opts.add_argument(f"--user-data-dir={CHROME_USER_DATA_DIR}")
        if CHROME_PROFILE_DIR:
            opts.add_argument(f"--profile-directory={CHROME_PROFILE_DIR}")
        kind = "REAL Chrome profile" if USE_REAL_CHROME else "dedicated agent profile"
        emit(job_id, "profile", f"Using {kind}: {CHROME_PROFILE_DIR} ({CHROME_USER_DATA_DIR})")
        if USE_REAL_CHROME:
            emit(job_id, "profile",
                 "Make sure your normal Chrome is FULLY CLOSED.", level="warn")

    driver = None
    try:
        try:
            driver = uc.Chrome(options=opts)
        except WebDriverException as exc:
            msg = (exc.msg or "").lower()
            if "chrome not reachable" in msg or "cannot connect to chrome" in msg:
                emit(job_id, "boot",
                     "Chrome failed to start. Close every Chrome window (tray included) "
                     "or unset USE_REAL_CHROME.", level="error")
            raise

        _update(job_id, progress=15, current_step="navigate",
                current_action=f"Opening {url}", current_url=url)
        emit(job_id, "navigate", f"Opening {url}", url=url)
        driver.get(url)
        WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        time.sleep(2)

        # ---- observe → classify → plan → execute loop ----
        outcome = "needs_human"
        for tick in range(6):  # at most 6 page transitions
            # If a new tab opened (external apply), switch to the newest
            try:
                if len(driver.window_handles) > 1:
                    driver.switch_to.window(driver.window_handles[-1])
            except WebDriverException:
                pass

            snap = page_snapshot(driver)
            kind = classify_page(snap)
            _update(job_id, progress=25 + tick * 10,
                    current_step=kind, current_action=f"Page detected: {kind}",
                    current_url=snap["url"])
            emit(job_id, "classify", f"Page → {kind}", url=snap["url"])

            outcome = run_adapter(kind, driver,
                                  lambda step, action, level="info", url="":
                                      emit(job_id, step, action, level=level, url=url),
                                  profile)
            if outcome in ("awaiting_approval", "submitted", "needs_human"):
                break
            time.sleep(1.5)

        if outcome == "submitted":
            _update(job_id, status="submitted", progress=100,
                    current_step="submitted", current_action="Already submitted")
            return

        if outcome == "needs_human":
            _update(job_id, status="awaiting_approval", progress=70,
                    current_step="needs_human",
                    current_action="Agent is stuck. Take over in the Chrome window, "
                                   "then click Approve to submit or Reject to abort.")
            emit(job_id, "needs_human",
                 "Agent paused — finish manually in Chrome, then Approve/Reject.",
                 level="warn")
        else:
            _update(job_id, status="awaiting_approval", progress=85,
                    current_step="approval",
                    current_action="Form filled. Waiting for human approval.")
            emit(job_id, "approval", "Click Approve or Reject in the web app.", level="warn")

        # ---- approval wait ----
        decision = _wait_for_decision(job_id)

        if decision == "approve":
            submit = find_submit_button(driver)
            if not submit:
                # Allow a beat — many forms enable Submit only after validation
                time.sleep(1.5)
                submit = find_submit_button(driver)
            if submit:
                emit(job_id, "submit",
                     f"Clicking submit: {submit.text or submit.get_attribute('aria-label') or 'button'}",
                     level="success")
                try: submit.click()
                except WebDriverException:
                    driver.execute_script("arguments[0].click();", submit)
                time.sleep(3)
                _update(job_id, status="submitted", progress=100,
                        current_step="submitted", current_action="Application submitted")
                emit(job_id, "submitted", "Application submitted", level="success")
            else:
                _update(job_id, status="failed", error="No submit button found")
                emit(job_id, "submit",
                     "Could not find a submit button. The form may need you to click "
                     "the final Submit manually in Chrome.", level="error")
        elif decision == "reject":
            _update(job_id, status="rejected", current_step="rejected",
                    current_action="Rejected by user")
            emit(job_id, "reject", "Rejected before submit", level="warn")
        elif decision == "cancel":
            emit(job_id, "cancel", "Cancelled", level="warn")
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



# --------------------------- HTTP server --------------------------------

class Handler(BaseHTTPRequestHandler):
    server_version = "ImperiumLocalAgent/3.0"

    # silence default noisy logging; we print our own events
    def log_message(self, format: str, *args: Any) -> None:  # noqa: A002
        return

    # ---- helpers ----

    def _send_json(self, status: int, payload: Any) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()
        self.wfile.write(body)

    def _read_json(self) -> Dict[str, Any]:
        length = int(self.headers.get("Content-Length") or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            data = json.loads(raw.decode("utf-8"))
        except Exception:
            return {}
        return data if isinstance(data, dict) else {}

    # ---- CORS preflight ----

    def do_OPTIONS(self) -> None:  # noqa: N802
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.end_headers()

    # ---- routing ----

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/") or "/"

        if path == "/health":
            return self._send_json(200, {
                "ok": True,
                "chrome": SELENIUM_OK,
                "headless": HEADLESS,
                "runs": len(_runs),
                "version": "3.0.0",
            })

        if path == "/runs":
            items = list(_runs.values())
            items.sort(key=lambda r: r.get("created_at", ""), reverse=True)
            return self._send_json(200, [
                {k: v for k, v in r.items() if k != "events"} for r in items
            ])

        if path.startswith("/status/"):
            job_id = path[len("/status/"):]
            run = _runs.get(job_id)
            if not run:
                return self._send_json(404, {"error": "job not found"})
            return self._send_json(200, run)

        if path.startswith("/events/"):
            job_id = path[len("/events/"):]
            run = _runs.get(job_id)
            if not run:
                return self._send_json(404, {"error": "job not found"})
            return self._send_json(200, {
                "events": run["events"],
                "status": run["status"],
                "progress": run["progress"],
            })

        self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path.rstrip("/") or "/"
        body = self._read_json()

        if path == "/apply":
            job_url = (body.get("job_url") or "").strip()
            if len(job_url) < 4:
                return self._send_json(400, {"error": "job_url is required"})
            profile = body.get("profile") or {}
            if not isinstance(profile, dict):
                return self._send_json(400, {"error": "profile must be an object"})
            if not profile.get("resume_path") and os.environ.get("RESUME_PATH"):
                profile["resume_path"] = os.environ["RESUME_PATH"]
            job_id = _new_run(job_url, profile)
            emit(job_id, "queued", f"Queued application for {job_url}")
            threading.Thread(target=run_job, args=(job_id,), daemon=True).start()
            return self._send_json(200, {"job_id": job_id})

        if path in ("/approve", "/reject"):
            job_id = (body.get("job_id") or "").strip()
            if job_id not in _runs:
                return self._send_json(404, {"error": "job not found"})
            approved = path == "/approve"
            _update(job_id, approved=approved)
            emit(
                job_id,
                "approve" if approved else "reject",
                "User approved" if approved else "User rejected",
                level="success" if approved else "warn",
            )
            return self._send_json(200, {"ok": True})

        self._send_json(404, {"error": "not found"})


def main() -> None:
    _load_state()
    print(f"[agent] Imperium Local Agent (offline, stdlib) -- http://{HOST}:{PORT}")
    print(f"[agent] Chrome ready: {SELENIUM_OK} | headless={HEADLESS} | state={STATE_FILE}")
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[agent] shutting down")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
