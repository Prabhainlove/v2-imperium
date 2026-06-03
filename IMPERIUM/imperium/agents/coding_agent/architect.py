from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from .models import WorkspaceSnapshot


@dataclass(slots=True)
class CodeArchitect:
    """Builds a high-level software architecture for the current coding task."""

    def design(
        self,
        task: dict[str, Any],
        snapshot: WorkspaceSnapshot,
    ) -> dict[str, Any]:
        query = str(task.get("query", "")).strip()
        target_paths = [str(item) for item in task.get("target_paths", []) if item]

        file_extensions: dict[str, int] = {}
        for rel_path in snapshot.files:
            ext = rel_path.rsplit(".", maxsplit=1)[-1].lower() if "." in rel_path else ""
            file_extensions[ext] = file_extensions.get(ext, 0) + 1

        dominant_languages = self._dominant_languages(file_extensions)

        architectural_modules = [
            {
                "name": "Code Architect",
                "responsibility": "Define module boundaries and integration strategy",
            },
            {
                "name": "Task Planner",
                "responsibility": "Convert high-level task into deterministic implementation steps",
            },
            {
                "name": "Code Generator",
                "responsibility": "Create and modify source code across files",
            },
            {
                "name": "Static Analyzer",
                "responsibility": "Detect syntax, quality, security, and performance issues",
            },
            {
                "name": "Debugger",
                "responsibility": "Interpret failures and drive corrective actions",
            },
            {
                "name": "Refactor Engine",
                "responsibility": "Improve maintainability and reduce code duplication",
            },
            {
                "name": "Execution Sandbox",
                "responsibility": "Execute validation commands in an isolated process scope",
            },
            {
                "name": "Self-Improvement Loop",
                "responsibility": "Iteratively stabilize generated code until failures are resolved",
            },
        ]

        return {
            "task_intent": query,
            "workspace_root": str(snapshot.root),
            "target_paths": target_paths,
            "repository_facts": {
                "file_count": len(snapshot.files),
                "dominant_languages": dominant_languages,
            },
            "architecture": {
                "modules": architectural_modules,
                "execution_contract": "async execute(task: dict) -> dict",
                "orchestration_mode": "imperium-core-controlled",
                "excluded_conflicting_surfaces": [
                    "standalone CLI runners",
                    "web dashboards",
                    "deployment-specific orchestration",
                    "external service auto-bindings",
                ],
            },
        }

    @staticmethod
    def _dominant_languages(file_extensions: dict[str, int]) -> list[str]:
        extension_to_language = {
            "py": "python",
            "ts": "typescript",
            "tsx": "typescript",
            "js": "javascript",
            "jsx": "javascript",
            "go": "go",
            "rs": "rust",
            "java": "java",
            "cs": "csharp",
            "cpp": "cpp",
            "c": "c",
            "rb": "ruby",
            "php": "php",
            "scala": "scala",
            "kt": "kotlin",
        }

        scored = sorted(file_extensions.items(), key=lambda item: item[1], reverse=True)
        languages: list[str] = []
        for ext, _count in scored:
            language = extension_to_language.get(ext)
            if not language:
                continue
            if language in languages:
                continue
            languages.append(language)
            if len(languages) >= 5:
                break
        return languages
