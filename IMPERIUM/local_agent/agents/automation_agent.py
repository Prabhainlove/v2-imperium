"""
agents/automation_agent.py
==========================

Purpose
-------
The orchestrator. Owns one job-application run from queue to terminal state:
launch Chrome, navigate to the job URL, then loop ``snapshot -> classify ->
adapter -> emit`` until the page asks for human approval (or auto-submits).

Inputs
------
- A ``job_id`` previously created via ``shared.models.new_run``.

Outputs
-------
- Mutates the run record in ``shared.models.RUNS`` (status / progress /
  events / current_step / current_url).
- Quits the Chrome driver on exit.

Responsibility
--------------
Top-level run lifecycle and approval handshake. It does NOT talk to the
DOM directly — that's delegated to ``automation/*`` modules.
"""
from __future__ import annotations

import time
import traceback
from typing import Any, Dict, Optional

from selenium.common.exceptions import TimeoutException, WebDriverException

from shared import models
from shared.llm_brain import classify_page, llm_available
from automation.selenium_driver import build_driver, SELENIUM_OK
from automation.form_parser import page_snapshot, find_submit_button
from automation.workflow_executor import run_adapter





def _safe_classify(snapshot: Dict[str, Any]) -> str:
    """Hard guards around LLM classification for pages we can identify safely."""
    url = (snapshot.get("url") or "").lower()
    if "linkedin.com" in url and snapshot.get("has_dialog"):
        return classify_page(snapshot)
    if "linkedin.com/jobs/search" in url or "linkedin.com/jobs/collections" in url:
        return "job_listing"
    if "linkedin.com/jobs" in url and snapshot.get("job_cards") and not snapshot.get("has_dialog"):
        return "job_listing"
    if "linkedin.com/jobs/view" in url and not snapshot.get("has_dialog"):
        return "job_detail"
    return classify_page(snapshot)


def _wait_for_decision(job_id: str, timeout: float = 600) -> Optional[str]:
    deadline = time.time() + timeout
    while time.time() < deadline:
        time.sleep(1)
        r = models.RUNS.get(job_id) or {}
        if r.get("status") == "cancelled":
            return "cancel"
        if r.get("approved") is True:
            return "approve"
        if r.get("approved") is False:
            return "reject"
    return None


def run_job(job_id: str) -> None:
    if not SELENIUM_OK:
        models.update(job_id, status="failed", error="Selenium not installed")
        models.emit(job_id, "error", "Selenium is not installed on this machine", level="error")
        return

    run = models.RUNS.get(job_id)
    if not run:
        return
    url = run["job_url"]
    profile = run.get("profile") or {}

    models.update(job_id, status="running", progress=5, current_step="boot",
                  current_action="Starting Chrome")
    models.emit(job_id, "boot", "Launching local Chrome with Selenium")
    models.emit(job_id, "brain",
                f"Ollama brain {'AVAILABLE' if llm_available() else 'OFFLINE — using heuristics'}",
                level="info" if llm_available() else "warn")

    driver = None
    try:
        try:
            driver, profile_desc = build_driver()
            if profile_desc:
                models.emit(job_id, "profile", profile_desc)
        except WebDriverException as exc:
            msg = (exc.msg or "").lower() if hasattr(exc, "msg") else str(exc).lower()
            if "chrome not reachable" in msg or "cannot connect to chrome" in msg:
                models.emit(job_id, "boot",
                            "Chrome failed to start. Close every Chrome window (tray included) "
                            "or unset USE_REAL_CHROME.", level="error")
            raise

        from selenium.webdriver.support.ui import WebDriverWait
        from selenium.webdriver.support import expected_conditions as EC
        from selenium.webdriver.common.by import By

        models.update(job_id, progress=15, current_step="navigate",
                      current_action=f"Opening {url}", current_url=url)
        models.emit(job_id, "navigate", f"Opening {url}", url=url)
        driver.get(url)
        WebDriverWait(driver, 20).until(EC.presence_of_element_located((By.TAG_NAME, "body")))
        time.sleep(2)

        # ---- observe → classify → plan → execute loop ----
        outcome = "needs_human"
        for tick in range(6):
            try:
                if len(driver.window_handles) > 1:
                    driver.switch_to.window(driver.window_handles[-1])
            except WebDriverException:
                pass

            snap = page_snapshot(driver)
            kind = _safe_classify(snap)
            models.update(job_id, progress=25 + tick * 10,
                          current_step=kind, current_action=f"Page detected: {kind}",
                          current_url=snap["url"])
            models.emit(job_id, "classify", f"Page → {kind}", url=snap["url"])

            def _emit(step, action, level="info", url=""):
                models.emit(job_id, step, action, level=level, url=url)

            outcome = run_adapter(kind, driver, _emit, profile)
            if outcome in ("awaiting_approval", "submitted", "needs_human"):
                break
            time.sleep(1.5)

        if outcome == "submitted":
            models.update(job_id, status="submitted", progress=100,
                          current_step="submitted", current_action="Already submitted")
            return

        if outcome == "needs_human":
            models.update(job_id, status="awaiting_approval", progress=70,
                          current_step="needs_human",
                          current_action="Agent is stuck. Take over in the Chrome window, "
                                         "then click Approve to submit or Reject to abort.")
            models.emit(job_id, "needs_human",
                        "Agent paused — finish manually in Chrome, then Approve/Reject.",
                        level="warn")
        else:
            models.update(job_id, status="awaiting_approval", progress=85,
                          current_step="approval",
                          current_action="Form filled. Waiting for human approval.")
            models.emit(job_id, "approval",
                        "Click Approve or Reject in the web app.", level="warn")

        decision = _wait_for_decision(job_id)

        if decision == "approve":
            submit = find_submit_button(driver)
            if not submit:
                time.sleep(1.5)
                submit = find_submit_button(driver)
            if submit:
                models.emit(job_id, "submit",
                            f"Clicking submit: "
                            f"{submit.text or submit.get_attribute('aria-label') or 'button'}",
                            level="success")
                try:
                    submit.click()
                except WebDriverException:
                    driver.execute_script("arguments[0].click();", submit)
                time.sleep(3)
                models.update(job_id, status="submitted", progress=100,
                              current_step="submitted", current_action="Application submitted")
                models.emit(job_id, "submitted", "Application submitted", level="success")
            else:
                models.update(job_id, status="failed", error="No submit button found")
                models.emit(job_id, "submit",
                            "Could not find a submit button. The form may need you to click "
                            "the final Submit manually in Chrome.", level="error")
        elif decision == "reject":
            models.update(job_id, status="rejected", current_step="rejected",
                          current_action="Rejected by user")
            models.emit(job_id, "reject", "Rejected before submit", level="warn")
        elif decision == "cancel":
            models.emit(job_id, "cancel", "Cancelled", level="warn")
        else:
            models.update(job_id, status="failed", error="Approval timeout")
            models.emit(job_id, "timeout", "Timed out waiting for approval", level="error")

    except TimeoutException as exc:
        models.update(job_id, status="failed", error=f"Timeout: {exc.msg}")
        models.emit(job_id, "error", f"Page timed out: {exc.msg}", level="error")
    except Exception as exc:  # noqa: BLE001
        models.update(job_id, status="failed", error=str(exc))
        models.emit(job_id, "error", f"Unhandled error: {exc}", level="error")
        traceback.print_exc()
    finally:
        if driver:
            try:
                driver.quit()
            except Exception:
                pass
        # B8 — best-effort HMAC callback to the web app on terminal states.
        try:
            _notify_terminal(job_id)
        except Exception:
            pass
