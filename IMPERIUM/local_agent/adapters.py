"""
Per-site adapters. Each adapter knows how to navigate a specific flow
(LinkedIn Easy Apply, Greenhouse, Lever, Workday). They return a dict:

    { "status": "submitted" | "awaiting_approval" | "needs_human" | "error",
      "filled": int, "note": str }

The main loop chooses an adapter based on classify_page().
"""
from __future__ import annotations

import time
from typing import Any, Callable, Dict, List, Optional

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.common.exceptions import (
    ElementClickInterceptedException,
    NoSuchElementException,
    StaleElementReferenceException,
    TimeoutException,
    WebDriverException,
)

from brain import answer_question


Emit = Callable[..., None]  # emit(step, action, level="info", url="")


# ============================================================
#                       common helpers
# ============================================================

def page_snapshot(driver) -> Dict[str, Any]:
    """Compact snapshot used by the brain to decide what to do."""
    buttons: List[str] = []
    dialog_text = ""
    job_cards = 0
    has_easy_apply_button = False
    try:
        for b in driver.find_elements(By.CSS_SELECTOR, "button, [role=button], a"):
            try:
                if not b.is_displayed(): continue
                txt = (b.text or b.get_attribute("aria-label") or "").strip()
                if txt and len(txt) < 80:
                    buttons.append(txt)
                if "easy apply" in txt.lower():
                    has_easy_apply_button = True
            except WebDriverException:
                continue
    except WebDriverException:
        pass
    try:
        job_cards = len(driver.find_elements(By.CSS_SELECTOR, "li.jobs-search-results__list-item, div.job-card-container, a[href*='/jobs/view/']"))
    except WebDriverException:
        pass
    try:
        dialogs = driver.find_elements(By.CSS_SELECTOR, "div[role='dialog'], .artdeco-modal, .jobs-easy-apply-modal")
        for d in dialogs:
            try:
                if d.is_displayed():
                    dialog_text = (d.text or "")[:3000]
                    break
            except WebDriverException:
                continue
    except WebDriverException:
        pass
    inputs = 0
    try:
        inputs = len(driver.find_elements(By.CSS_SELECTOR, "input, textarea, select"))
    except WebDriverException:
        pass
    body_text = ""
    try:
        body_text = driver.find_element(By.TAG_NAME, "body").text or ""
    except WebDriverException:
        pass
    return {
        "url": driver.current_url,
        "title": driver.title,
        "buttons": buttons[:40],
        "input_count": inputs,
        "job_cards": job_cards,
        "has_easy_apply_button": has_easy_apply_button,
        "has_dialog": bool(dialog_text),
        "dialog_text": dialog_text,
        "body_text": body_text[:6000],
    }


def click_first(driver, selectors: List[str], *, timeout: float = 6) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        for sel in selectors:
            try:
                els = driver.find_elements(By.CSS_SELECTOR, sel)
                for el in els:
                    try:
                        if not el.is_displayed() or not el.is_enabled():
                            continue
                        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", el)
                        time.sleep(0.2)
                        el.click()
                        return True
                    except (ElementClickInterceptedException, WebDriverException):
                        try:
                            driver.execute_script("arguments[0].click();", el)
                            return True
                        except WebDriverException:
                            continue
            except WebDriverException:
                continue
        time.sleep(0.3)
    return False


def click_xpath(driver, xpaths: List[str], *, timeout: float = 6) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        for xp in xpaths:
            try:
                for el in driver.find_elements(By.XPATH, xp):
                    try:
                        if not el.is_displayed() or not el.is_enabled():
                            continue
                        driver.execute_script("arguments[0].scrollIntoView({block:'center'});", el)
                        time.sleep(0.2)
                        try:
                            el.click()
                        except (ElementClickInterceptedException, WebDriverException):
                            driver.execute_script("arguments[0].click();", el)
                        return True
                    except WebDriverException:
                        continue
            except WebDriverException:
                continue
        time.sleep(0.3)
    return False


def find_submit_button(driver):
    """Find a submit/apply button using many heuristics."""
    candidates = [
        "button[aria-label*='Submit application' i]",
        "button[aria-label*='Submit' i]",
        "button[data-control-name='submit_unify']",
        "button[type='submit']:not([disabled])",
        "input[type='submit']:not([disabled])",
        "button[id*='submit' i]:not([disabled])",
    ]
    for sel in candidates:
        try:
            for el in driver.find_elements(By.CSS_SELECTOR, sel):
                if el.is_displayed() and el.is_enabled():
                    return el
        except WebDriverException:
            continue
    # Text-based fallback
    try:
        xp = ("//button[not(@disabled) and "
              "(contains(translate(normalize-space(.),"
              "'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'submit application')"
              " or normalize-space(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ',"
              "'abcdefghijklmnopqrstuvwxyz'))='submit'"
              " or contains(translate(normalize-space(.),"
              "'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'apply now'))]")
        for el in driver.find_elements(By.XPATH, xp):
            if el.is_displayed() and el.is_enabled():
                return el
    except WebDriverException:
        pass
    return None


def _label_text(driver, el) -> str:
    for attr in ("aria-label", "placeholder", "name", "id", "data-test", "data-testid"):
        v = el.get_attribute(attr) or ""
        if v.strip():
            return v.strip()
    # try associated <label>
    try:
        eid = el.get_attribute("id")
        if eid:
            lab = driver.find_elements(By.CSS_SELECTOR, f"label[for='{eid}']")
            if lab and lab[0].text:
                return lab[0].text.strip()
    except WebDriverException:
        pass
    # parent text
    try:
        return (el.find_element(By.XPATH, "./ancestor::label[1]").text or "").strip()
    except WebDriverException:
        return ""


PROFILE_MAP = [
    (("first name", "given name"),               lambda p, n: n["first"]),
    (("last name", "surname", "family name"),    lambda p, n: n["last"]),
    (("full name", "your name", "legal name"),   lambda p, n: p.get("name")),
    (("name",),                                  lambda p, n: p.get("name")),
    (("email", "e-mail"),                        lambda p, n: p.get("email")),
    (("phone", "mobile", "telephone"),           lambda p, n: p.get("phone")),
    (("address",),                               lambda p, n: p.get("location")),
    (("city",),                                  lambda p, n: p.get("location")),
    (("location", "where are you based"),        lambda p, n: p.get("location")),
    (("linkedin",),                              lambda p, n: p.get("linkedin_url") or p.get("linkedin")),
    (("github",),                                lambda p, n: p.get("github_url") or p.get("github")),
    (("portfolio", "website", "personal site"),  lambda p, n: p.get("portfolio_url") or p.get("portfolio")),
    (("headline", "title"),                      lambda p, n: p.get("headline")),
    (("summary", "about you", "cover letter", "tell us"),
                                                  lambda p, n: p.get("summary")),
]


def _direct_profile_value(label: str, profile: Dict[str, Any], name_parts: Dict[str, str]):
    low = label.lower()
    for needles, getter in PROFILE_MAP:
        if any(n in low for n in needles):
            v = getter(profile, name_parts)
            if v: return str(v)
    return None


def fill_visible_fields(driver, emit: Emit, profile: Dict[str, Any],
                        job_context: str = "") -> int:
    """Generic form filler: profile-map first, LLM fallback for unknowns."""
    parts = (profile.get("name") or "").split(" ", 1)
    name_parts = {"first": parts[0] if parts else "",
                  "last":  parts[1] if len(parts) > 1 else ""}

    filled = 0
    elements = driver.find_elements(By.CSS_SELECTOR, "input, textarea, select")
    for el in elements:
        try:
            tag = el.tag_name.lower()
            t = (el.get_attribute("type") or "text").lower()
            if t in {"hidden", "submit", "button", "checkbox", "radio", "file"}:
                continue
            if not el.is_displayed() or not el.is_enabled():
                continue
            if (el.get_attribute("value") or "").strip():
                continue  # already filled
            label = _label_text(driver, el)
            if not label:
                continue

            if tag == "select":
                options = []
                try:
                    options = [o.text.strip() for o in el.find_elements(By.TAG_NAME, "option") if o.text]
                except WebDriverException:
                    pass
                ans = answer_question(label, profile, job_context, choices=options)
                if not ans: continue
                for o in el.find_elements(By.TAG_NAME, "option"):
                    if (o.text or "").strip().lower() == ans.lower():
                        try: o.click(); filled += 1; emit("fill", f"Selected '{label}' = {ans}", level="success"); break
                        except WebDriverException: pass
                continue

            val = _direct_profile_value(label, profile, name_parts)
            if not val:
                val = answer_question(label, profile, job_context)
            if not val:
                continue
            try: el.clear()
            except WebDriverException: pass
            el.send_keys(str(val))
            filled += 1
            emit("fill", f"Filled '{label[:60]}' = {str(val)[:60]}", level="success")
            time.sleep(0.1)
        except (StaleElementReferenceException, WebDriverException) as exc:
            emit("fill", f"Skipped a field: {exc.__class__.__name__}", level="warn")
    return filled


def maybe_upload_resume(driver, emit: Emit, profile: Dict[str, Any]) -> bool:
    path = profile.get("resume_path") or profile.get("resume_file")
    if not path:
        return False
    try:
        ups = driver.find_elements(By.CSS_SELECTOR, "input[type='file']")
        for u in ups:
            try:
                name = (u.get_attribute("name") or u.get_attribute("id") or "").lower()
                if "resume" in name or "cv" in name or len(ups) == 1:
                    u.send_keys(path)
                    emit("upload", f"Uploaded resume: {path}", level="success")
                    time.sleep(1)
                    return True
            except WebDriverException:
                continue
    except WebDriverException:
        pass
    return False


# ============================================================
#                  LinkedIn Easy Apply
# ============================================================

def linkedin_pick_first_job(driver, emit: Emit) -> bool:
    """On a /jobs/search page, click the first job card."""
    before = driver.current_url
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
            or d.find_elements(By.CSS_SELECTOR, "button.jobs-apply-button, button[aria-label*='Easy Apply' i], button[aria-label*='Apply' i]")
        )
    except TimeoutException:
        pass
    time.sleep(1)
    return True


def linkedin_click_easy_apply(driver, emit: Emit) -> bool:
    if click_first(driver, [
        "button.jobs-apply-button",
        "button[aria-label*='Easy Apply' i]",
        "button[aria-label*='Apply' i]",
        "button[data-control-name='jobdetails_topcard_inapply']",
    ], timeout=8):
        emit("easy_apply", "Opened Easy Apply modal", level="success")
        time.sleep(1.5)
        return True
    emit("easy_apply", "No Easy Apply button (external apply required)", level="warn")
    return False


def linkedin_easy_apply_loop(driver, emit: Emit, profile: Dict[str, Any],
                              max_steps: int = 8) -> str:
    """
    Walk the Easy Apply wizard: fill -> Next -> Review.
    Stops at Review and returns 'awaiting_approval'.
    """
    job_context = ""
    try:
        job_context = driver.find_element(By.CSS_SELECTOR, ".jobs-description").text[:2000]
    except WebDriverException:
        pass

    for step in range(max_steps):
        time.sleep(1)
        maybe_upload_resume(driver, emit, profile)
        n = fill_visible_fields(driver, emit, profile, job_context)
        emit("easy_apply", f"Step {step+1}: filled {n} field(s)")

        # Look for Review/Submit first
        if click_first(driver, [
            "button[aria-label*='Review your application' i]",
            "button[aria-label='Review your application']",
        ], timeout=2):
            emit("easy_apply", "Reached Review step", level="success")
            time.sleep(1.5)
            return "awaiting_approval"

        # Otherwise Next/Continue
        moved = click_first(driver, [
            "button[aria-label='Continue to next step']",
            "button[aria-label*='Continue' i]",
            "button[aria-label*='next step' i]",
        ], timeout=3)
        if not moved:
            # No Next button? Maybe we're already at Submit.
            if find_submit_button(driver):
                emit("easy_apply", "Reached Submit step", level="success")
                return "awaiting_approval"
            emit("easy_apply", "Stuck — no Next/Review/Submit visible", level="warn")
            return "needs_human"
        time.sleep(1.2)

    emit("easy_apply", "Exceeded max wizard steps", level="warn")
    return "needs_human"


# ============================================================
#                   External ATS handlers
# ============================================================

def external_form_flow(driver, emit: Emit, profile: Dict[str, Any]) -> str:
    """Generic Greenhouse / Lever / Ashby / Workday handler."""
    time.sleep(1.5)
    # Some sites have a separate Apply button to expand the form
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
    emit("external", f"Filled {n} field(s) on {driver.current_url.split('/')[2]}",
         level="success" if n else "warn")
    return "awaiting_approval"


# ============================================================
#                        dispatch
# ============================================================

def run_adapter(kind: str, driver, emit: Emit, profile: Dict[str, Any]) -> str:
    if kind == "job_listing":
        if linkedin_pick_first_job(driver, emit):
            WebDriverWait(driver, 8).until(
                lambda d: "/jobs/view/" in d.current_url or
                          d.find_elements(By.CSS_SELECTOR, "button.jobs-apply-button"))
            kind = "job_detail"
        else:
            return "needs_human"

    if kind == "job_detail":
        if "linkedin.com" in driver.current_url:
            if linkedin_click_easy_apply(driver, emit):
                return linkedin_easy_apply_loop(driver, emit, profile)
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
