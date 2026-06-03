from __future__ import annotations

from dataclasses import dataclass, field
from threading import RLock
from typing import Any


@dataclass(slots=True)
class SkillDefinition:
    name: str
    category: str
    description: str
    metadata: dict[str, Any] = field(default_factory=dict)


class SkillManager:
    def __init__(self) -> None:
        self._lock = RLock()
        self._skills: dict[str, SkillDefinition] = {}

    def register(self, skill: SkillDefinition) -> None:
        key = skill.name.strip().lower()
        if not key:
            raise ValueError("skill name cannot be empty")

        with self._lock:
            self._skills[key] = skill

    def get(self, name: str) -> SkillDefinition | None:
        key = name.strip().lower()
        with self._lock:
            return self._skills.get(key)

    def list_skills(self) -> list[SkillDefinition]:
        with self._lock:
            return list(self._skills.values())
