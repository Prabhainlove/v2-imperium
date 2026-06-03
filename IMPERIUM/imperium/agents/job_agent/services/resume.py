from __future__ import annotations

import asyncio
import logging
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from ..models import CandidateProfile, GeneratedDocument, JobListing, MatchResult, normalize_str_list
from .analysis import ApplicationDecision
from .llm_client import OpenAICompatibleLLMClient


logger = logging.getLogger(__name__)


class ATSResumeGenerator:
    """Builds ATS-optimized plain-text resumes for each target job."""

    def generate_resume_text(
        self,
        *,
        profile: CandidateProfile,
        listing: JobListing,
        match: MatchResult,
    ) -> str:
        keyword_set = self._extract_keywords(listing.description, listing.required_skills)

        summary = (
            f"{profile.name} is a results-driven professional aligned to the {listing.title} "
            f"role at {listing.company}. Focus areas include {', '.join(keyword_set[:8])}."
        )

        lines: list[str] = []
        lines.append(profile.name)
        lines.append("Contact")
        lines.append(f"Email: {profile.contact.email}")
        if profile.contact.phone:
            lines.append(f"Phone: {profile.contact.phone}")
        if profile.contact.location:
            lines.append(f"Location: {profile.contact.location}")
        if profile.linkedin_profile:
            lines.append(f"LinkedIn: {profile.linkedin_profile}")
        if profile.github_repositories:
            lines.append(f"GitHub: {profile.github_repositories[0]}")

        lines.append("")
        lines.append("Professional Summary")
        lines.append(summary)

        lines.append("")
        lines.append("Technical Skills")
        prioritized_skills = self._prioritize_skills(profile.skills, keyword_set)
        lines.append(", ".join(prioritized_skills))

        lines.append("")
        lines.append("Work Experience")
        for item in profile.work_experience:
            lines.append(f"{item.title} | {item.company}")
            for achievement in item.achievements[:4]:
                lines.append(f"- {self._inject_keywords(achievement, keyword_set)}")

        lines.append("")
        lines.append("Projects")
        for project in profile.projects:
            lines.append(f"{project.name}: {self._inject_keywords(project.description, keyword_set)}")
            if project.technologies:
                lines.append(f"Technologies: {', '.join(project.technologies)}")

        lines.append("")
        lines.append("Education")
        for item in profile.education:
            base = f"{item.degree}"
            if item.field_of_study:
                base = f"{base}, {item.field_of_study}"
            lines.append(f"{base} - {item.institution}")

        lines.append("")
        lines.append("Certifications")
        if profile.certifications:
            for cert in profile.certifications:
                line = cert.name
                if cert.issuer:
                    line = f"{line} ({cert.issuer})"
                lines.append(line)
        else:
            lines.append("None listed")

        lines.append("")
        lines.append("Target Role Alignment")
        lines.append(f"Match score for this role: {match.score}")
        lines.append("Matched skills: " + (", ".join(match.matched_skills) if match.matched_skills else "None detected"))
        lines.append("Missing skills being addressed: " + (", ".join(match.missing_skills) if match.missing_skills else "None"))

        return "\n".join(lines).strip() + "\n"

    def write_resume(
        self,
        *,
        content: str,
        output_dir: Path,
        company: str,
        job_title: str,
    ) -> GeneratedDocument:
        output_dir.mkdir(parents=True, exist_ok=True)
        filename = f"resume_{self._slug(company)}_{self._slug(job_title)}.txt"
        path = output_dir / filename
        path.write_text(content, encoding="utf-8")
        return GeneratedDocument(path=str(path), content=content, mime_type="text/plain")

    def _extract_keywords(self, description: str, required_skills: Iterable[str]) -> list[str]:
        keywords = normalize_str_list(required_skills)
        token_pattern = re.compile(r"\b[a-zA-Z][a-zA-Z0-9+/.-]{2,}\b")

        frequencies: dict[str, int] = {}
        for token in token_pattern.findall(description):
            normalized = token.lower()
            if normalized in {"the", "and", "with", "for", "that", "this", "you", "your"}:
                continue
            frequencies[normalized] = frequencies.get(normalized, 0) + 1

        ranked = sorted(frequencies.items(), key=lambda item: item[1], reverse=True)
        for token, _ in ranked[:20]:
            if token not in [item.lower() for item in keywords]:
                keywords.append(token)

        return keywords[:20]

    def _prioritize_skills(self, profile_skills: Iterable[str], keywords: Iterable[str]) -> list[str]:
        profile_skill_list = normalize_str_list(profile_skills)
        keyword_set = {word.lower() for word in keywords}

        matching = [skill for skill in profile_skill_list if skill.lower() in keyword_set]
        remaining = [skill for skill in profile_skill_list if skill.lower() not in keyword_set]
        return (matching + remaining)[:24]

    @staticmethod
    def _inject_keywords(text: str, keywords: list[str]) -> str:
        sentence = text.strip()
        if not sentence:
            return sentence

        lower_sentence = sentence.lower()
        for keyword in keywords[:6]:
            if keyword.lower() in lower_sentence:
                return sentence

        if keywords:
            return f"{sentence} (Relevant: {keywords[0]})"
        return sentence

    @staticmethod
    def _slug(value: str) -> str:
        lowered = value.lower().strip()
        normalized = re.sub(r"[^a-z0-9]+", "_", lowered)
        return normalized.strip("_") or "job"


@dataclass(slots=True)
class ResumeOptimizationResult:
    resume_text: str
    source: str
    notes: list[str]
    raw: dict[str, Any] | None = None


class ResumeOptimizer:
    def __init__(self, llm_client: OpenAICompatibleLLMClient | None = None) -> None:
        self._llm = llm_client or OpenAICompatibleLLMClient()

    async def optimize_resume_text(
        self,
        *,
        profile: CandidateProfile,
        listing: JobListing,
        match: MatchResult,
        base_resume_text: str,
        decision: ApplicationDecision | None = None,
    ) -> ResumeOptimizationResult:
        if self._llm.enabled:
            try:
                messages = [
                    {
                        "role": "system",
                        "content": "You are an expert resume writer. Return ONLY valid JSON. No markdown.",
                    },
                    {
                        "role": "user",
                        "content": (
                            "Rewrite the candidate's Professional Summary line to better fit the role. "
                            "Keep it 1-2 sentences, factual, and ATS-friendly. Output JSON with: "
                            "summary (string), notes (array of strings).\n\n"
                            f"ROLE: {listing.title} at {listing.company}\n"
                            f"KEYWORDS: {', '.join((listing.required_skills or [])[:12])}\n"
                            f"MATCH_SCORE: {match.score}\n"
                            f"MISSING_SKILLS: {', '.join((match.missing_skills or [])[:10])}\n"
                            f"CURRENT_SUMMARY_LINE: {extract_summary_line(base_resume_text)}\n"
                        ),
                    },
                ]

                def _call_llm() -> dict[str, Any]:
                    return self._llm.chat_json(messages=messages, max_tokens=220, temperature=0.1)

                payload = await asyncio.to_thread(_call_llm)
                summary = str(payload.get("summary", "")).strip()
                if summary:
                    updated = replace_summary_line(base_resume_text, summary)
                    notes = [str(item).strip() for item in payload.get("notes", []) if str(item).strip()]
                    return ResumeOptimizationResult(
                        resume_text=updated,
                        source="llm_summary_rewrite",
                        notes=notes[:8],
                        raw=payload,
                    )
            except Exception as exc:
                logger.warning("Resume LLM optimization failed; falling back. error=%s", exc)

        notes: list[str] = []
        if decision:
            notes.append(f"Decision: {decision.decision_reason}")
            if decision.recommended_customizations:
                notes.extend(decision.recommended_customizations[:6])
        else:
            if match.matched_skills:
                notes.append(f"Emphasize: {', '.join(match.matched_skills[:6])}")
            if match.missing_skills:
                notes.append(f"Address gaps: {', '.join(match.missing_skills[:6])}")

        optimized = append_customization_notes(base_resume_text, notes)
        return ResumeOptimizationResult(
            resume_text=optimized,
            source="heuristic_notes",
            notes=notes[:10],
            raw=None,
        )


def extract_summary_line(resume_text: str) -> str:
    lines = [line.rstrip() for line in resume_text.splitlines()]
    for idx, line in enumerate(lines):
        if line.strip().lower() == "professional summary" and idx + 1 < len(lines):
            return lines[idx + 1].strip()
    return ""


def replace_summary_line(resume_text: str, new_summary: str) -> str:
    lines = resume_text.splitlines()
    for idx, line in enumerate(lines):
        if line.strip().lower() == "professional summary" and idx + 1 < len(lines):
            lines[idx + 1] = new_summary.strip()
            return "\n".join(lines).strip() + "\n"
    return resume_text


def append_customization_notes(resume_text: str, notes: list[str]) -> str:
    cleaned = [note.strip() for note in notes if note and note.strip()]
    if not cleaned:
        return resume_text

    lines: list[str] = []
    lines.extend(resume_text.rstrip().splitlines())
    lines.append("")
    lines.append("Customization Notes")
    for note in cleaned[:10]:
        lines.append(f"- {note}")
    return "\n".join(lines).strip() + "\n"


class CoverLetterGenerator:
    """Generates tailored cover letters from candidate and job context."""

    def generate_cover_letter(
        self,
        *,
        profile: CandidateProfile,
        listing: JobListing,
        match: MatchResult,
    ) -> str:
        matched_skills = ", ".join(match.matched_skills[:6]) if match.matched_skills else "relevant technical capabilities"
        top_achievement = self._top_achievement(profile)

        lines = [
            f"Dear Hiring Team at {listing.company},",
            "",
            (
                f"I am excited to apply for the {listing.title} role. My background aligns strongly "
                f"with your requirements, especially in {matched_skills}."
            ),
            "",
            (
                f"One result I am proud of: {top_achievement}. This reflects the ownership and execution "
                "discipline I bring to high-impact roles."
            ),
            "",
            (
                f"Your focus on {listing.title} outcomes and modern engineering standards is compelling. "
                "I would welcome the opportunity to contribute immediately and grow with your team."
            ),
            "",
            "Thank you for your consideration.",
            "",
            f"Sincerely,\n{profile.name}",
            f"Email: {profile.contact.email}",
        ]
        return "\n".join(lines).strip() + "\n"

    @staticmethod
    def _top_achievement(profile: CandidateProfile) -> str:
        for role in profile.work_experience:
            if role.achievements:
                return role.achievements[0]
        for project in profile.projects:
            if project.description:
                return project.description
        return "Built and delivered measurable improvements across cross-functional technical projects"


try:
    from reportlab.lib import colors
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
    from reportlab.lib.units import inch
    from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer

    REPORTLAB_AVAILABLE = True
except ImportError:
    REPORTLAB_AVAILABLE = False


class PDFResumeGenerator:
    """Generates professional PDF resumes with reportlab when available."""

    def __init__(self) -> None:
        self.has_pdf = REPORTLAB_AVAILABLE

    def generate_resume(
        self,
        *,
        profile: Any,
        job_listing: Any,
        match: Any,
        output_path: Path,
    ) -> Path:
        if self.has_pdf:
            return self._generate_pdf(profile, job_listing, match, output_path)
        return self._generate_text(profile, job_listing, match, output_path)

    def _generate_pdf(self, profile, job_listing, match, output_path: Path) -> Path:
        pdf_path = output_path.with_suffix(".pdf")
        pdf_path.parent.mkdir(parents=True, exist_ok=True)

        template = getattr(getattr(profile, "preferences", None), "resume_template", "modern")

        if template == "ats":
            return self._generate_ats_template(profile, job_listing, match, pdf_path)
        if template == "classic":
            return self._generate_classic_template(profile, job_listing, match, pdf_path)
        if template == "creative":
            return self._generate_creative_template(profile, job_listing, match, pdf_path)
        return self._generate_modern_template(profile, job_listing, match, pdf_path)

    def _generate_modern_template(self, profile, job_listing, match, pdf_path: Path) -> Path:
        pdf_path.parent.mkdir(parents=True, exist_ok=True)

        doc = SimpleDocTemplate(
            str(pdf_path),
            pagesize=letter,
            rightMargin=0.75 * inch,
            leftMargin=0.75 * inch,
            topMargin=0.75 * inch,
            bottomMargin=0.75 * inch,
        )

        story = []
        styles = getSampleStyleSheet()

        title_style = ParagraphStyle(
            "CustomTitle",
            parent=styles["Heading1"],
            fontSize=24,
            textColor=colors.HexColor("#1a1a1a"),
            spaceAfter=6,
            alignment=1,
        )

        heading_style = ParagraphStyle(
            "CustomHeading",
            parent=styles["Heading2"],
            fontSize=14,
            textColor=colors.HexColor("#2c3e50"),
            spaceAfter=6,
            spaceBefore=12,
            borderWidth=0,
            borderColor=colors.HexColor("#3498db"),
            borderPadding=0,
        )

        story.append(Paragraph(profile.name.upper(), title_style))

        contact_text = f"{profile.contact.email} | {profile.contact.phone}"
        if profile.contact.location:
            contact_text += f" | {profile.contact.location}"
        story.append(Paragraph(contact_text, styles["Normal"]))
        story.append(Spacer(1, 0.2 * inch))

        story.append(Paragraph("PROFESSIONAL SUMMARY", heading_style))
        summary = self._generate_summary(profile, job_listing, match)
        story.append(Paragraph(summary, styles["Normal"]))
        story.append(Spacer(1, 0.15 * inch))

        story.append(Paragraph("TECHNICAL SKILLS", heading_style))
        skills_text = " • ".join(profile.skills[:15])
        story.append(Paragraph(skills_text, styles["Normal"]))
        story.append(Spacer(1, 0.15 * inch))

        def _attr(obj, key, default=""):
            if isinstance(obj, dict):
                return obj.get(key, default)
            return getattr(obj, key, default)

        if profile.work_experience:
            story.append(Paragraph("WORK EXPERIENCE", heading_style))
            for exp in profile.work_experience[:3]:
                title = _attr(exp, "title", "Position")
                company = _attr(exp, "company", "Company")
                exp_title = f"<b>{title}</b> | {company}"
                story.append(Paragraph(exp_title, styles["Normal"]))

                start = _attr(exp, "start_date", "")
                end = _attr(exp, "end_date", "")
                duration = _attr(exp, "duration", "") or " – ".join(x for x in (start, end) if x)
                if duration:
                    story.append(Paragraph(f"<i>{duration}</i>", styles["Normal"]))

                achievements = _attr(exp, "achievements", []) or []
                desc = _attr(exp, "description", "")
                if desc:
                    story.append(Paragraph(f"• {desc}", styles["Normal"]))
                for ach in achievements[:5]:
                    story.append(Paragraph(f"• {ach}", styles["Normal"]))

                story.append(Spacer(1, 0.1 * inch))

        if profile.education:
            story.append(Paragraph("EDUCATION", heading_style))
            for edu in profile.education:
                degree = _attr(edu, "degree", "Degree")
                institution = _attr(edu, "institution", "Institution")
                edu_text = f"<b>{degree}</b> | {institution}"
                year = _attr(edu, "year", "") or _attr(edu, "end_date", "")
                if year:
                    edu_text += f" | {year}"
                story.append(Paragraph(edu_text, styles["Normal"]))
                story.append(Spacer(1, 0.05 * inch))

        if profile.projects:
            story.append(Spacer(1, 0.1 * inch))
            story.append(Paragraph("KEY PROJECTS", heading_style))
            for proj in profile.projects[:3]:
                proj_title = f"<b>{_attr(proj, 'name', 'Project')}</b>"
                story.append(Paragraph(proj_title, styles["Normal"]))
                proj_desc = _attr(proj, "description", "")
                if proj_desc:
                    story.append(Paragraph(f"• {proj_desc}", styles["Normal"]))
                story.append(Spacer(1, 0.05 * inch))

        doc.build(story)
        return pdf_path

    def _generate_text(self, profile, job_listing, match, output_path: Path) -> Path:
        txt_path = output_path.with_suffix(".txt")
        txt_path.parent.mkdir(parents=True, exist_ok=True)

        lines = []
        lines.append("=" * 70)
        lines.append(profile.name.upper().center(70))
        lines.append("=" * 70)
        lines.append(f"{profile.contact.email} | {profile.contact.phone}")
        if profile.contact.location:
            lines.append(f"Location: {profile.contact.location}")
        lines.append("")

        lines.append("PROFESSIONAL SUMMARY")
        lines.append("-" * 70)
        lines.append(self._generate_summary(profile, job_listing, match))
        lines.append("")

        lines.append("TECHNICAL SKILLS")
        lines.append("-" * 70)
        lines.append(", ".join(profile.skills[:15]))
        lines.append("")

        if profile.work_experience:
            lines.append("WORK EXPERIENCE")
            lines.append("-" * 70)
            for exp in profile.work_experience[:3]:
                lines.append(f"\n{exp.get('title', 'Position')} | {exp.get('company', 'Company')}")
                if exp.get("duration"):
                    lines.append(f"{exp['duration']}")
                if exp.get("description"):
                    lines.append(f"• {exp['description']}")
            lines.append("")

        if profile.education:
            lines.append("EDUCATION")
            lines.append("-" * 70)
            for edu in profile.education:
                lines.append(f"{edu.get('degree', 'Degree')} | {edu.get('institution', 'Institution')}")
                if edu.get("year"):
                    lines.append(f"Year: {edu['year']}")
            lines.append("")

        txt_path.write_text("\n".join(lines), encoding="utf-8")
        return txt_path

    def _generate_summary(self, profile, job_listing, match) -> str:
        years_exp = len(profile.work_experience) if profile.work_experience else 0
        summary = f"Results-driven professional with {years_exp}+ years of experience in "

        matched_skills = match.matched_skills[:3] if hasattr(match, "matched_skills") else profile.skills[:3]
        summary += ", ".join(matched_skills)

        summary += ". Proven track record in delivering high-quality solutions. "
        summary += f"Seeking {job_listing.title} position at {job_listing.company} "
        summary += "to leverage expertise and drive impactful results."

        return summary

    def _generate_ats_template(self, profile, job_listing, match, pdf_path: Path) -> Path:
        return self._generate_modern_template(profile, job_listing, match, pdf_path)

    def _generate_classic_template(self, profile, job_listing, match, pdf_path: Path) -> Path:
        return self._generate_modern_template(profile, job_listing, match, pdf_path)

    def _generate_creative_template(self, profile, job_listing, match, pdf_path: Path) -> Path:
        return self._generate_modern_template(profile, job_listing, match, pdf_path)
