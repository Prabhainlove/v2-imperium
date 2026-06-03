from __future__ import annotations

import re
from dataclasses import asdict
from pathlib import Path
from typing import Any
from uuid import uuid4

from ..models import CandidateProfile
from ..storage.database import JobAgentDatabase


class ProfileValidationError(ValueError):
    """Raised when the candidate profile payload is incomplete."""


class CandidateProfileManager:
    """Loads, validates, and persists candidate profiles."""

    def __init__(self, database: JobAgentDatabase) -> None:
        self.database = database

    def save_profile(self, profile: CandidateProfile) -> CandidateProfile:
        self._validate_profile(profile)
        self.database.save_candidate_profile(profile)
        return profile

    def build_and_save(self, payload: dict[str, Any]) -> CandidateProfile:
        profile = self._profile_from_payload(payload)
        self.save_profile(profile)
        return profile

    def load_profile(self) -> CandidateProfile | None:
        return self.database.load_latest_candidate_profile()

    def ensure_profile(self, payload: dict[str, Any] | None = None) -> CandidateProfile:
        if payload:
            return self.build_and_save(payload)

        existing = self.load_profile()
        if existing is None:
            raise ProfileValidationError(
                "Candidate profile missing. Provide task['candidate_profile'] with name, contact, and skills."
            )
        self._validate_profile(existing)
        return existing

    def profile_completeness(self, profile: CandidateProfile) -> dict[str, Any]:
        checks = {
            "name": bool(profile.name.strip()),
            "contact_email": bool(profile.contact.email.strip()),
            "skills": len(profile.skills) > 0,
            "work_experience": len(profile.work_experience) > 0,
            "education": len(profile.education) > 0,
            "projects": len(profile.projects) > 0,
            "linkedin_profile": bool(profile.linkedin_profile.strip()),
            "github_repositories": len(profile.github_repositories) > 0,
            "portfolio_links": len(profile.portfolio_links) > 0,
        }

        score = round(sum(1 for passed in checks.values() if passed) / len(checks), 4)
        missing = [field for field, passed in checks.items() if not passed]
        return {
            "score": score,
            "checks": checks,
            "missing": missing,
        }

    def detect_skill_gaps(
        self,
        profile: CandidateProfile,
        required_skills: list[str],
    ) -> list[str]:
        profile_skills = {item.strip().lower() for item in profile.skills if item.strip()}
        gaps: list[str] = []
        for required in required_skills:
            normalized = required.strip().lower()
            if not normalized:
                continue
            if normalized not in profile_skills:
                gaps.append(required.strip())
        return gaps

    def as_dict(self, profile: CandidateProfile) -> dict[str, Any]:
        return asdict(profile)

    def _profile_from_payload(self, payload: dict[str, Any]) -> CandidateProfile:
        normalized = dict(payload)
        normalized.setdefault("profile_id", str(uuid4()))
        profile = CandidateProfile.from_dict(normalized)
        self._validate_profile(profile)
        return profile

    @staticmethod
    def _validate_profile(profile: CandidateProfile) -> None:
        if not profile.name.strip():
            raise ProfileValidationError("Profile name cannot be empty.")
        if not profile.contact.email.strip():
            raise ProfileValidationError("Profile contact.email is required.")
        if not profile.skills:
            raise ProfileValidationError("Profile skills list cannot be empty.")


def parse_resume(file_path: Path) -> dict[str, Any]:
    text = _extract_text(file_path)
    return {
        "name": _extract_name(text),
        "contact": _extract_contact(text),
        "skills": _extract_skills(text),
        "work_experience": _extract_experience(text),
        "education": _extract_education(text),
        "projects": _extract_projects(text),
        "certifications": _extract_certifications(text),
    }


def _extract_text(file_path: Path) -> str:
    suffix = file_path.suffix.lower()

    if suffix == ".txt":
        return file_path.read_text(encoding="utf-8", errors="ignore")

    if suffix == ".pdf":
        try:
            import PyPDF2

            with open(file_path, "rb") as f:
                reader = PyPDF2.PdfReader(f)
                text = ""
                for page in reader.pages:
                    text += page.extract_text()
                return text
        except ImportError:
            try:
                import pdfplumber

                with pdfplumber.open(file_path) as pdf:
                    text = ""
                    for page in pdf.pages:
                        text += page.extract_text() or ""
                    return text
            except ImportError:
                return "PDF parsing requires PyPDF2 or pdfplumber. Install with: pip install PyPDF2"

    if suffix in [".docx", ".doc"]:
        try:
            import docx

            doc = docx.Document(file_path)
            return "\n".join([para.text for para in doc.paragraphs])
        except ImportError:
            return "DOCX parsing requires python-docx. Install with: pip install python-docx"

    return ""


def _extract_name(text: str) -> str:
    lines = [l.strip() for l in text.split("\n") if l.strip()]

    for line in lines[:10]:
        if "name" in line.lower() and ":" in line:
            name = line.split(":", 1)[1].strip()
            if name and len(name) < 50:
                return name

    if lines:
        first_line = lines[0]
        if not any(word in first_line.lower() for word in ["resume", "cv", "curriculum"]):
            if len(first_line) < 50 and "@" not in first_line:
                return first_line

    return "Candidate"


def _extract_contact(text: str) -> dict[str, str]:
    contact = {
        "email": "",
        "phone": "",
        "location": "",
    }

    email_match = re.search(r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b", text)
    if email_match:
        contact["email"] = email_match.group(0)

    phone_patterns = [
        r"\+?\d{1,3}[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}",
        r"\+?\d{2}[-.\s]?\d{10}",
        r"\d{10}",
    ]
    for pattern in phone_patterns:
        phone_match = re.search(pattern, text)
        if phone_match:
            contact["phone"] = phone_match.group(0)
            break

    location_match = re.search(r"(?:Location|Address|City):\s*([^\n]+)", text, re.IGNORECASE)
    if location_match:
        contact["location"] = location_match.group(1).strip()
    else:
        cities = ["Hyderabad", "Bangalore", "Mumbai", "Delhi", "Pune", "Chennai", "Kolkata"]
        for city in cities:
            if city in text:
                contact["location"] = city
                break

    return contact


def _extract_skills(text: str) -> list[str]:
    skills = []
    tech_keywords = [
        "Python",
        "Java",
        "JavaScript",
        "TypeScript",
        "C++",
        "C#",
        "Go",
        "Rust",
        "Ruby",
        "PHP",
        "React",
        "Angular",
        "Vue",
        "Node.js",
        "Django",
        "Flask",
        "FastAPI",
        "Spring",
        "Express",
        "SQL",
        "PostgreSQL",
        "MySQL",
        "MongoDB",
        "Redis",
        "Elasticsearch",
        "AWS",
        "Azure",
        "GCP",
        "Docker",
        "Kubernetes",
        "Jenkins",
        "Git",
        "CI/CD",
        "Machine Learning",
        "Deep Learning",
        "TensorFlow",
        "PyTorch",
        "Pandas",
        "NumPy",
        "REST API",
        "GraphQL",
        "Microservices",
        "Agile",
        "Scrum",
    ]

    text_lower = text.lower()
    for skill in tech_keywords:
        if skill.lower() in text_lower:
            skills.append(skill)

    skills_match = re.search(
        r"(?:Skills|Technical Skills|Technologies):\s*([^\n]+(?:\n[^\n]+)*)",
        text,
        re.IGNORECASE,
    )
    if skills_match:
        skills_text = skills_match.group(1)
        extracted = re.split(r"[,;|•\n]", skills_text)
        for skill in extracted:
            skill = skill.strip()
            if skill and len(skill) < 30 and skill not in skills:
                skills.append(skill)

    return skills[:20]


def _extract_experience(text: str) -> list[dict[str, str]]:
    experiences = []

    exp_section = re.search(
        r"(?:Work Experience|Experience|Employment History):\s*(.*?)(?=\n(?:Education|Projects|Skills|Certifications)|$)",
        text,
        re.IGNORECASE | re.DOTALL,
    )

    if exp_section:
        exp_text = exp_section.group(1)
        entries = re.split(r"\n(?=[A-Z][a-z]+ (?:at |@|-))", exp_text)

        for entry in entries[:5]:
            if len(entry.strip()) < 20:
                continue

            lines = [l.strip() for l in entry.split("\n") if l.strip()]
            if not lines:
                continue

            first_line = lines[0]
            title = ""
            company = ""

            if " at " in first_line:
                parts = first_line.split(" at ", 1)
                title = parts[0].strip()
                company = parts[1].strip()
            elif " - " in first_line:
                parts = first_line.split(" - ", 1)
                title = parts[0].strip()
                company = parts[1].strip() if len(parts) > 1 else ""
            else:
                title = first_line

            duration = ""
            for line in lines[1:3]:
                if re.search(r"\d{4}", line):
                    duration = line
                    break

            description = " ".join(lines[2:5]) if len(lines) > 2 else ""

            experiences.append(
                {
                    "title": title[:100],
                    "company": company[:100],
                    "duration": duration[:50],
                    "description": description[:300],
                }
            )

    return experiences


def _extract_education(text: str) -> list[dict[str, str]]:
    education = []

    edu_section = re.search(
        r"(?:Education|Academic Background):\s*(.*?)(?=\n(?:Experience|Projects|Skills|Certifications)|$)",
        text,
        re.IGNORECASE | re.DOTALL,
    )

    if edu_section:
        edu_text = edu_section.group(1)
        lines = [l.strip() for l in edu_text.split("\n") if l.strip()]

        current_edu: dict[str, str] = {}
        for line in lines[:10]:
            if any(deg in line for deg in ["B.Tech", "B.E.", "M.Tech", "M.S.", "MBA", "Bachelor", "Master", "PhD"]):
                if current_edu:
                    education.append(current_edu)
                current_edu = {"degree": line, "institution": "", "year": ""}

            elif any(word in line.lower() for word in ["university", "college", "institute"]):
                if current_edu:
                    current_edu["institution"] = line

            elif re.search(r"\b(19|20)\d{2}\b", line):
                if current_edu:
                    current_edu["year"] = line

        if current_edu:
            education.append(current_edu)

    return education


def _extract_projects(text: str) -> list[dict[str, str]]:
    projects = []

    proj_section = re.search(
        r"(?:Projects|Personal Projects):\s*(.*?)(?=\n(?:Experience|Education|Skills|Certifications)|$)",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    if proj_section:
        proj_text = proj_section.group(1)
        entries = [line.strip() for line in proj_text.split("\n") if line.strip()]
        for entry in entries[:5]:
            if len(entry) < 10:
                continue
            projects.append({"name": entry[:80], "description": "", "technologies": []})

    return projects


def _extract_certifications(text: str) -> list[dict[str, str]]:
    certifications = []

    cert_section = re.search(
        r"(?:Certifications|Certificates):\s*(.*?)(?=\n(?:Experience|Education|Skills|Projects)|$)",
        text,
        re.IGNORECASE | re.DOTALL,
    )
    if cert_section:
        cert_text = cert_section.group(1)
        entries = [line.strip() for line in cert_text.split("\n") if line.strip()]
        for entry in entries[:6]:
            if len(entry) < 6:
                continue
            certifications.append({"name": entry[:80], "issuer": "", "date_obtained": ""})

    return certifications
