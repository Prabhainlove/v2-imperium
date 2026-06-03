from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from .analyzer import StaticAnalyzer
from .debugger import Debugger
from .generator import CodeGenerator
from .models import ImprovementIteration
from .sandbox import ExecutionSandbox


@dataclass(slots=True)
class SelfImprovementLoop:
    """Iteratively stabilizes generated code with analyze-debug-refine cycles."""

    analyzer: StaticAnalyzer
    debugger: Debugger
    generator: CodeGenerator
    sandbox: ExecutionSandbox
    max_iterations: int = 4

    async def stabilize(
        self,
        *,
        changed_files: Iterable[str | Path],
        validation_commands: list[str] | None,
        cwd: str | Path,
    ) -> dict[str, Any]:
        tracked_files = self._normalize_files(changed_files)
        commands = list(validation_commands or [])
        if not commands:
            commands = self.sandbox.build_python_compile_commands(tracked_files)

        iterations: list[ImprovementIteration] = []
        stabilized = False

        for iteration in range(1, self.max_iterations + 1):
            issues = self.analyzer.analyze_files(tracked_files)
            command_results = await self.sandbox.run_commands(
                commands,
                cwd=cwd,
                timeout_per_command=180,
            )

            insights = self.debugger.derive_insights(
                issues=issues,
                command_results=command_results,
            )

            has_critical_issue = any(
                item.severity in {"error", "critical"} for item in issues
            )
            has_failed_command = any(not result.succeeded for result in command_results)

            iteration_report = ImprovementIteration(
                iteration=iteration,
                analysis_issues=issues,
                command_results=command_results,
                insights=insights,
                stabilized=not has_critical_issue and not has_failed_command,
            )

            if iteration_report.stabilized:
                iterations.append(iteration_report)
                stabilized = True
                break

            fixes = self.debugger.apply_automatic_fixes(
                insights=insights,
                generator=self.generator,
            )
            iteration_report.applied_fixes = fixes
            iterations.append(iteration_report)

            if not fixes:
                # No more deterministic fixes available.
                break

            for fix in fixes:
                path = fix.get("path")
                if path:
                    tracked_files.add(Path(path).resolve())

        return {
            "stabilized": stabilized,
            "iterations": [self._serialize_iteration(item) for item in iterations],
            "tracked_files": sorted(str(path) for path in tracked_files),
            "final_command_set": commands,
        }

    def _normalize_files(self, files: Iterable[str | Path]) -> set[Path]:
        normalized: set[Path] = set()
        for item in files:
            path = Path(item)
            if path.exists() and path.is_file():
                normalized.add(path.resolve())
        return normalized

    def _serialize_iteration(self, iteration: ImprovementIteration) -> dict[str, Any]:
        return {
            "iteration": iteration.iteration,
            "analysis_issues": [
                {
                    "severity": issue.severity,
                    "category": issue.category,
                    "message": issue.message,
                    "file_path": issue.file_path,
                    "line": issue.line,
                    "column": issue.column,
                    "hint": issue.hint,
                }
                for issue in iteration.analysis_issues
            ],
            "command_results": [
                {
                    "command": result.command,
                    "cwd": result.cwd,
                    "return_code": result.return_code,
                    "timed_out": result.timed_out,
                    "stdout": result.stdout,
                    "stderr": result.stderr,
                }
                for result in iteration.command_results
            ],
            "insights": [
                {
                    "root_cause": insight.root_cause,
                    "confidence": insight.confidence,
                    "suggested_fix": insight.suggested_fix,
                    "target_file": insight.target_file,
                    "target_line": insight.target_line,
                }
                for insight in iteration.insights
            ],
            "applied_fixes": iteration.applied_fixes,
            "stabilized": iteration.stabilized,
        }
