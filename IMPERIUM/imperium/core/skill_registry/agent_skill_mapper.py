from __future__ import annotations

from collections import defaultdict
from threading import RLock


class AgentSkillMapper:
    def __init__(self) -> None:
        self._lock = RLock()
        self._mapping: dict[str, set[str]] = defaultdict(set)

    def assign(self, agent_name: str, skill_name: str) -> None:
        agent = agent_name.strip().lower()
        skill = skill_name.strip().lower()
        if not agent or not skill:
            raise ValueError("agent_name and skill_name are required")

        with self._lock:
            self._mapping[agent].add(skill)

    def unassign(self, agent_name: str, skill_name: str) -> None:
        agent = agent_name.strip().lower()
        skill = skill_name.strip().lower()
        if not agent or not skill:
            return

        with self._lock:
            self._mapping[agent].discard(skill)

    def get_skills(self, agent_name: str) -> list[str]:
        agent = agent_name.strip().lower()
        with self._lock:
            return sorted(self._mapping.get(agent, set()))

    def all_assignments(self) -> dict[str, list[str]]:
        with self._lock:
            return {agent: sorted(skills) for agent, skills in self._mapping.items()}
