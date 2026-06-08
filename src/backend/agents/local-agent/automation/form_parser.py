"""
automation/form_parser.py
=========================

Purpose
-------
Read pages and fill generic form fields. Provides a DOM ``page_snapshot``
used by the LLM brain, label-aware field detection, a profile-keyword map
for instant fills, click helpers, and a robust submit-button finder.

Inputs
------
- A live Selenium ``WebDriver``.
- Candidate ``profile`` dict (name, email, phone, etc.).
- An ``emit`` callback for logging.

Outputs
-------
- ``page_snapshot()`` → dict describing the current page.
- ``fill_visible_fields()`` / ``fill_choice_controls()`` → int (fields filled).
- ``find_submit_button()`` → WebElement or ``None``.

Responsibility
--------------
DOM reading + generic form filling. No site-specific flow logic — that
lives in ``workflow_executor.py``.
"""
from __future__ import annotations

import time
from typing import Any, Callable, Dict, List

from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
from selenium.common.exceptions import (
    ElementClickInterceptedException,
    StaleElementReferenceException,
    WebDriverException,
)

from shared.llm_brain import answer_question

Emit = Callable[..., None]


# ---------------- DOM snapshot ----------------

def page_snapshot(driver) -> Dict[str, Any]:
    """Compact snapshot used by the brain to decide what to do."""
    buttons: List[str] = []
    dialog_text = ""
    job_cards = 0
    has_easy_apply_button = False
    try:
        for b in driver.find_elements(By.CSS_SELECTOR, "button, [role=button], a"):
            try:
                if not b.is_displayed():
                    continue
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
        job_cards = len(driver.find_elements(
            By.CSS_SELECTOR,
            "li.jobs-search-results__list-item, div.job-card-container, "
            "a[href*='/jobs/view/']",
        ))
    except WebDriverException:
        pass
    try:
        dialogs = driver.find_elements(
            By.CSS_SELECTOR,
            "div[role='dialog'], .artdeco-modal, .jobs-easy-apply-modal",
        )
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


def active_dialog(driver):
    try:
        for d in driver.find_elements(
            By.CSS_SELECTOR,
            "div[role='dialog'], .artdeco-modal, .jobs-easy-apply-modal",
        ):
            try:
                if d.is_displayed():
                    return d
            except WebDriverException:
                continue
    except WebDriverException:
        pass
    return None


def active_form_root(driver):
    return active_dialog(driver) or driver


# ---------------- click helpers ----------------

def click_first(driver, selectors: List[str], *, timeout: float = 6, root=None) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        for sel in selectors:
            try:
                els = (root or driver).find_elements(By.CSS_SELECTOR, sel)
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


def click_xpath(driver, xpaths: List[str], *, timeout: float = 6, root=None) -> bool:
    end = time.time() + timeout
    while time.time() < end:
        for xp in xpaths:
            try:
                for el in (root or driver).find_elements(By.XPATH, xp):
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


def find_submit_button(driver, root=None):
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
            for el in (root or driver).find_elements(By.CSS_SELECTOR, sel):
                if el.is_displayed() and el.is_enabled():
                    return el
        except WebDriverException:
            continue
    try:
        xp = ("//button[not(@disabled) and "
              "(contains(translate(normalize-space(.),"
              "'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'submit application')"
              " or normalize-space(translate(.,'ABCDEFGHIJKLMNOPQRSTUVWXYZ',"
              "'abcdefghijklmnopqrstuvwxyz'))='submit'"
              " or contains(translate(normalize-space(.),"
              "'ABCDEFGHIJKLMNOPQRSTUVWXYZ','abcdefghijklmnopqrstuvwxyz'),'apply now'))]")
        for el in (root or driver).find_elements(By.XPATH, xp):
            if el.is_displayed() and el.is_enabled():
                return el
    except WebDriverException:
        pass
    return None


# ---------------- field filling ----------------

def _label_text(driver, el) -> str:
    for attr in ("aria-label", "placeholder", "name", "id", "data-test", "data-testid"):
        v = el.get_attribute(attr) or ""
        if v.strip():
            return v.strip()
    try:
        eid = el.get_attribute("id")
        if eid:
            lab = driver.find_elements(By.CSS_SELECTOR, f"label[for='{eid}']")
            if lab and lab[0].text:
                return lab[0].text.strip()
    except WebDriverException:
        pass
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
            if v:
                return str(v)
    return None


def fill_visible_fields(driver, emit: Emit, profile: Dict[str, Any],
                        job_context: str = "", root=None) -> int:
    """Generic form filler: profile-map first, LLM fallback for unknowns."""
    parts = (profile.get("name") or "").split(" ", 1)
    name_parts = {"first": parts[0] if parts else "",
                  "last":  parts[1] if len(parts) > 1 else ""}

    filled = 0
    elements = (root or driver).find_elements(By.CSS_SELECTOR, "input, textarea, select")
    for el in elements:
        try:
            tag = el.tag_name.lower()
            t = (el.get_attribute("type") or "text").lower()
            if t in {"hidden", "submit", "button", "checkbox", "radio", "file"}:
                continue
            if not el.is_displayed() or not el.is_enabled():
                continue
            if (el.get_attribute("value") or "").strip():
                continue
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
                if not ans:
                    continue
                for o in el.find_elements(By.TAG_NAME, "option"):
                    if (o.text or "").strip().lower() == ans.lower():
                        try:
                            o.click()
                            filled += 1
                            emit("fill", f"Selected '{label}' = {ans}", level="success")
                            break
                        except WebDriverException:
                            pass
                continue

            val = _direct_profile_value(label, profile, name_parts)
            if not val:
                val = answer_question(label, profile, job_context)
            if not val:
                continue
            try:
                el.clear()
            except WebDriverException:
                pass
            el.send_keys(str(val))
            if el.get_attribute("role") == "combobox" or (
                el.get_attribute("aria-autocomplete") or ""
            ).lower() in {"list", "both"}:
                time.sleep(0.6)
                try:
                    el.send_keys(Keys.ARROW_DOWN)
                    el.send_keys(Keys.ENTER)
                except WebDriverException:
                    pass
            filled += 1
            emit("fill", f"Filled '{label[:60]}' = {str(val)[:60]}", level="success")
            time.sleep(0.1)
        except (StaleElementReferenceException, WebDriverException) as exc:
            emit("fill", f"Skipped a field: {exc.__class__.__name__}", level="warn")
    return filled


def fill_choice_controls(driver, emit: Emit, profile: Dict[str, Any],
                         job_context: str = "", root=None) -> int:
    """Fill visible radio groups and safe required checkboxes."""
    filled = 0
    seen_radio_names = set()
    for el in (root or driver).find_elements(
        By.CSS_SELECTOR, "input[type='radio'], input[type='checkbox']",
    ):
        try:
            t = (el.get_attribute("type") or "").lower()
            if not el.is_enabled() or el.is_selected():
                continue
            label = _label_text(driver, el)
            try:
                label = (el.find_element(By.XPATH, "./ancestor::label[1]").text or label).strip()
            except WebDriverException:
                pass
            try:
                question = (el.find_element(By.XPATH, "./ancestor::fieldset[1]").text or label).strip()
            except WebDriverException:
                question = label
            low = f"{question} {label}".lower()

            if t == "checkbox":
                if any(k in low for k in ("agree", "confirm", "certify", "consent", "acknowledge")):
                    driver.execute_script("arguments[0].click();", el)
                    filled += 1
                    emit("fill", f"Checked '{label[:60] or 'required confirmation'}'",
                         level="success")
                continue

            name = el.get_attribute("name") or question
            if name in seen_radio_names:
                continue
            group = (root or driver).find_elements(
                By.CSS_SELECTOR, f"input[type='radio'][name='{name}']",
            ) if el.get_attribute("name") else [el]
            choices = []
            for r in group:
                txt = _label_text(driver, r)
                try:
                    txt = (r.find_element(By.XPATH, "./ancestor::label[1]").text or txt).strip()
                except WebDriverException:
                    pass
                choices.append(txt or (r.get_attribute("value") or ""))
            answer = answer_question(question, profile, job_context,
                                     choices=[c for c in choices if c])
            target = None
            if answer:
                for r, choice in zip(group, choices):
                    if choice and (
                        choice.lower() == answer.lower()
                        or choice.lower() in answer.lower()
                        or answer.lower() in choice.lower()
                    ):
                        target = r
                        break
            target = target or group[0]
            driver.execute_script("arguments[0].click();", target)
            seen_radio_names.add(name)
            filled += 1
            emit("fill",
                 f"Selected '{question[:50]}' = {(answer or choices[0] or 'option')[:40]}",
                 level="success")
        except (StaleElementReferenceException, WebDriverException) as exc:
            emit("fill", f"Skipped a choice: {exc.__class__.__name__}", level="warn")
    return filled
