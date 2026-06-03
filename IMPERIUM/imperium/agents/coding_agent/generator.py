from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
from typing import Any

from .adapters import FileEditor


@dataclass(slots=True)
class CodeGenerator:
    editor: FileEditor

    def apply_explicit_edits(self, task: dict[str, Any]) -> dict[str, Any]:
        edits = task.get("edits")
        if not isinstance(edits, list):
            edits = task.get("file_edits")

        if not isinstance(edits, list):
            return {
                "applied": [],
                "changed_files": [],
                "errors": [],
            }

        applied: list[dict[str, Any]] = []
        errors: list[dict[str, Any]] = []
        changed_files: set[str] = set()

        for index, edit in enumerate(edits, start=1):
            if not isinstance(edit, dict):
                errors.append(
                    {
                        "index": index,
                        "error": "Edit entry must be a dictionary",
                    }
                )
                continue

            operation = str(edit.get("operation", edit.get("command", ""))).strip().lower()
            path = edit.get("path")
            if not operation or not path:
                errors.append(
                    {
                        "index": index,
                        "error": "Edit requires operation and path",
                        "edit": edit,
                    }
                )
                continue

            try:
                changed = self._apply_operation(operation, str(path), edit)
                changed_files.add(str(changed))
                applied.append(
                    {
                        "index": index,
                        "operation": operation,
                        "path": str(changed),
                    }
                )
            except Exception as exc:
                errors.append(
                    {
                        "index": index,
                        "operation": operation,
                        "path": str(path),
                        "error": str(exc),
                        "error_type": type(exc).__name__,
                    }
                )

        return {
            "applied": applied,
            "changed_files": sorted(changed_files),
            "errors": errors,
        }

    def generate_from_blueprint(
        self,
        task: dict[str, Any],
        architecture: dict[str, Any],
    ) -> dict[str, Any]:
        requested_files = task.get("generate_files")
        if not isinstance(requested_files, list) or not requested_files:
            return {
                "generated": [],
                "changed_files": [],
                "errors": [],
            }

        generated: list[dict[str, Any]] = []
        errors: list[dict[str, Any]] = []
        changed_files: set[str] = set()

        for index, item in enumerate(requested_files, start=1):
            if not isinstance(item, dict):
                errors.append(
                    {
                        "index": index,
                        "error": "generate_files entry must be a dict",
                    }
                )
                continue

            path = str(item.get("path", "")).strip()
            language = str(item.get("language", "")).strip().lower()
            description = str(item.get("description", "")).strip()
            content = item.get("content")

            if not path:
                errors.append(
                    {
                        "index": index,
                        "error": "Generated file entry is missing 'path'",
                    }
                )
                continue

            if not isinstance(content, str):
                content = self._build_stub_content(
                    path=path,
                    language=language,
                    description=description,
                    architecture=architecture,
                )

            try:
                changed = self.editor.write_file(path, content)
                changed_files.add(str(changed))
                generated.append(
                    {
                        "index": index,
                        "path": str(changed),
                        "language": language,
                    }
                )
            except Exception as exc:
                errors.append(
                    {
                        "index": index,
                        "path": path,
                        "error": str(exc),
                        "error_type": type(exc).__name__,
                    }
                )

        return {
            "generated": generated,
            "changed_files": sorted(changed_files),
            "errors": errors,
        }

    def replace_in_file(
        self,
        file_path: str | Path,
        old: str,
        new: str,
        *,
        require_unique: bool = True,
    ) -> Path:
        changed, _count = self.editor.str_replace(
            file_path,
            old,
            new,
            require_unique=require_unique,
        )
        return changed

    def overwrite_file(self, file_path: str | Path, content: str) -> Path:
        return self.editor.write_file(file_path, content)

    def _apply_operation(self, operation: str, path: str, edit: dict[str, Any]) -> Path:
        if operation in {"write", "create"}:
            content = str(edit.get("content", edit.get("file_text", "")))
            return self.editor.write_file(path, content)

        if operation == "append":
            content = str(edit.get("content", ""))
            return self.editor.append_file(path, content)

        if operation in {"str_replace", "replace"}:
            old_str = str(edit.get("old_str", ""))
            new_str = str(edit.get("new_str", ""))
            require_unique = bool(edit.get("require_unique", True))
            changed, _count = self.editor.str_replace(
                path,
                old_str,
                new_str,
                require_unique=require_unique,
            )
            return changed

        if operation == "insert":
            line_value = edit.get("line", edit.get("insert_line", 0))
            line_number = int(line_value)
            content = str(edit.get("content", edit.get("new_str", "")))
            return self.editor.insert(path, line_number, content)

        if operation == "delete":
            return self.editor.delete_file(path)

        raise ValueError(f"Unsupported edit operation: {operation}")

    def _build_stub_content(
        self,
        *,
        path: str,
        language: str,
        description: str,
        architecture: dict[str, Any],
    ) -> str:
        file_name = Path(path).name
        architecture_modules = architecture.get("architecture", {}).get("modules", [])
        module_names = [
            str(item.get("name", "")).strip()
            for item in architecture_modules
            if isinstance(item, dict)
        ]
        module_line = ", ".join(item for item in module_names if item)

        if language in {"python", "py"} or path.endswith(".py"):
            header = [
                '"""Autogenerated by IMPERIUM Coding Agent."""',
                "",
                f"# File: {file_name}",
            ]
            if description:
                header.append(f"# Purpose: {description}")
            if module_line:
                header.append(f"# Related subsystems: {module_line}")
            header.extend(
                [
                    "",
                    "from __future__ import annotations",
                    "",
                    "def main() -> None:",
                    "    pass",
                    "",
                    "if __name__ == \"__main__\":",
                    "    main()",
                    "",
                ]
            )
            return "\n".join(header)

        if language in {"typescript", "ts"} or path.endswith(".ts"):
            lines = [
                "// Autogenerated by IMPERIUM Coding Agent",
                f"// File: {file_name}",
            ]
            if description:
                lines.append(f"// Purpose: {description}")
            lines.extend(
                [
                    "",
                    "export function main(): void {",
                    "  // TODO: implement",
                    "}",
                    "",
                ]
            )
            return "\n".join(lines)

        return ""
