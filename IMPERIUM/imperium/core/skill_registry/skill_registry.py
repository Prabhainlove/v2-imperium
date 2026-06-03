from __future__ import annotations

from typing import Any

from core.skill_registry.agent_skill_mapper import AgentSkillMapper
from core.skill_registry.capability_discovery import CapabilityDiscovery
from core.skill_registry.skill_manager import SkillDefinition, SkillManager


class SkillRegistry:
    def __init__(
        self,
        *,
        skill_manager: SkillManager | None = None,
        mapper: AgentSkillMapper | None = None,
        discovery: CapabilityDiscovery | None = None,
    ) -> None:
        self.skill_manager = skill_manager or SkillManager()
        self.mapper = mapper or AgentSkillMapper()
        self.discovery = discovery or CapabilityDiscovery()

    def register_skill(
        self,
        name: str,
        *,
        category: str = "general",
        description: str = "",
        metadata: dict[str, Any] | None = None,
    ) -> None:
        self.skill_manager.register(
            SkillDefinition(
                name=name,
                category=category,
                description=description,
                metadata=dict(metadata or {}),
            )
        )

    def assign_skill_to_agent(self, agent_name: str, skill_name: str) -> None:
        self.mapper.assign(agent_name, skill_name)

    def get_skills_for_agent(self, agent_name: str) -> list[str]:
        return self.mapper.get_skills(agent_name)

    def detect_missing_skills(self, required_skills: list[str]) -> list[str]:
        available_skills = [item.name for item in self.skill_manager.list_skills()]
        return self.discovery.detect_missing_skills(required_skills, available_skills)

    def snapshot(self) -> dict[str, Any]:
        return {
            "skills": [
                {
                    "name": skill.name,
                    "category": skill.category,
                    "description": skill.description,
                    "metadata": dict(skill.metadata),
                }
                for skill in self.skill_manager.list_skills()
            ],
            "agent_skill_map": self.mapper.all_assignments(),
        }
