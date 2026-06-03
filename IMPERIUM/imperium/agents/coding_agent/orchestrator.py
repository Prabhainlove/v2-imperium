from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from time import perf_counter
from typing import Any
from uuid import uuid4

try:
    from agents.coding_agent.adapters import FileEditor, OpenDevinSkillBridge, RepositoryExplorer, TerminalExecutor
    from agents.coding_agent.analyzer import StaticAnalyzer
    from agents.coding_agent.architect import CodeArchitect
    from agents.coding_agent.debugger import Debugger
    from agents.coding_agent.generator import CodeGenerator
    from agents.coding_agent.improvement import SelfImprovementLoop
    from agents.coding_agent.models import CodeIssue, PlanStep, StepExecutionResult, utc_now_iso
    from agents.coding_agent.planner import TaskPlanner
    from agents.coding_agent.refactor import RefactorEngine
    from agents.coding_agent.sandbox import ExecutionSandbox
except ImportError:
    # Fallback to relative imports for standalone execution
    from .adapters import FileEditor, OpenDevinSkillBridge, RepositoryExplorer, TerminalExecutor
    from .analyzer import StaticAnalyzer
    from .architect import CodeArchitect
    from .debugger import Debugger
    from .generator import CodeGenerator
    from .improvement import SelfImprovementLoop
    from .models import CodeIssue, PlanStep, StepExecutionResult, utc_now_iso
    from .planner import TaskPlanner
    from .refactor import RefactorEngine
    from .sandbox import ExecutionSandbox


@dataclass(slots=True)
class CodingAgentConfig:
    max_snapshot_depth: int = 6
    max_snapshot_files: int = 2500
    max_self_improvement_iterations: int = 4
    enable_refactor: bool = True
    enable_legacy_opendevin_bridge: bool = False


class ImperiumCodingAgent:
    """IMPERIUM-native coding agent with autonomous software engineering loops."""

    VERSION = "3.0.0-imperium-coding"

    def __init__(self, workspace_root: str | Path | None = None, config: CodingAgentConfig | None = None):
        self.default_workspace_root = (
            Path(workspace_root).resolve()
            if workspace_root is not None
            else Path(__file__).resolve().parents[1]
        )
        self.config = config or CodingAgentConfig()

        self.code_architect = CodeArchitect()
        self.task_planner = TaskPlanner()
        self.static_analyzer = StaticAnalyzer()
        self.debugger = Debugger()
        self.refactor_engine = RefactorEngine()

    async def execute(self, task: dict[str, Any]) -> dict[str, Any]:
        started_at = utc_now_iso()
        task_id = str(task.get("task_id") or uuid4())

        if not isinstance(task, dict):
            return {
                "status": "failure",
                "task_id": task_id,
                "error": "Task must be a dictionary",
                "agent_version": self.VERSION,
            }

        workspace_root = self._resolve_workspace(task)
        runtime = self._build_runtime(workspace_root)

        step_results: list[StepExecutionResult] = []
        architecture_payload: dict[str, Any] = {}
        plan: list[PlanStep] = []
        changed_files: set[str] = set()

        try:
            # Step 1: repository analysis
            step_1_start = utc_now_iso()
            t0 = perf_counter()
            snapshot = runtime["explorer"].snapshot(
                max_depth=self.config.max_snapshot_depth,
                max_files=self.config.max_snapshot_files,
            )
            step_results.append(
                StepExecutionResult(
                    step_id="step_1_repository_analysis",
                    title="Analyze Repository",
                    subsystem="Task Planner",
                    status="completed",
                    started_at=step_1_start,
                    finished_at=utc_now_iso(),
                    details={
                        "workspace_root": str(snapshot.root),
                        "file_count": len(snapshot.files),
                        "sampled_files": list(snapshot.sampled_file_contents.keys()),
                        "duration_seconds": round(perf_counter() - t0, 6),
                    },
                )
            )

            # Step 2: architecture design
            step_2_start = utc_now_iso()
            t1 = perf_counter()
            architecture_payload = self.code_architect.design(task, snapshot)
            plan = self.task_planner.create_plan(task, architecture_payload)
            step_results.append(
                StepExecutionResult(
                    step_id="step_2_architecture",
                    title="Architect Solution",
                    subsystem="Code Architect",
                    status="completed",
                    started_at=step_2_start,
                    finished_at=utc_now_iso(),
                    details={
                        "dominant_languages": architecture_payload.get("repository_facts", {}).get(
                            "dominant_languages", []
                        ),
                        "plan_steps": [item.step_id for item in plan],
                        "duration_seconds": round(perf_counter() - t1, 6),
                    },
                )
            )

            # Step 3: generate/modify code
            step_3_start = utc_now_iso()
            t2 = perf_counter()
            explicit_edits = runtime["generator"].apply_explicit_edits(task)
            generated_files = runtime["generator"].generate_from_blueprint(task, architecture_payload)

            for file_path in explicit_edits.get("changed_files", []):
                changed_files.add(str(Path(file_path).resolve()))
            for file_path in generated_files.get("changed_files", []):
                changed_files.add(str(Path(file_path).resolve()))

            generation_errors = explicit_edits.get("errors", []) + generated_files.get("errors", [])
            generation_status = "completed" if not generation_errors else "partial"

            step_results.append(
                StepExecutionResult(
                    step_id="step_3_generate_or_modify",
                    title="Generate or Modify Code",
                    subsystem="Code Generator",
                    status=generation_status,
                    started_at=step_3_start,
                    finished_at=utc_now_iso(),
                    details={
                        "explicit_edits": explicit_edits,
                        "generated_files": generated_files,
                        "duration_seconds": round(perf_counter() - t2, 6),
                    },
                )
            )

            # Step 4: static analysis before runtime execution
            step_4_start = utc_now_iso()
            t3 = perf_counter()
            analysis_targets = self._resolve_analysis_targets(task, changed_files, snapshot.files, workspace_root)
            pre_analysis_issues = self.static_analyzer.analyze_files(analysis_targets)
            step_results.append(
                StepExecutionResult(
                    step_id="step_4_static_analysis",
                    title="Run Static Analysis",
                    subsystem="Static Analyzer",
                    status="completed",
                    started_at=step_4_start,
                    finished_at=utc_now_iso(),
                    details={
                        "issue_count": len(pre_analysis_issues),
                        "critical_issue_count": sum(
                            1
                            for issue in pre_analysis_issues
                            if issue.severity in {"error", "critical"}
                        ),
                        "duration_seconds": round(perf_counter() - t3, 6),
                    },
                )
            )

            # Step 5: sandbox execution + self improvement loop
            step_5_start = utc_now_iso()
            t4 = perf_counter()
            validation_commands = self._resolve_validation_commands(task)
            if changed_files or validation_commands:
                stabilization_targets = (
                    [Path(item).resolve() for item in sorted(changed_files)]
                    if changed_files
                    else analysis_targets
                )
                improvement_loop = SelfImprovementLoop(
                    analyzer=self.static_analyzer,
                    debugger=self.debugger,
                    generator=runtime["generator"],
                    sandbox=runtime["sandbox"],
                    max_iterations=self.config.max_self_improvement_iterations,
                )
                stabilization_report = await improvement_loop.stabilize(
                    changed_files=stabilization_targets,
                    validation_commands=validation_commands,
                    cwd=workspace_root,
                )
            else:
                stabilization_report = {
                    "stabilized": True,
                    "iterations": [],
                    "tracked_files": [],
                    "final_command_set": [],
                    "skipped": True,
                }

            for iteration in stabilization_report.get("iterations", []):
                applied_fixes = iteration.get("applied_fixes", [])
                if not isinstance(applied_fixes, list):
                    continue
                for fix in applied_fixes:
                    if not isinstance(fix, dict):
                        continue
                    path = fix.get("path")
                    if not path:
                        continue
                    changed_files.add(str(Path(path).resolve()))

            step_results.append(
                StepExecutionResult(
                    step_id="step_5_sandbox_execution",
                    title="Execute in Sandbox",
                    subsystem="Self-Improvement Loop",
                    status="completed" if stabilization_report.get("stabilized") else "partial",
                    started_at=step_5_start,
                    finished_at=utc_now_iso(),
                    details={
                        "stabilization_report": stabilization_report,
                        "duration_seconds": round(perf_counter() - t4, 6),
                    },
                )
            )

            # Step 6: final refactor pass
            step_6_start = utc_now_iso()
            t5 = perf_counter()
            refactor_changes: list[dict[str, Any]] = []
            if self.config.enable_refactor and changed_files:
                refactor_changes = self.refactor_engine.refine_files(sorted(changed_files))
                for change in refactor_changes:
                    path = change.get("path")
                    if path:
                        changed_files.add(str(Path(path).resolve()))

            final_issues = self.static_analyzer.analyze_files(sorted(changed_files))
            critical_remaining = self._critical_issue_count(final_issues)
            step_results.append(
                StepExecutionResult(
                    step_id="step_6_refactor_and_finalize",
                    title="Refactor and Finalize",
                    subsystem="Refactor Engine",
                    status="completed" if critical_remaining == 0 else "partial",
                    started_at=step_6_start,
                    finished_at=utc_now_iso(),
                    details={
                        "refactor_changes": refactor_changes,
                        "final_issue_count": len(final_issues),
                        "final_critical_issue_count": critical_remaining,
                        "duration_seconds": round(perf_counter() - t5, 6),
                    },
                )
            )

            status = self._final_status(
                generation_errors=bool(generation_errors),
                critical_remaining=critical_remaining,
                stabilized=bool(stabilization_report.get("stabilized")),
            )

            return {
                "status": status,
                "task_id": task_id,
                "agent_type": "coding",
                "agent_version": self.VERSION,
                "workspace_root": str(workspace_root),
                "query": str(task.get("query", "")).strip(),
                "architecture": architecture_payload,
                "plan": [self._serialize_plan_step(item) for item in plan],
                "execution": {
                    "steps": [self._serialize_step_result(item) for item in step_results],
                    "changed_files": sorted(changed_files),
                    "conflicting_infrastructure_excluded": [
                        "standalone CLI runners",
                        "web dashboards",
                        "deployment infrastructure",
                        "external service bindings",
                    ],
                    "legacy_opendevin_capabilities": {
                        "repo_ops_bridge_available": runtime["bridge"].repo_ops_available,
                        "file_editor_bridge_available": runtime["bridge"].file_editor_available,
                    },
                },
                "quality": {
                    "pre_analysis_issues": [self._serialize_issue(item) for item in pre_analysis_issues],
                    "final_analysis_issues": [self._serialize_issue(item) for item in final_issues],
                    "stabilized": bool(stabilization_report.get("stabilized")),
                    "self_improvement_iterations": stabilization_report.get("iterations", []),
                },
                "capabilities": self.get_capabilities(),
                "started_at": started_at,
                "finished_at": utc_now_iso(),
            }

        except Exception as exc:
            return {
                "status": "failure",
                "task_id": task_id,
                "agent_type": "coding",
                "agent_version": self.VERSION,
                "workspace_root": str(workspace_root),
                "error": str(exc),
                "error_type": type(exc).__name__,
                "partial_steps": [self._serialize_step_result(item) for item in step_results],
                "started_at": started_at,
                "finished_at": utc_now_iso(),
            }

    def get_capabilities(self) -> dict[str, Any]:
        return {
            "agent_type": "coding",
            "version": self.VERSION,
            "entrypoint": "async execute(task: dict) -> dict",
            "core_subsystems": [
                "Code Architect",
                "Task Planner",
                "Code Generator",
                "Static Analyzer",
                "Debugger",
                "Refactor Engine",
                "Execution Sandbox",
                "Self-Improvement Loop",
            ],
            "engineering_capabilities": {
                "repository_exploration": True,
                "terminal_execution": True,
                "code_editing": True,
                "debugging_workflows": True,
                "tool_execution": True,
                "multi_file_generation": True,
                "legacy_code_refactoring": True,
            },
            "adaptive_behavior": {
                "analyze_error": True,
                "identify_root_cause": True,
                "rewrite_affected_code": True,
                "reexecute_until_stable": True,
            },
        }

    def _build_runtime(self, workspace_root: Path) -> dict[str, Any]:
        bridge = OpenDevinSkillBridge(
            load_legacy=self.config.enable_legacy_opendevin_bridge
        )
        explorer = RepositoryExplorer(workspace_root, bridge=bridge)
        editor = FileEditor(workspace_root)
        generator = CodeGenerator(editor=editor)
        executor = TerminalExecutor(default_cwd=workspace_root)
        sandbox = ExecutionSandbox(executor=executor)

        return {
            "bridge": bridge,
            "explorer": explorer,
            "editor": editor,
            "generator": generator,
            "executor": executor,
            "sandbox": sandbox,
        }

    def _resolve_workspace(self, task: dict[str, Any]) -> Path:
        workspace_value = task.get("workspace_path")
        if workspace_value:
            candidate = Path(str(workspace_value)).expanduser()
            if not candidate.is_absolute():
                candidate = (self.default_workspace_root / candidate).resolve()
            return candidate
        return self.default_workspace_root

    def _resolve_analysis_targets(
        self,
        task: dict[str, Any],
        changed_files: set[str],
        snapshot_files: list[str],
        workspace_root: Path,
    ) -> list[Path]:
        if changed_files:
            return [Path(path).resolve() for path in sorted(changed_files)]

        target_paths = task.get("target_paths")
        resolved: list[Path] = []
        if isinstance(target_paths, list):
            for value in target_paths:
                value_str = str(value).strip()
                if not value_str:
                    continue
                candidate = Path(value_str)
                if not candidate.is_absolute():
                    candidate = (workspace_root / candidate).resolve()
                if candidate.exists() and candidate.is_file():
                    resolved.append(candidate)

        if resolved:
            return resolved

        fallback = []
        for rel_path in snapshot_files:
            if not rel_path.endswith(".py"):
                continue
            fallback.append((workspace_root / rel_path).resolve())
            if len(fallback) >= 12:
                break
        return fallback

    def _resolve_validation_commands(self, task: dict[str, Any]) -> list[str]:
        for key in ("validation_commands", "commands", "execute_commands"):
            value = task.get(key)
            if isinstance(value, list):
                return [str(item).strip() for item in value if str(item).strip()]
        return []

    def _critical_issue_count(self, issues: list[CodeIssue]) -> int:
        return sum(1 for issue in issues if issue.severity in {"error", "critical"})

    def _final_status(
        self,
        *,
        generation_errors: bool,
        critical_remaining: int,
        stabilized: bool,
    ) -> str:
        if critical_remaining > 0:
            return "failure"
        if generation_errors or not stabilized:
            return "partial"
        return "success"

    def _serialize_plan_step(self, step: PlanStep) -> dict[str, Any]:
        return {
            "step_id": step.step_id,
            "title": step.title,
            "objective": step.objective,
            "subsystem": step.subsystem,
            "status": step.status,
            "metadata": step.metadata,
        }

    def _serialize_step_result(self, step: StepExecutionResult) -> dict[str, Any]:
        return {
            "step_id": step.step_id,
            "title": step.title,
            "subsystem": step.subsystem,
            "status": step.status,
            "started_at": step.started_at,
            "finished_at": step.finished_at,
            "details": step.details,
        }

    def _serialize_issue(self, issue: CodeIssue) -> dict[str, Any]:
        return {
            "severity": issue.severity,
            "category": issue.category,
            "message": issue.message,
            "file_path": issue.file_path,
            "line": issue.line,
            "column": issue.column,
            "hint": issue.hint,
        }
