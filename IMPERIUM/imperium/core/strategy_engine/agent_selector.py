from __future__ import annotations

from typing import Any

from core.common import AgentDescriptor


class AgentSelector:
    def select(
        self,
        *,
        required_capabilities: list[str],
        agents: list[AgentDescriptor],
        agent_performance: dict[str, dict[str, float | int]] | None = None,
        max_agents: int = 4,
        requested_agents: list[str] | None = None,
    ) -> list[str]:
        # If specific agents are requested, use them directly
        if requested_agents:
            available_names = {agent.name.lower() for agent in agents if agent.status.lower() in {"online", "ready", "available"}}
            selected = []
            for requested in requested_agents:
                # Try exact match first
                if requested.lower() in available_names:
                    # Find the actual agent name (with correct casing)
                    for agent in agents:
                        if agent.name.lower() == requested.lower():
                            selected.append(agent.name)
                            break
                # Try alias match
                else:
                    for agent in agents:
                        if hasattr(agent, 'metadata') and isinstance(agent.metadata, dict):
                            aliases = agent.metadata.get('aliases', [])
                            if requested.lower() in [a.lower() for a in aliases]:
                                selected.append(agent.name)
                                break
            
            if selected:
                return selected[:max_agents]
        
        # Otherwise, use capability-based selection
        performance = {
            key.lower(): value for key, value in dict(agent_performance or {}).items()
        }

        scored: list[tuple[float, str]] = []
        for agent in agents:
            capability_set = {item.lower() for item in agent.capabilities}
            overlap = len(set(required_capabilities).intersection(capability_set))
            if overlap == 0:
                continue

            base = overlap / max(1, len(required_capabilities))
            perf = performance.get(agent.name.lower(), {})
            success_rate = float(perf.get("success_rate", 0.5))
            avg_latency = float(perf.get("average_latency", 0.0))
            latency_penalty = min(0.3, avg_latency / 300)

            score = base + (0.4 * success_rate) - latency_penalty
            scored.append((score, agent.name))

        if not scored:
            fallback = [agent.name for agent in agents if agent.status.lower() in {"online", "ready", "available"}]
            return fallback[: max(1, max_agents)]

        scored.sort(key=lambda row: row[0], reverse=True)
        return [name for _, name in scored[: max(1, max_agents)]]
