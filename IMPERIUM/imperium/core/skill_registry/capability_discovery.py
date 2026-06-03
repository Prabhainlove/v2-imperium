from __future__ import annotations

from typing import Iterable


class CapabilityDiscovery:
    def detect_missing_skills(
        self,
        required_skills: Iterable[str],
        available_skills: Iterable[str],
    ) -> list[str]:
        available = {skill.strip().lower() for skill in available_skills if skill.strip()}
        missing: list[str] = []

        for skill in required_skills:
            normalized = skill.strip().lower()
            if normalized and normalized not in available:
                missing.append(normalized)

        return sorted(set(missing))
