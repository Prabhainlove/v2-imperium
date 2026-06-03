from __future__ import annotations

from typing import Any

from core.security.command_validator import CommandValidator
from core.security.permission_manager import PermissionManager
from core.security.sandbox_controller import SandboxController
from core.security.security_policy_engine import SecurityPolicyEngine


class Security:
    def __init__(
        self,
        *,
        permission_manager: PermissionManager | None = None,
        command_validator: CommandValidator | None = None,
        policy_engine: SecurityPolicyEngine | None = None,
        sandbox_controller: SandboxController | None = None,
    ) -> None:
        self.permission_manager = permission_manager or PermissionManager()
        self.command_validator = command_validator or CommandValidator()
        self.policy_engine = policy_engine or SecurityPolicyEngine()
        self.sandbox_controller = sandbox_controller or SandboxController()

    def validate_action(
        self,
        *,
        command: str,
        actor: str,
        action: str,
        context: dict[str, Any] | None = None,
    ) -> tuple[bool, dict[str, Any]]:
        command_ok, command_message = self.command_validator.validate(command)
        if not command_ok:
            return (False, {"reason": command_message, "type": "command_validation"})

        if not self.enforce_permissions(actor=actor, action=action):
            return (False, {"reason": "permission denied", "type": "permission"})

        policy_context = {
            "command": command,
            "actor": actor,
            "action": action,
            "context": dict(context or {}),
        }
        policy_ok, violations = self.policy_engine.evaluate(policy_context)
        if not policy_ok:
            return (False, {"reason": "policy violation", "violations": violations, "type": "policy"})

        return (True, {"reason": "ok"})

    def enforce_permissions(self, *, actor: str, action: str) -> bool:
        return self.permission_manager.has_permission(actor, action)

    def shutdown(self) -> None:
        self.sandbox_controller.shutdown()
