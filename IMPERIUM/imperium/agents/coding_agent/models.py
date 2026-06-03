from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal


TaskStatus = Literal["success", "failure", "partial"]
IssueSeverity = Literal["info", "warning", "error", "critical"]


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(slots=True)
class PlanStep:
    step_id: str
    title: str
    objective: str
    subsystem: str
    status: str = "pending"
    metadata: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class StepExecutionResult:
    step_id: str
    title: str
    subsystem: str
    status: str
    started_at: str
    finished_at: str
    details: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class CommandResult:
    command: str
    cwd: str
    return_code: int
    stdout: str
    stderr: str
    timed_out: bool = False

    @property
    def succeeded(self) -> bool:
        return self.return_code == 0 and not self.timed_out


@dataclass(slots=True)
class CodeIssue:
    severity: IssueSeverity
    category: str
    message: str
    file_path: str | None = None
    line: int | None = None
    column: int | None = None
    hint: str | None = None


@dataclass(slots=True)
class DebugInsight:
    root_cause: str
    confidence: float
    suggested_fix: str
    target_file: str | None = None
    target_line: int | None = None


@dataclass(slots=True)
class WorkspaceSnapshot:
    root: Path
    files: list[str]
    sampled_file_contents: dict[str, str] = field(default_factory=dict)


@dataclass(slots=True)
class ImprovementIteration:
    iteration: int
    analysis_issues: list[CodeIssue] = field(default_factory=list)
    command_results: list[CommandResult] = field(default_factory=list)
    insights: list[DebugInsight] = field(default_factory=list)
    applied_fixes: list[dict[str, Any]] = field(default_factory=list)
    stabilized: bool = False
