"""
automation/workflow_executor.py
===============================

Purpose
-------
Site-specific flows. Knows how to pick a LinkedIn job card, open Easy Apply,
walk a multi-step wizard, and handle generic ATS forms (Greenhouse, Lever,
Ashby, Workday). Exposes one entrypoint, ``run_adapter(kind, ...)``, that
the orchestrator calls after the page is classified.

Inputs
------
- A ``kind`` label from ``shared.llm_brain.classify_page``.
- Selenium driver, ``emit`` callback, ``profile`` dict.

Outputs
-------
- One of: ``"submitted"``, ``"awaiting_approval"``, ``"needs_human"``.

Responsibility
--------------
Flow orchestration per site. Generic form mechanics live in
``form_parser.py``; resume drops in ``resume_uploader.py``.
"""
from __future__ import annotations

import time
from typing import Any, Callable, Dict

from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.common.exceptions import TimeoutException, WebDriverException

from automation.form_parser import (
    active_dialog, active_form_root,
    click_first, click_xpath,
    fill_visible_fields, fill_choice_controls,
    find_submit_button,
)
from automation.resume_uploader import maybe_upload_resume

Emit = Callable[..., None]


# ============================================================
#                  LinkedIn Easy Apply
# ============================================================

def linkedin_pick_first_job(driver, emit: Emit) -> bool:
    """On a /jobs/search page, click the first job card (Easy Apply preferred)."""
    before = driver.current_url
    ok = False
    try:
        cards = driver.find_elements(
            By.CSS_SELECTOR,
            "li.jobs-search-results__list-item, div.job-card-container",
        )
        cards.sort(key=lambda c: 0 if "easy apply" in (c.text or "").lower() else 1)
        for card in cards[:12]:
            try:
                link = card.find_element(By.CSS_SELECTOR, "a[href*='/jobs/view/']")
                if link.is_displayed():
                    driver.execute_script("arguments[0].scrollIntoView({block:'center'});", link)
                    time.sleep(0.2)
                    try:
                        link.click()
                    except WebDriverException:
                        driver.execute_script("arguments[0].click();", link)
                    ok = True
                    break
            except WebDriverException:
                continue
    except WebDriverException:
        pass
    if not ok:
        ok = click_first(driver, [
            "li.jobs-search-results__list-item a[href*='/jobs/view/']",
            "div.job-card-container a[href*='/jobs/view/']",
            "a.job-card-list__title",
            "a.job-card-container__link",
            "a[href*='/jobs/view/']",
        ], timeout=8)
    if not ok:
        emit("listing", "Could not find a job card to click", level="warn")
        return False
    emit("listing", "Opened first job card", level="success")
    try:
        WebDriverWait(driver, 10).until(
            lambda d: d.current_url != before
            or d.find_elements(
                By.CSS_SELECTOR,
                "button.jobs-apply-button, button[aria-label*='Easy Apply' i], "
                "button[aria-label*='Apply' i]",
            )
        )
    except TimeoutException:
        pass
    time.sleep(1)
    return True


def linkedin_click_easy_apply(driver, emit: Emit) -> bool:
    before_url = driver.current_url
    before_handles = list(driver.window_handles)
    if click_first(driver, [
        "button.jobs-apply-button",
        "button[aria-label*='Easy Apply' i]",
        "button[aria-label*='Apply' i]",
        "button[data-control-name='jobdetails_topcard_inapply']",
    ], timeout=8):
        time.sleep(2)
        try:
            if len(driver.window_handles) > len(before_handles):
                driver.switch_to.window(driver.window_handles[-1])
                emit("external", "Opened external application tab",
                     level="success", url=driver.current_url)
                return False
        except WebDriverException:
            pass
        if active_dialog(driver):
            emit("easy_apply", "Opened Easy Apply modal", level="success")
            return True
        if "linkedin.com" not in driver.current_url or driver.current_url != before_url:
            emit("external", "Opened external application page",
                 level="success", url=driver.current_url)
            return False
        emit("easy_apply", "Clicked Apply, but no modal opened yet", level="warn")
        return False
    emit("easy_apply", "No Apply button found", level="warn")
    return False


def linkedin_easy_apply_loop(driver, emit: Emit, profile: Dict[str, Any],
                             max_steps: int = 8) -> str:
    """Walk the Easy Apply wizard: fill -> Next -> Review. Stops at Review."""
    job_context = ""
    try:
        job_context = driver.find_element(By.CSS_SELECTOR, ".jobs-description").text[:2000]
    except WebDriverException:
        pass

    for step in range(max_steps):
        time.sleep(1)
        root = active_form_root(driver)
        maybe_upload_resume(driver, emit, profile, root=root)
        n = fill_visible_fields(driver, emit, profile, job_context, root=root)
        n += fill_choice_controls(driver, emit, profile, job_context, root=root)
        emit("easy_apply", f"Step {step+1}: filled {n} field(s)")

        if click_first(driver, [
            "button[aria-label*='Review your application' i]",
            "button[aria-label='Review your application']",
        ], timeout=2, root=root) or click_xpath(driver, [
            ".//button[not(@disabled) and contains(translate(normalize-space(.),"
            "'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'review')]",
        ], timeout=1, root=root):
            emit("easy_apply", "Reached Review step", level="success")
            time.sleep(1.5)
            return "awaiting_approval"

        moved = click_first(driver, [
            "button[aria-label='Continue to next step']",
            "button[aria-label*='Continue' i]",
            "button[aria-label*='next step' i]",
            "button[aria-label*='Next' i]",
        ], timeout=3, root=root) or click_xpath(driver, [
            ".//button[not(@disabled) and (normalize-space(translate(.,"
            "'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'))='next' "
            "or contains(translate(normalize-space(.),"
            "'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'continue'))]",
        ], timeout=1, root=root)
        if not moved:
            if find_submit_button(driver, root=root):
                emit("easy_apply", "Reached Submit step", level="success")
                return "awaiting_approval"
            emit("easy_apply", "Stuck — no Next/Review/Submit visible", level="warn")
            return "needs_human"
        time.sleep(1.2)

    emit("easy_apply", "Exceeded max wizard steps", level="warn")
    return "needs_human"


# ============================================================
#                  External ATS handlers
# ============================================================

def external_form_flow(driver, emit: Emit, profile: Dict[str, Any]) -> str:
    """Generic Greenhouse / Lever / Ashby / Workday handler."""
    time.sleep(1.5)
    click_first(driver, [
        "a.postings-btn[href*='apply']",         # Lever
        "a#apply_button",                        # Greenhouse
        "button[data-source='apply_button']",
    ], timeout=2)
    time.sleep(1)

    job_context = ""
    try:
        job_context = driver.find_element(By.TAG_NAME, "body").text[:3000]
    except WebDriverException:
        pass

    maybe_upload_resume(driver, emit, profile)
    n = fill_visible_fields(driver, emit, profile, job_context)
    host = driver.current_url.split("/")[2] if "://" in driver.current_url else "site"
    emit("external", f"Filled {n} field(s) on {host}",
         level="success" if n else "warn")
    return "awaiting_approval"


# ============================================================
#                        dispatch
# ============================================================

def run_adapter(kind: str, driver, emit: Emit, profile: Dict[str, Any]) -> str:
    if kind == "job_listing":
        if linkedin_pick_first_job(driver, emit):
            try:
                WebDriverWait(driver, 10).until(
                    lambda d: "/jobs/view/" in d.current_url
                    or d.find_elements(
                        By.CSS_SELECTOR,
                        "button.jobs-apply-button, button[aria-label*='Easy Apply' i], "
                        "button[aria-label*='Apply' i]",
                    )
                )
            except TimeoutException:
                emit("listing", "Job opened, but Apply button did not appear yet", level="warn")
            kind = "job_detail"
        else:
            return "needs_human"

    if kind == "job_detail":
        if "linkedin.com" in driver.current_url:
            if linkedin_click_easy_apply(driver, emit):
                return linkedin_easy_apply_loop(driver, emit, profile)
            try:
                if len(driver.window_handles) > 1:
                    driver.switch_to.window(driver.window_handles[-1])
            except WebDriverException:
                pass
            if "linkedin.com" not in driver.current_url:
                return external_form_flow(driver, emit, profile)
            return "needs_human"
        return external_form_flow(driver, emit, profile)

    if kind == "easy_apply_step":
        return linkedin_easy_apply_loop(driver, emit, profile)

    if kind in ("external_form", "resume_upload"):
        return external_form_flow(driver, emit, profile)

    if kind == "login_wall":
        emit("login", "Login wall detected — please sign in inside the Chrome window, "
             "then re-run the job. Your session will persist.", level="warn")
        return "needs_human"

    if kind == "captcha":
        emit("captcha", "Captcha detected — solve it manually in the Chrome window, "
             "then approve.", level="warn")
        return "needs_human"

    if kind == "success":
        emit("done", "Application already submitted", level="success")
        return "submitted"

    emit("unknown", f"Unhandled page kind: {kind}", level="warn")
    return "needs_human"
